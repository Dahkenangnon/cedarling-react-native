import type { Spec } from '../NativeCedarlingReactNative';
import { createTurboModuleAdapter } from '../turboModuleAdapter';

function transport(overrides: Partial<Spec> = {}): Spec {
  return {
    getLogIds: jest.fn(async () => '["log-1","log-2"]'),
    getDataContextEntry: jest.fn(async () => 'null'),
    getNativeInfo: jest.fn(async () =>
      JSON.stringify({
        sdkVersion: '0.1.0',
        cedarlingRevision: 'f7c6e34be6ac8d585a9d7b6f7a12921b440b495b',
        cedarlingCrateVersion: '2.3.0',
        uniffiVersion: '0.29.5',
        abis: ['ios-arm64'],
      })
    ),
    ...overrides,
  } as unknown as Spec;
}

describe('TurboModule JSON transport adapter', () => {
  test('decodes complex values without changing raw log strings', async () => {
    const rawLog = '{"id":"log-1","log_level":"DEBUG"}';
    const native = transport({
      getLogById: jest.fn(async () => rawLog),
    });
    const adapter = createTurboModuleAdapter(native);

    await expect(adapter.getLogIds()).resolves.toEqual(['log-1', 'log-2']);
    await expect(adapter.getDataContextEntry('missing')).resolves.toBeNull();
    await expect(adapter.getLogById('log-1')).resolves.toBe(rawLog);
    await expect(adapter.getNativeInfo()).resolves.toMatchObject({
      cedarlingCrateVersion: '2.3.0',
    });
  });

  test('fails closed when native transport JSON is malformed', async () => {
    const adapter = createTurboModuleAdapter(transport({ getLogIds: jest.fn(async () => '{') }));

    await expect(adapter.getLogIds()).rejects.toMatchObject({
      code: 'E_NATIVE_RESULT_INCONSISTENT',
      message: 'native log IDs must contain valid transport JSON',
    });
  });
});
