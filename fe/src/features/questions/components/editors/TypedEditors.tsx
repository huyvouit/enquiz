import { useState } from 'react'
import { Button, Input, Toggle } from '@/shared/components'
import { QUESTION_LIMITS } from '../../types'
import { ChipsInput } from './ChipsInput'

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Fill in the blank: accepted answers (any spelling counts as correct) and an
 * optional word bank so young children tap a word instead of typing.
 */
export function FillBlankEditor({
  accepted,
  useBank,
  bank,
  onChange,
}: {
  accepted: string[]
  useBank: boolean
  bank: string[]
  onChange: (next: { accepted?: string[]; useBank?: boolean; bank?: string[] }) => void
}) {
  const bankHasAnswer = accepted.some((a) => bank.some((b) => norm(a) === norm(b)))
  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border-2 border-line p-4">
      <legend className="px-1 text-sm font-bold">Đáp án điền vào chỗ trống</legend>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Đáp án được chấp nhận (1–{QUESTION_LIMITS.maxAcceptedAnswers})</span>
        <ChipsInput
          values={accepted}
          onChange={(v) => onChange({ accepted: v })}
          max={QUESTION_LIMITS.maxAcceptedAnswers}
          placeholder="VD: cat (Enter để thêm)"
          ariaLabel="Đáp án được chấp nhận"
          tone="grass"
        />
        <span className="text-xs text-ink-soft">Không phân biệt chữ hoa/thường và khoảng trắng thừa.</span>
      </div>

      <Toggle checked={useBank} onChange={(v) => onChange({ useBank: v })} label="Cho chọn từ (lớp 1–3)" />
      {useBank ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">
            Từ gợi ý ({QUESTION_LIMITS.minOptions}–{QUESTION_LIMITS.maxOptions}, phải có đáp án đúng)
          </span>
          <ChipsInput
            values={bank}
            onChange={(v) => onChange({ bank: v })}
            max={QUESTION_LIMITS.maxOptions}
            placeholder="VD: fish"
            ariaLabel="Từ gợi ý"
            tone="sunny"
          />
          {accepted[0] && !bankHasAnswer ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange({ bank: [...bank, accepted[0]].slice(0, QUESTION_LIMITS.maxOptions) })}
            >
              ＋ Thêm “{accepted[0]}” vào từ gợi ý
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Học sinh sẽ tự gõ từ vào ô trống (phù hợp lớp 4–5).</p>
      )}
    </fieldset>
  )
}

/** Ordering: the pieces in the correct order; the game scrambles them. */
export function OrderingEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [sentence, setSentence] = useState('')
  const move = (i: number, d: -1 | 1) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  const preview = items.map((w) => w.trim()).filter(Boolean).join(' ')

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-line p-4">
      <legend className="px-1 text-sm font-bold">
        Các phần theo đúng thứ tự ({QUESTION_LIMITS.minOrderItems}–{QUESTION_LIMITS.maxOrderItems})
      </legend>
      <div className="flex gap-2">
        <Input
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Gõ cả câu, VD: I like my cat"
          aria-label="Câu hoàn chỉnh để tách từ"
          maxLength={300}
        />
        <Button
          variant="secondary"
          disabled={!sentence.trim()}
          onClick={() => {
            onChange(sentence.trim().split(/\s+/).slice(0, QUESTION_LIMITS.maxOrderItems))
            setSentence('')
          }}
        >
          Tách từ
        </Button>
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-6 text-right font-bold text-ink-soft">{i + 1}.</span>
            <Input
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              required
              maxLength={40}
              aria-label={`Phần ${i + 1}`}
            />
            <Button variant="ghost" size="sm" aria-label="Lên" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Xuống"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Xoá phần"
              disabled={items.length <= QUESTION_LIMITS.minOrderItems}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          </li>
        ))}
      </ol>
      {items.length < QUESTION_LIMITS.maxOrderItems ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([...items, ''])}>
          ＋ Thêm phần
        </Button>
      ) : null}
      {preview ? (
        <p className="rounded-xl bg-grass-soft px-3 py-2 font-bold text-green-900">Câu đúng: {preview}</p>
      ) : null}
    </fieldset>
  )
}
