/**
 * Option colours and shapes, in the same order as the students' answer
 * tiles (features/play MultipleChoiceGame), so "the blue diamond" means the
 * same option on the projector and on every tablet.
 */
export const OPTION_COLORS = [
  'bg-sky-soft border-sky',
  'bg-sunny-soft border-sunny',
  'bg-grass-soft border-grass',
  'bg-grape-soft border-grape',
  'bg-coral-soft border-coral',
  'bg-brand-soft border-brand',
] as const
export const OPTION_BARS = ['bg-sky', 'bg-sunny', 'bg-grass', 'bg-grape', 'bg-coral', 'bg-brand'] as const
export const OPTION_SHAPES = ['🔷', '⭐', '🟢', '💜', '❤️', '🔶'] as const
