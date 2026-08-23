import { NativeModule, requireNativeModule } from 'expo';

import { createCedarlingApi } from './createCedarlingApi';
import type { CedarlingNativeModule } from './types';

declare class CedarlingExpoNativeModule extends NativeModule implements CedarlingNativeModule {
  initialize(bootstrapJson: string, archiveUri: string | null): Promise<void>;
  isInitialized(): Promise<boolean>;
  authorizeUnsigned(
    principalJson: string | null,
    action: string,
    resourceJson: string,
    contextJson: string
  ): Promise<unknown>;
  authorizeMultiIssuer(
    tokensJson: string,
    action: string,
    resourceJson: string,
    contextJson: string
  ): Promise<unknown>;
  getLogIds(): Promise<unknown>;
  getLogById(id: string): Promise<unknown>;
  getLogsByRequestId(requestId: string): Promise<unknown>;
  getLogsByRequestIdAndTag(requestId: string, tag: string): Promise<unknown>;
  getLogsByTag(tag: string): Promise<unknown>;
  popLogs(): Promise<unknown>;
  pushDataContext(key: string, valueJson: string, ttlSeconds: number | null): Promise<void>;
  getDataContext(key: string): Promise<unknown>;
  getDataContextEntry(key: string): Promise<unknown>;
  removeDataContext(key: string): Promise<boolean>;
  clearDataContext(): Promise<void>;
  listDataContext(): Promise<unknown>;
  getDataContextStats(): Promise<unknown>;
  isTrustedIssuerLoadedByName(name: string): Promise<boolean>;
  isTrustedIssuerLoadedByIssuer(issuer: string): Promise<boolean>;
  getTrustedIssuerSummary(): Promise<unknown>;
  dispose(): Promise<void>;
  getNativeInfo(): Promise<unknown>;
}

const nativeModule = requireNativeModule<CedarlingExpoNativeModule>('CedarlingReactNative');

export const Cedarling = createCedarlingApi(nativeModule);
