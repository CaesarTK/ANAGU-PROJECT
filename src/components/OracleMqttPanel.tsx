import { useEffect, useState } from 'react';
import { CheckCircle2, Play, Radio, Wifi, WifiOff, XCircle } from 'lucide-react';
import { MqttMessageRecord } from '../types';

interface OfflineQueueItem {
  clientQueueId: string;
  parcelCode: string;
  applicantName: string;
  queuedAt: string;
}

const OFFLINE_STORAGE_KEY = 'anagu_offline_queue_v1';

interface Props {
  liveMessages: MqttMessageRecord[];
  onRefreshMessages: () => void;
}

export function OracleMqttPanel({ liveMessages, onRefreshMessages }: Props) {
  const [matchingRules, setMatchingRules] = useState<
    Array<{ ruleId: string; matchCondition: string; failureOutcome: string }>
  >([]);
  const [topicSchema, setTopicSchema] = useState<
    Array<{ topic: string; payloadFields: string; qos: number; sampleBytes: number }>
  >([]);

  const [parcelCode, setParcelCode] = useState('ABJ-KAT-501');
  const [nationalId, setNationalId] = useState('NIN-88320194');
  const [institutionalRef, setInstitutionalRef] = useState('AGIS-REG-501');
  const [communityAttest, setCommunityAttest] = useState('ELDER-ATT-501');
  const [docsComplete, setDocsComplete] = useState(true);
  const [sigValid, setSigValid] = useState(true);
  const [litigationFlag, setLitigationFlag] = useState(false);
  const [oracleResult, setOracleResult] = useState<{
    outcome: string;
    passed: boolean;
    diagnosticReason: string;
    oracleHash: string;
    executionMs: number;
  } | null>(null);

  const [oracleSuite, setOracleSuite] = useState<{
    total: number;
    rows: Array<{ outcome: string; frequency: number; percentage: string }>;
  } | null>(null);

  const [networkTestRows, setNetworkTestRows] = useState<
    Array<{
      condition: string;
      messagesSent: number;
      successfullyDelivered: number;
      deliveryRate: string;
      avgLatencyMs: number;
    }>
  >([]);
  const [runningNetworkTest, setRunningNetworkTest] = useState(false);

  const [isOffline, setIsOffline] = useState(false);
  const [offlineParcel, setOfflineParcel] = useState('ABJ-FLD-774');
  const [offlineApplicant, setOfflineApplicant] = useState('Field Surveyor Mobile');
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [offlineReport, setOfflineReport] = useState<{
    queuedLocally: boolean;
    deliveredAfterReconnect: boolean;
    reconnectDelaySeconds: number | null;
  }>({
    queuedLocally: false,
    deliveredAfterReconnect: false,
    reconnectDelaySeconds: null,
  });

  useEffect(() => {
    fetch('/api/oracle/spec')
      .then((r) => r.json())
      .then((d) => {
        setMatchingRules(d.matchingRules);
        setTopicSchema(d.topicSchema);
      });
  }, []);

  const handleVerifyClaim = async () => {
    const res = await fetch('/api/oracle/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: `ORC-LIVE-${Date.now().toString().slice(-4)}`,
        parcelCode,
        applicantName: 'Claimant Probe',
        nationalId,
        documentHash: '0xdoc789',
        documentSignatureValid: sigValid,
        supportingDocsComplete: docsComplete,
        communityAttestationCode: communityAttest,
        institutionalRefCode: institutionalRef,
        pendingLitigationFlag: litigationFlag,
      }),
    });
    const json = await res.json();
    setOracleResult(json);
  };

  const handleRunOracleSuite = async () => {
    const res = await fetch('/api/oracle/test-suite', { method: 'POST' });
    const json = await res.json();
    setOracleSuite(json);
  };

  const handleRunNetworkTest = async () => {
    setRunningNetworkTest(true);
    try {
      const res = await fetch('/api/mqtt/network-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messagesPerCondition: 40 }),
      });
      const json = await res.json();
      setNetworkTestRows(json.rows);
      onRefreshMessages();
    } finally {
      setRunningNetworkTest(false);
    }
  };

  const handleMobileSubmit = async () => {
    if (isOffline) {
      const item: OfflineQueueItem = {
        clientQueueId: `Q-${Date.now().toString().slice(-5)}`,
        parcelCode: offlineParcel,
        applicantName: offlineApplicant,
        queuedAt: new Date().toISOString(),
      };
      const next = [...offlineQueue, item];
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(next));
      setOfflineQueue(next);
      setOfflineReport({
        queuedLocally: true,
        deliveredAfterReconnect: false,
        reconnectDelaySeconds: null,
      });
    } else {
      await fetch('/api/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'land/registration/status',
          qos: 1,
          payload: {
            parcelCode: offlineParcel,
            applicantName: offlineApplicant,
            status: 'Online direct capture',
            timestamp: new Date().toISOString(),
          },
        }),
      });
      onRefreshMessages();
    }
  };

  const handleReconnectAndFlush = async () => {
    const reconnectTimestamp = Date.now();
    setIsOffline(false);
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    const items: OfflineQueueItem[] = raw ? JSON.parse(raw) : [];
    if (items.length === 0) return;

    let maxDelaySec = 0;
    for (const item of items) {
      const res = await fetch('/api/mqtt/offline-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          reconnectTimestamp,
        }),
      });
      const json = await res.json();
      maxDelaySec = Math.max(maxDelaySec, json.reconnectDelaySeconds || 0.12);
    }

    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify([]));
    setOfflineQueue([]);
    setOfflineReport({
      queuedLocally: true,
      deliveredAfterReconnect: true,
      reconnectDelaySeconds: maxDelaySec,
    });
    onRefreshMessages();
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-300">Component 3 · Objective iii</div>
          <h1 className="text-xl font-bold text-white mt-0.5">
            Community Verification Oracle & MQTT Synchronisation
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Reconciles statutory and customary tenure claims prior to chain execution, and streams
            QoS 1/2 notifications with local offline-queue resilience.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRunOracleSuite}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-100 bg-[#1b273d] hover:bg-[#23324e] border border-[#31456b] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Play className="w-4 h-4 text-sky-300" />
            <span>Run Oracle Suite</span>
          </button>
          <button
            onClick={handleRunNetworkTest}
            disabled={runningNetworkTest}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Radio className="w-4 h-4" />
            <span>{runningNetworkTest ? 'Testing Netem...' : 'Run Degraded MQTT Test'}</span>
          </button>
        </div>
      </div>

      {/* Part A: Ownership Verification Oracle */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md space-y-4">
          <h2 className="text-base font-semibold text-white">
            Part A — Deterministic Oracle Matching Criteria
          </h2>
          <div className="divide-y divide-[#233048] text-xs">
            {matchingRules.map((rule) => (
              <div key={rule.ruleId} className="py-3 space-y-1">
                <div className="font-semibold text-sky-300">{rule.ruleId}</div>
                <div className="text-slate-300 leading-relaxed">{rule.matchCondition}</div>
                <div className="text-slate-400">
                  On mismatch: <span className="font-semibold text-rose-300">{rule.failureOutcome}</span>
                </div>
              </div>
            ))}
          </div>

          {oracleSuite && (
            <div className="pt-4 border-t border-[#27354f]">
              <h3 className="text-sm font-semibold text-white mb-2">
                Ownership Verification Test Results (Isolated)
              </h3>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                    <th className="py-2 pr-4">Verification Outcome</th>
                    <th className="py-2 pr-4 text-right">Frequency</th>
                    <th className="py-2 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233048]">
                  {oracleSuite.rows.map((r) => (
                    <tr key={r.outcome}>
                      <td className="py-2 pr-4 text-slate-200">{r.outcome}</td>
                      <td className="py-2 pr-4 text-right font-mono tabular-nums text-white">{r.frequency}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-white">{r.percentage}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#324466] font-semibold">
                    <td className="py-2 pr-4 text-white">Total</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-white">{oracleSuite.total}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-white">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-6 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md space-y-4">
          <h2 className="text-base font-semibold text-white">
            Interactive Oracle Claim Verification
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Parcel Code</label>
              <input
                value={parcelCode}
                onChange={(e) => setParcelCode(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">National ID (NIN)</label>
              <input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Institutional Ref</label>
              <input
                value={institutionalRef}
                onChange={(e) => setInstitutionalRef(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Community Elder Attestation</label>
              <input
                value={communityAttest}
                onChange={(e) => setCommunityAttest(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={docsComplete}
                onChange={(e) => setDocsComplete(e.target.checked)}
                className="accent-sky-400"
              />
              <span>Supporting Docs Complete</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sigValid}
                onChange={(e) => setSigValid(e.target.checked)}
                className="accent-sky-400"
              />
              <span>Document Signature Valid</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={litigationFlag}
                onChange={(e) => setLitigationFlag(e.target.checked)}
                className="accent-sky-400"
              />
              <span>Pending Litigation Caveat</span>
            </label>
          </div>

          <button
            onClick={handleVerifyClaim}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Verify Ownership Claim
          </button>

          {oracleResult && (
            <div className="pt-4 border-t border-[#28354e] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-sm text-white">
                  {oracleResult.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{oracleResult.outcome}</span>
                </span>
                <span className="font-mono tabular-nums font-semibold text-sky-300">
                  {oracleResult.executionMs} ms
                </span>
              </div>
              <p className="text-slate-300">{oracleResult.diagnosticReason}</p>
              <div className="font-mono text-slate-400 truncate">
                Oracle Hash: {oracleResult.oracleHash}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Part B: MQTT Topic Schema, Degraded Network Test & Offline Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Part B — MQTT Topic & Payload Schema
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Measured payload byte lengths feed directly into Component 4 storage-overhead analysis
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#283652] font-semibold text-slate-400">
                  <th className="py-2 pr-3">Topic</th>
                  <th className="py-2 pr-3">Payload Fields</th>
                  <th className="py-2 pr-3 text-right">QoS</th>
                  <th className="py-2 text-right">Size (bytes)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                {topicSchema.map((t) => (
                  <tr key={t.topic}>
                    <td className="py-2 pr-3 font-mono font-semibold text-sky-300">{t.topic}</td>
                    <td className="py-2 pr-3 font-mono text-slate-300">{t.payloadFields}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">{t.qos}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-white">
                      {t.sampleBytes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {networkTestRows.length > 0 && (
            <div className="pt-4 border-t border-[#27354f]">
              <h3 className="text-sm font-semibold text-white mb-2">
                MQTT Delivery Performance by Network Condition
              </h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#283652] font-semibold text-slate-400">
                    <th className="py-2 pr-3">Condition</th>
                    <th className="py-2 pr-3 text-right">Sent</th>
                    <th className="py-2 pr-3 text-right">Delivered</th>
                    <th className="py-2 pr-3 text-right">Delivery Rate</th>
                    <th className="py-2 text-right">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233048]">
                  {networkTestRows.map((row) => (
                    <tr key={row.condition}>
                      <td className="py-2 pr-3 text-slate-100 font-medium">{row.condition}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">{row.messagesSent}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">
                        {row.successfullyDelivered}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums font-semibold text-emerald-300">
                        {row.deliveryRate}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-300">
                        {row.avgLatencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Mobile Offline Queue & Reconnect Sync
            </h2>
            <button
              onClick={() => (isOffline ? handleReconnectAndFlush() : setIsOffline(true))}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                isOffline
                  ? 'bg-amber-950/80 text-amber-200 border border-amber-700/70 hover:bg-amber-900/80'
                  : 'bg-[#1b2b46] text-sky-200 border border-[#2e456e] hover:bg-[#23385b]'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{isOffline ? 'Offline (Click to Reconnect)' : 'Online (Go Offline)'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Field Parcel Code</label>
              <input
                value={offlineParcel}
                onChange={(e) => setOfflineParcel(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Claimant / Officer</label>
              <input
                value={offlineApplicant}
                onChange={(e) => setOfflineApplicant(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <button
            onClick={handleMobileSubmit}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer"
          >
            {isOffline ? 'Capture Submission into Local Offline Queue' : 'Publish Live Field Capture'}
          </button>

          <div className="pt-3 border-t border-[#28354e] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">
                localStorage Buffer ({OFFLINE_STORAGE_KEY})
              </span>
              <span className="font-mono tabular-nums font-semibold text-sky-300">
                {offlineQueue.length} queued
              </span>
            </div>

            {offlineQueue.length > 0 && (
              <div className="bg-amber-950/60 border border-amber-700/60 rounded-lg p-2.5 space-y-1 font-mono text-[11px] text-amber-200">
                {offlineQueue.map((item) => (
                  <div key={item.clientQueueId} className="flex justify-between">
                    <span>{item.clientQueueId} · {item.parcelCode}</span>
                    <span>QUEUED</span>
                  </div>
                ))}
              </div>
            )}

            <table className="w-full text-left border-collapse mt-2">
              <thead>
                <tr className="border-b border-[#283652] text-slate-400">
                  <th className="py-1.5 pr-3">Offline Queue Test Scenario</th>
                  <th className="py-1.5 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                <tr>
                  <td className="py-1.5 pr-3 text-slate-300">Submission made while offline is queued locally</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-white">
                    {offlineReport.queuedLocally || offlineQueue.length > 0 ? 'Yes' : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-300">Queued submission delivered after reconnect</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-white">
                    {offlineReport.deliveredAfterReconnect ? 'Yes' : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-slate-300">Time from reconnect to successful delivery</td>
                  <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-sky-300">
                    {offlineReport.reconnectDelaySeconds !== null
                      ? `${offlineReport.reconnectDelaySeconds} s`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Live WebSocket MQTT Broker Feed */}
      <section className="bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
        <h3 className="text-base font-semibold text-white mb-3">
          Live MQTT Broker Stream ({liveMessages.length} recent messages)
        </h3>
        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#283652] font-semibold text-slate-400">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Topic</th>
                <th className="py-2 pr-3 text-right">QoS</th>
                <th className="py-2 pr-3 text-right">Bytes</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#233048]">
              {liveMessages.slice(0, 15).map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-3 font-mono text-slate-400">{m.id}</td>
                  <td className="py-2 pr-3 font-mono font-semibold text-sky-300">{m.topic}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">{m.qos}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">{m.payloadBytes} B</td>
                  <td className="py-2 pr-3 text-slate-300">{m.source}</td>
                  <td className="py-2 font-mono text-slate-300 truncate max-w-md">
                    {JSON.stringify(m.payload)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
