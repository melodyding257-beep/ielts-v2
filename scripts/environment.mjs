import nextEnv from '@next/env'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const NO_PROXY = 'localhost,127.0.0.1,::1,0.0.0.0'
export const PROXY_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY']

export function loadDevelopmentEnv() {
  // Use Next.js precedence, including shell variables and .env.development.local.
  nextEnv.loadEnvConfig(PROJECT_ROOT, true)
}

export function supportsEnvProxy(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number)
  return major >= 24 || (major === 22 && minor >= 21)
}

export function networkEnv(proxy = null, source = process.env) {
  const env = { ...source }
  for (const key of PROXY_KEYS) delete env[key]
  if (proxy) {
    env.NODE_USE_ENV_PROXY = '1'
    env.HTTP_PROXY = proxy
    env.HTTPS_PROXY = proxy
    env.NO_PROXY = NO_PROXY
    env.no_proxy = NO_PROXY
  }
  return env
}
