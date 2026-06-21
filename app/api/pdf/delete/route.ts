import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pdfId } = await request.json()
    if (!pdfId) {
      return NextResponse.json({ error: 'pdfId required' }, { status: 400 })
    }

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

    // 删 Storage 文件
    if (pdf.file_path) {
      const { error: storageErr } = await supabase.storage
        .from('pdfs')
        .remove([pdf.file_path])
      if (storageErr) {
        console.warn('Storage delete error (non-fatal):', storageErr.message)
      }
    }

    // 删 practice_records（若无 CASCADE 则手动删）
    await supabase
      .from('practice_records')
      .delete()
      .eq('pdf_id', pdfId)

    // 删 pdfs 记录
    const { error: deleteErr } = await supabase
      .from('pdfs')
      .delete()
      .eq('id', pdfId)
      .eq('user_id', user.id)

    if (deleteErr) throw deleteErr

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete PDF error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete' },
      { status: 500 }
    )
  }
}
