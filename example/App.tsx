import { Asset } from 'expo-asset';
import { useCallback } from 'react';

import CedarlingDemo from '../demo/CedarlingDemo';

export default function App() {
  const loadPolicyStoreUri = useCallback(async () => {
    const archive = Asset.fromModule(require('./assets/policy-store.cjar'));
    await archive.downloadAsync();
    if (!archive.localUri) {
      throw new Error('Policy-store asset has no local URI');
    }
    return archive.localUri;
  }, []);

  return <CedarlingDemo loadPolicyStoreUri={loadPolicyStoreUri} runtimeLabel="Expo" />;
}
