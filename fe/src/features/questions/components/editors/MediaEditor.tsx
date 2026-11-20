import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { Button, Field, Input } from '@/shared/components'
import { speak, voicesReady } from '@/shared/speech'
import { questionsApi } from '../../api/questions.api'
import { IMAGE_TYPES, QUESTION_LIMITS } from '../../types'

/** Image: upload (PNG/JPG/WebP ≤ 1 MB) or paste an http(s) link. */
export function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    if (!IMAGE_TYPES.includes(file.type)) {
      setError('Chỉ nhận ảnh PNG, JPG hoặc WebP')
      return
    }
    if (file.size > QUESTION_LIMITS.maxImageBytes) {
      setError(`Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Tối đa 1 MB.`)
      return
    }
    setUploading(true)
    try {
      const res = await questionsApi.uploadImage(file)
      onChange(res.url)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">Ảnh minh hoạ (tuỳ chọn)</span>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <div className="relative">
            <img src={value} alt="Ảnh câu hỏi" className="h-24 w-auto max-w-40 rounded-xl border-2 border-line object-contain" />
            <button
              type="button"
              aria-label="Bỏ ảnh"
              onClick={() => onChange('')}
              className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-coral font-bold text-white shadow"
            >
              ✕
            </button>
          </div>
        ) : null}
        <Button variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
          🖼️ {value ? 'Đổi ảnh' : 'Tải ảnh'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // allow picking the same file again
            if (file) void upload(file)
          }}
        />
      </div>
      <Input
        type="url"
        placeholder="…hoặc dán link ảnh https://"
        value={value.startsWith('/') ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Link ảnh"
      />
      <span className="text-xs text-ink-soft">PNG, JPG hoặc WebP, tối đa 1 MB.</span>
      {error ? <span className="text-sm font-bold text-coral">{error}</span> : null}
    </div>
  )
}

/**
 * English text of a listening question. On save the server turns it into an
 * MP3 (plan D16); students only get the audio, never this text.
 * "Nghe thử" before saving uses this device's voice, which may differ.
 */
export function AudioTextField({
  value,
  onChange,
  savedText,
  audioUrl,
}: {
  value: string
  onChange: (text: string) => void
  /** The text as last saved, to tell whether its audio is current. */
  savedText?: string
  audioUrl?: string
}) {
  const [voice, setVoice] = useState<boolean | null>(null)
  useEffect(() => {
    void voicesReady().then(setVoice)
  }, [])

  const text = value.trim()
  const saved = text !== '' && text === (savedText ?? '').trim()
  const ready = saved && !!audioUrl

  function listen() {
    if (ready) void new Audio(audioUrl).play().catch(() => undefined)
    else speak(text)
  }

  return (
    <Field
      label="Câu đọc to bằng tiếng Anh (tuỳ chọn)"
      hint="Có nội dung này, câu hỏi thành dạng Nghe: khi lưu, hệ thống tạo file đọc to cho học sinh nghe (học sinh không thấy chữ)."
    >
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="VD: a duck"
          maxLength={QUESTION_LIMITS.maxAudioText}
          lang="en"
        />
        <Button
          variant="secondary"
          aria-label="Nghe thử"
          disabled={!text || (!ready && voice === false)}
          onClick={listen}
        >
          ▶ Nghe
        </Button>
      </div>
      {text === '' ? null : ready ? (
        <span className="text-xs font-bold text-green-700">✅ Đã có âm thanh cho học sinh.</span>
      ) : saved ? (
        <span className="text-xs font-bold text-yellow-800">
          ⚠️ Chưa tạo được âm thanh. Bấm Lưu để thử lại, hoặc nhờ quản trị viên tạo âm thanh.
        </span>
      ) : (
        <span className="text-xs text-ink-soft">
          Âm thanh sẽ được tạo khi lưu. “Nghe thử” lúc này dùng giọng của máy bạn.
        </span>
      )}
    </Field>
  )
}
