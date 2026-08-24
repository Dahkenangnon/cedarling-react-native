describe('iOS TurboModule entrypoint', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('resolves Cedarling through TurboModuleRegistry and preserves public mapping', async () => {
    const transport = {
      isInitialized: jest.fn(async () => true),
      authorizeUnsigned: jest.fn(async () =>
        JSON.stringify({
          allowed: true,
          decision: 'ALLOW',
          requestId: 'ios-request',
          diagnostics: { reasons: ['allow_reader'], errors: [] },
        })
      ),
    };
    const getEnforcing = jest.fn(() => transport);

    jest.doMock('react-native', () => ({
      TurboModuleRegistry: { getEnforcing },
    }));

    let Cedarling: typeof import('../CedarlingModule.ios').Cedarling;
    jest.isolateModules(() => {
      Cedarling = require('../CedarlingModule.ios').Cedarling;
    });

    expect(getEnforcing).toHaveBeenCalledWith('CedarlingReactNative');
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
