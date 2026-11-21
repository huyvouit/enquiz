import type { LiveEffect } from './live-room.machine.js';
import type { LiveRoomMeta } from './live-room.registry.js';
import {
  ENDED_KEEP_MS,
  LiveRoomRegistry,
  LOBBY_IDLE_MS,
} from './live-room.registry.js';

const questions = [{ id: 'q1', optionCount: 3, correctIndex: 1 }];

function makeRegistry(pins: string[] = []) {
  const registry = new LiveRoomRegistry();
  let now = 1_000_000;
  registry.now = () => now;
  const queue = [...pins];
  if (pins.length > 0) registry.randomPin = () => queue.shift() ?? '999999';
  const seen: [string, LiveEffect[]][] = [];
  registry.setListener((room, effects) => seen.push([room.pin, effects]));
  return {
    registry,
    seen,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const open = (r: LiveRoomRegistry, matchId = 'm1') =>
  r.open({
    matchId,
    hostId: 'h1',
    questions,
    settings: {},
    meta: {} as LiveRoomMeta,
  });

describe('LiveRoomRegistry', () => {
  it('gives every open room its own 6-digit PIN', () => {
    const { registry } = makeRegistry(['123456', '123456', '654321']);
    const a = open(registry, 'm1');
    const b = open(registry, 'm2');
    expect(a.pin).toBe('123456');
    expect(b.pin).toBe('654321');
    expect(registry.findByMatch('m2')?.pin).toBe('654321');
    expect(new LiveRoomRegistry().randomPin()).toMatch(/^[1-9]\d{5}$/);
  });

  it('applies events, reports effects and keeps refused ones out', () => {
    const { registry, seen } = makeRegistry();
    const room = open(registry);
    expect(registry.apply(room.pin, { type: 'start' })?.error).toBe(
      'no_players',
    );
    registry.apply(room.pin, {
      type: 'join',
      player: { id: 'p1', userId: 'u1', nickname: 'An', isGuest: false },
    });
    registry.apply(room.pin, { type: 'start' });
    expect(registry.get(room.pin)?.state.phase).toBe('countdown');
    expect(seen.map(([, e]) => e)).toEqual([
      ['lobby:players'],
      ['question:start'],
    ]);
    expect(registry.apply('000000', { type: 'start' })).toBeUndefined();
  });

  it('drives timed phases from the tick loop', () => {
    const { registry, seen, advance } = makeRegistry();
    const room = open(registry);
    registry.apply(room.pin, {
      type: 'join',
      player: { id: 'p1', userId: 'u1', nickname: 'An', isGuest: false },
    });
    registry.apply(room.pin, { type: 'start' });
    advance(3_000);
    registry.tickAll();
    expect(registry.get(room.pin)?.state.phase).toBe('answering');
    advance(20_000);
    registry.tickAll();
    expect(registry.get(room.pin)?.state.phase).toBe('reveal');
    expect(seen.at(-1)?.[1]).toEqual(['question:reveal']);
  });

  it('closes an idle lobby and drops ended rooms later', () => {
    const { registry, seen, advance } = makeRegistry();
    const room = open(registry);
    advance(LOBBY_IDLE_MS + 1);
    registry.tickAll();
    expect(registry.get(room.pin)?.state.phase).toBe('ended');
    expect(seen.at(-1)).toEqual([room.pin, ['room:closed']]);
    advance(ENDED_KEEP_MS + 1);
    registry.tickAll();
    expect(registry.get(room.pin)).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('keeps ticking other rooms when one listener call fails', () => {
    const { registry, advance } = makeRegistry(['111111', '222222']);
    registry.setListener((room) => {
      if (room.pin === '111111') throw new Error('boom');
    });
    for (const id of ['m1', 'm2']) {
      const r = open(registry, id);
      registry.apply(r.pin, {
        type: 'join',
        player: { id: 'p', userId: 'u', nickname: 'An', isGuest: false },
      });
      registry.apply(r.pin, { type: 'start' });
    }
    advance(3_000);
    registry.tickAll();
    expect(registry.get('111111')?.state.phase).toBe('answering');
    expect(registry.get('222222')?.state.phase).toBe('answering');
  });
});
