import { registerWebModule, NativeModule } from 'expo';

// CedarlingReactNativeModule is not available on the web platform.
class CedarlingReactNativeModule extends NativeModule<{}> {}

export default registerWebModule(CedarlingReactNativeModule, 'CedarlingReactNativeModule');
