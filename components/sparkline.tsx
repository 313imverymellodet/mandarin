interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  className?: string
}

/**
 * Minimal inline sparkline for an edge series. Colored by overall direction —
 * green when the edge is rising (converging toward an arb), red when falling.
 */
export function Sparkline({ data, width = 52, height = 16, className }: SparklineProps) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground/60">—</span>

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  const rising = data[data.length - 1] >= data[0]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`${rising ? "text-green-500" : "text-red-500"} ${className ?? ""}`}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
