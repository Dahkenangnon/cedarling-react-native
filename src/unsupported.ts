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
    dispose: reject,
    getNativeInfo: reject,
  };
}
