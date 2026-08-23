import { Asset } from 'expo-asset';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Cedarling,
  CedarlingError,
  type CedarEntity,
  type CedarlingAuthorizeResult,
  type CedarlingNativeInfo,
  type JsonObject,
} from 'cedarling-react-native';

import allowPrincipalJson from './assets/fixtures/allow-principal.json';
import bootstrapJson from './assets/fixtures/bootstrap.json';
import denyPrincipalJson from './assets/fixtures/deny-principal.json';
import resourceJson from './assets/fixtures/resource.json';

type RunStatus = 'idle' | 'running' | 'pass' | 'fail';

const action = 'ReactNativeExample::Action::"Read"';
const allowPrincipal = allowPrincipalJson as CedarEntity;
const denyPrincipal = denyPrincipalJson as CedarEntity;
const resource = resourceJson as CedarEntity;
const bootstrap = bootstrapJson as JsonObject;

export default function App() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nativeInfo, setNativeInfo] = useState<CedarlingNativeInfo | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [archiveUri, setArchiveUri] = useState<string | null>(null);
  const [allowResult, setAllowResult] = useState<CedarlingAuthorizeResult | null>(null);
  const [denyResult, setDenyResult] = useState<CedarlingAuthorizeResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [completedRuns, setCompletedRuns] = useState(0);

  const runSmokeTests = useCallback(async () => {
    const startedAt = performance.now();
    setStatus('running');
    setError(null);
    setAllowResult(null);
    setDenyResult(null);

    try {
      const archive = Asset.fromModule(require('./assets/policy-store.cjar'));
      await archive.downloadAsync();
      if (!archive.localUri) {
        throw new CedarlingError('E_ARCHIVE_IO', 'Policy-store asset has no local URI');
      }
      setArchiveUri(archive.localUri);

      await Cedarling.initialize({
        bootstrap,
        policyStore: {
          kind: 'archive',
          uri: archive.localUri,
        },
      });
      setInitialized(await Cedarling.isInitialized());
      setNativeInfo(await Cedarling.getNativeInfo());

      const allow = await Cedarling.authorizeUnsigned({
        principal: allowPrincipal,
        action,
        resource,
      });
      setAllowResult(allow);

      const deny = await Cedarling.authorizeUnsigned({
        principal: denyPrincipal,
        action,
        resource,
      });
      setDenyResult(deny);

      if (!allow.allowed || allow.decision !== 'ALLOW') {
        throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'Expected real ALLOW decision');
      }
      if (deny.allowed || deny.decision !== 'DENY') {
        throw new CedarlingError('E_NATIVE_RESULT_INCONSISTENT', 'Expected real DENY decision');
      }

      setCompletedRuns((count) => count + 1);
      setStatus('pass');
    } catch (caught) {
      const message =
        caught instanceof CedarlingError || caught instanceof Error
          ? (caught as CedarlingError).code
            ? (caught as CedarlingError).code + ': ' + caught.message
            : caught.message
          : 'Unknown smoke-test failure';
      setError(message);
      setInitialized(false);
      setStatus('fail');
    } finally {
      setElapsedMs(performance.now() - startedAt);
    }
  }, []);

  const disposeAndReinitialize = useCallback(async () => {
    try {
      await Cedarling.dispose();
      setInitialized(false);
      await runSmokeTests();
    } catch (caught) {
      setStatus('fail');
      setError(caught instanceof Error ? caught.message : 'Dispose failed');
    }
  }, [runSmokeTests]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NATIVE AUTHORIZATION EXPERIMENT</Text>
        <Text style={styles.header}>Cedarling on React Native</Text>
        <Text style={styles.intro}>
          Real Cedar authorization through Expo Modules, platform-native UniFFI bindings, and the
          embedded Rust core.
        </Text>

        <View style={styles.summary}>
          <Metric label="Platform" value={Platform.OS} testID="platform" />
          <Metric label="SDK" value={nativeInfo?.sdkVersion ?? 'Not loaded'} testID="sdk-version" />
          <Metric
            label="Revision"
            value={nativeInfo?.cedarlingRevision.slice(0, 12) ?? 'Not loaded'}
            testID="cedarling-revision"
          />
          <Metric
            label="Execution"
            value={elapsedMs == null ? 'Not run' : elapsedMs.toFixed(1) + ' ms'}
            testID="execution-time"
          />
          <Metric label="Completed runs" value={String(completedRuns)} testID="completed-runs" />
        </View>

        <StatusRow
          label="Native initialization"
          status={initialized ? 'pass' : status === 'running' ? 'running' : 'idle'}
          detail={initialized ? 'One synchronized Cedarling instance is active' : 'Not initialized'}
          testID="initialization-status"
        />
        <StatusRow
          label="Policy archive"
          status={archiveUri ? 'pass' : status === 'running' ? 'running' : 'idle'}
          detail={archiveUri ? 'Local Expo Asset URI ready' : 'Waiting for bundled .cjar'}
          testID="archive-status"
        />
        <DecisionCard
          label="Reader request"
          expected="ALLOW"
          result={allowResult}
          testID="allow-result"
        />
        <DecisionCard
          label="Guest request"
          expected="DENY"
          result={denyResult}
          testID="deny-result"
        />

        {error ? (
          <View style={styles.errorCard} testID="smoke-error">
            <Text style={styles.errorTitle}>FAIL</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <ActionButton
            label="Run native smoke tests"
            onPress={runSmokeTests}
            disabled={status === 'running'}
            testID="run-native-smoke-tests"
          />
          <ActionButton
            label="Dispose and reinitialize"
            onPress={disposeAndReinitialize}
            disabled={status === 'running' || !initialized}
            secondary
            testID="dispose-and-reinitialize"
          />
        </View>

        <View style={styles.overall} testID="overall-status">
          {status === 'running' ? <ActivityIndicator color="#22c55e" /> : null}
          <Text style={styles.overallText} testID="overall-status-value">
            {status === 'idle'
              ? 'READY'
              : status === 'running'
                ? 'RUNNING'
                : status === 'pass'
                  ? 'PASS'
                  : 'FAIL'}
          </Text>
        </View>

        <Text style={styles.note}>
          This app requires an Expo development build and does not run in Expo Go. Mobile
          authorization is defense in depth; backend services must independently authorize protected
          operations.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.metric} testID={testID}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} testID={testID + '-value'}>
        {value}
      </Text>
    </View>
  );
}

