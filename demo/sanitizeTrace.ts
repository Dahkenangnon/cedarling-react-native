const REDACTED = '[REDACTED]';
const LOCAL_PATH = '[LOCAL_PATH]';
const MAX_DEPTH = '[MAX_DEPTH]';
const CIRCULAR = '[CIRCULAR]';

const sensitiveKeyFragments = [
  'authorization',
  'clientsecret',
  'credential',
  'jwt',
  'password',
  'payload',
  'privatekey',
  'secret',
  'token',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

function sanitizeString(value: string, depth: number, seen: WeakSet<object>): unknown {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return REDACTED;
  }

  const uri = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (uri && ['asset', 'bundle', 'content', 'file'].includes(uri[1].toLowerCase())) {
    return `[${uri[1].toUpperCase()}_URI]`;
  }

  if (/^\/(?:Users|data|home|private|tmp|var)\//.test(trimmed)) {
    return LOCAL_PATH;
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return sanitizeTraceValueInternal(JSON.parse(trimmed) as unknown, depth + 1, seen);
    } catch {
      // Keep malformed or non-JSON diagnostic strings unchanged.
    }
  }

  return value;
}

function sanitizeTraceValueInternal(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > 8) {
    return MAX_DEPTH;
  }
  if (typeof value === 'string') {
    return sanitizeString(value, depth, seen);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return String(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return CIRCULAR;
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => sanitizeTraceValueInternal(entry, depth + 1, seen));
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSensitiveKey(key) ? REDACTED : sanitizeTraceValueInternal(entry, depth + 1, seen),
      ])
    );
  } finally {
    seen.delete(value);
  }
}

/** Redacts sensitive and machine-local values before the demo renders a trace event. */
export function sanitizeTraceValue(value: unknown): unknown {
  return sanitizeTraceValueInternal(value, 0, new WeakSet<object>());
}
