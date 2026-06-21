// 应用通用类型定义

export interface PdfDocument {
  id: string
  userId: string
  fileName: string
  filePath: string
  parsedContent: string | null
  createdAt: string
}

export interface PracticeRecord {
  id: string
  userId: string
  pdfId: string
  answers: Record<string, string>
  score: number | null
  timeSpent: number
  createdAt: string
}

export interface ParsedPdfContent {
  text: string
  questions?: Question[]
}

export interface Question {
  id: number
  type: 'multiple-choice' | 'true-false-ng' | 'fill-blank' | 'matching'
  question: string
  options?: string[]
  correctAnswer?: string
}

export interface PracticeSession {
  pdfId: string
  startTime: number
  answers: Record<string, string>
}
