import assert from 'node:assert/strict'
import test from 'node:test'
import { networkEnv, PROXY_KEYS, NO_PROXY, supportsEnvProxy } from './environment.mjs'

test('direct probes and Next clear inherited proxy settings without changing other variables', () => {
  const source = { KEEP: 'value', ...Object.fromEntries(PROXY_KEYS.map((key) => [key, 'stale'])) }
  const env = networkEnv(null, source)
  assert.equal(env.KEEP, 'value')
  for (const key of PROXY_KEYS) assert.equal(env[key], undefined)
  assert.equal(source.HTTPS_PROXY, 'stale')
})

test('proxy route clears lower-case overrides and bypasses local backend addresses', () => {
  const env = networkEnv('http://127.0.0.1:17891', { https_proxy: 'http://stale:1234', ALL_PROXY: 'stale' })
  assert.equal(env.NODE_USE_ENV_PROXY, '1')
  assert.equal(env.HTTPS_PROXY, 'http://127.0.0.1:17891')
  assert.equal(env.https_proxy, undefined)
  assert.equal(env.ALL_PROXY, undefined)
  assert.equal(env.NO_PROXY, NO_PROXY)
  assert.equal(env.no_proxy, NO_PROXY)
})

test('supports the Node 22 proxy backport as well as Node 24', () => {
  for (const version of ['22.21.0', '22.22.0', '24.0.0', '24.15.0', '26.0.0']) assert.equal(supportsEnvProxy(version), true)
  for (const version of ['20.19.0', '22.20.0', '23.11.0']) assert.equal(supportsEnvProxy(version), false)
})
