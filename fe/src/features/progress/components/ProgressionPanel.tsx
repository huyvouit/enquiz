import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/components'
import { confettiBurst, confettiShower } from '@/shared/lib/celebrate'
import { playSfx } from '@/shared/sound'
import { PASS_SCORE, type AttemptProgression } from '../types'

/**
 * What the attempt changed: XP, level-up, newly opened station.
 * `fresh` = shown right after finishing → plays sounds and confetti once.
 */
export function ProgressionPanel({
  progression,
  score,
  fresh,
}: {
  progression: AttemptProgression
  score: number
  fresh: boolean
}) {
  const navigate = useNavigate()
  const celebrated = useRef(false)

  useEffect(() => {
    if (!fresh || celebrated.current) return
    celebrated.current = true
    if (progression.leveledUp) {
      playSfx('levelUp')
      confettiShower()
    } else {
      playSfx('finish')
      if (score >= 90) confettiBurst()
    }
  }, [fresh, progression.leveledUp, score])

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {progression.leveledUp ? (
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 1.3, type: 'spring', stiffness: 200, damping: 10 }}
          className="w-full rounded-2xl bg-gradient-to-r from-sunny via-amber-300 to-sunny px-5 py-4 text-center shadow-pop-sm"
        >
          <p className="font-display text-3xl font-extrabold text-ink">🎉 LÊN CẤP {progression.levelAfter}!</p>
          <p className="font-bold text-ink/80">Em đã vượt qua trạm này</p>
        </motion.div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <span className="rounded-full bg-grape-soft px-4 py-1.5 font-display text-lg font-bold text-purple-800">
          ⚡ +{progression.xpEarned} XP
        </span>
        <span className="rounded-full bg-brand-soft px-4 py-1.5 font-display text-lg font-bold text-brand-dark">
          🏅 Cấp {progression.levelAfter}
        </span>
        {progression.totalXp !== null ? (
          <span className="rounded-full bg-slate-100 px-4 py-1.5 font-display text-lg font-bold text-ink-soft">
            Tổng {progression.totalXp} XP
          </span>
        ) : null}
      </div>

      {!progression.passed ? (
        <p className="text-center font-semibold text-ink-soft">
          Cần đạt <b className="text-brand">{PASS_SCORE} điểm</b> để vượt qua trạm và mở trạm tiếp theo. Cố lên nhé! 💪
        </p>
      ) : progression.xpEarned === 0 ? (
        <p className="text-center font-semibold text-ink-soft">Phá kỷ lục cũ của em để nhận thêm XP nhé! 🚀</p>
      ) : null}

      {progression.unlockedQuiz ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8 }}
        >
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate(`/play/${progression.unlockedQuiz!.id}`)}
          >
            🔓 Trạm mới: {progression.unlockedQuiz.coverEmoji} {progression.unlockedQuiz.title}
          </Button>
        </motion.div>
      ) : null}
    </div>
  )
}
