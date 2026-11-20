import type { StudentReport } from '../types'

const W = 560
const H = 180
const PAD = { left: 32, right: 12, top: 14, bottom: 30 }

const weekLabel = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

/** Weekly average score (8 weeks) as an inline SVG line; gaps where no attempt. */
export function TrendChart({ weeks }: { weeks: StudentReport['weeklyTrend'] }) {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (weeks.length <= 1 ? innerW / 2 : (i * innerW) / (weeks.length - 1))
  const y = (score: number) => PAD.top + innerH - (score / 100) * innerH

  // Line segments only between consecutive weeks that both have data.
  const segments: string[] = []
  weeks.forEach((w, i) => {
    const prev = weeks[i - 1]
    if (i > 0 && prev.averageScore !== null && w.averageScore !== null) {
      segments.push(`M${x(i - 1)},${y(prev.averageScore)} L${x(i)},${y(w.averageScore)}`)
    }
  })

  const summary = weeks
    .map((w) => `${weekLabel.format(new Date(w.weekStart))}: ${w.averageScore ?? 'không làm bài'}`)
    .join('; ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Điểm trung bình theo tuần. ${summary}`}>
      {[0, 60, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            className={v === 60 ? 'stroke-grass' : 'stroke-line'}
            strokeDasharray={v === 60 ? '4 4' : undefined}
          />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-soft text-[10px] font-bold">
            {v}
          </text>
        </g>
      ))}
      <path d={segments.join(' ')} className="fill-none stroke-brand" strokeWidth={3} strokeLinecap="round" />
      {weeks.map((w, i) => (
        <g key={w.weekStart}>
          {w.averageScore !== null ? (
            <>
              <circle cx={x(i)} cy={y(w.averageScore)} r={5} className="fill-brand stroke-white" strokeWidth={2} />
              <text x={x(i)} y={y(w.averageScore) - 9} textAnchor="middle" className="fill-ink text-[11px] font-extrabold">
                {w.averageScore}
              </text>
            </>
          ) : (
            <circle cx={x(i)} cy={y(0)} r={3} className="fill-line" />
          )}
          <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-soft text-[10px] font-semibold">
            {weekLabel.format(new Date(w.weekStart))}
          </text>
        </g>
      ))}
    </svg>
  )
}
