import {
  Cedarling,
  CedarlingError,
  type AuthorizeUnsignedRequest,
  type CedarEntity,
  type CedarlingAuthorizeResult,
  type CedarlingNativeInfo,
  type JsonObject,
} from 'cedarling-react-native';
import { useCallback, useMemo, useState } from 'react';
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

import { sanitizeTraceValue } from './sanitizeTrace';
import allowPrincipalJson from '../example/assets/fixtures/allow-principal.json';
import bootstrapJson from '../example/assets/fixtures/bootstrap.json';
import denyPrincipalJson from '../example/assets/fixtures/deny-principal.json';
import resourceJson from '../example/assets/fixtures/resource.json';

type RunStatus = 'idle' | 'running' | 'pass' | 'fail';

type Scenario = {
  id: string;
  label: string;
  description: string;
  expected: 'ALLOW' | 'DENY';
  request: AuthorizeUnsignedRequest;
};

type DebugEvent = {
  timestamp: string;
  operation: string;
  phase: 'start' | 'success' | 'error' | 'info';
  detail: unknown;
};

const action = 'ReactNativeExample::Action::"Read"';
const allowPrincipal = allowPrincipalJson as CedarEntity;
const denyPrincipal = denyPrincipalJson as CedarEntity;
const resource = resourceJson as CedarEntity;
const bootstrap = bootstrapJson as JsonObject;
const contextKey = 'demo-session';

export type CedarlingDemoProps = {
  loadPolicyStoreUri: () => Promise<string>;
  runtimeLabel: string;
};

const scenarios: Scenario[] = [
  {
    id: 'reader',
    label: 'Reader can read',
    description: 'Alice has role=reader, so allow_reader applies.',
    expected: 'ALLOW',
    request: { principal: allowPrincipal, action, resource },
  },
  {
    id: 'guest',
    label: 'Guest is denied',
    description: 'Mallory has role=guest, so no permit policy applies.',
    expected: 'DENY',
    request: { principal: denyPrincipal, action, resource },
  },
  {
    id: 'anonymous',
    label: 'Anonymous is denied',
    description: 'The principal is absent, so the User-scoped permit cannot match.',
    expected: 'DENY',
    request: { principal: null, action, resource },
  },
];

