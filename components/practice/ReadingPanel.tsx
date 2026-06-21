'use client'

import { useState } from 'react'

interface ReadingPanelProps {
  title: string
  content: any
  highlights: Array<{ id: string; text: string; color: string }>
  notes: Array<{ id: string; text: string; content: string }>
  onHighlight: (text: string) => void
  onNote: (text: string) => void
  onClearHighlight: (id: string) => void
}

export default function ReadingPanel({
  title,
  content,
  highlights,
  notes,
  onHighlight,
  onNote,
  onClearHighlight,
}: ReadingPanelProps) {
  const [selectedText, setSelectedText] = useState('')
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [contextHighlightId, setContextHighlightId] = useState<string | null>(null)

  // 处理文本选择
  const handleMouseUp = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()

    if (text && text.length > 0) {
      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()

      if (rect) {
        setSelectedText(text)
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

  // 提取文章文本（使用后端解析的 article）
  const articleText = content?.article || 'No content available'

  // 按 \n\n 分段（PDF 原始段落）
  const paragraphs = articleText
    .split('\n\n')
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0)

  return (
    <div
      className="h-full overflow-y-auto p-8"
      onMouseUp={handleMouseUp}
      onClick={() => {
        setMenuPosition(null)
        setContextMenuPosition(null)
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-8">{title}</h1>

      <div className="prose max-w-none">
        <div>
          {paragraphs.map((para: string, idx: number) => (
            <p key={idx} className="mb-6 whitespace-pre-wrap leading-7 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* 选择菜单 */}
      {menuPosition && (
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
              onNote(selectedText)
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
