describe('iOS native entrypoint', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('loads the Cedarling Expo module and preserves the public mapping layer', async () => {
    const nativeModule = {
      initialize: jest.fn(async () => undefined),
      isInitialized: jest.fn(async () => true),
      authorizeUnsigned: jest.fn(async () => ({
        allowed: true,
        decision: 'ALLOW',
        requestId: 'ios-request',
        diagnostics: { reasons: ['allow_reader'], errors: [] },
      })),
      authorizeMultiIssuer: jest.fn(),
      getLogIds: jest.fn(async () => []),
      getLogById: jest.fn(),
      getLogsByRequestId: jest.fn(),
      getLogsByRequestIdAndTag: jest.fn(),
      getLogsByTag: jest.fn(),
      popLogs: jest.fn(),
      pushDataContext: jest.fn(),
      getDataContext: jest.fn(),
      getDataContextEntry: jest.fn(),
      removeDataContext: jest.fn(),
      clearDataContext: jest.fn(),
      listDataContext: jest.fn(),
      getDataContextStats: jest.fn(),
      isTrustedIssuerLoadedByName: jest.fn(),
      isTrustedIssuerLoadedByIssuer: jest.fn(),
      getTrustedIssuerSummary: jest.fn(),
      dispose: jest.fn(async () => undefined),
      getNativeInfo: jest.fn(async () => ({
        sdkVersion: '0.1.0',
        cedarlingRevision: 'f7c6e34be6ac8d585a9d7b6f7a12921b440b495b',
        cedarlingCrateVersion: '2.3.0',
        uniffiVersion: '0.29.5',
        abis: ['ios-arm64', 'ios-simulator-arm64'],
      })),
    };
    const requireNativeModule = jest.fn(() => nativeModule);

    jest.doMock('expo', () => ({
      NativeModule: class {},
      requireNativeModule,
    }));

    let Cedarling: typeof import('../CedarlingModule.ios').Cedarling;
    jest.isolateModules(() => {
      Cedarling = require('../CedarlingModule.ios').Cedarling;
    });

    expect(requireNativeModule).toHaveBeenCalledWith('CedarlingReactNative');
    await expect(Cedarling!.isInitialized()).resolves.toBe(true);
    await expect(
      Cedarling!.authorizeUnsigned({
        principal: {
          cedar_entity_mapping: {
            entity_type: 'Example::User',
            id: 'alice',
          },
        },
        action: 'Example::Action::"Read"',
        resource: {
          cedar_entity_mapping: {
            entity_type: 'Example::Document',
            id: 'document-1',
          },
        },
      })
    ).resolves.toMatchObject({
      allowed: true,
      decision: 'ALLOW',
      requestId: 'ios-request',
    });
  });
});
