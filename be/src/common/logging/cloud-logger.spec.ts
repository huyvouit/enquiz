import { toCloudEntry } from './cloud-logger.js';

const service = { name: 'enquiz-api', version: 'enquiz-api-00007' };

describe('toCloudEntry (Cloud Logging / Error Reporting)', () => {
  it('a plain log line: severity, message, context', () => {
    expect(
      toCloudEntry(
        'INFO',
        'Mapped {/api/v1/health, GET}',
        ['RouterExplorer'],
        service,
      ),
    ).toEqual({
      severity: 'INFO',
      message: 'Mapped {/api/v1/health, GET}',
      context: 'RouterExplorer',
    });
  });

  it('an Error object (HttpExceptionFilter): reported with its stack', () => {
    const err = new Error('boom');
    const entry = toCloudEntry('ERROR', err, ['HttpExceptionFilter'], service);
    expect(entry).toMatchObject({
      severity: 'ERROR',
      context: 'HttpExceptionFilter',
      '@type':
        'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
      serviceContext: { service: 'enquiz-api', version: 'enquiz-api-00007' },
    });
    expect(entry.message).toMatch(/^Error: boom\n\s+at /);
  });

  it('message + stack + context, the way Nest logs a caught error', () => {
    const stack = new Error('db down').stack;
    const entry = toCloudEntry(
      'ERROR',
      'Broadcast failed',
      [stack, 'LiveRoomRegistry'],
      service,
    );
    expect(entry.context).toBe('LiveRoomRegistry');
    expect(entry.message).toMatch(/^Broadcast failed\nError: db down\n\s+at /);
    expect(entry['@type']).toBeDefined();
  });

  it('an error without a stack is logged but not reported', () => {
    const entry = toCloudEntry('ERROR', 'No free live PIN', [], service);
    expect(entry).toEqual({ severity: 'ERROR', message: 'No free live PIN' });
  });

  it('a warning is never reported, even with a stack', () => {
    const entry = toCloudEntry(
      'WARNING',
      'slow',
      [new Error('x').stack],
      service,
    );
    expect(entry['@type']).toBeUndefined();
  });

  it('objects are serialised', () => {
    expect(toCloudEntry('INFO', { a: 1 }, [], service).message).toBe('{"a":1}');
  });
});
