import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Model } from 'mongoose';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { User } from '../users/schemas/user.schema.js';
import { shortName } from '../users/users.mapper.js';
import { LiveAccessService } from './live-access.service.js';
import { clientIp, LiveAuthError, LiveAuthService } from './live-auth.js';
import {
  activePlayers,
  type LiveEffect,
  type LiveEvent,
} from './live-room.machine.js';
import { type LiveRoom, LiveRoomRegistry } from './live-room.registry.js';
import { LiveResultsService } from './live-results.service.js';
import { hostView, playerView } from './live.views.js';
import { checkNickname, uniqueNickname } from './nickname.js';

/** What the handshake middleware and the join events store on a socket. */
export interface LiveSocketData {
  user: AuthUser | null;
  ip: string;
  /** PIN of the room this socket shows as host (projector). */
  hostPin?: string;
  /** The player this socket plays as. */
  player?: { pin: string; playerId: string };
}

export type LiveSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  LiveSocketData
>;

/** Acknowledgement of every client event. */
export type LiveAck =
  | { ok: true; [field: string]: unknown }
  | { ok: false; error: string; message: string };

/** Vietnamese text for every refusal the screens may show. */
const MESSAGES: Record<string, string> = {
  bad_request: 'Dữ liệu gửi lên không hợp lệ',
  not_found: 'Không tìm thấy phòng với mã PIN này',
  too_many_attempts: 'Em thử nhiều quá, chờ 1 phút rồi thử lại nhé',
  login_required: 'Phòng này cần đăng nhập bằng tài khoản học sinh',
  not_in_class: 'Phòng này chỉ dành cho học sinh của lớp',
  students_only: 'Giáo viên mở màn chiếu, không vào chơi được',
  not_host: 'Bạn không điều khiển phòng này',
  not_joined: 'Em chưa vào phòng',
  rejoin_failed: 'Không vào lại được, em nhập mã PIN để vào lại nhé',
  nickname_length: 'Biệt danh dài từ 2 đến 16 ký tự',
  nickname_characters: 'Biệt danh chỉ gồm chữ, số và khoảng trắng',
  nickname_rude: 'Biệt danh này không phù hợp, em chọn tên khác nhé',
  room_full: 'Phòng đã đủ người',
  banned: 'Em không vào lại phòng này được',
  wrong_phase: 'Chưa làm được việc này lúc này',
  no_players: 'Chưa có học sinh nào trong phòng',
  already_answered: 'Em đã chọn đáp án rồi',
  wrong_question: 'Câu hỏi đã đổi',
  bad_choice: 'Lựa chọn không hợp lệ',
  too_late: 'Hết giờ rồi',
  unknown_player: 'Không tìm thấy người chơi',
};

const fail = (error: string): LiveAck => ({
  ok: false,
  error,
  message: MESSAGES[error] ?? 'Có lỗi xảy ra, em thử lại nhé',
});

const isPin = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{6}$/.test(v.trim());
const isShortString = (v: unknown, max = 64): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const isSmallInt = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < 100;
const body = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

const sha256 = (s: string) => createHash('sha256').update(s).digest();
const allRoom = (pin: string) => `room:${pin}`;
const hostRoom = (pin: string) => `host:${pin}`;
const playerRoom = (pin: string, id: string) => `player:${pin}:${id}`;

/**
 * Socket.io side of the live quiz (plan 5, namespace `/live`).
 *
 * - Handshake: JWT checked once (L9); no token = anonymous (guest, L11).
 * - Host: `host:attach` (also after F5), `host:start|next|end|kick`.
 * - Player: `player:join` (student, or guest with nickname), `player:rejoin`
 *   (guest after reconnect, L10), `player:answer`.
 * - After every change each screen receives its whole picture:
 *   `host:state` / `room:state` (see live.views.ts). Answers only update
 *   the host (`question:progress`), never the other players.
 */
