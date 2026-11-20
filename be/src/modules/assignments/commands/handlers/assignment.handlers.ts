import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommandHandler,
  EventBus,
  ICommandHandler,
  QueryBus,
} from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ClassAccess,
  ClassAccessQuery,
} from '../../../classes/queries/impl/class-membership.queries.js';
import { EXAM_DEFAULT_SEC } from '../../../../common/utils/exam-time.js';
import { ExamStartedQuery } from '../../../exams/queries/impl/exam.queries.js';
import { canSeeQuiz } from '../../../quizzes/quiz-access.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import {
  assertValidDueDate,
  loadManagedAssignment,
} from '../../assignment-access.js';
import { AssignmentSubmissionsService } from '../../assignment-submissions.service.js';
import { AssignmentView } from '../../assignments.mapper.js';
import { CreateAssignmentDto } from '../../dto/assignment.dto.js';
import { AssignmentCreatedEvent } from '../../events/assignment.events.js';
import {
  Assignment,
  AssignmentMode,
  AssignmentTarget,
  RevealPolicy,
} from '../../schemas/assignment.schema.js';
import {
  CreateAssignmentCommand,
  DeleteAssignmentCommand,
  UpdateAssignmentCommand,
} from '../impl/assignment.commands.js';

/** Resolves who the homework is for. All ids must be members of the class. */
function resolveTarget(
  dto: CreateAssignmentDto['target'],
  c: ClassAccess,
): { target: AssignmentTarget; studentIds: string[] } {
  if (dto.kind === 'group') {
    const group = c.groups.find((g) => g.id === dto.groupId);
    if (!group) throw new NotFoundException('Không tìm thấy nhóm');
    return {
      target: {
        kind: 'group',
        groupId: new Types.ObjectId(group.id),
        groupName: group.name,
      },
      studentIds: group.studentIds,
    };
  }
  if (dto.kind === 'students') {
    const members = new Set(c.studentIds);
    const picked = dto.studentIds ?? [];
    if (picked.some((id) => !members.has(id))) {
      throw new BadRequestException('Chỉ giao được cho học sinh của lớp này');
    }
    return { target: { kind: 'students' }, studentIds: picked };
  }
  return { target: { kind: 'class' }, studentIds: c.studentIds };
}

/**
 * Exam time: the teacher's choice, else the quiz's suggestion, else 15
 * minutes (plan E6). Classic homework has no time limit.
 */
function examTime(
  mode: AssignmentMode,
  chosen: number | undefined,
  quizSuggestion: number | null | undefined,
): number | undefined {
  if (mode !== AssignmentMode.EXAM) return undefined;
  return chosen ?? quizSuggestion ?? EXAM_DEFAULT_SEC;
}

@CommandHandler(CreateAssignmentCommand)
export class CreateAssignmentHandler implements ICommandHandler<CreateAssignmentCommand> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  async execute({
    classId,
    dto,
    user,
  }: CreateAssignmentCommand): Promise<AssignmentView> {
    const c = await this.queryBus.execute(
      new ClassAccessQuery(classId, user, 'manage'),
    );
    // Own quizzes (drafts too), shared ones and system ones (plan D2).
    const quiz = await this.quizModel.findById(dto.quizId).lean();
    if (!quiz || !canSeeQuiz(user, quiz)) {
      throw new NotFoundException('Không tìm thấy bài quiz');
    }
    assertValidDueDate(dto.dueDate);

    const { target, studentIds } = resolveTarget(dto.target, c);
    if (studentIds.length === 0) {
      throw new BadRequestException(
        dto.target.kind === 'class'
          ? 'Lớp chưa có học sinh nào để giao bài'
          : 'Nhóm chưa có học sinh nào',
      );
    }

    const mode = dto.mode ?? AssignmentMode.CLASSIC;
    const created = await this.assignmentModel.create({
      classId: new Types.ObjectId(c.id),
      quizId: quiz._id,
      teacherId: new Types.ObjectId(c.teacherId),
      target,
      studentIds: studentIds.map((id) => new Types.ObjectId(id)),
      dueDate: dto.dueDate,
      note: dto.note?.trim() || undefined,
      mode,
      timeLimitSec: examTime(
        mode,
        dto.timeLimitSec,
        quiz.settings?.timeLimitSec,
      ),
      reveal: dto.reveal ?? RevealPolicy.AFTER_SUBMIT,
    });
    this.eventBus.publish(
      new AssignmentCreatedEvent(
        created._id.toString(),
        c.id,
        studentIds.length,
      ),
    );
    const [view] = await this.submissions.views([created.toObject()]);
    return view;
  }
}

