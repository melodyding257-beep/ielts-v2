interface TimerProps {
  seconds: number
}

export default function Timer({ seconds: totalSeconds }: TimerProps) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <span>
      {minutes} minute{minutes !== 1 ? 's' : ''}, {seconds} second{seconds !== 1 ? 's' : ''}
    </span>
  )
}
