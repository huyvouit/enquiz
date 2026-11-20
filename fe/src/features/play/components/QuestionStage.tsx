import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Card } from '@/shared/components'
import { BLANK, type PlayQuestion, type TypedAnswer } from '../types'
import { FillBlankGame } from './FillBlankGame'
import { ListenButton } from './ListenButton'
import { OrderingGame } from './OrderingGame'

/** Grading result of the current question, when known. */
export interface StageFeedback {
  studentAnswer: unknown
  isCorrect: boolean
  correctAnswer: unknown
}

/**
 * Animated question card + answer area; slides when the question changes.
 * Shows the image (mediaUrl) large, a 🔊 button for listening questions and,
 * for fill_in_blank, the gap highlighted in the sentence.
 *
 * Multiple choice and matching games are passed as `children` by the caller.
 * Fill-in-the-blank and ordering games have their own "Kiểm tra" button and
 * are rendered here when `onSubmit` is given:
 * - `feedback`: the graded answer (shows right/wrong, locks the game)
 * - `submitted`: an answer already given but not graded (teacher preview)
 */
export function QuestionStage({
  question,
  children,
  onSubmit,
  feedback,
  submitted,
  busy = false,
  preview = false,
}: {
  question: PlayQuestion
  children?: ReactNode
  onSubmit?: (answer: TypedAnswer) => void
  feedback?: StageFeedback
  submitted?: TypedAnswer
  busy?: boolean
  /** Teacher preview: explains a listening question that has no audio yet. */
  preview?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const given = feedback ? (feedback.studentAnswer as TypedAnswer | null) ?? undefined : submitted
  const gameProps = {
    question,
    correctAnswer: feedback?.correctAnswer,
    isCorrect: feedback?.isCorrect,
    disabled: busy,
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={question.id}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -60 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Card className="mb-6 text-center">
          {question.mediaUrl ? (
            <img
              src={question.mediaUrl}
              alt=""
              className="mx-auto mb-4 max-h-72 w-auto max-w-full rounded-2xl object-contain"
            />
          ) : null}
          {question.audioUrl || question.audioPending ? (
            <ListenButton url={question.audioUrl} preview={preview} />
          ) : null}
          <h1 className="font-display text-3xl font-extrabold leading-snug sm:text-4xl">
            {question.type === 'fill_in_blank' ? <WithBlank text={question.questionText} /> : question.questionText}
          </h1>
        </Card>

        {onSubmit && question.type === 'fill_in_blank' ? (
          <FillBlankGame
            {...gameProps}
            submitted={typeof given === 'string' ? given : undefined}
            onSubmit={(a) => onSubmit(a)}
          />
        ) : null}
        {onSubmit && question.type === 'ordering' ? (
          <OrderingGame
            {...gameProps}
            submitted={Array.isArray(given) ? given : undefined}
            onSubmit={(a) => onSubmit(a)}
          />
        ) : null}

        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Renders "I have a ___." with the gap as a dashed box. */
function WithBlank({ text }: { text: string }) {
  const [before, ...rest] = text.split(BLANK)
  if (rest.length === 0) return <>{text}</>
  return (
    <>
      {before}
      <span
        aria-label="chỗ trống"
        className="mx-1 inline-block min-w-24 border-b-4 border-dashed border-brand align-baseline text-brand"
      >
        &nbsp;
      </span>
      {rest.join(BLANK)}
    </>
  )
}
