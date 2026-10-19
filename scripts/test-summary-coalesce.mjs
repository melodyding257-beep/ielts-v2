import assert from 'node:assert/strict'
import test from 'node:test'
import { coalesceSummaryQuestions, parseSummaryText } from '../lib/utils/practiceHelpers.ts'

const sectionTitle = 'Questions 22–26'
const direction = 'Complete the summary below.'
const fragments = [
  'Stress: its effects and how to reduce it 22 _______ Statistics on workers’ compensation show that people take more time off work due to stress than for any other 22 _______ at work.',
  'On average, workers who take time off because of stress stay away for 23 _______. _____',
  'This absence comes at a high price 24 _______ while the number of insurance claims due to stress amount to only 24 _______ of the total.',
  'Experts believe that seeking to relieve stress through physical therapies such as sport or 25 _______ may be less effective than simply reviewing your',
  'may be less effective than simply reviewing your 26 _______.',
]
const questions = fragments.map((text, index) => ({
  id: String(index + 22),
  sectionTitle,
  direction,
  type: 'fill_blank',
  text,
  options: null,
  sharedOptions: null,
  selectCount: 1,
}))

test('split summary becomes one continuous exercise with one box per number', () => {
  const [summary] = coalesceSummaryQuestions(questions)
  assert.equal(summary.id, '22-26')
  assert.equal(summary.type, 'fill_blank_summary')
  assert.equal(summary.contentBlocks, null)
  assert.deepEqual(parseSummaryText(summary.text).map((part) => part.id).filter(Boolean), ['22', '23', '24', '25', '26'])
  assert.doesNotMatch(parseSummaryText(summary.text).map((part) => part.before).join(''), /_{3,}/)
  assert.match(summary.text, /any other 22 _______ at work/)
  assert.match(summary.text, /only 24 _______ of the total/)
  assert.doesNotMatch(summary.text, /reduce it 22 _______/)
  assert.doesNotMatch(summary.text, /price 24 _______/)
  assert.equal((summary.text.match(/may be less effective than simply reviewing your/g) ?? []).length, 1)
})

test('independent fill-in questions are not grouped', () => {
  const independent = questions.map((question) => ({ ...question, direction: 'Complete the sentence.' }))
  assert.deepEqual(coalesceSummaryQuestions(independent), independent)
})

test('summary still groups when only the first item carries the section heading', () => {
  const sparse = questions.map((question, index) => index === 0
    ? question
    : { ...question, sectionTitle: '', direction: '' })
  assert.equal(coalesceSummaryQuestions(sparse).length, 1)
})

test('an already complete summary fragment is preferred over repeated snippets', () => {
  const complete = 'A 22 _______ B 23 _______ C 24 _______ D 25 _______ E 26 _______.'
  const mixed = questions.map((question, index) => index === 0 ? { ...question, text: complete } : question)
  const [summary] = coalesceSummaryQuestions(mixed)
  assert.equal(summary.text, complete)
})
