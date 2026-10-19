export function getParserConfig() {
  const configuredUrl = process.env.BACKEND_URL?.trim()
  const url = configuredUrl || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000')
  if (!url) throw new Error('Production BACKEND_URL is missing')
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash) {
    throw new Error('BACKEND_URL must be an HTTP(S) service address without query parameters')
  }
  const timeoutMs = Number(process.env.PARSER_TIMEOUT_MS || 420000)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('PARSER_TIMEOUT_MS must be a positive integer')
  return { url: url.replace(/\/+$/, ''), timeoutMs }
}
