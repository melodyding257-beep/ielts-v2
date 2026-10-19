import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pdfDeleteSchema } from '@/lib/utils/validators'
import { getErrorMessage } from '@/lib/utils/errors'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = pdfDeleteSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ error: '无效的文件编号' }, { status: 400 })
    }
    const { pdfId } = body.data

    // 查文件信息（同时验证归属权）
    const { data: pdf, error: fetchErr } = await supabase
      .from('pdfs')
      .select('id, file_path')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !pdf) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete either a legacy single path or a JSON-encoded image batch.
    if (pdf.file_path) {
      let storagePaths = [pdf.file_path]
      try {
        const parsedPaths: unknown = JSON.parse(pdf.file_path)
        if (Array.isArray(parsedPaths) && parsedPaths.every((path) => typeof path === 'string')) {
          storagePaths = parsedPaths
        }
      } catch {
        // Legacy records store a plain path rather than JSON.
      }

      const { error: storageErr } = await supabase.storage
        .from('pdfs')
        .remove(storagePaths)
      if (storageErr) throw storageErr
    }

    // 删 practice_records（若无 CASCADE 则手动删）
    const { error: recordsError } = await supabase
      .from('practice_records')
      .delete()
      .eq('pdf_id', pdfId)
      .eq('user_id', user.id)
    if (recordsError) throw recordsError

    // 删 pdfs 记录
    const { error: deleteErr } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', pdfId)
      .eq('user_id', user.id)

    if (deleteErr) throw deleteErr

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Delete PDF error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, '删除失败，请重试') },
      { status: 500 }
    )
  }
}
