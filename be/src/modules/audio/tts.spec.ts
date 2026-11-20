import { QuestionAudioService } from './question-audio.service.js';
import {
  audioKey,
  FakeTtsProvider,
  GoogleTtsProvider,
  type TtsProvider,
  type TtsVoice,
} from './tts.js';

const voice: TtsVoice = { language: 'en-GB', name: '', speakingRate: 0.85 };

describe('audioKey', () => {
  it('is the same for the same text and voice, and hides the text', () => {
    const key = audioKey('a duck', voice);
    expect(key).toMatch(/^[0-9a-f]{32}\.mp3$/);
    expect(audioKey('a duck', voice)).toBe(key);
    expect(key).not.toContain('duck');
  });

  it('changes with the text or the voice', () => {
    const key = audioKey('a duck', voice);
    expect(audioKey('a dog', voice)).not.toBe(key);
    expect(audioKey('a duck', { ...voice, language: 'en-US' })).not.toBe(key);
  });
});

describe('GoogleTtsProvider', () => {
  it('asks for slow MP3 in the configured voice and decodes the audio', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            audioContent: Buffer.from('mp3!').toString('base64'),
          }),
        ),
    );
    const tts = new GoogleTtsProvider(
      'key-123',
      { ...voice, name: 'en-GB-Standard-A' },
      fetchFn as unknown as typeof fetch,
    );
    expect((await tts.synthesize('a duck')).toString()).toBe('mp3!');

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe(
      'key-123',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      input: { text: 'a duck' },
      voice: { languageCode: 'en-GB', name: 'en-GB-Standard-A' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85 },
    });
  });

  it('reports API errors without the key', async () => {
    const fetchFn = async () =>
      new Response('API not enabled', { status: 403 });
    const tts = new GoogleTtsProvider(
      'secret-key',
      voice,
      fetchFn as unknown as typeof fetch,
    );
    const err = await tts.synthesize('x').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Text-to-Speech 403: API not enabled');
    expect((err as Error).message).not.toContain('secret-key');
  });
});

describe('QuestionAudioService', () => {
  function service(tts: TtsProvider | null) {
    const files = new Map<string, Buffer>();
    const storage = {
      disk: {
        exists: vi.fn(async (k: string) => files.has(k)),
        put: vi.fn(async (k: string, b: Buffer) => {
          files.set(k, b);
        }),
      },
      publicUrl: (k: string) => `/audio/${k}`,
    };
    const config = {
      get: (k: string) => ({ TTS_LANGUAGE: 'en-GB', TTS_VOICE: '' })[k],
    };
    const svc = new QuestionAudioService(
      tts,
      storage as never,
      config as never,
    );
    return { svc, storage, files };
  }

  it('makes the file once and then reuses it', async () => {
    const tts = new FakeTtsProvider();
    const spy = vi.spyOn(tts, 'synthesize');
    const { svc, files } = service(tts);
    const url = await svc.urlFor('a duck');
    expect(url).toBe(`/audio/${audioKey('a duck', voice)}`);
    expect(await svc.urlFor('a duck')).toBe(url);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(files.size).toBe(1);
  });

  it('gives no URL without text, with TTS off, or when TTS fails', async () => {
    expect(await service(new FakeTtsProvider()).svc.urlFor('')).toBeUndefined();
    expect(await service(null).svc.urlFor('a duck')).toBeUndefined();
    const broken: TtsProvider = {
      synthesize: () => Promise.reject(new Error('quota')),
    };
    const { svc, files } = service(broken);
    expect(await svc.urlFor('a duck')).toBeUndefined();
    expect(files.size).toBe(0);
  });

  it('fills many questions and skips the ones without text', async () => {
    const { svc } = service(new FakeTtsProvider());
    const docs: { audioText?: string; audioUrl?: string }[] = [
      { audioText: 'one' },
      {},
      { audioText: 'two' },
    ];
    await svc.fill(docs, 2);
    expect(docs[0].audioUrl).toMatch(/^\/audio\/[0-9a-f]{32}\.mp3$/);
    expect(docs[1].audioUrl).toBeUndefined();
    expect(docs[2].audioUrl).not.toBe(docs[0].audioUrl);
  });
});
