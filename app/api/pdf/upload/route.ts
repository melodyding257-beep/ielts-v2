import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 检查今日上传额度（每人每天最多 6 篇）
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('pdfs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())

    if ((count ?? 0) >= 6) {
      return NextResponse.json(
        { error: '今日上传额度已用完（每天最多 6 篇），明天再试吧' },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. 调用 FastAPI 解析 PDF
    const parseFormData = new FormData()
    parseFormData.append('file', file)

    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8000'
    const parseResponse = await fetch(`${backendUrl}/parse`, {
      method: 'POST',
      body: parseFormData,
    })

    if (!parseResponse.ok) {
      throw new Error('Failed to parse PDF')
    }

    const parsedData = await parseResponse.json()

    // 2. 上传原文件到 Supabase Storage
    const fileBuffer = await file.arrayBuffer()

    // 清理文件名：移除特殊字符，替换空格和中文
    const sanitizedName = file.name
      .replace(/[^\w\s\-\.]/g, '') // 移除特殊字符（保留字母数字-_.）
      .replace(/\s+/g, '_') // 空格替换为下划线
      .replace(/[^\x00-\x7F]/g, '') // 移除非 ASCII 字符（包括中文）

    const fileName = `${user.id}/${Date.now()}_${sanitizedName || 'document.pdf'}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
      })

    if (uploadError) {
      throw uploadError
    }

    // 3. 保存到数据库
    const { data: pdfData, error: dbError } = await supabase
      .from('pdfs')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: uploadData.path,
        parsed_content: JSON.stringify(parsedData),
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({
      success: true,
      pdf: pdfData,
      parsed: parsedData
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload PDF' },
      { status: 500 }
    )
  }
}
