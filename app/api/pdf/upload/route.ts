import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/utils/errors'
import { getParserConfig } from '@/lib/server/parser-config'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp'])

function extensionOf(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^\w\s\-.]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\x00-\x7F]/g, '')
}

export async function POST(request: NextRequest) {
  const nextStartedAt = performance.now()
  const uploadedPaths: string[] = []

  try {
    const supabase = await createClient()
    let user
    const formData = await request.formData()
    const guestMode = formData.get('guestMode') === 'true'
    if (!guestMode) {
      try {
        const result = await supabase.auth.getUser()
        // 游客没有 Supabase session 是正常状态，不应阻断仅临时解析流程。
        if (result.error && !/auth session missing/i.test(result.error.message)) {
          throw result.error
        }
        user = result.data.user
      } catch (authError: unknown) {
        const message = getErrorMessage(authError)
        if (/fetch failed|network|socket|ECONN|TLS|timeout/i.test(message)) {
          return NextResponse.json(
            { error: 'Supabase unavailable', detail: '无法连接 Supabase 认证服务，请稍后重试' },
            { status: 503 }
          )
        }
        throw authError
      }
    }

    if (!guestMode && !user) {
      return NextResponse.json({ error: '登录已失效，请重新登录或返回首页使用游客模式' }, { status: 401 })
    }

    // 显式游客请求跳过远程认证检查，仅在本次请求内返回解析结果。
    let files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
    const legacyFile = formData.get('file')
    if (files.length === 0 && legacyFile instanceof File) files = [legacyFile]

    if (files.length === 0) {
      return NextResponse.json({ error: '请选择一个 PDF 或至少一张图片' }, { status: 400 })
    }

    const pdfFiles = files.filter((file) => extensionOf(file.name) === 'pdf')
    const imageFiles = files.filter((file) => IMAGE_EXTENSIONS.has(extensionOf(file.name)))
    const isSinglePdf = files.length === 1 && pdfFiles.length === 1
    const isImageBatch = imageFiles.length === files.length

    if (!isSinglePdf && !isImageBatch) {
      return NextResponse.json(
        { error: '一次只能上传一个 PDF，或上传一组属于同一篇阅读的图片；不能混合上传' },
        { status: 400 }
      )
    }

    if (isImageBatch && files.length > 10) {
      return NextResponse.json({ error: '一次最多上传 10 张图片' }, { status: 400 })
    }

    if (isImageBatch) {
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }

    console.info(
      `[pdf/upload] received ${files.length} file(s)`
    )

    let parserConfig
    try {
      parserConfig = getParserConfig()
    } catch (configError) {
      console.error('Parser configuration error:', getErrorMessage(configError))
      return NextResponse.json({ error: '解析服务配置尚未就绪，请联系管理员' }, { status: 503 })
    }
    const parseFormData = new FormData()
    for (const file of files) {
      parseFormData.append('files', file, file.name)
    }
    console.info('[pdf/upload] forwarding batch to parser')
    const parseStartedAt = performance.now()
    const parseResponse = await fetch(`${parserConfig.url}/parse`, {
      method: 'POST',
      body: parseFormData,
      signal: AbortSignal.timeout(parserConfig.timeoutMs),
    })
    const backendRoundTripMs = Math.round(performance.now() - parseStartedAt)
    const parsePayload = await parseResponse.json().catch(() => null)

    if (!parseResponse.ok) {
      const detail = parsePayload?.detail
      const failureMeta = detail?.parseMeta
      const failureTimings = {
        ...(detail?.timing ?? {}),
        backendRoundTripMs,
        nextPipelineMs: Math.round(performance.now() - nextStartedAt),
      }
      let parseRunStored = false

      if (user && failureMeta?.runId && failureMeta?.fileHash) {
        const { error: runError } = await supabase.from('parse_runs').insert({
          user_id: user.id,
          pdf_id: null,
          run_id: failureMeta.runId,
          file_hash: failureMeta.fileHash,
          file_name: files[0].name,
          model: failureMeta.model ?? 'unknown',
          parser_version: failureMeta.parserVersion ?? 'unknown',
          prompt_version: failureMeta.promptVersion ?? 'unknown',
          status: 'failed',
          answer_status: detail?.answerStatus ?? 'uncertain',
          page_count: detail?.pageCount ?? 0,
          question_count: detail?.questionCount ?? detail?.validation?.expectedQuestionIds?.length ?? 0,
          retry_count: failureMeta.retryCount ?? 0,
          timings: failureTimings,
          validation_report: detail?.validation ?? {},
          raw_output: failureMeta.rawModelOutput ?? {},
          normalized_output: detail?.normalizedOutput ?? {},
        })
        if (runError) console.warn('Failed parse run could not be stored:', runError.message)
        else parseRunStored = true
      }

      const validationErrors = Array.isArray(detail?.validation?.errors)
        ? detail.validation.errors.join('；')
        : ''
      const message = typeof detail === 'string'
        ? detail
        : detail?.message || `解析接口返回 ${parseResponse.status}`
      return NextResponse.json(
        {
          error: validationErrors ? `${message}：${validationErrors}` : message,
          validation: detail?.validation,
          timing: failureTimings,
          parseRunId: failureMeta?.runId ?? null,
          parseRunStored,
        },
        { status: parseResponse.status }
      )
    }

    if (!parsePayload || typeof parsePayload !== 'object') {
      return NextResponse.json(
        { error: '解析服务返回了无效数据，请查看后端日志' },
        { status: 502 }
      )
    }

    const parsedData = parsePayload
    console.info(`[pdf/upload] parser completed with ${parsedData.questions?.length ?? 0} questions`)

    const storageStartedAt = performance.now()
    const batchId = Date.now()
    if (user) for (const [index, file] of files.entries()) {
      const sanitizedName = sanitizeFileName(file.name)
      const fallbackName = isSinglePdf ? 'document.pdf' : `page-${index + 1}.png`
      const storagePath = `${user.id}/${batchId}_${index + 1}_${sanitizedName || fallbackName}`
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(storagePath, await file.arrayBuffer(), {
          contentType: file.type || (isSinglePdf ? 'application/pdf' : 'application/octet-stream'),
        })

      if (uploadError) throw uploadError
      uploadedPaths.push(storagePath)
    }
    const storageMs = Math.round(performance.now() - storageStartedAt)

    const parsedTitle = typeof parsedData.title === 'string' ? parsedData.title.trim() : ''
    const displayName = parsedTitle || files[0].name
    const parseMeta = parsedData.parseMeta ?? {}
    const { rawModelOutput = {}, ...publicParseMeta } = parseMeta
    const parsedForStorage = { ...parsedData, parseMeta: publicParseMeta }

    const databaseStartedAt = performance.now()
    const { data: pdfData, error: dbError } = user ? await supabase
      .from('pdfs')
      .insert({
        user_id: user.id,
        file_name: displayName,
        file_path: uploadedPaths.length === 1 ? uploadedPaths[0] : JSON.stringify(uploadedPaths),
        parsed_content: JSON.stringify(parsedForStorage),
      })
      .select()
      .single() : { data: null, error: null }

    if (dbError) throw dbError

    const databaseMsBeforeRun = Math.round(performance.now() - databaseStartedAt)
    const timings = {
      ...(parseMeta.timing ?? {}),
      backendRoundTripMs,
      storageMs,
      databaseMs: databaseMsBeforeRun,
      nextPipelineMs: Math.round(performance.now() - nextStartedAt),
    }

    let parseRunStored = false
    if (user && pdfData && parseMeta.runId && parseMeta.fileHash) {
      const { error: runError } = await supabase.from('parse_runs').insert({
        user_id: user.id,
        pdf_id: pdfData.id,
        run_id: parseMeta.runId,
        file_hash: parseMeta.fileHash,
        file_name: displayName,
        model: parseMeta.model ?? 'unknown',
        parser_version: parseMeta.parserVersion ?? 'unknown',
        prompt_version: parseMeta.promptVersion ?? 'unknown',
        status: parseMeta.validation?.status ?? 'failed',
        answer_status: parsedData.answerStatus ?? 'none',
        page_count: parsedData.total_pages ?? parsedData.pages?.length ?? 0,
        question_count: parsedData.questions?.length ?? 0,
        retry_count: parseMeta.retryCount ?? 0,
        timings,
        validation_report: parseMeta.validation ?? {},
        raw_output: rawModelOutput,
        normalized_output: parsedForStorage,
      })

      if (runError) {
        // Keep uploads usable before the optional migration has been applied.
        console.warn('Parse run could not be stored:', runError.message)
      } else {
        parseRunStored = true
      }
    }

    return NextResponse.json({
      success: true,
      pdf: pdfData,
      parsed: parsedForStorage,
      parseRunId: parseMeta.runId ?? null,
      parseRunStored,
      timing: timings,
    })
  } catch (error: unknown) {
    console.error('Upload error:', error)

    if (uploadedPaths.length > 0) {
      try {
        const supabase = await createClient()
        await supabase.storage.from('pdfs').remove(uploadedPaths)
      } catch (cleanupError) {
        console.warn('Storage rollback failed:', cleanupError)
      }
    }

    return NextResponse.json(
      { error: getErrorMessage(error, '文件上传失败，请重试') },
      { status: 500 }
    )
  }
}
