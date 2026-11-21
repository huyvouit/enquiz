import type { LoggerService } from '@nestjs/common';

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const REPORTED_ERROR =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

export interface CloudLogEntry {
  severity: Severity;
  message: string;
  context?: string;
  '@type'?: string;
  serviceContext?: { service: string; version?: string };
}

/** A JavaScript stack trace, as Nest passes it next to an error message. */
const isStack = (value: unknown): value is string =>
  typeof value === 'string' && /\n\s+at /.test(value);

/**
 * One log line for Cloud Logging (launch checklist C3): JSON with
 * `severity`, so logs can be filtered by level, and errors with a stack
 * trace marked as ReportedErrorEvent, so Cloud Error Reporting groups them
 * and can e-mail the first occurrence. Pure, for tests.
 */
export function toCloudEntry(
  severity: Severity,
  message: unknown,
  params: unknown[],
  service: { name: string; version?: string },
): CloudLogEntry {
  const rest = [...params];
  // Nest puts the context (class name) last when it is a string.
  const context =
    rest.length > 0 && typeof rest.at(-1) === 'string' && !isStack(rest.at(-1))
      ? (rest.pop() as string)
      : undefined;
  let stack: string | undefined;
  if (message instanceof Error) stack = message.stack;
  else if (isStack(rest[0])) stack = rest[0];

  const text =
    message instanceof Error
      ? message.message
      : typeof message === 'string'
        ? message
        : JSON.stringify(message);
  const entry: CloudLogEntry = { severity, message: text, context };
  if ((severity === 'ERROR' || severity === 'CRITICAL') && stack) {
    // Error Reporting reads the stack trace from the message.
    // An Error's stack already starts with "Error: <message>".
    entry.message = message instanceof Error ? stack : `${text}\n${stack}`;
    entry['@type'] = REPORTED_ERROR;
    entry.serviceContext = { service: service.name, version: service.version };
  }
  return entry;
}

/**
 * Nest logger used on Cloud Run (K_SERVICE is set there). Local runs keep
 * Nest's coloured console logger.
 */
export class CloudLogger implements LoggerService {
  private readonly service = {
    name: process.env.K_SERVICE ?? 'enquiz-api',
    version: process.env.K_REVISION,
  };

  log(message: unknown, ...params: unknown[]) {
    this.write('INFO', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.write('ERROR', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.write('WARNING', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.write('DEBUG', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.write('DEBUG', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.write('CRITICAL', message, params);
  }

  private write(severity: Severity, message: unknown, params: unknown[]) {
    const line = JSON.stringify(
      toCloudEntry(severity, message, params, this.service),
    );
    (severity === 'ERROR' || severity === 'CRITICAL'
      ? process.stderr
      : process.stdout
    ).write(`${line}\n`);
  }
}
