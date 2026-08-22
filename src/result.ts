import { CedarlingError } from './errors';
import type { CedarlingAuthorizeResult, CedarlingNativeInfo } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', label + ' must be a string array');
  }
  return value;
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
      reasons: stringArray(diagnostics.reasons, 'native diagnostics.reasons'),
      errors: stringArray(diagnostics.errors, 'native diagnostics.errors'),
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
    abis: stringArray(value.abis, 'native info.abis'),
  };
}
