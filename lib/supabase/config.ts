export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || url === 'your-supabase-url') {
    throw new Error('请配置 NEXT_PUBLIC_SUPABASE_URL，再重新启动或构建网站')
  }
  if (!key || key === 'your-supabase-anon-key') {
    throw new Error('请配置 NEXT_PUBLIC_SUPABASE_ANON_KEY，再重新启动或构建网站')
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 必须是有效的 HTTP 或 HTTPS 地址')
  }
  return { url, key }
}
