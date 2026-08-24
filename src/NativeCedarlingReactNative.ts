import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Private Codegen transport. Complex values are encoded as JSON so the
 * public API is independent of Codegen's restricted object type system.
 */
export interface Spec extends TurboModule {
  initialize(bootstrapJson: string, archiveUri: string | null): Promise<void>;
  isInitialized(): Promise<boolean>;
  authorizeUnsigned(
    principalJson: string | null,
    action: string,
    resourceJson: string,
    contextJson: string
  ): Promise<string>;
  authorizeMultiIssuer(
    tokensJson: string,
    action: string,
    resourceJson: string,
    contextJson: string
  ): Promise<string>;
  getLogIds(): Promise<string>;
  getLogById(id: string): Promise<string>;
  getLogsByRequestId(requestId: string): Promise<string>;
  getLogsByRequestIdAndTag(requestId: string, tag: string): Promise<string>;
  getLogsByTag(tag: string): Promise<string>;
  popLogs(): Promise<string>;
  pushDataContext(key: string, valueJson: string, ttlSeconds: number | null): Promise<void>;
  getDataContext(key: string): Promise<string>;
  getDataContextEntry(key: string): Promise<string>;
  removeDataContext(key: string): Promise<boolean>;
  clearDataContext(): Promise<void>;
  listDataContext(): Promise<string>;
  getDataContextStats(): Promise<string>;
  isTrustedIssuerLoadedByName(name: string): Promise<boolean>;
  isTrustedIssuerLoadedByIssuer(issuer: string): Promise<boolean>;
  getTrustedIssuerSummary(): Promise<string>;
  dispose(): Promise<void>;
  getNativeInfo(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('CedarlingReactNative');
