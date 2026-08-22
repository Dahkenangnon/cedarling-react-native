import { NativeModule, requireNativeModule } from 'expo';

declare class CedarlingReactNativeModule extends NativeModule<{}> {}

export default requireNativeModule<CedarlingReactNativeModule>('CedarlingReactNative');
