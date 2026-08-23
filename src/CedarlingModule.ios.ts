import nativeModule from './NativeCedarlingReactNative';
import { createCedarlingApi } from './createCedarlingApi';
import { createTurboModuleAdapter } from './turboModuleAdapter';

export const Cedarling = createCedarlingApi(createTurboModuleAdapter(nativeModule));
