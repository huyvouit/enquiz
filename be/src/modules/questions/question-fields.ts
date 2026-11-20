import type { QuestionDto } from './dto/question.dto.js';
import { QuestionSkill } from './question-types.js';

/** Non-content fields shared by create and update (content: see the validator). */
export function questionFieldsFromDto(dto: QuestionDto) {
  const audioText = dto.audioText?.trim() || undefined;
  return {
    topic: dto.topic.trim(),
    gradeLevel: dto.gradeLevel,
    type: dto.type,
    // A question read aloud is a listening question unless said otherwise.
    skill:
      dto.skill ??
      (audioText ? QuestionSkill.LISTENING : QuestionSkill.VOCABULARY),
    mediaUrl: dto.mediaUrl || undefined,
    audioText,
    explanation: dto.explanation?.trim() || undefined,
    tags: [
      ...new Set(
        (dto.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      ),
    ],
    yleLevel: dto.yleLevel,
    unit: dto.unit?.trim() || undefined,
  };
}
