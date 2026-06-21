import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户的 PDF 列表
    const { data: pdfs, error } = await supabase
      .from('pdfs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ pdfs })
  } catch (error: any) {
    console.error('List PDFs error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch PDFs' },
      { status: 500 }
    )
  }
}
