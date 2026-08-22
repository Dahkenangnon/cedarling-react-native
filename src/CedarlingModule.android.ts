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
  dispose(): Promise<void>;
  getNativeInfo(): Promise<unknown>;
}

const nativeModule = requireNativeModule<CedarlingExpoNativeModule>('CedarlingReactNative');

export const Cedarling = createCedarlingApi(nativeModule);
