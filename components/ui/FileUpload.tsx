'use client'

import { ChangeEvent } from 'react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
}

export default function FileUpload({
  onFileSelect,
  accept = '.pdf',
}: FileUploadProps) {
  // 文件上传组件
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer text-blue-600 hover:text-blue-700"
      >
        点击上传 PDF 文件
      </label>
    </div>
  )
}
