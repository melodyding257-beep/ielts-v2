export function getErrorMessage(error: unknown, fallback = '请求失败，请重试'): string {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error &&
      typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}
