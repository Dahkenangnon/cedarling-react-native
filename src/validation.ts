import { CedarlingError } from './errors';
import type { CedarEntity, CedarlingToken, JsonObject, JsonValue } from './types';

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertJsonValue(
  value: unknown,
  path: string,
  seen: Set<object>
): asserts value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CedarlingError('E_INVALID_JSON', path + ' must contain only finite numbers');
    }
    return;
  }

  if (typeof value !== 'object') {
    throw new CedarlingError('E_INVALID_JSON', path + ' contains a non-JSON value');
  }

  if (seen.has(value)) {
    throw new CedarlingError('E_INVALID_JSON', path + ' contains a circular reference');
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, path + '[' + index + ']', seen));
  } else {
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, path + '.' + key, seen);
    }
  }

  seen.delete(value);
}

export function serializeJsonObject(value: unknown, label: string): string {
  if (!isJsonObject(value)) {
    throw new CedarlingError('E_INVALID_JSON', label + ' must be a JSON object');
  }
  assertJsonValue(value, label, new Set<object>());
  return JSON.stringify(value);
}

export function serializeJsonValue(value: unknown, label: string): string {
  assertJsonValue(value, label, new Set<object>());
  return JSON.stringify(value);
}

export function validateNonemptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CedarlingError('E_INVALID_INPUT', label + ' must be a nonempty string');
  }
  return value;
}

export function validateTtlSeconds(value: unknown): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new CedarlingError('E_INVALID_INPUT', 'ttlSeconds must be a non-negative safe integer');
  }
  return value as number;
}

export function serializeBootstrap(bootstrap: JsonObject | string): string {
  if (typeof bootstrap !== 'string') {
    return serializeJsonObject(bootstrap, 'bootstrap');
  }

  if (bootstrap.trim().length === 0) {
    throw new CedarlingError('E_INVALID_JSON', 'bootstrap must not be empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bootstrap);
  } catch (error) {
    throw new CedarlingError('E_INVALID_JSON', 'bootstrap must be valid JSON', error);
  }

  return serializeJsonObject(parsed, 'bootstrap');
}

export function serializeEntity(entity: CedarEntity, label: string): string {
  if (!isJsonObject(entity)) {
    throw new CedarlingError('E_INVALID_INPUT', label + ' must be an object');
  }

  const mapping = entity.cedar_entity_mapping;
  if (!isJsonObject(mapping)) {
    throw new CedarlingError('E_INVALID_INPUT', label + '.cedar_entity_mapping must be an object');
  }

  if (typeof mapping.entity_type !== 'string' || mapping.entity_type.trim().length === 0) {
    throw new CedarlingError(
      'E_INVALID_INPUT',
      label + '.cedar_entity_mapping.entity_type must be a nonempty string'
    );
  }

  if (typeof mapping.id !== 'string' || mapping.id.trim().length === 0) {
    throw new CedarlingError(
      'E_INVALID_INPUT',
      label + '.cedar_entity_mapping.id must be a nonempty string'
    );
  }

  return serializeJsonObject(entity, label);
}

export function serializeContext(context: JsonObject | undefined): string {
  return serializeJsonObject(context ?? {}, 'context');
}

export function validateAction(action: string): string {
  if (typeof action !== 'string' || action.trim().length === 0) {
    throw new CedarlingError('E_INVALID_INPUT', 'action must be a nonempty string');
  }
  return action;
}

export function serializeTokens(tokens: CedarlingToken[]): string {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new CedarlingError('E_INVALID_INPUT', 'tokens must contain at least one token');
  }

  const normalized = tokens.map((token, index) => {
    if (!isJsonObject(token)) {
      throw new CedarlingError('E_INVALID_INPUT', 'tokens[' + index + '] must be an object');
    }
    if (typeof token.mapping !== 'string' || token.mapping.trim().length === 0) {
      throw new CedarlingError(
        'E_INVALID_INPUT',
        'tokens[' + index + '].mapping must be a nonempty string'
      );
    }
    if (typeof token.payload !== 'string' || token.payload.trim().length === 0) {
      throw new CedarlingError(
        'E_INVALID_INPUT',
        'tokens[' + index + '].payload must be a nonempty string'
      );
    }
    return { mapping: token.mapping, payload: token.payload };
  });

  return JSON.stringify(normalized);
}
