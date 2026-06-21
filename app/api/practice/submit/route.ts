import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateScore } from '@/lib/utils/practiceHelpers'
import type { BackendQuestion } from '@/lib/utils/practiceHelpers'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pdfId, answers, timeSpent } = await request.json()

    // 取正确答案
    const { data: pdf, error: pdfErr } = await supabase
      .from('pdfs')
      .select('parsed_content')
      .eq('id', pdfId)
      .single()

    if (pdfErr || !pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const parsedContent = JSON.parse(pdf.parsed_content || '{}')
    const correctAnswers: Record<string, string> = parsedContent.answers ?? {}
    const questions: BackendQuestion[] = parsedContent.questions ?? []

    // 判分
    const { correct_count, total_count } = calculateScore(questions, answers, correctAnswers)

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
          correct_count,
          total_count,
          attempt_count,
        },
        { onConflict: 'user_id,pdf_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, record })
  } catch (error: any) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to submit answers' },
      { status: 500 }
    )
  }
}
