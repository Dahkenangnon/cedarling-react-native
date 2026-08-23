export const CEDARLING_ERROR_CODES = [
  'E_UNSUPPORTED_PLATFORM',
  'E_NOT_INITIALIZED',
  'E_ALREADY_DISPOSED',
  'E_INVALID_INPUT',
  'E_INVALID_JSON',
  'E_ARCHIVE_IO',
  'E_ARCHIVE_TOO_LARGE',
  'E_INITIALIZATION',
  'E_AUTHORIZATION',
  'E_LOGGING',
  'E_DATA_CONTEXT',
  'E_NATIVE_RESULT_INCONSISTENT',
  'E_NATIVE',
] as const;

export type CedarlingErrorCode = (typeof CEDARLING_ERROR_CODES)[number];

const ERROR_CODE_SET = new Set<string>(CEDARLING_ERROR_CODES);

export class CedarlingError extends Error {
  readonly code: CedarlingErrorCode;
  override readonly cause?: unknown;

  constructor(code: CedarlingErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'CedarlingError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeCedarlingError(
  error: unknown,
  fallbackCode: CedarlingErrorCode = 'E_NATIVE'
): CedarlingError {
  if (error instanceof CedarlingError) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    const code =
      typeof candidate.code === 'string' && ERROR_CODE_SET.has(candidate.code)
        ? (candidate.code as CedarlingErrorCode)
        : fallbackCode;
    const message =
      typeof candidate.message === 'string' && candidate.message.length > 0
        ? candidate.message
        : 'Cedarling native operation failed';
    return new CedarlingError(code, message, error);
  }

  return new CedarlingError(fallbackCode, 'Cedarling native operation failed', error);
}

export function unsupportedPlatformError(platform: string): CedarlingError {
  return new CedarlingError(
    'E_UNSUPPORTED_PLATFORM',
    'cedarling-react-native supports Android and iOS; received ' + platform
  );
}
