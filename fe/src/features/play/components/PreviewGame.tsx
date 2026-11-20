import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MatchPair } from '@/shared/api/types'
import { Button } from '@/shared/components'
import { isAnswered } from '../lib/answers'
import type { PlayAnswer, PlayQuiz, TypedAnswer } from '../types'
import { MatchingGame } from './MatchingGame'
import { MultipleChoiceGame } from './MultipleChoiceGame'
import { PlayTopBar } from './PlayTopBar'
import { QuestionStage } from './QuestionStage'

/**
 * Teacher/admin preview: same screens, nothing graded or saved. The play
 * payload has no answer keys, so answers are only recorded, never checked.
 */
export function PreviewGame({ quiz }: { quiz: PlayQuiz }) {
  const navigate = useNavigate()
  const { questions } = quiz
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, PlayAnswer>>({})

  const question = questions[index]
  const answer = answers[question.id]
  const isLast = index === questions.length - 1
  const set = (a: PlayAnswer) => setAnswers((prev) => ({ ...prev, [question.id]: a }))
  const typed = question.type === 'fill_in_blank' || question.type === 'ordering'

  return (
    <div className="mx-auto max-w-3xl">
      <PlayTopBar
        done={Object.keys(answers).length}
        total={questions.length}
        onQuit={() => navigate(-1)}
      />
      <p className="mb-4 rounded-xl bg-sunny-soft px-4 py-2 text-center text-sm font-bold text-yellow-800">
        👀 Chế độ xem thử của giáo viên — không chấm điểm, không lưu kết quả
      </p>

      <QuestionStage
        question={question}
        preview
        submitted={typed ? (answer as TypedAnswer | undefined) : undefined}
        onSubmit={typed ? set : undefined}
      >
        {question.type === 'multiple_choice' && question.options ? (
          <MultipleChoiceGame
            options={question.options}
            value={typeof answer === 'string' ? answer : undefined}
            onChange={set}
          />
        ) : null}
        {question.type === 'matching' && question.matching ? (
          <MatchingGame
            lefts={question.matching.lefts}
            rights={question.matching.rights}
            value={Array.isArray(answer) ? (answer as MatchPair[]) : []}
            onChange={set}
          />
        ) : null}
        {typed && answer !== undefined ? (
          <p className="mt-4 text-center text-sm font-bold text-ink-soft">
            Đã ghi nhận câu trả lời (xem thử không chấm điểm).
          </p>
        ) : null}
      </QuestionStage>

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button variant="secondary" size="lg" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ← Quay lại
        </Button>
        {isLast ? (
          <Button variant="success" size="lg" onClick={() => navigate(-1)}>
            Kết thúc xem thử
          </Button>
        ) : (
          <Button size="lg" disabled={!isAnswered(question, answer)} onClick={() => setIndex(index + 1)}>
            Tiếp theo →
          </Button>
        )}
      </div>
    </div>
  )
}
