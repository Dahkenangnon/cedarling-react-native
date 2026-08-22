import { createCedarlingApi } from '../createCedarlingApi';
import { CedarlingError, normalizeCedarlingError } from '../errors';
import { mapAuthorizeResult } from '../result';
import type { CedarEntity, CedarlingNativeModule } from '../types';
import { createUnsupportedApi } from '../unsupported';

const resource: CedarEntity = {
  cedar_entity_mapping: {
    entity_type: 'Example::Document',
    id: 'document-1',
  },
};

const principal: CedarEntity = {
  cedar_entity_mapping: {
    entity_type: 'Example::User',
    id: 'alice',
  },
  role: 'reader',
};

function nativeModule(): jest.Mocked<CedarlingNativeModule> {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockResolvedValue(true),
    authorizeUnsigned: jest.fn().mockResolvedValue({
      allowed: true,
      decision: 'ALLOW',
      requestId: 'request-1',
      diagnostics: { reasons: ['allow_reader'], errors: [] },
    }),
    authorizeMultiIssuer: jest.fn().mockResolvedValue({
      allowed: false,
      decision: 'DENY',
      requestId: 'request-2',
      diagnostics: { reasons: [], errors: [] },
    }),
    dispose: jest.fn().mockResolvedValue(undefined),
    getNativeInfo: jest.fn().mockResolvedValue({
      sdkVersion: '0.1.0',
      cedarlingRevision: 'f7c6e34be6ac8d585a9d7b6f7a12921b440b495b',
      cedarlingCrateVersion: '0.1.0',
      uniffiVersion: '0.29.5',
      abis: ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
    }),
  };
}

describe('Cedarling TypeScript boundary', () => {
  test('serializes bootstrap objects', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await api.initialize({
      bootstrap: {
        CEDARLING_APPLICATION_NAME: 'Example',
        CEDARLING_LOG_TYPE: 'off',
      },
    });

    expect(native.initialize).toHaveBeenCalledWith(
      JSON.stringify({
        CEDARLING_APPLICATION_NAME: 'Example',
        CEDARLING_LOG_TYPE: 'off',
      }),
      null
    );
  });

  test('normalizes valid bootstrap JSON strings', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await api.initialize({ bootstrap: ' { "CEDARLING_APPLICATION_NAME": "Example" } ' });

    expect(native.initialize).toHaveBeenCalledWith(
      '{"CEDARLING_APPLICATION_NAME":"Example"}',
      null
    );
  });

  test('serializes entities and defaults context to an empty object', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await api.authorizeUnsigned({
      principal,
      action: 'Example::Action::"Read"',
      resource,
    });

    expect(native.authorizeUnsigned).toHaveBeenCalledWith(
      JSON.stringify(principal),
      'Example::Action::"Read"',
      JSON.stringify(resource),
      '{}'
    );
  });

  test('converts multi-issuer tokens into a single JSON argument', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await api.authorizeMultiIssuer({
      tokens: [{ mapping: 'Example::AccessToken', payload: 'header.payload.signature' }],
      action: 'Example::Action::"Read"',
      resource,
    });

    expect(native.authorizeMultiIssuer).toHaveBeenCalledWith(
      '[{"mapping":"Example::AccessToken","payload":"header.payload.signature"}]',
      'Example::Action::"Read"',
      JSON.stringify(resource),
      '{}'
    );
  });

  test('maps the complete native authorization result', async () => {
    const result = mapAuthorizeResult({
      allowed: true,
      decision: 'ALLOW',
      requestId: 'request-1',
      diagnostics: { reasons: ['allow_reader'], errors: ['nonfatal diagnostic'] },
    });

    expect(result).toEqual({
      allowed: true,
      decision: 'ALLOW',
      requestId: 'request-1',
      diagnostics: { reasons: ['allow_reader'], errors: ['nonfatal diagnostic'] },
    });
  });

  test('fails closed when Boolean and Cedar decisions disagree', () => {
    expect(() =>
      mapAuthorizeResult({
        allowed: true,
        decision: 'DENY',
        requestId: 'request-1',
        diagnostics: { reasons: [], errors: [] },
      })
    ).toThrow(expect.objectContaining({ code: 'E_NATIVE_RESULT_INCONSISTENT' }));
  });

  test.each([
    {
      label: 'empty action',
      request: { principal, action: '', resource },
    },
    {
      label: 'missing entity type',
      request: {
        principal,
        action: 'Example::Action::"Read"',
        resource: {
          cedar_entity_mapping: { entity_type: '', id: 'document-1' },
        },
      },
    },
    {
      label: 'missing entity id',
      request: {
        principal,
        action: 'Example::Action::"Read"',
        resource: {
          cedar_entity_mapping: { entity_type: 'Example::Document', id: '' },
        },
      },
    },
  ])('rejects $label before native invocation', async ({ request }) => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await expect(api.authorizeUnsigned(request as never)).rejects.toMatchObject({
      code: 'E_INVALID_INPUT',
    });
    expect(native.authorizeUnsigned).not.toHaveBeenCalled();
  });

  test('rejects malformed bootstrap JSON before native invocation', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await expect(api.initialize({ bootstrap: '{' })).rejects.toMatchObject({
      code: 'E_INVALID_JSON',
    });
    expect(native.initialize).not.toHaveBeenCalled();
  });

  test('rejects non-JSON context before native invocation', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);
    const context = { score: Number.NaN };

    await expect(
      api.authorizeUnsigned({
        principal,
        action: 'Example::Action::"Read"',
        resource,
        context,
      })
    ).rejects.toMatchObject({ code: 'E_INVALID_JSON' });
    expect(native.authorizeUnsigned).not.toHaveBeenCalled();
  });

  test('rejects empty multi-issuer tokens before native invocation', async () => {
    const native = nativeModule();
    const api = createCedarlingApi(native);

    await expect(
      api.authorizeMultiIssuer({
        tokens: [],
        action: 'Example::Action::"Read"',
        resource,
      })
    ).rejects.toMatchObject({ code: 'E_INVALID_INPUT' });
    expect(native.authorizeMultiIssuer).not.toHaveBeenCalled();
  });

  test('normalizes known native codes and hides unknown ones', () => {
    expect(normalizeCedarlingError({ code: 'E_ARCHIVE_IO', message: 'cannot read' })).toMatchObject(
      {
        code: 'E_ARCHIVE_IO',
        message: 'cannot read',
      }
    );
    expect(
      normalizeCedarlingError({ code: 'SENSITIVE_INTERNAL', message: 'failed' })
    ).toMatchObject({
      code: 'E_NATIVE',
      message: 'failed',
    });
  });

  test('returns stable unsupported-platform errors without loading native code', async () => {
    const api = createUnsupportedApi('Web');

    await expect(api.isInitialized()).rejects.toEqual(
      new CedarlingError(
        'E_UNSUPPORTED_PLATFORM',
        'cedarling-react-native supports Android only; received Web'
      )
    );
  });
});
