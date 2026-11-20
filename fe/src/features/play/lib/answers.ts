import type { PlayAnswer, PlayQuestion } from '../types'

/** True when the question has a complete answer and the child may continue. */
export function isAnswered(question: PlayQuestion, answer: PlayAnswer | undefined): boolean {
  if (answer === undefined) return false
  switch (question.type) {
    case 'multiple_choice':
    case 'fill_in_blank':
      return typeof answer === 'string' && answer.trim().length > 0
    case 'matching':
      return Array.isArray(answer) && answer.length === (question.matching?.lefts.length ?? 0)
    case 'ordering':
      return Array.isArray(answer) && answer.length === (question.ordering?.items.length ?? 0)
    default:
      return false
  }
}

/** Same comparison as the backend graders: case- and extra-space-insensitive. */
export const normalizeAnswer = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase()

/** fill_in_blank feedback: correctAnswer is the list of accepted answers. */
export function firstAccepted(correctAnswer: unknown): string | undefined {
  if (typeof correctAnswer === 'string') return correctAnswer
  if (Array.isArray(correctAnswer) && typeof correctAnswer[0] === 'string') return correctAnswer[0]
  return undefined
}

/** ordering feedback: the pieces in the right order. */
export function orderedPieces(correctAnswer: unknown): string[] {
  return Array.isArray(correctAnswer) ? correctAnswer.filter((x): x is string => typeof x === 'string') : []
}
