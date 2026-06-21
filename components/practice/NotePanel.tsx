'use client'

import { useState } from 'react'

interface Note {
  id: string
  text: string
  content: string
}

interface NotePanelProps {
  notes: Note[]
  onClose: () => void
  onDelete: (id: string) => void
  onUpdate: (id: string, content: string) => void
}

export default function NotePanel({ notes, onClose, onDelete, onUpdate }: NotePanelProps) {
  const [activeNote, setActiveNote] = useState(notes[0]?.id || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const currentNote = notes.find(n => n.id === activeNote)

  const handleDelete = () => {
    if (activeNote) {
      onDelete(activeNote)
      setShowDeleteConfirm(false)
      setActiveNote(notes.filter(n => n.id !== activeNote)[0]?.id || '')
    }
  }

  return (
    <div className="w-1/3 border-l border-gray-200 bg-white flex flex-col">
      {/* 头部 */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">NOTE</h3>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 笔记内容 */}
      {currentNote ? (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-blue-50 p-4 rounded mb-4">
            <div className="font-semibold mb-2">
              Part 1 <span className="text-blue-600">{currentNote.text}</span>
            </div>
          </div>

          <textarea
            placeholder="Record ideas"
            value={currentNote.content}
            onChange={(e) => onUpdate(currentNote.id, e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          {showDeleteConfirm ? (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <p className="text-sm text-blue-800 mb-4">DO YOU WANT TO DELETE THE NOTE?</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-100 rounded transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
                >
                  DELETE
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              DELETE
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No notes yet
        </div>
      )}
    </div>
  )
}
