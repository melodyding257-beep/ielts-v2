import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // 客户端 Supabase 实例
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
