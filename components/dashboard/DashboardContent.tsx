'use client'

import { useState } from 'react'
import FileList from './FileList'
import UploadSection from './UploadSection'

export default function DashboardContent() {
  const [fileListVersion, setFileListVersion] = useState(0)

  return (
    <>
      <UploadSection
        onUploadSuccess={() => setFileListVersion((version) => version + 1)}
      />

      <div className="mt-12">
        <h3 className="text-xl font-semibold mb-4">我的文件</h3>
        <FileList refreshKey={fileListVersion} />
      </div>
    </>
  )
}
