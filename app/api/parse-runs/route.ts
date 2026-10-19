import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseTimingSchema, uuidSchema } from '@/lib/utils/validators'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const runId = request.nextUrl.searchParams.get('runId')
    if (runId) {
      if (!uuidSchema.safeParse(runId).success) {
        return NextResponse.json({ error: '无效的解析运行编号' }, { status: 400 })
      }
      const { data, error } = await supabase
        .from('parse_runs')
        .select('run_id,raw_output,normalized_output,validation_report')
        .eq('user_id', user.id)
        .eq('run_id', runId)
        .single()
      if (error) throw error
      return NextResponse.json({ run: data })
    }

    const { data, error } = await supabase
      .from('parse_runs')
      .select('id,pdf_id,run_id,file_hash,file_name,model,parser_version,prompt_version,status,answer_status,page_count,question_count,retry_count,timings,validation_report,normalized_output,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      if (/parse_runs|schema cache|does not exist/i.test(error.message)) {
        return NextResponse.json(
          { error: '解析运行表尚未创建，请先执行 Supabase migration：202609150001_parse_runs.sql' },
          { status: 503 }
        )
      }
      throw error
    }
    return NextResponse.json({ runs: data ?? [] })
  } catch (error: unknown) {
    console.error('List parse runs error:', error)
    return NextResponse.json({ error: getErrorMessage(error, '读取解析记录失败') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = parseTimingSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ error: '无效的耗时记录' }, { status: 400 })
    }
    const { runId, endToEndMs } = body.data

    const { data: existing, error: readError } = await supabase
      .from('parse_runs')
      .select('timings')
      .eq('user_id', user.id)
      .eq('run_id', runId)
      .single()
    if (readError) throw readError

    const { error: updateError } = await supabase
      .from('parse_runs')
      .update({ timings: { ...(existing?.timings ?? {}), endToEndMs: Math.round(endToEndMs) } })
      .eq('user_id', user.id)
      .eq('run_id', runId)
    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Update parse timing error:', error)
    return NextResponse.json({ error: getErrorMessage(error, '更新时间失败') }, { status: 500 })
  }
}
