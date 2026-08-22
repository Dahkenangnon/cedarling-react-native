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

export interface CedarlingApi {
  initialize(options: CedarlingInitOptions): Promise<void>;
  isInitialized(): Promise<boolean>;
  authorizeUnsigned(request: AuthorizeUnsignedRequest): Promise<CedarlingAuthorizeResult>;
  authorizeMultiIssuer(request: AuthorizeMultiIssuerRequest): Promise<CedarlingAuthorizeResult>;
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
  dispose(): Promise<void>;
  getNativeInfo(): Promise<unknown>;
}
