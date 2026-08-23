import type { Spec } from './NativeCedarlingReactNative';
import { CedarlingError } from './errors';
import type { CedarlingNativeModule } from './types';

function decodeJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CedarlingError(
      'E_NATIVE_RESULT_INCONSISTENT',
      `${label} must contain valid transport JSON`,
      error
    );
  }
}

export function createTurboModuleAdapter(nativeModule: Spec): CedarlingNativeModule {
  return {
    initialize: (bootstrapJson, archiveUri) => nativeModule.initialize(bootstrapJson, archiveUri),
    isInitialized: () => nativeModule.isInitialized(),
    authorizeUnsigned: async (principalJson, action, resourceJson, contextJson) =>
      decodeJson(
        await nativeModule.authorizeUnsigned(principalJson, action, resourceJson, contextJson),
        'native authorization result'
      ),
    authorizeMultiIssuer: async (tokensJson, action, resourceJson, contextJson) =>
      decodeJson(
        await nativeModule.authorizeMultiIssuer(tokensJson, action, resourceJson, contextJson),
        'native authorization result'
      ),
    getLogIds: async () => decodeJson(await nativeModule.getLogIds(), 'native log IDs'),
    getLogById: (id) => nativeModule.getLogById(id),
    getLogsByRequestId: async (requestId) =>
      decodeJson(await nativeModule.getLogsByRequestId(requestId), 'native logs'),
    getLogsByRequestIdAndTag: async (requestId, tag) =>
      decodeJson(await nativeModule.getLogsByRequestIdAndTag(requestId, tag), 'native logs'),
    getLogsByTag: async (tag) => decodeJson(await nativeModule.getLogsByTag(tag), 'native logs'),
    popLogs: async () => decodeJson(await nativeModule.popLogs(), 'native logs'),
    pushDataContext: (key, valueJson, ttlSeconds) =>
      nativeModule.pushDataContext(key, valueJson, ttlSeconds),
    getDataContext: (key) => nativeModule.getDataContext(key),
    getDataContextEntry: async (key) =>
      decodeJson(await nativeModule.getDataContextEntry(key), 'native data entry'),
    removeDataContext: (key) => nativeModule.removeDataContext(key),
    clearDataContext: () => nativeModule.clearDataContext(),
    listDataContext: async () =>
      decodeJson(await nativeModule.listDataContext(), 'native data entries'),
    getDataContextStats: async () =>
      decodeJson(await nativeModule.getDataContextStats(), 'native data stats'),
    isTrustedIssuerLoadedByName: (name) => nativeModule.isTrustedIssuerLoadedByName(name),
    isTrustedIssuerLoadedByIssuer: (issuer) => nativeModule.isTrustedIssuerLoadedByIssuer(issuer),
    getTrustedIssuerSummary: async () =>
      decodeJson(await nativeModule.getTrustedIssuerSummary(), 'native trusted issuer summary'),
    dispose: () => nativeModule.dispose(),
    getNativeInfo: async () => decodeJson(await nativeModule.getNativeInfo(), 'native provenance'),
  };
}
