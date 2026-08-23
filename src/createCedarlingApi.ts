import { CedarlingError, normalizeCedarlingError } from './errors';
import {
  mapAuthorizeResult,
  mapDataEntries,
  mapDataEntry,
  mapDataStoreStats,
  mapDataValue,
  mapNativeInfo,
  mapString,
  mapStringArray,
  mapTrustedIssuerSummary,
} from './result';
import type { CedarlingApi, CedarlingNativeModule } from './types';
import {
  serializeBootstrap,
  serializeContext,
  serializeEntity,
  serializeJsonValue,
  serializeTokens,
  validateAction,
  validateNonemptyString,
  validateTtlSeconds,
} from './validation';

function invalidInput(error: TypeError): CedarlingError {
  return new CedarlingError('E_INVALID_INPUT', error.message, error);
}

export function createCedarlingApi(nativeModule: CedarlingNativeModule): CedarlingApi {
  return {
    async initialize(options) {
      try {
        if (typeof options !== 'object' || options === null) {
          throw new TypeError('initialize options must be an object');
        }
        const bootstrapJson = serializeBootstrap(options.bootstrap);
        const archiveUri = options.policyStore?.uri ?? null;
        if (options.policyStore) {
          if (options.policyStore.kind !== 'archive') {
            throw new TypeError('policyStore.kind must be archive');
          }
          if (typeof archiveUri !== 'string' || archiveUri.trim().length === 0) {
            throw new TypeError('policyStore.uri must be a nonempty string');
          }
        }
        await nativeModule.initialize(bootstrapJson, archiveUri);
      } catch (error) {
        if (error instanceof TypeError) {
          throw invalidInput(error);
        }
        throw normalizeCedarlingError(error, 'E_INITIALIZATION');
      }
    },

    async isInitialized() {
      try {
        return await nativeModule.isInitialized();
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },

    async authorizeUnsigned(request) {
      try {
        if (typeof request !== 'object' || request === null) {
          throw new TypeError('authorization request must be an object');
        }
        const result = await nativeModule.authorizeUnsigned(
          request.principal == null ? null : serializeEntity(request.principal, 'principal'),
          validateAction(request.action),
          serializeEntity(request.resource, 'resource'),
          serializeContext(request.context)
        );
        return mapAuthorizeResult(result);
      } catch (error) {
        if (error instanceof TypeError) {
          throw invalidInput(error);
        }
        throw normalizeCedarlingError(error, 'E_AUTHORIZATION');
      }
    },

    async authorizeMultiIssuer(request) {
      try {
        if (typeof request !== 'object' || request === null) {
          throw new TypeError('authorization request must be an object');
        }
        const result = await nativeModule.authorizeMultiIssuer(
          serializeTokens(request.tokens),
          validateAction(request.action),
          serializeEntity(request.resource, 'resource'),
          serializeContext(request.context)
        );
        return mapAuthorizeResult(result);
      } catch (error) {
        if (error instanceof TypeError) {
          throw invalidInput(error);
        }
        throw normalizeCedarlingError(error, 'E_AUTHORIZATION');
      }
    },

    async getLogIds() {
      try {
        return mapStringArray(await nativeModule.getLogIds(), 'native log IDs');
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async getLogById(id) {
      try {
        return mapString(
          await nativeModule.getLogById(validateNonemptyString(id, 'log id')),
          'native log'
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async getLogsByRequestId(requestId) {
      try {
        return mapStringArray(
          await nativeModule.getLogsByRequestId(validateNonemptyString(requestId, 'request id')),
          'native logs'
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async getLogsByRequestIdAndTag(requestId, tag) {
      try {
        return mapStringArray(
          await nativeModule.getLogsByRequestIdAndTag(
            validateNonemptyString(requestId, 'request id'),
            validateNonemptyString(tag, 'log tag')
          ),
          'native logs'
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async getLogsByTag(tag) {
      try {
        return mapStringArray(
          await nativeModule.getLogsByTag(validateNonemptyString(tag, 'log tag')),
          'native logs'
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async popLogs() {
      try {
        return mapStringArray(await nativeModule.popLogs(), 'native logs');
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_LOGGING');
      }
    },

    async pushDataContext(key, value, ttlSeconds) {
      try {
        await nativeModule.pushDataContext(
          validateNonemptyString(key, 'data context key'),
          serializeJsonValue(value, 'data context value'),
          validateTtlSeconds(ttlSeconds)
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async getDataContext(key) {
      try {
        return mapDataValue(
          await nativeModule.getDataContext(validateNonemptyString(key, 'data context key'))
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async getDataContextEntry(key) {
      try {
        return mapDataEntry(
          await nativeModule.getDataContextEntry(validateNonemptyString(key, 'data context key'))
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async removeDataContext(key) {
      try {
        return await nativeModule.removeDataContext(
          validateNonemptyString(key, 'data context key')
        );
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async clearDataContext() {
      try {
        await nativeModule.clearDataContext();
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async listDataContext() {
      try {
        return mapDataEntries(await nativeModule.listDataContext());
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async getDataContextStats() {
      try {
        return mapDataStoreStats(await nativeModule.getDataContextStats());
      } catch (error) {
        throw normalizeCedarlingError(error, 'E_DATA_CONTEXT');
      }
    },

    async isTrustedIssuerLoadedByName(name) {
      try {
        return await nativeModule.isTrustedIssuerLoadedByName(
          validateNonemptyString(name, 'trusted issuer name')
        );
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },

    async isTrustedIssuerLoadedByIssuer(issuer) {
      try {
        return await nativeModule.isTrustedIssuerLoadedByIssuer(
          validateNonemptyString(issuer, 'trusted issuer URL')
        );
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },

    async getTrustedIssuerSummary() {
      try {
        return mapTrustedIssuerSummary(await nativeModule.getTrustedIssuerSummary());
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },

    async dispose() {
      try {
        await nativeModule.dispose();
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },

    async getNativeInfo() {
      try {
        return mapNativeInfo(await nativeModule.getNativeInfo());
      } catch (error) {
        throw normalizeCedarlingError(error);
      }
    },
  };
}
