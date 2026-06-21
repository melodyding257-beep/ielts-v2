'use client'

import { useEffect, useState } from 'react'

interface TimerProps {
  startTime: number
  onTimeUp?: () => void
}

export default function Timer({ startTime, onTimeUp }: TimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = Math.floor((now - startTime) / 1000)
      setElapsed(diff)
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <span>
      {minutes} minute{minutes !== 1 ? 's' : ''}, {seconds} second{seconds !== 1 ? 's' : ''}
    </span>
  )
}
