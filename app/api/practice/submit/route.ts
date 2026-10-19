import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/utils/practiceHelpers'
import type { BackendQuestion } from '@/lib/utils/practiceHelpers'
import { getErrorMessage } from '@/lib/utils/errors'
import { practiceSubmissionSchema } from '@/lib/utils/validators'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = practiceSubmissionSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return NextResponse.json({ error: '无效的练习提交内容，请检查答案与用时' }, { status: 400 })
    }
    const { pdfId, answers, timeSpent } = body.data

    // 取正确答案
    const { data: pdf, error: pdfErr } = await supabase
      .from('pdfs')
      .select('parsed_content')
      .eq('id', pdfId)
      .eq('user_id', user.id)
      .single()

    if (pdfErr || !pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const parsedContent = JSON.parse(pdf.parsed_content || '{}')
    const correctAnswers: Record<string, string> = parsedContent.answers ?? {}
    const questions: BackendQuestion[] = parsedContent.questions ?? []
    const hasAnswerKey = parsedContent.answerStatus
      ? parsedContent.answerStatus === 'complete'
      : Object.keys(correctAnswers).length > 0

    // 无答案材料仍保存用户作答和用时，但不制造 0/0 或虚假评分。
    const scoring = hasAnswerKey
      ? calculateScore(questions, answers, correctAnswers)
      : { correct_count: null, total_count: null }

    // 查旧记录取 attempt_count
    const { data: existing } = await supabase
      .from('practice_records')
      .select('attempt_count')
      .eq('user_id', user.id)
      .eq('pdf_id', pdfId)
      .maybeSingle()

    const attempt_count = (existing?.attempt_count ?? 0) + 1

    // UPSERT
    const { data: record, error } = await supabase
      .from('practice_records')
      .upsert(
        {
          user_id: user.id,
          pdf_id: pdfId,
          answers,
          time_spent: timeSpent,
          correct_count: scoring.correct_count,
          total_count: scoring.total_count,
          attempt_count,
        },
        { onConflict: 'user_id,pdf_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, record })
  } catch (error: unknown) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, '提交失败，请重试') },
      { status: 500 }
    )
  }
}
