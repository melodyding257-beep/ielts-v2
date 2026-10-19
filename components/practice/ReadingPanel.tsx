'use client'

import { useRef, useState } from 'react'
import type { ArticleBlock, ParsedData } from '@/lib/utils/practiceHelpers'
import { getHighlightSegments, type Highlight, type TextSelection } from '@/lib/utils/highlights'

interface ReadingPanelProps {
  title: string
  content: ParsedData
  highlights: Highlight[]
  onHighlight: (selection: TextSelection) => void
  onNote: (text: string) => void
  onClearHighlight: (id: string) => void
}

export default function ReadingPanel({
  title,
  content,
  highlights,
  onHighlight,
  onNote,
  onClearHighlight,
}: ReadingPanelProps) {
  const articleRef = useRef<HTMLDivElement>(null)
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextHighlightId, setContextHighlightId] = useState<string | null>(null)

  // 处理文本选择
  const handleMouseUp = () => {
    const selection = window.getSelection()
    const root = articleRef.current
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!root || !range || !root.contains(range.commonAncestorContainer)) {
      setMenuPosition(null)
      return
    }
    const rawText = range.toString()
    const text = rawText.trim()

    if (text && text.length > 0) {
      const rect = range.getBoundingClientRect()

      if (rect) {
        const prefix = document.createRange()
        prefix.selectNodeContents(root)
        prefix.setEnd(range.startContainer, range.startOffset)
        const start = prefix.toString().length + rawText.length - rawText.trimStart().length
        setSelectedText({ text, start, end: start + text.length })
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        })
      }
    } else {
      setMenuPosition(null)
    }
  }

  // 处理右键点击高亮文字
  const handleContextMenu = (e: React.MouseEvent, highlightId: string) => {
    e.preventDefault()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextHighlightId(highlightId)
  }

  const articleBlocks: ArticleBlock[] = content.articleBlocks?.length
    ? content.articleBlocks
    : (content.article || 'No content available')
        .split(/\n\s*\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ type: 'paragraph' as const, text }))

  const { offsets: blockOffsets } = articleBlocks.reduce<{ end: number; offsets: number[] }>((previous, block) => {
    const start = previous.end + (block.type === 'bullet' ? 1 : 0)
    const end = start + (block.label?.text?.length ?? 0) +
      (block.runs?.length ? block.runs.reduce((sum, run) => sum + run.text.length, 0) : block.text.length)
    return { end, offsets: [...previous.offsets, start] }
  }, { end: 0, offsets: [] })

  const renderHighlightedText = (text: string, offset: number) =>
    getHighlightSegments(text, offset, highlights).map((segment, index) => segment.highlight ? (
      <mark key={index} data-highlight-id={segment.highlight.id} className="bg-amber-200 text-inherit"
        onContextMenu={(event) => handleContextMenu(event, segment.highlight!.id)}>
        {segment.text}
      </mark>
    ) : <span key={index}>{segment.text}</span>)

  const renderRichText = (block: ArticleBlock, offset: number) => {
    const runs = block.runs?.length
      ? block.runs
      : [{ text: block.text, bold: false, italic: false, underline: false }]

    return (
      <>
        {block.label?.text && (
          <span
            className={`mr-4 inline-block ${block.label.bold ? 'font-bold' : ''} ${block.label.italic ? 'italic' : ''}`}
          >
            {renderHighlightedText(block.label.text, offset)}
          </span>
        )}
        {runs.map((run, index) => {
          const start = offset + (block.label?.text?.length ?? 0) +
            runs.slice(0, index).reduce((sum, previous) => sum + previous.text.length, 0)
          return (
          <span
            key={`${index}-${run.text.slice(0, 12)}`}
            className={`${run.bold ? 'font-bold' : ''} ${run.italic ? 'italic' : ''} ${run.underline ? 'underline' : ''}`}
          >
            {renderHighlightedText(run.text, start)}
          </span>
          )
        })}
      </>
    )
  }

  const alignmentClass = (block: ArticleBlock) => ({
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }[block.alignment ?? 'left'])

  const familyClass = (block: ArticleBlock) => ({
    serif: 'font-serif',
    sans: 'font-sans',
    monospace: 'font-mono',
    unknown: '',
  }[block.fontFamilyRole ?? 'unknown'])

  return (
    <div
      className="h-full overflow-y-auto p-8"
      onMouseUp={handleMouseUp}
      onClick={() => {
        if (!window.getSelection()?.toString().trim()) setMenuPosition(null)
        setContextMenuPosition(null)
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-8">{title}</h1>

      <div className="prose max-w-none">
        <div ref={articleRef}>
          {articleBlocks.map((block, idx) => {
            const sharedClass = `${alignmentClass(block)} ${familyClass(block)}`
            if (block.type === 'heading') {
              return <h2 key={idx} className={`mb-3 mt-7 text-lg font-bold leading-7 first:mt-0 ${sharedClass}`}>{renderRichText(block, blockOffsets[idx])}</h2>
            }
            if (block.type === 'subtitle') {
              return <p key={idx} className={`mb-6 text-lg italic leading-7 ${sharedClass}`}>{renderRichText(block, blockOffsets[idx])}</p>
            }
            if (block.type === 'bullet') {
              return <div key={idx} className={`mb-3 flex items-start gap-3 leading-7 ${sharedClass}`}><span aria-hidden="true">•</span><p className="min-w-0 flex-1">{renderRichText(block, blockOffsets[idx])}</p></div>
            }
            return <p key={idx} className={`mb-6 whitespace-pre-wrap leading-7 last:mb-0 ${sharedClass}`}>{renderRichText(block, blockOffsets[idx])}</p>
          })}
        </div>
      </div>

      {/* 选择菜单 */}
      {menuPosition && selectedText && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg flex"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2 border-r"
            onClick={(e) => {
              e.stopPropagation()
              onNote(selectedText.text)
              setMenuPosition(null)
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Note
          </button>
          <button
            className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation()
              onHighlight(selectedText)
              setMenuPosition(null)
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Highlight
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenuPosition && contextHighlightId && (
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            className="px-4 py-2 hover:bg-gray-100 flex items-center gap-2 w-full text-left"
            onClick={(e) => {
              e.stopPropagation()
              onClearHighlight(contextHighlightId)
              setContextMenuPosition(null)
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Highlight
          </button>
        </div>
      )}
    </div>
  )
}
