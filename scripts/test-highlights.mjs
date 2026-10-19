import assert from 'node:assert/strict'
import test from 'node:test'
import { getHighlightSegments } from '../lib/utils/highlights.ts'

const highlight = (start, end, id = 'one') => ({ start, end, id, text: '', color: 'brown' })

test('selecting repeated text highlights only the selected occurrence', () => {
  const segments = getHighlightSegments('same same', 0, [highlight(5, 9)])
  assert.deepEqual(segments.map((segment) => [segment.text, segment.highlight?.id]), [['same ', undefined], ['same', 'one']])
})
test('a selection across rich-text runs is clipped independently in each run', () => {
  const highlights = [highlight(3, 8)]
  const segments = [...getHighlightSegments('abcde', 0, highlights), ...getHighlightSegments('fghij', 5, highlights)]
  assert.equal(segments.filter((segment) => segment.highlight).map((segment) => segment.text).join(''), 'defgh')
  assert.equal(segments.map((segment) => segment.text).join(''), 'abcdefghij')
})
test('removing an overlapping highlight restores the earlier selection', () => {
  const first = highlight(0, 6)
  const later = highlight(2, 4, 'two')
  assert.deepEqual(getHighlightSegments('abcdef', 0, [first, later]).map((segment) => segment.highlight?.id), ['one', 'two', 'one'])
  assert.deepEqual(getHighlightSegments('abcdef', 0, [first]).map((segment) => segment.highlight?.id), ['one'])
})
