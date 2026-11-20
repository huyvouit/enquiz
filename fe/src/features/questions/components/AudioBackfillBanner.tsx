import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { queryClient } from '@/shared/api/query-client'
import { Button } from '@/shared/components'
import { questionsApi } from '../api/questions.api'

const statusKey = ['questions', 'audio-status'] as const

/**
 * Admin only: listening questions saved without audio (text-to-speech was
 * off or failed, or created before plan D16). Makes it in batches until done.
 */
export function AudioBackfillBanner() {
  const status = useQuery({ queryKey: statusKey, queryFn: questionsApi.audioStatus })
  const [note, setNote] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: async () => {
      let generated = 0
      // Batch after batch, stopping when one makes no progress (TTS failing).
      for (;;) {
        const r = await questionsApi.backfillAudio()
        generated += r.generated
        if (r.remaining === 0 || r.generated === 0) return { generated, remaining: r.remaining }
      }
    },
    onSuccess: ({ generated, remaining }) =>
      setNote(
        remaining === 0
          ? `Đã tạo âm thanh cho ${generated} câu.`
          : `Đã tạo ${generated} câu; còn ${remaining} câu chưa tạo được. Xem log máy chủ rồi thử lại.`,
      ),
    onError: (err) => setNote(errorMessage(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  })

  const missing = status.data?.missing ?? 0
  if (!status.data || (missing === 0 && !note)) return null

  return (
    <div className="mb-5 rounded-2xl bg-sunny-soft px-4 py-3 text-sm font-bold text-yellow-900">
      {missing > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            🔇 {missing} câu nghe chưa có âm thanh, học sinh chưa nghe được.
            {status.data.enabled ? null : ' Máy chủ đang tắt chức năng đọc thành tiếng (TTS_DRIVER=none).'}
          </p>
          {status.data.enabled ? (
            <Button variant="secondary" disabled={run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? 'Đang tạo…' : '🔊 Tạo âm thanh'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="mt-1">{note}</p> : null}
    </div>
  )
}
