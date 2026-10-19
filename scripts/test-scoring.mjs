import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateScore } from '../lib/utils/practiceHelpers.ts'

const questions = [
  { id: '1', type: 'fill_blank' },
  { id: '2-3', type: 'choice_multi' },
  { id: '4-5', type: 'fill_blank_summary' },
  { id: '6', type: 'matching_list', sharedOptions: ['A. One person', 'B. Another person'] },
]
const correct = { '1': 'apple', '2': 'A', '3': 'C', '4': 'one', '5': 'two', '6': 'B' }

test('normal answers keep fill-in, multi-select, summary and matching scoring', () => {
  assert.deepEqual(calculateScore(questions, { '1': ' Apple ', '2-3': ['C', 'A'], '4': 'one', '5': 'two', '6': 'Another person' }, correct), { correct_count: 6, total_count: 6 })
})

test('wrong answer shapes do not crash or receive marks', () => {
  assert.deepEqual(calculateScore(questions, { '1': ['apple'], '2-3': 'A', '4': ['one'], '5': ['two'], '6': ['B'] }, correct), { correct_count: 0, total_count: 6 })
})

test('unattempted questions and an incomplete multi-selection remain incorrect', () => {
  assert.deepEqual(calculateScore(questions, { '2-3': ['A'] }, correct), { correct_count: 0, total_count: 6 })
})
