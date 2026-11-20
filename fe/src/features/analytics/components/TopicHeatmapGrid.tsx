import { EmptyState } from '@/shared/components'
import { BAND_STYLE, rateBand, SKILL_LABEL } from '../lib/labels'
import type { TopicHeatmap } from '../types'

/** Topic × skill grid: % correct of first attempts in the period. */
export function TopicHeatmapGrid({ data }: { data: TopicHeatmap }) {
  if (data.cells.length === 0) {
    return <EmptyState emoji="🌱" title="Chưa có bài làm nào trong khoảng thời gian này" />
  }
  const byKey = new Map(data.cells.map((c) => [`${c.topic}\u0000${c.skill}`, c]))
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface">
        <table className="w-full min-w-[480px] border-separate border-spacing-1 p-1 text-center">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface px-3 py-2 text-left text-sm text-ink-soft">Chủ đề</th>
              {data.skills.map((s) => (
                <th key={s} className="px-3 py-2 text-sm text-ink-soft">
                  {SKILL_LABEL[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topics.map((topic) => (
              <tr key={topic}>
                <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-bold">
                  {topic}
                </th>
                {data.skills.map((skill) => {
                  const cell = byKey.get(`${topic}\u0000${skill}`)
                  if (!cell) {
                    return (
                      <td key={skill} className="rounded-xl border-2 border-dashed border-line text-sm text-ink-soft">
                        —
                      </td>
                    )
                  }
                  const style = BAND_STYLE[rateBand(cell.correctRate)]
                  const thin = cell.answered < data.minAnswers
                  return (
                    <td
                      key={skill}
                      title={`${topic} · ${SKILL_LABEL[skill]}: ${cell.correctRate}% đúng / ${cell.answered} câu trả lời`}
                      className={`min-w-24 rounded-xl border-2 px-2 py-2 ${style.cell} ${thin ? 'opacity-45' : ''}`}
                    >
                      <span className={`block font-display text-xl font-extrabold ${style.text}`}>
                        <span aria-hidden className="mr-1 text-xs">
                          {style.icon}
                        </span>
                        {cell.correctRate}%
                      </span>
                      <span className="block text-xs font-semibold text-ink-soft">
                        {cell.answered} câu{thin ? ' · ít dữ liệu' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend minAnswers={data.minAnswers} />
    </div>
  )
}

export function HeatLegend({ minAnswers }: { minAnswers?: number }) {
  const items = [
    { band: 'low' as const, label: 'Dưới 50% đúng' },
    { band: 'mid' as const, label: '50–79%' },
    { band: 'high' as const, label: 'Từ 80%' },
  ]
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink-soft">
      {items.map((i) => (
        <span key={i.band} className="inline-flex items-center gap-1">
          <span className={`inline-block size-4 rounded border-2 ${BAND_STYLE[i.band].cell}`} aria-hidden />
          {BAND_STYLE[i.band].icon} {i.label}
        </span>
      ))}
      {minAnswers ? <span>Ô mờ: ít hơn {minAnswers} câu trả lời, chưa đủ để kết luận.</span> : null}
    </div>
  )
}
