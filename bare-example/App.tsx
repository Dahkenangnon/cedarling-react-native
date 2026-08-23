import { Platform } from 'react-native';
import { useCallback } from 'react';

import CedarlingDemo from '../demo/CedarlingDemo';

export default function App() {
  const loadPolicyStoreUri = useCallback(async () => {
    if (Platform.OS === 'android') {
      return 'asset:///policy-store.cjar';
    }
    if (Platform.OS === 'ios') {
      return 'bundle:///policy-store.cjar';
    }
    throw new Error(`Unsupported bare example platform: ${Platform.OS}`);
  }, []);

  return (
    <CedarlingDemo
      loadPolicyStoreUri={loadPolicyStoreUri}
      runtimeLabel="Bare React Native"
    />
  );
}
