import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PracticeClient from './PracticeClient'

interface PracticePageProps {
  params: Promise<{ id: string }>
}

export default async function PracticePage({ params }: PracticePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: pdf, error } = await supabase
    .from('pdfs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !pdf) redirect('/dashboard')

  const { data: record } = await supabase
    .from('practice_records')
    .select('*')
    .eq('user_id', user.id)
    .eq('pdf_id', id)
    .maybeSingle()

  const parsedData = JSON.parse(pdf.parsed_content || '{}')

  return (
    <PracticeClient
      pdfId={pdf.id}
      fileName={pdf.file_name}
      parsedData={parsedData}
      initialRecord={record}
    />
  )
}