@WebSocketGateway({ namespace: '/live' })
export class LiveGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);
  @WebSocketServer() private readonly server!: Namespace;
  /** `pin:playerId` → id of the socket currently playing as them. */
  private readonly activeSockets = new Map<string, string>();

  constructor(
    private readonly auth: LiveAuthService,
    private readonly registry: LiveRoomRegistry,
    private readonly access: LiveAccessService,
    private readonly results: LiveResultsService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  afterInit(): void {
    const hops = this.config.getOrThrow<number>('TRUST_PROXY');
    this.server.use((socket: LiveSocket, next) => {
      this.auth
        .authenticate(socket.handshake.auth?.token)
        .then((user) => {
          socket.data.user = user;
          socket.data.ip = clientIp(
            socket.handshake.address,
            socket.handshake.headers['x-forwarded-for'],
            hops,
          );
          next();
        })
        .catch((err: unknown) => {
          if (!(err instanceof LiveAuthError)) {
            this.logger.error(`Live handshake failed: ${String(err)}`);
          }
          next(
            new Error(err instanceof LiveAuthError ? err.code : 'unavailable'),
          );
        });
    });
    this.registry.setListener((room, effects) => this.broadcast(room, effects));
  }

  handleDisconnect(socket: LiveSocket): void {
    const player = socket.data.player;
    if (!player) return;
    const key = `${player.pin}:${player.playerId}`;
    // Replaced by a newer socket (other tab, reconnect): stay online.
    if (this.activeSockets.get(key) !== socket.id) return;
    this.activeSockets.delete(key);
    this.registry.apply(player.pin, {
      type: 'disconnect',
      playerId: player.playerId,
    });
  }

  @SubscribeMessage('session:whoami')
  whoami(@ConnectedSocket() socket: LiveSocket) {
    const { user, ip } = socket.data;
    return {
      user: user ? { userId: user.userId, role: user.role } : null,
      clientIp: ip,
      serverNow: new Date().toISOString(),
    };
  }

  // ---------- Host (projector) ----------

  @SubscribeMessage('host:attach')
  hostAttach(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() payload: unknown,
  ): LiveAck {
    const { matchId } = body(payload);
    const user = socket.data.user;
    if (!user || user.role === Role.STUDENT) return fail('not_host');
    if (!isShortString(matchId)) return fail('bad_request');
    const room = this.registry.findByMatch(matchId);
    if (!room || room.state.phase === 'ended') return fail('not_found');
    if (room.hostId !== user.userId && user.role !== Role.ADMIN) {
      return fail('not_host');
    }
    socket.data.hostPin = room.pin;
    void socket.join(hostRoom(room.pin));
    void socket.join(allRoom(room.pin));
    return { ok: true, state: hostView(room) };
  }

  @SubscribeMessage('host:start')
  hostStart(@ConnectedSocket() socket: LiveSocket): LiveAck {
    return this.hostCommand(socket, { type: 'start' }, (room) => {
      room.meta.startedAt = Date.now();
    });
  }

  @SubscribeMessage('host:next')
  hostNext(@ConnectedSocket() socket: LiveSocket): LiveAck {
    return this.hostCommand(socket, { type: 'next' });
  }

  @SubscribeMessage('host:end')
  hostEnd(@ConnectedSocket() socket: LiveSocket): LiveAck {
    return this.hostCommand(socket, { type: 'end' });
  }

  @SubscribeMessage('host:kick')
  hostKick(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() payload: unknown,
  ): LiveAck {
    const { playerId } = body(payload);
    if (!isShortString(playerId)) return fail('bad_request');
    return this.hostCommand(socket, { type: 'kick', playerId }, (room) => {
      const target = playerRoom(room.pin, playerId);
      this.server.to(target).emit('player:kicked');
      this.server.in(target).disconnectSockets(true);
      this.activeSockets.delete(`${room.pin}:${playerId}`);
    });
  }

  private hostCommand(
    socket: LiveSocket,
    event: LiveEvent,
    onSuccess?: (room: LiveRoom) => void,
  ): LiveAck {
    const pin = socket.data.hostPin;
    const room = pin ? this.registry.get(pin) : undefined;
    if (!room) return fail('not_host');
    const result = this.registry.apply(room.pin, event);
    if (!result) return fail('not_found');
    if (result.error) return fail(result.error);
    onSuccess?.(room);
    return { ok: true };
  }

  // ---------- Players ----------

  @SubscribeMessage('player:join')
  async playerJoin(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() payload: unknown,
  ): Promise<LiveAck> {
    const { pin, nickname } = body(payload);
    const { user, ip } = socket.data;
    if (!isPin(pin)) return fail('bad_request');
    // Anonymous visitors: limited per IP (L11). Students: per account, so a
    // school behind one IP does not block itself.
    if (!user && !this.access.guestJoinAllowed(ip)) {
      return fail('too_many_attempts');
    }
    const found = this.access.findRoom(
      pin,
      user ? `u:${user.userId}` : `ip:${ip}`,
    );
    if (found === 'blocked') return fail('too_many_attempts');
    if (!found) return fail('not_found');
    const room = found;

    let identity: { userId: string | null; nickname: string };
    if (user) {
      if (user.role !== Role.STUDENT) return fail('students_only');
      const allowed = room.meta.allowedUserIds;
      if (allowed && !allowed.includes(user.userId))
        return fail('not_in_class');
      const doc = await this.userModel
        .findById(user.userId, { fullName: 1 })
        .lean();
      const fullName = doc?.fullName ?? user.username;
      // Class room: full names; open room: "Anh N." (plan D3).
      identity = {
        userId: user.userId,
        nickname: room.meta.classId ? fullName : shortName(fullName),
      };
    } else {
      if (!room.meta.allowGuests) return fail('login_required');
      const check = checkNickname(nickname);
      if (!check.ok) return fail(`nickname_${check.reason}`);
      identity = { userId: null, nickname: check.nickname };
    }

    const known = identity.userId
      ? room.state.players.find((p) => p.userId === identity.userId)
      : undefined;
    const taken = activePlayers(room.state)
      .filter((p) => p.id !== known?.id)
      .map((p) => p.nickname);
    const result = this.registry.apply(room.pin, {
      type: 'join',
      player: {
        id: randomBytes(8).toString('hex'),
        userId: identity.userId,
        nickname: known?.nickname ?? uniqueNickname(identity.nickname, taken),
        isGuest: identity.userId === null,
      },
    });
    if (!result) return fail('not_found');
    if (result.error) return fail(result.error);
    const playerId = result.playerId!;

    let rejoinToken: string | undefined;
    if (!identity.userId) {
      rejoinToken = randomBytes(16).toString('base64url');
      room.meta.guestTokens[playerId] = sha256(rejoinToken).toString('hex');
    }
    this.attachPlayer(socket, room, playerId);
    return {
      ok: true,
      playerId,
      ...(rejoinToken ? { rejoinToken } : {}),
      state: playerView(room, playerId),
    };
  }

  /** Guest back after F5 or a dropped connection (L10). */
  @SubscribeMessage('player:rejoin')
  playerRejoin(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() payload: unknown,
  ): LiveAck {
    const { pin, playerId, rejoinToken } = body(payload);
    if (
      !isPin(pin) ||
      !isShortString(playerId) ||
      !isShortString(rejoinToken)
    ) {
      return fail('bad_request');
    }
    const found = this.access.findRoom(pin, `ip:${socket.data.ip}`);
    if (found === 'blocked') return fail('too_many_attempts');
    if (!found) return fail('not_found');
    const expected = found.meta.guestTokens[playerId];
    const given = sha256(rejoinToken);
    if (!expected || !timingSafeEqual(Buffer.from(expected, 'hex'), given)) {
      return fail('rejoin_failed');
    }
    const result = this.registry.apply(found.pin, {
      type: 'reconnect',
      playerId,
    });
    if (!result || result.error) return fail('rejoin_failed');
    this.attachPlayer(socket, found, playerId);
    return { ok: true, playerId, state: playerView(found, playerId) };
  }

  @SubscribeMessage('player:answer')
  playerAnswer(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() payload: unknown,
  ): LiveAck {
    const player = socket.data.player;
    if (!player) return fail('not_joined');
    const { questionIndex, choice } = body(payload);
    if (!isSmallInt(questionIndex) || !isSmallInt(choice)) {
      return fail('bad_request');
    }
    const result = this.registry.apply(player.pin, {
      type: 'answer',
      playerId: player.playerId,
      questionIndex,
      choice,
    });
    if (!result) return fail('not_found');
    return result.error ? fail(result.error) : { ok: true };
  }

  /** One socket per player: a newer one (tab, device) replaces the older. */
  private attachPlayer(socket: LiveSocket, room: LiveRoom, playerId: string) {
    const key = `${room.pin}:${playerId}`;
    const previous = this.activeSockets.get(key);
    this.activeSockets.set(key, socket.id);
    if (previous && previous !== socket.id) {
      this.server.to(previous).emit('player:replaced');
      this.server.in(previous).disconnectSockets(true);
    }
    socket.data.player = { pin: room.pin, playerId };
    void socket.join(allRoom(room.pin));
    void socket.join(playerRoom(room.pin, playerId));
  }

  // ---------- Broadcasting ----------

  private broadcast(room: LiveRoom, effects: LiveEffect[]): void {
    const pin = room.pin;
    this.server.to(hostRoom(pin)).emit('host:state', hostView(room));
    if (effects.every((e) => e === 'question:progress')) return;

    for (const p of activePlayers(room.state)) {
      if (p.online) {
        this.server
          .to(playerRoom(pin, p.id))
          .emit('room:state', playerView(room, p.id));
      }
    }
    if (effects.includes('match:ended')) {
      void this.results.saveOnce(room, 'ended');
    }
    if (effects.includes('room:closed')) {
      this.server.to(allRoom(pin)).emit('room:closed');
      // Closed mid-game (idle host): keep what was played.
      void this.results.saveOnce(room, 'aborted');
      for (const key of this.activeSockets.keys()) {
        if (key.startsWith(`${pin}:`)) this.activeSockets.delete(key);
      }
    }
  }
}