@CommandHandler(UpdateAssignmentCommand)
export class UpdateAssignmentHandler implements ICommandHandler<UpdateAssignmentCommand> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly queryBus: QueryBus,
    private readonly submissions: AssignmentSubmissionsService,
  ) {}

  async execute({
    assignmentId,
    dto,
    user,
  }: UpdateAssignmentCommand): Promise<AssignmentView> {
    const { assignment } = await loadManagedAssignment(
      this.assignmentModel,
      this.queryBus,
      assignmentId,
      user,
    );
    const set: Partial<Assignment> = {};
    if (dto.dueDate !== undefined) {
      assertValidDueDate(dto.dueDate);
      set.dueDate = dto.dueDate;
    }
    if (dto.note !== undefined) set.note = dto.note.trim();
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.reveal !== undefined) set.reveal = dto.reveal;

    const mode = dto.mode ?? assignment.mode ?? AssignmentMode.CLASSIC;
    const modeChanged = mode !== (assignment.mode ?? AssignmentMode.CLASSIC);
    const timeChanged =
      mode === AssignmentMode.EXAM &&
      dto.timeLimitSec !== undefined &&
      dto.timeLimitSec !== assignment.timeLimitSec;
    if (modeChanged || timeChanged) {
      await this.assertNotStarted(assignment._id);
      set.mode = mode;
      set.timeLimitSec = examTime(
        mode,
        dto.timeLimitSec ?? assignment.timeLimitSec,
        await this.quizSuggestion(assignment.quizId),
      );
    }

    const unset =
      set.mode === AssignmentMode.CLASSIC ? { timeLimitSec: 1 } : {};
    if (set.mode === AssignmentMode.CLASSIC) delete set.timeLimitSec;
    const updated = await this.assignmentModel
      .findByIdAndUpdate(
        assignment._id,
        { $set: set, $unset: unset },
        { returnDocument: 'after' },
      )
      .lean();
    const [view] = await this.submissions.views([updated!]);
    return view;
  }

  /** Mode and exam time are fixed once someone has started (plan E6). */
  private async assertNotStarted(assignmentId: Types.ObjectId): Promise<void> {
    const attempts = await this.submissions.attempts([assignmentId]);
    const started =
      (attempts.get(assignmentId.toString())?.size ?? 0) > 0 ||
      (await this.queryBus.execute(
        new ExamStartedQuery(assignmentId.toString()),
      ));
    if (started) {
      throw new ConflictException(
        'Đã có học sinh làm bài nên không đổi được chế độ hay thời gian',
      );
    }
  }

  private async quizSuggestion(quizId: Types.ObjectId) {
    const quiz = await this.quizModel.findById(quizId, { settings: 1 }).lean();
    return quiz?.settings?.timeLimitSec ?? null;
  }
}

@CommandHandler(DeleteAssignmentCommand)
export class DeleteAssignmentHandler implements ICommandHandler<DeleteAssignmentCommand> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    assignmentId,
    user,
  }: DeleteAssignmentCommand): Promise<void> {
    const { assignment } = await loadManagedAssignment(
      this.assignmentModel,
      this.queryBus,
      assignmentId,
      user,
    );
    await this.assignmentModel.deleteOne({ _id: assignment._id });
  }
}
