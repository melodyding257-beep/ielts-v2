export interface TextSelection {
  text: string
  start: number
  end: number
}

export interface Highlight extends TextSelection {
  id: string
  color: string
}

export function getHighlightSegments(text: string, offset: number, highlights: Highlight[]) {
  const relevant = highlights.filter((highlight) => highlight.start < offset + text.length && highlight.end > offset)
  const cuts = new Set([0, text.length])
  for (const highlight of relevant) {
    cuts.add(Math.max(0, highlight.start - offset))
    cuts.add(Math.min(text.length, highlight.end - offset))
  }
  const positions = [...cuts].sort((a, b) => a - b)
  return positions.slice(0, -1).map((start, index) => {
    const end = positions[index + 1]
    const highlight = [...relevant].reverse().find((item) => item.start <= offset + start && item.end >= offset + end)
    return { text: text.slice(start, end), highlight }
  })
}
