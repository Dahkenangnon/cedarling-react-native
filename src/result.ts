import { CedarlingError } from './errors';
import type {
  CedarlingAuthorizeResult,
  CedarlingDataEntry,
  CedarlingDataStoreStats,
  CedarlingNativeInfo,
  CedarlingTrustedIssuerSummary,
  JsonValue,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', label + ' must be a string array');
  }
  return value;
}

export function mapString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', label + ' must be a string');
  }
  return value;
}

function mapBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', label + ' must be boolean');
  }
  return value;
}

function mapNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', label + ' must be a finite number');
  }
  return value;
}

function parseJson(value: unknown, label: string): JsonValue {
  const raw = mapString(value, label);
  try {
    return JSON.parse(raw) as JsonValue;
  } catch (error) {
    throw new CedarlingError(
      'E_NATIVE_RESULT_INCONSISTENT',
      label + ' must contain valid JSON',
      error
    );
  }
}

export function mapAuthorizeResult(value: unknown): CedarlingAuthorizeResult {
  if (!isRecord(value)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native result must be an object');
  }

  const { allowed, decision, requestId, diagnostics } = value;
  if (typeof allowed !== 'boolean') {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native allowed must be boolean');
  }
  if (decision !== 'ALLOW' && decision !== 'DENY') {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native decision is invalid');
  }
  if (allowed !== (decision === 'ALLOW')) {
    throw new CedarlingError(
      'E_NATIVE_RESULT_INCONSISTENT',
      'native Boolean and Cedar decision disagree'
    );
  }
  if (typeof requestId !== 'string' || requestId.trim().length === 0) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native request ID is missing');
  }
  if (!isRecord(diagnostics)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native diagnostics are missing');
  }

  return {
    allowed,
    decision,
    requestId,
    diagnostics: {
      reasons: mapStringArray(diagnostics.reasons, 'native diagnostics.reasons'),
      errors: mapStringArray(diagnostics.errors, 'native diagnostics.errors'),
    },
  };
}

export function mapNativeInfo(value: unknown): CedarlingNativeInfo {
  if (!isRecord(value)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native info must be an object');
  }

  const requiredStrings = [
    'sdkVersion',
    'cedarlingRevision',
    'cedarlingCrateVersion',
    'uniffiVersion',
  ] as const;
  for (const key of requiredStrings) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      throw new CedarlingError(
        'E_NATIVE_RESULT_INCONSISTENT',
        'native info ' + key + ' is missing'
      );
    }
  }

  return {
    sdkVersion: value.sdkVersion as string,
    cedarlingRevision: value.cedarlingRevision as string,
    cedarlingCrateVersion: value.cedarlingCrateVersion as string,
    uniffiVersion: value.uniffiVersion as string,
    abis: mapStringArray(value.abis, 'native info.abis'),
  };
}

export function mapDataValue(value: unknown): JsonValue | null {
  return value === null ? null : parseJson(value, 'native data value');
}

export function mapDataEntry(value: unknown): CedarlingDataEntry | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native data entry must be an object');
  }
  const expiresAt = mapString(value.expiresAt, 'native data entry expiresAt');
  return {
    key: mapString(value.key, 'native data entry key'),
    value: parseJson(value.valueJson, 'native data entry valueJson'),
    dataType: mapString(value.dataType, 'native data entry dataType'),
    createdAt: mapString(value.createdAt, 'native data entry createdAt'),
    expiresAt: expiresAt.length === 0 ? null : expiresAt,
    accessCount: mapNumber(value.accessCount, 'native data entry accessCount'),
  };
}

export function mapDataEntries(value: unknown): CedarlingDataEntry[] {
  if (!Array.isArray(value)) {
    throw new CedarlingError(
      'E_NATIVE_RESULT_INCONSISTENT',
      'native data entries must be an array'
    );
  }
  return value.map((entry) => {
    const mapped = mapDataEntry(entry);
    if (mapped === null) {
      throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native data entry cannot be null');
    }
    return mapped;
  });
}

export function mapDataStoreStats(value: unknown): CedarlingDataStoreStats {
  if (!isRecord(value)) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'native data stats must be an object');
  }
  return {
    entryCount: mapNumber(value.entryCount, 'native data stats entryCount'),
    maxEntries: mapNumber(value.maxEntries, 'native data stats maxEntries'),
    maxEntrySize: mapNumber(value.maxEntrySize, 'native data stats maxEntrySize'),
    metricsEnabled: mapBoolean(value.metricsEnabled, 'native data stats metricsEnabled'),
    totalSizeBytes: mapNumber(value.totalSizeBytes, 'native data stats totalSizeBytes'),
    averageEntrySizeBytes: mapNumber(
      value.averageEntrySizeBytes,
      'native data stats averageEntrySizeBytes'
    ),
    capacityUsagePercent: mapNumber(
      value.capacityUsagePercent,
      'native data stats capacityUsagePercent'
    ),
    memoryAlertThreshold: mapNumber(
      value.memoryAlertThreshold,
      'native data stats memoryAlertThreshold'
    ),
    memoryAlertTriggered: mapBoolean(
      value.memoryAlertTriggered,
      'native data stats memoryAlertTriggered'
    ),
  };
}

export function mapTrustedIssuerSummary(value: unknown): CedarlingTrustedIssuerSummary {
  if (!isRecord(value)) {
    throw new CedarlingError(
      'E_NATIVE_RESULT_INCONSISTENT',
      'native trusted issuer summary must be an object'
    );
  }
  return {
    total: mapNumber(value.total, 'native trusted issuer total'),
    loaded: mapNumber(value.loaded, 'native trusted issuer loaded'),
    loadedIds: mapStringArray(value.loadedIds, 'native trusted issuer loadedIds'),
    failedIds: mapStringArray(value.failedIds, 'native trusted issuer failedIds'),
  };
}