export default function CedarlingDemo({ loadPolicyStoreUri, runtimeLabel }: CedarlingDemoProps) {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nativeInfo, setNativeInfo] = useState<CedarlingNativeInfo | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [archiveUri, setArchiveUri] = useState<string | null>(null);
  const [allowResult, setAllowResult] = useState<CedarlingAuthorizeResult | null>(null);
  const [denyResult, setDenyResult] = useState<CedarlingAuthorizeResult | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0].id);
  const [selectedResult, setSelectedResult] = useState<CedarlingAuthorizeResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [completedRuns, setCompletedRuns] = useState(0);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [nativeLogs, setNativeLogs] = useState<string[]>([]);
  const [apiReport, setApiReport] = useState<unknown>(null);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0],
    [selectedScenarioId]
  );

  const appendEvent = useCallback(
    (operation: string, phase: DebugEvent['phase'], detail: unknown) => {
      setEvents((current) => [
        ...current,
        {
          timestamp: new Date().toISOString(),
          operation,
          phase,
          detail: sanitizeTraceValue(detail),
        },
      ]);
    },
    []
  );

  const trace = useCallback(
    async <T,>(operation: string, input: unknown, task: () => Promise<T>): Promise<T> => {
      const startedAt = Date.now();
      appendEvent(operation, 'start', input);
      try {
        const result = await task();
        appendEvent(operation, 'success', {
          durationMs: Date.now() - startedAt,
          result,
        });
        return result;
      } catch (caught) {
        appendEvent(operation, 'error', {
          durationMs: Date.now() - startedAt,
          error: errorMessage(caught),
        });
        throw caught;
      }
    },
    [appendEvent]
  );

  const initializeIfNeeded = useCallback(async () => {
    const alreadyInitialized = await trace('isInitialized', null, () => Cedarling.isInitialized());
    if (alreadyInitialized) {
      setInitialized(true);
      if (!nativeInfo) {
        setNativeInfo(await trace('getNativeInfo', null, () => Cedarling.getNativeInfo()));
      }
      return;
    }

    const resolvedArchiveUri = await trace(
      'loadPolicyStoreUri',
      { runtime: runtimeLabel },
      loadPolicyStoreUri
    );
    if (resolvedArchiveUri.trim().length === 0) {
      throw new CedarlingError('E_ARCHIVE_IO', 'Policy-store loader returned no URI');
    }
    setArchiveUri(resolvedArchiveUri);
    await trace(
      'initialize',
      { bootstrap, policyStore: { kind: 'archive', uri: resolvedArchiveUri } },
      () =>
        Cedarling.initialize({
          bootstrap,
          policyStore: { kind: 'archive', uri: resolvedArchiveUri },
        })
    );
    setInitialized(await trace('isInitialized', null, () => Cedarling.isInitialized()));
    setNativeInfo(await trace('getNativeInfo', null, () => Cedarling.getNativeInfo()));
  }, [loadPolicyStoreUri, nativeInfo, runtimeLabel, trace]);

  const refreshNativeLogs = useCallback(
    async (requestId?: string) => {
      const ids = await Cedarling.getLogIds();
      const logs: string[] = [];
      for (const id of ids) {
        logs.push(await Cedarling.getLogById(id));
      }
      setNativeLogs(logs);
      appendEvent('refreshNativeLogs', 'info', {
        ids,
        requestId,
        requestLogCount: requestId
          ? (await Cedarling.getLogsByRequestId(requestId)).length
          : undefined,
      });
      return { ids, logs };
    },
    [appendEvent]
  );

  const runScenario = useCallback(
    async (scenario: Scenario, updateSelectedResult = true) => {
      const result = await trace('authorizeUnsigned', scenario.request, () =>
        Cedarling.authorizeUnsigned(scenario.request)
      );
      if (result.decision !== scenario.expected) {
        throw new CedarlingError(
          'E_NATIVE_RESULT_INCONSISTENT',
          `Expected ${scenario.expected}, received ${result.decision}`
        );
      }
      if (updateSelectedResult) {
        setSelectedResult(result);
      }
      if (scenario.id === 'reader') {
        setAllowResult(result);
      }
      if (scenario.id === 'guest') {
        setDenyResult(result);
      }
      await refreshNativeLogs(result.requestId);
      return result;
    },
    [refreshNativeLogs, trace]
  );

  const runSelectedScenario = useCallback(async () => {
    const startedAt = Date.now();
    setStatus('running');
    setError(null);
    setSelectedResult(null);
    try {
      await initializeIfNeeded();
      await runScenario(selectedScenario);
      setCompletedRuns((count) => count + 1);
      setStatus('pass');
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('fail');
    } finally {
      setElapsedMs(Date.now() - startedAt);
    }
  }, [initializeIfNeeded, runScenario, selectedScenario]);

  const runSmokeTests = useCallback(async () => {
    const startedAt = Date.now();
    setStatus('running');
    setError(null);
    setAllowResult(null);
    setDenyResult(null);

    try {
      await initializeIfNeeded();
      const allow = await runScenario(scenarios[0], false);
      const deny = await runScenario(scenarios[1], false);
      setAllowResult(allow);
      setDenyResult(deny);
      setCompletedRuns((count) => count + 1);
      setStatus('pass');
    } catch (caught) {
      setError(errorMessage(caught));
      setInitialized(false);
      setStatus('fail');
    } finally {
      setElapsedMs(Date.now() - startedAt);
    }
  }, [initializeIfNeeded, runScenario]);

  const runApiExplorer = useCallback(async () => {
    const startedAt = Date.now();
    setStatus('running');
    setError(null);
    setApiReport(null);

    try {
      await initializeIfNeeded();
      const authorization = await runScenario(selectedScenario);

      const logIds = await trace('getLogIds', null, () => Cedarling.getLogIds());
      const firstLog = logIds[0]
        ? await trace('getLogById', { id: logIds[0] }, () => Cedarling.getLogById(logIds[0]))
        : null;
      const requestLogs = await trace(
        'getLogsByRequestId',
        { requestId: authorization.requestId },
        () => Cedarling.getLogsByRequestId(authorization.requestId)
      );
      const debugLogs = await trace('getLogsByTag', { tag: 'DEBUG' }, () =>
        Cedarling.getLogsByTag('DEBUG')
      );
      const requestDebugLogs = await trace(
        'getLogsByRequestIdAndTag',
        { requestId: authorization.requestId, tag: 'DEBUG' },
        () => Cedarling.getLogsByRequestIdAndTag(authorization.requestId, 'DEBUG')
      );

      const contextValue = {
        source: 'react-native-example',
        platform: Platform.OS,
        selectedScenario: selectedScenario.id,
      };
      await trace('pushDataContext', { key: contextKey, value: contextValue, ttlSeconds: 60 }, () =>
        Cedarling.pushDataContext(contextKey, contextValue, 60)
      );
      const context = await trace('getDataContext', { key: contextKey }, () =>
        Cedarling.getDataContext(contextKey)
      );
      const contextEntry = await trace('getDataContextEntry', { key: contextKey }, () =>
        Cedarling.getDataContextEntry(contextKey)
      );
      const contextEntries = await trace('listDataContext', null, () =>
        Cedarling.listDataContext()
      );
      const contextStats = await trace('getDataContextStats', null, () =>
        Cedarling.getDataContextStats()
      );
      const removed = await trace('removeDataContext', { key: contextKey }, () =>
        Cedarling.removeDataContext(contextKey)
      );
      await trace('pushDataContext', { key: contextKey, value: true }, () =>
        Cedarling.pushDataContext(contextKey, true)
      );
      await trace('clearDataContext', null, () => Cedarling.clearDataContext());

      const issuers = await trace('getTrustedIssuerSummary', null, () =>
        Cedarling.getTrustedIssuerSummary()
      );
      const issuerByName = await trace(
        'isTrustedIssuerLoadedByName',
        { name: 'offline-demo' },
        () => Cedarling.isTrustedIssuerLoadedByName('offline-demo')
      );
      const issuerByUrl = await trace(
        'isTrustedIssuerLoadedByIssuer',
        { issuer: 'https://invalid.example' },
        () => Cedarling.isTrustedIssuerLoadedByIssuer('https://invalid.example')
      );

      setApiReport({
        authorization,
        logs: {
          ids: logIds,
          firstLog,
          byRequest: requestLogs.length,
          byTag: debugLogs.length,
          byRequestAndTag: requestDebugLogs.length,
        },
        dataContext: { context, contextEntry, contextEntries, contextStats, removed },
        trustedIssuers: { ...issuers, demoNameLoaded: issuerByName, demoUrlLoaded: issuerByUrl },
        multiIssuer:
          'Not executed: the offline fixture intentionally has no trusted issuer or real JWT.',
        lifecycle: 'dispose() is exercised by the separate Dispose and reinitialize action.',
      });
      setCompletedRuns((count) => count + 1);
      setStatus('pass');
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('fail');
    } finally {
      setElapsedMs(Date.now() - startedAt);
    }
  }, [initializeIfNeeded, runScenario, selectedScenario, trace]);

  const popNativeLogs = useCallback(async () => {
    try {
      const popped = await trace('popLogs', null, () => Cedarling.popLogs());
      setNativeLogs(popped);
    } catch (caught) {
      setError(errorMessage(caught));
      setStatus('fail');
    }
  }, [trace]);

  const disposeAndReinitialize = useCallback(async () => {
    try {
      await trace('dispose', null, () => Cedarling.dispose());
      setInitialized(false);
      await runSmokeTests();
    } catch (caught) {
      setStatus('fail');
      setError(errorMessage(caught));
    }
  }, [runSmokeTests, trace]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NATIVE AUTHORIZATION LAB · {runtimeLabel.toUpperCase()}</Text>
        <Text style={styles.header}>Cedarling on React Native</Text>
        <Text style={styles.intro}>
          Run real Cedar decisions, inspect the complete mobile call path, and explore logs,
          data-context, issuer, and lifecycle APIs.
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
          <Metric label="Raw logs" value={String(nativeLogs.length)} testID="raw-log-count" />
        </View>

        <StatusRow
          label="Native initialization"
          status={initialized ? 'pass' : status === 'running' ? 'running' : 'idle'}
          detail={initialized ? 'One serialized Cedarling instance is active' : 'Not initialized'}
          testID="initialization-status"
        />
        <StatusRow
          label="Policy archive"
          status={archiveUri || initialized ? 'pass' : status === 'running' ? 'running' : 'idle'}
          detail={
            archiveUri ? 'Bundled .cjar resolved to a local URI' : 'Waiting for bundled .cjar'
          }
          testID="archive-status"
        />

        <SectionTitle
          title="Authorization requests"
          detail="Select one request, inspect its input, then run it through Rust."
        />
        <View style={styles.scenarioList}>
          {scenarios.map((scenario) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedScenario.id === scenario.id }}
              key={scenario.id}
              onPress={() => {
                setSelectedScenarioId(scenario.id);
                setSelectedResult(null);
              }}
              style={[
                styles.scenario,
                selectedScenario.id === scenario.id && styles.scenarioSelected,
              ]}
              testID={'scenario-' + scenario.id}>
              <View style={styles.scenarioHeader}>
                <Text style={styles.scenarioLabel}>{scenario.label}</Text>
                <Text style={styles.expected}>Expected {scenario.expected}</Text>
              </View>
              <Text style={styles.scenarioDescription}>{scenario.description}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.detailLabel}>Selected request</Text>
        <RawJson value={selectedScenario.request} />
        <ActionButton
          label="Run selected request"
          onPress={runSelectedScenario}
          disabled={status === 'running'}
          testID="run-selected-request"
        />
        {selectedResult ? (
          <DecisionCard
            label={selectedScenario.label}
            expected={selectedScenario.expected}
            result={selectedResult}
            testID="selected-result"
          />
        ) : null}

        <SectionTitle
          title="Automated smoke"
          detail="The stable ALLOW/DENY path used by Android and iOS UI automation."
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
            label="Run complete API explorer"
            onPress={runApiExplorer}
            disabled={status === 'running'}
            secondary
            testID="run-api-explorer"
          />
          <ActionButton
            label="Dispose and reinitialize"
            onPress={disposeAndReinitialize}
            disabled={status === 'running' || !initialized}
            secondary
            testID="dispose-and-reinitialize"
          />
        </View>

        {apiReport ? (
          <View style={styles.reportCard} testID="api-explorer-report">
            <Text style={styles.reportTitle}>API explorer report</Text>
            <RawJson value={apiReport} light />
          </View>
        ) : null}

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
          <Text style={styles.evidenceText} testID="smoke-evidence-summary">
            {status === 'pass' && allowResult && denyResult
              ? `ALLOW request: ${allowResult.decision} · DENY request: ${denyResult.decision}`
              : 'Run the native smoke test to capture decision evidence.'}
          </Text>
        </View>

        <Text style={styles.note}>
          Requires a native development/release build; it does not run in Expo Go. Client-side
          authorization is defense in depth. A backend must independently authorize protected
          operations.
        </Text>

        <View style={styles.debugPanel} testID="debug-panel">
          <Text style={styles.debugTitle}>Realtime diagnostics</Text>
          <Text style={styles.debugWarning}>
            Demo fixtures only. Raw logs and request traces may contain sensitive authorization
            data; do not expose this panel in production builds.
          </Text>
          <View style={styles.debugActions}>
            <SmallButton
              label="Refresh logs"
              onPress={() => refreshNativeLogs().catch((caught) => setError(errorMessage(caught)))}
              disabled={!initialized || status === 'running'}
              testID="refresh-native-logs"
            />
            <SmallButton
              label="Pop logs"
              onPress={popNativeLogs}
              disabled={!initialized || status === 'running'}
              testID="pop-native-logs"
            />
            <SmallButton
              label="Clear display"
              onPress={() => {
                setEvents([]);
                setNativeLogs([]);
              }}
              disabled={status === 'running'}
              testID="clear-debug-display"
            />
          </View>
          <Text style={styles.debugSection}>Cedarling raw memory logs ({nativeLogs.length})</Text>
          <Text selectable style={styles.debugText} testID="raw-native-logs">
            {nativeLogs.length > 0
              ? nativeLogs.map((log, index) => `[${index}] ${prettyRawLog(log)}`).join('\n\n')
              : 'No native logs loaded.'}
          </Text>
          <Text style={styles.debugSection}>JS → native call trace ({events.length})</Text>
          <Text selectable style={styles.debugText} testID="bridge-event-trace">
            {events.length > 0
              ? events.map((event) => JSON.stringify(event, null, 2)).join('\n\n')
              : 'No calls recorded.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function errorMessage(caught: unknown): string {
  if (caught instanceof CedarlingError) {
    return caught.code + ': ' + caught.message;
  }
  if (caught instanceof Error) {
    return caught.message;
  }
  return 'Unknown native operation failure';
}

