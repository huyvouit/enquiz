// Public API of the play (game) feature.
export { PlayPage } from './pages/PlayPage'
// Reused by the exam room (plan 4.2): same games, controlled, no grading.
export { FillBlankGame } from './components/FillBlankGame'
export { MatchingGame } from './components/MatchingGame'
export { MultipleChoiceGame } from './components/MultipleChoiceGame'
export { OrderingGame } from './components/OrderingGame'
export { QuestionStage } from './components/QuestionStage'
export { isAnswered } from './lib/answers'
export type { PlayAnswer, PlayQuestion } from './types'
