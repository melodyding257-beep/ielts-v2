import assert from 'node:assert/strict'
import test from 'node:test'
import { practiceSubmissionSchema, pdfDeleteSchema, parseTimingSchema } from '../lib/utils/validators.ts'
import { getErrorMessage } from '../lib/utils/errors.ts'

const id = '11111111-1111-4111-8111-111111111111'
test('practice submissions support unattempted questions and multi-select answers', () => {
  assert.equal(practiceSubmissionSchema.safeParse({ pdfId: id, answers: { '1': '', '2-3': ['A', 'C'] }, timeSpent: 0 }).success, true)
})
test('malformed IDs, answers and negative or fractional time are rejected', () => {
  for (const changes of [{ pdfId: 'bad' }, { answers: null }, { answers: { '1': 3 } }, { timeSpent: -1 }, { timeSpent: 1.5 }]) {
    assert.equal(practiceSubmissionSchema.safeParse({ pdfId: id, answers: {}, timeSpent: 5, ...changes }).success, false)
  }
  assert.equal(pdfDeleteSchema.safeParse(null).success, false)
  assert.equal(parseTimingSchema.safeParse({ runId: id, endToEndMs: Infinity }).success, false)
})
test('Supabase error objects retain their message and unexpected errors use a readable fallback', () => {
  assert.equal(getErrorMessage({ message: 'Connection failed', code: '503' }), 'Connection failed')
  assert.equal(getErrorMessage({}, '读取失败'), '读取失败')
})
