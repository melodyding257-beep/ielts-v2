import assert from 'node:assert/strict'
import test from 'node:test'
import { getParserConfig } from '../lib/server/parser-config.ts'

function withEnv(values, check) {
  const keys = ['NODE_ENV', 'BACKEND_URL', 'PARSER_TIMEOUT_MS']
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  try {
    for (const key of keys) {
      if (values[key] === undefined) delete process.env[key]
      else process.env[key] = values[key]
    }
    check()
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('local parsing has a default backend and production requires an explicit address', () => {
  withEnv({ NODE_ENV: 'development' }, () => {
    assert.deepEqual(getParserConfig(), { url: 'http://localhost:8000', timeoutMs: 420000 })
  })
  withEnv({ NODE_ENV: 'production' }, () => assert.throws(getParserConfig, /BACKEND_URL/))
})

test('production accepts an upstream path and normalizes whitespace and trailing slash', () => {
  withEnv({ NODE_ENV: 'production', BACKEND_URL: ' https://parser.example/api/ ', PARSER_TIMEOUT_MS: '10000' }, () => {
    assert.deepEqual(getParserConfig(), { url: 'https://parser.example/api', timeoutMs: 10000 })
  })
})

test('invalid parser addresses and timeouts fail before an upstream request', () => {
  for (const url of ['invalid', 'file:///tmp/parser', 'https://example.com?token=x', 'https://example.com#parse']) {
    withEnv({ BACKEND_URL: url }, () => assert.throws(getParserConfig))
  }
  for (const timeout of ['-1', '0', '1.5', 'bad']) {
    withEnv({ BACKEND_URL: 'http://localhost:8000', PARSER_TIMEOUT_MS: timeout }, () => assert.throws(getParserConfig, /PARSER_TIMEOUT_MS/))
  }
})
