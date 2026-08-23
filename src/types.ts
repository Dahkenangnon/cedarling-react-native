export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type CedarEntity = JsonObject & {
  cedar_entity_mapping: {
    entity_type: string;
    id: string;
  };
};

export type CedarlingToken = {
  mapping: string;
  payload: string;
};

export type CedarlingInitOptions = {
  bootstrap: JsonObject | string;
  policyStore?: {
    kind: 'archive';
    uri: string;
  };
};

export type AuthorizeUnsignedRequest = {
  principal?: CedarEntity | null;
  action: string;
  resource: CedarEntity;
  context?: JsonObject;
};

export type AuthorizeMultiIssuerRequest = {
  tokens: CedarlingToken[];
  action: string;
  resource: CedarEntity;
  context?: JsonObject;
};

export type CedarlingDiagnostics = {
  reasons: string[];
  errors: string[];
};

export type CedarlingAuthorizeResult = {
  allowed: boolean;
  decision: 'ALLOW' | 'DENY';
  requestId: string;
  diagnostics: CedarlingDiagnostics;
};

export type CedarlingNativeInfo = {
  sdkVersion: string;
  cedarlingRevision: string;
  cedarlingCrateVersion: string;
  uniffiVersion: string;
  abis: string[];
};

export type CedarlingDataEntry = {
  key: string;
  value: JsonValue;
  dataType: string;
  createdAt: string;
  expiresAt: string | null;
  accessCount: number;
};

export type CedarlingDataStoreStats = {
  entryCount: number;
  maxEntries: number;
  maxEntrySize: number;
  metricsEnabled: boolean;
  totalSizeBytes: number;
  averageEntrySizeBytes: number;
  capacityUsagePercent: number;
  memoryAlertThreshold: number;
  memoryAlertTriggered: boolean;
};

export type CedarlingTrustedIssuerSummary = {
  total: number;
  loaded: number;
  loadedIds: string[];
  failedIds: string[];
};

export interface CedarlingApi {
  initialize(options: CedarlingInitOptions): Promise<void>;
  isInitialized(): Promise<boolean>;
  authorizeUnsigned(request: AuthorizeUnsignedRequest): Promise<CedarlingAuthorizeResult>;
  authorizeMultiIssuer(request: AuthorizeMultiIssuerRequest): Promise<CedarlingAuthorizeResult>;
  getLogIds(): Promise<string[]>;
  getLogById(id: string): Promise<string>;
  getLogsByRequestId(requestId: string): Promise<string[]>;
  getLogsByRequestIdAndTag(requestId: string, tag: string): Promise<string[]>;
  getLogsByTag(tag: string): Promise<string[]>;
  popLogs(): Promise<string[]>;
  pushDataContext(key: string, value: JsonValue, ttlSeconds?: number): Promise<void>;
  getDataContext(key: string): Promise<JsonValue | null>;
  getDataContextEntry(key: string): Promise<CedarlingDataEntry | null>;
  removeDataContext(key: string): Promise<boolean>;
  clearDataContext(): Promise<void>;
  listDataContext(): Promise<CedarlingDataEntry[]>;
  getDataContextStats(): Promise<CedarlingDataStoreStats>;
  isTrustedIssuerLoadedByName(name: string): Promise<boolean>;
  isTrustedIssuerLoadedByIssuer(issuer: string): Promise<boolean>;
  getTrustedIssuerSummary(): Promise<CedarlingTrustedIssuerSummary>;
  dispose(): Promise<void>;
  getNativeInfo(): Promise<CedarlingNativeInfo>;
}

export interface CedarlingNativeModule {
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
