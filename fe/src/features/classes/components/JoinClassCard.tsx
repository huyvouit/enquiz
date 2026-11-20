import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, Input } from '@/shared/components'
import { playSfx } from '@/shared/sound'
import { classesApi } from '../api/classes.api'
import { classKeys } from '../hooks/useClasses'
import type { StudentClassView } from '../types'

/**
 * Student home: type the class code the teacher gave. Codes ignore case,
 * spaces and dashes (the server normalises them too).
 */
export function JoinClassCard({ onJoined }: { onJoined?: (c: StudentClassView) => void }) {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [joined, setJoined] = useState<StudentClassView | null>(null)
  const join = useMutation({
    mutationFn: classesApi.join,
    onSuccess: (c) => {
      playSfx('levelUp')
      setJoined(c)
      setCode('')
      void qc.invalidateQueries({ queryKey: classKeys.all })
      // Joining can add open homework and a class leaderboard.
      void qc.invalidateQueries({ queryKey: ['assignments'] })
      onJoined?.(c)
    },
    onError: () => playSfx('wrong'),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (code.trim()) join.mutate(code.trim())
  }

  return (
    <Card className="bg-sky-soft/60">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">🏫 Vào lớp của cô</h2>
        <p className="text-sm font-semibold text-ink-soft">Nhập mã lớp cô giáo đọc cho em (6 chữ và số).</p>
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="Mã lớp"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="VD: AB3X7K"
            maxLength={12}
            autoComplete="off"
            className="min-w-0 flex-1 text-center font-display text-2xl tracking-[0.2em] uppercase"
          />
          <Button type="submit" size="lg" loading={join.isPending} disabled={!code.trim()}>
            Vào lớp
          </Button>
        </div>
        {join.error ? (
          <p role="alert" className="font-bold text-coral">
            {errorMessage(join.error)}
          </p>
        ) : null}
        {joined ? (
          <p role="status" className="rounded-xl bg-grass-soft p-3 font-bold text-green-700">
            🎉 Em đã vào lớp {joined.name}
            {joined.teacherName ? ` của ${joined.teacherName}` : ''}!
          </p>
        ) : null}
      </form>
    </Card>
  )
}
