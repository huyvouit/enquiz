import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { PlayQuestion } from '../quizzes/quizzes.mapper.js';
import {
  createRoomState,
  type LiveEffect,
  type LiveEvent,
  type LiveQuestion,
  type LiveRoomState,
  type LiveSettings,
  reduce,
  type Transition,
} from './live-room.machine.js';

/** How often timed phases (countdown, answer timer, auto-advance) are checked. */
export const TICK_MS = 250;
/** A lobby nobody starts is closed after this long (L4). */
export const LOBBY_IDLE_MS = 30 * 60_000;
/** Any room without activity is closed after this long (host left). */
export const ROOM_IDLE_MS = 2 * 3600_000;
/** An ended room stays readable this long for late screens, then is dropped. */
export const ENDED_KEEP_MS = 5 * 60_000;

/** What the reducer does not need but the views and the results do. */
export interface LiveRoomMeta {
  quiz: { id: string; title: string; coverEmoji: string };
  /** Same order as state.questions; options already in display order. */
  playQuestions: PlayQuestion[];
  classId: string | null;
  className: string | null;
  /** Class-bound room (L3): only these students may join. */
  allowedUserIds: string[] | null;
  allowGuests: boolean;
  /** Questions of the quiz left out: not multiple choice (L1). */
  skippedCount: number;
  /** Guest playerId → sha256 of its rejoinToken (L10). */
  guestTokens: Record<string, string>;
  startedAt: number | null;
  /** Set once the report is being written (ended or aborted). */
  saving: Promise<void> | null;
}

export interface LiveRoom {
  matchId: string;
  pin: string;
  hostId: string;
  createdAt: number;
  state: LiveRoomState;
  meta: LiveRoomMeta;
}

export type EffectListener = (room: LiveRoom, effects: LiveEffect[]) => void;

/**
 * All live rooms of this instance, in memory (plan 5, L2; one Cloud Run
 * instance, D19). Owns PIN allocation, the tick loop that drives timed
 * phases and the clean-up of abandoned rooms. Every state change goes
 * through `apply`, which runs the pure reducer and notifies the listener
 * (the gateway) of the effects to broadcast.
 */
@Injectable()
export class LiveRoomRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveRoomRegistry.name);
  private readonly rooms = new Map<string, LiveRoom>();
  private listener: EffectListener = () => {};
  private timer: NodeJS.Timeout | undefined;

  /** Replaced in tests. */
  now: () => number = () => Date.now();
  randomPin: () => string = () => String(randomInt(100_000, 1_000_000));

  onModuleInit(): void {
    this.timer = setInterval(() => this.tickAll(), TICK_MS);
    // Never keep the process alive just for the tick loop.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  setListener(listener: EffectListener): void {
    this.listener = listener;
  }

  get size(): number {
    return this.rooms.size;
  }

  get(pin: string): LiveRoom | undefined {
    return this.rooms.get(pin);
  }

  findByMatch(matchId: string): LiveRoom | undefined {
    return [...this.rooms.values()].find((r) => r.matchId === matchId);
  }

  open(input: {
    matchId: string;
    hostId: string;
    questions: LiveQuestion[];
    settings: Partial<LiveSettings>;
    meta: LiveRoomMeta;
  }): LiveRoom {
    const now = this.now();
    const room: LiveRoom = {
      matchId: input.matchId,
      hostId: input.hostId,
      pin: this.allocatePin(),
      createdAt: now,
      state: createRoomState(input.questions, input.settings, now),
      meta: input.meta,
    };
    this.rooms.set(room.pin, room);
    return room;
  }

  /** Runs one event through the reducer and broadcasts its effects. */
  apply(pin: string, event: LiveEvent): Transition | undefined {
    const room = this.rooms.get(pin);
    if (!room) return undefined;
    const result = reduce(room.state, event, this.now());
    if (result.error) return result;
    room.state = result.state;
    if (result.effects.length > 0) this.notify(room, result.effects);
    return result;
  }

  /** Drives timed phases of every room and closes abandoned ones. */
  tickAll(): void {
    const now = this.now();
    // Deleting from a Map while iterating it is safe.
    for (const room of this.rooms.values()) {
      try {
        this.apply(room.pin, { type: 'tick' });
        this.sweep(room, now);
      } catch (err) {
        // One broken room must not stop the others.
        this.logger.error(`Room ${room.pin}: ${String(err)}`);
      }
    }
  }

  private sweep(room: LiveRoom, now: number): void {
    const { phase, lastActivityAt, phaseStartedAt } = room.state;
    if (phase === 'ended') {
      if (now - phaseStartedAt > ENDED_KEEP_MS) this.rooms.delete(room.pin);
      return;
    }
    const idleLimit = phase === 'lobby' ? LOBBY_IDLE_MS : ROOM_IDLE_MS;
    if (now - lastActivityAt > idleLimit) {
      room.state = { ...room.state, phase: 'ended', phaseStartedAt: now };
      this.notify(room, ['room:closed']);
    }
  }

  private notify(room: LiveRoom, effects: LiveEffect[]): void {
    try {
      this.listener(room, effects);
    } catch (err) {
      this.logger.error(`Broadcast for ${room.pin} failed: ${String(err)}`);
    }
  }

  /** 6 random digits not used by an open room (L4). */
  private allocatePin(): string {
    for (let i = 0; i < 50; i++) {
      const pin = this.randomPin();
      if (!this.rooms.has(pin)) return pin;
    }
    throw new Error('No free live PIN');
  }
}
