import { CedarlingError, normalizeCedarlingError } from './errors';
import { mapAuthorizeResult, mapNativeInfo } from './result';
import type { CedarlingApi, CedarlingNativeModule } from './types';
import {
  serializeBootstrap,
  serializeContext,
  serializeEntity,
  serializeTokens,
  validateAction,
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
