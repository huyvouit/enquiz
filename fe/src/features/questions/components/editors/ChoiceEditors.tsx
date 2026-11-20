import { Button, Input } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { QUESTION_LIMITS } from '../../types'

/** Multiple choice: the options, one marked as the correct answer. */
export function OptionsEditor({
  options,
  correctIndex,
  onChange,
}: {
  options: string[]
  correctIndex: number
  onChange: (options: string[], correctIndex: number) => void
}) {
  const remove = (i: number) => {
    const next = options.filter((_, idx) => idx !== i)
    const nextCorrect = i === correctIndex ? 0 : i < correctIndex ? correctIndex - 1 : correctIndex
    onChange(next, nextCorrect)
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-bold">Các lựa chọn (chọn ⭕ cho đáp án đúng)</legend>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct-option"
            aria-label={`Đáp án đúng là lựa chọn ${i + 1}`}
            checked={correctIndex === i}
            onChange={() => onChange(options, i)}
            className="size-5 accent-green-500"
          />
          <Input
            value={opt}
            placeholder={`Lựa chọn ${i + 1}`}
            onChange={(e) => onChange(options.map((o, idx) => (idx === i ? e.target.value : o)), correctIndex)}
            required
            maxLength={80}
            className={cn(correctIndex === i && 'border-grass bg-grass-soft')}
          />
          <Button
            variant="ghost"
            size="sm"
            aria-label="Xoá lựa chọn"
            disabled={options.length <= QUESTION_LIMITS.minOptions}
            onClick={() => remove(i)}
          >
            ✕
          </Button>
        </div>
      ))}
      {options.length < QUESTION_LIMITS.maxOptions ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([...options, ''], correctIndex)}>
          ＋ Thêm lựa chọn
        </Button>
      ) : null}
    </fieldset>
  )
}

/** Matching: left ↔ right pairs (the pairs are the answer key). */
export function PairsEditor({
  pairs,
  onChange,
}: {
  pairs: { left: string; right: string }[]
  onChange: (pairs: { left: string; right: string }[]) => void
}) {
  const update = (i: number, side: 'left' | 'right', value: string) =>
    onChange(pairs.map((p, idx) => (idx === i ? { ...p, [side]: value } : p)))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-bold">Các cặp nối (vế trái ↔ vế phải)</legend>
      {pairs.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={p.left} placeholder="VD: 🐶" onChange={(e) => update(i, 'left', e.target.value)} required maxLength={60} />
          <span aria-hidden className="text-xl">
            ↔
          </span>
          <Input value={p.right} placeholder="VD: dog" onChange={(e) => update(i, 'right', e.target.value)} required maxLength={60} />
          <Button
            variant="ghost"
            size="sm"
            aria-label="Xoá cặp"
            disabled={pairs.length <= QUESTION_LIMITS.minPairs}
            onClick={() => onChange(pairs.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      {pairs.length < QUESTION_LIMITS.maxPairs ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange([...pairs, { left: '', right: '' }])}
        >
          ＋ Thêm cặp
        </Button>
      ) : null}
    </fieldset>
  )
}