function prettyRawLog(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
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

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
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
        <View style={styles.decisionCopy}>
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

function RawJson({ value, light = false }: { value: unknown; light?: boolean }) {
  return (
    <Text selectable style={[styles.rawJson, light && styles.rawJsonLight]}>
      {JSON.stringify(value, null, 2)}
    </Text>
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

function SmallButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.smallButton, disabled && styles.buttonDisabled]}
      testID={testID}>
      <Text style={styles.smallButtonText}>{label}</Text>
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
  sectionTitle: { marginTop: 12 },
  sectionHeading: { color: '#f0fdf4', fontSize: 21, fontWeight: '800' },
  sectionDetail: { color: '#8ca398', fontSize: 12, lineHeight: 18, marginTop: 3 },
  scenarioList: { gap: 8 },
  scenario: {
    backgroundColor: '#0c1b15',
    borderColor: '#254837',
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  scenarioSelected: { backgroundColor: '#133322', borderColor: '#4ade80', borderWidth: 2 },
  scenarioHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  scenarioLabel: { color: '#ecfdf5', flex: 1, fontSize: 15, fontWeight: '700' },
  scenarioDescription: { color: '#8ca398', fontSize: 12, lineHeight: 17, marginTop: 5 },
  decisionCard: { backgroundColor: '#f5fbf7', borderRadius: 16, padding: 16 },
  decisionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  decisionCopy: { flex: 1, paddingRight: 10 },
  decisionLabel: { color: '#10221a', fontSize: 18, fontWeight: '800' },
  expected: { color: '#7ea18f', fontSize: 11, marginTop: 2 },
  evidenceText: { color: '#bbf7d0', fontSize: 13, fontWeight: '700', textAlign: 'center' },
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
  rawJson: {
    backgroundColor: '#050b08',
    borderColor: '#254837',
    borderRadius: 10,
    borderWidth: 1,
    color: '#bbf7d0',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    padding: 12,
  },
  rawJsonLight: { backgroundColor: '#e7f5eb', borderColor: '#b5d7c0', color: '#173327' },
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
  reportCard: { backgroundColor: '#f5fbf7', borderRadius: 16, gap: 10, padding: 16 },
  reportTitle: { color: '#10221a', fontSize: 18, fontWeight: '800' },
  overall: {
    alignItems: 'center',
    flexDirection: 'column',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
  },
  overallText: { color: '#86efac', fontSize: 13, fontWeight: '800', letterSpacing: 1.4 },
  note: { color: '#6f897c', fontSize: 11, lineHeight: 17, marginTop: 4 },
  debugPanel: {
    backgroundColor: '#020604',
    borderColor: '#315b45',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
  },
  debugTitle: { color: '#f0fdf4', fontSize: 20, fontWeight: '800' },
  debugWarning: { color: '#fbbf24', fontSize: 11, lineHeight: 16, marginTop: 5 },
  debugActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  smallButton: {
    backgroundColor: '#173c29',
    borderColor: '#3f6552',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonText: { color: '#bbf7d0', fontSize: 11, fontWeight: '700' },
  debugSection: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  debugText: {
    color: '#d1fae5',
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
  },
});