function StatusRow({
  label,
  status,
  detail,
  testID,
}: {
  label: string;
  status: RunStatus;
  detail: string;
  testID: string;
}) {
  return (
    <View style={styles.statusRow} testID={testID}>
      <View style={[styles.dot, status === 'pass' && styles.dotPass]} />
      <View style={styles.statusCopy}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function DecisionCard({
  label,
  expected,
  result,
  testID,
}: {
  label: string;
  expected: 'ALLOW' | 'DENY';
  result: CedarlingAuthorizeResult | null;
  testID: string;
}) {
  const passed = result?.decision === expected;
  return (
    <View style={styles.decisionCard} testID={testID}>
      <View style={styles.decisionHeader}>
        <View>
          <Text style={styles.decisionLabel}>{label}</Text>
          <Text style={styles.expected}>Expected {expected}</Text>
        </View>
        <Text style={[styles.badge, passed && styles.badgePass]} testID={testID + '-decision'}>
          {result ? result.decision : 'PENDING'}
        </Text>
      </View>
      <Text style={styles.detailLabel}>Request ID</Text>
      <Text style={styles.monospace} testID={testID + '-request-id'}>
        {result?.requestId ?? '—'}
      </Text>
      <Text style={styles.detailLabel}>Reason IDs</Text>
      <Text style={styles.monospace} testID={testID + '-reasons'}>
        {result?.diagnostics.reasons.join(', ') || '—'}
      </Text>
      <Text style={styles.detailLabel}>Diagnostic errors</Text>
      <Text style={styles.monospace} testID={testID + '-errors'}>
        {result?.diagnostics.errors.join(', ') || '—'}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  secondary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  secondary?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
      testID={testID}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07130f' },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  eyebrow: { color: '#86efac', fontSize: 12, fontWeight: '700', letterSpacing: 1.8 },
  header: { color: '#f0fdf4', fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  intro: { color: '#a7b7ae', fontSize: 15, lineHeight: 22, marginBottom: 6 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    width: '48%',
    backgroundColor: '#10221a',
    borderColor: '#254837',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  metricLabel: { color: '#7c9b8b', fontSize: 11, textTransform: 'uppercase' },
  metricValue: { color: '#dcfce7', fontSize: 14, fontWeight: '700', marginTop: 5 },
  statusRow: {
    alignItems: 'center',
    backgroundColor: '#0c1b15',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 14,
  },
  dot: { backgroundColor: '#52615a', borderRadius: 6, height: 12, width: 12 },
  dotPass: { backgroundColor: '#22c55e' },
  statusCopy: { marginLeft: 12, flex: 1 },
  statusLabel: { color: '#ecfdf5', fontSize: 15, fontWeight: '700' },
  statusDetail: { color: '#8ca398', fontSize: 12, marginTop: 2 },
  decisionCard: {
    backgroundColor: '#f5fbf7',
    borderRadius: 16,
    padding: 16,
  },
  decisionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  decisionLabel: { color: '#10221a', fontSize: 18, fontWeight: '800' },
  expected: { color: '#5c7468', fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: '#dce5e0',
    borderRadius: 999,
    color: '#4b6256',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgePass: { backgroundColor: '#bbf7d0', color: '#14532d' },
  detailLabel: { color: '#708379', fontSize: 10, marginTop: 7, textTransform: 'uppercase' },
  monospace: { color: '#173327', fontFamily: 'monospace', fontSize: 12, marginTop: 2 },
  errorCard: { backgroundColor: '#451a1a', borderRadius: 12, padding: 14 },
  errorTitle: { color: '#fca5a5', fontWeight: '800' },
  errorText: { color: '#fecaca', fontSize: 12, lineHeight: 18, marginTop: 5 },
  actions: { gap: 10, marginTop: 2 },
  button: {
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonSecondary: { backgroundColor: 'transparent', borderColor: '#3f6552', borderWidth: 1 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#052e16', fontSize: 15, fontWeight: '800' },
  buttonTextSecondary: { color: '#bbf7d0' },
  overall: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  overallText: { color: '#86efac', fontSize: 13, fontWeight: '800', letterSpacing: 1.4 },
  note: { color: '#6f897c', fontSize: 11, lineHeight: 17, marginTop: 4 },
});
