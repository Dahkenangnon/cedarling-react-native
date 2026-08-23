import { unsupportedPlatformError } from './errors';
import type { CedarlingApi } from './types';

export function createUnsupportedApi(platform: string): CedarlingApi {
  const reject = async (): Promise<never> => {
    throw unsupportedPlatformError(platform);
  };

  return {
    initialize: reject,
    isInitialized: reject,
    authorizeUnsigned: reject,
    authorizeMultiIssuer: reject,
    getLogIds: reject,
    getLogById: reject,
    getLogsByRequestId: reject,
    getLogsByRequestIdAndTag: reject,
    getLogsByTag: reject,
    popLogs: reject,
    pushDataContext: reject,
    getDataContext: reject,
    getDataContextEntry: reject,
    removeDataContext: reject,
    clearDataContext: reject,
    listDataContext: reject,
    getDataContextStats: reject,
    isTrustedIssuerLoadedByName: reject,
    isTrustedIssuerLoadedByIssuer: reject,
    getTrustedIssuerSummary: reject,
    dispose: reject,
    getNativeInfo: reject,
  };
}
