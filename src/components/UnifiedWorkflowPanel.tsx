import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Play, Plus } from 'lucide-react';
import { AuditTrailEntry, LandApplication, UserRole } from '../types';

interface Props {
  activeRole: UserRole;
  onRefreshMessages: () => void;
}

const PIPELINE_STEPS = [
  { key: 'APPLICATION_SUBMITTED', num: '01', label: 'Submitted', role: 'Citizen' },
  { key: 'SPATIAL_VERIFIED', num: '02', label: 'GIS Spatial', role: 'Surveyor' },
  { key: 'ORACLE_VERIFIED', num: '03', label: 'Oracle Attest', role: 'LandAdministrator' },
  { key: 'LEGAL_VERIFIED', num: '04', label: 'Legal Clear', role: 'LandAdministrator' },
  { key: 'COMPLETED', num: '05', label: 'Registrar · NFT · MQTT', role: 'Registrar' },
];

export function UnifiedWorkflowPanel({ activeRole, onRefreshMessages }: Props) {
  const [applications, setApplications] = useState<LandApplication[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [integrationReport, setIntegrationReport] = useState<{
    total: number;
    rows: Array<{ status: string; frequency: number; percentage: string }>;
  } | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);

  const [parcelCode, setParcelCode] = useState('ABJ-ASQ-602');
  const [district, setDistrict] = useState('Asokoro District A04');
  const [applicantName, setApplicantName] = useState('Folake Balogun');
  const [nationalId, setNationalId] = useState('NIN-91204455');
  const [tenureType, setTenureType] = useState<'Statutory' | 'Customary-Converted'>('Statutory');
  const [coordsStr, setCoordsStr] = useState(
    '[[7.4930,9.0842],[7.4942,9.0842],[7.4942,9.0852],[7.4930,9.0852],[7.4930,9.0842]]'
  );

  const loadState = async () => {
    const res = await fetch('/api/workflow/state');
    const json = await res.json();
    setApplications(json.applications);
    setAuditTrail(json.auditTrail);
  };

  useEffect(() => {
    loadState();
  }, []);

  const handleSubmitApp = async () => {
    let parsedCoords: [number, number][] = [];
    try {
      parsedCoords = JSON.parse(coordsStr);
    } catch {
      setFeedback({ ok: false, text: 'Invalid JSON polygon coordinates.' });
      return;
    }

    const res = await fetch('/api/workflow/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parcelCode,
        district,
        applicantName,
        nationalId,
        coordinates: parsedCoords,
        tenureType,
        supportingDocsComplete: true,
        documentSignatureValid: true,
        communityAttestationCode: `ELDER-ATT-${parcelCode.slice(-3)}`,
        institutionalRefCode: `AGIS-REG-${parcelCode.slice(-3)}`,
        actorRole: activeRole,
      }),
    });
    const created = await res.json();
    setFeedback({
      ok: true,
      text: `Created ${created.applicationId} for ${created.parcelCode} (awaiting Surveyor GIS verification).`,
    });
    loadState();
    onRefreshMessages();
  };

  const handleAdvance = async (applicationId: string, action: 'advance' | 'cancel' = 'advance') => {
    const res = await fetch('/api/workflow/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, actorRole: activeRole, action }),
    });
    const json = await res.json();
    if (!json.success) {
      setFeedback({ ok: false, text: json.error });
    } else {
      setFeedback({
        ok: true,
        text: `${applicationId} moved to stage ${json.application.stage} (${json.application.statusCategory}).`,
      });
    }
    loadState();
    onRefreshMessages();
  };

  const handleRunIntegrationSuite = async () => {
    setRunningSuite(true);
    try {
      const res = await fetch('/api/workflow/test-suite', { method: 'POST' });
      const json = await res.json();
      setIntegrationReport(json);
      loadState();
      onRefreshMessages();
    } finally {
      setRunningSuite(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-300">
            Integration · Unified Registration Pipeline
          </div>
          <h1 className="text-xl font-bold text-white mt-0.5">
            End-to-End 8-Stage RBAC Registration Workflow
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Switch your active role in the top bar (<span className="font-semibold text-sky-300">{activeRole}</span>) to
            execute authorised transitions across GIS, Oracle, Legal, Registrar, NFT Issuance, and MQTT.
          </p>
        </div>
        <button
          onClick={handleRunIntegrationSuite}
          disabled={runningSuite}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Play className="w-4 h-4" />
          <span>{runningSuite ? 'Running E2E Suite...' : 'Run End-to-End Workflow Suite'}</span>
        </button>
      </div>

      {/* Connected Pipeline Stepper */}
      <section className="bg-[#182132] border border-[#2a3954] rounded-xl p-5 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          {PIPELINE_STEPS.map((st) => {
            const roleMatch = st.role === activeRole;
            return (
              <div
                key={st.key}
                className={`rounded-lg p-3.5 border transition-colors ${
                  roleMatch
                    ? 'bg-[#1e3152] border-sky-400'
                    : 'bg-[#131924] border-[#27354f]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sky-300">{st.num}</span>
                  <span className="text-[11px] font-medium text-slate-400">{st.role}</span>
                </div>
                <div className="font-semibold text-white mt-1.5">{st.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-start gap-2 ${
            feedback.ok
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-100'
              : 'bg-rose-950/60 border-rose-700/60 text-rose-100'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Submit Application + Active Pipeline Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-4 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md space-y-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-semibold text-white">Submit Land Application</h2>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Parcel Code</label>
              <input
                value={parcelCode}
                onChange={(e) => setParcelCode(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">District / Cadastral Zone</label>
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Applicant</label>
                <input
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">National ID</label>
                <input
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f1522] border border-[#2d3e5e] rounded-lg font-mono text-slate-100 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Tenure Type</label>
              <select
                value={tenureType}
                onChange={(e) =>
                  setTenureType(e.target.value as 'Statutory' | 'Customary-Converted')
                }
                className="w-full px-3 py-2 border border-[#2d3e5e] rounded-lg bg-[#0f1522] text-slate-100 focus:outline-none focus:border-sky-400"
              >
                <option value="Statutory">Statutory Right of Occupancy</option>
                <option value="Customary-Converted">Customary-Converted Tenure</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">WGS 84 Polygon Coordinates</label>
              <textarea
                rows={3}
                value={coordsStr}
                onChange={(e) => setCoordsStr(e.target.value)}
                className="w-full p-2.5 border border-[#2d3e5e] rounded-lg font-mono bg-[#0f1522] text-slate-100 focus:outline-none focus:border-sky-400"
              />
            </div>
            <button
              onClick={handleSubmitApp}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Submit Application
            </button>
          </div>
        </section>

        <section className="lg:col-span-8 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
          <h2 className="text-base font-semibold text-white mb-4">
            Active Registration Applications ({applications.length})
          </h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#283652] font-semibold text-slate-400">
                  <th className="py-2 pr-3">Application</th>
                  <th className="py-2 pr-3">Parcel & Claimant</th>
                  <th className="py-2 pr-3">Current Stage</th>
                  <th className="py-2 pr-3">Token</th>
                  <th className="py-2 text-right">RBAC Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                {applications.slice(0, 15).map((app) => {
                  const isTerminal = ['COMPLETED', 'REJECTED', 'CANCELLED', 'REVOKED'].includes(
                    app.stage
                  );
                  return (
                    <tr key={app.applicationId} className="hover:bg-[#1e2a40] transition-colors">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-sky-300">
                        {app.applicationId}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-100">{app.parcelCode}</div>
                        <div className="text-slate-400">{app.applicantName}</div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div
                          className={`font-mono font-semibold ${
                            app.stage === 'COMPLETED'
                              ? 'text-emerald-300'
                              : app.stage === 'REJECTED'
                                ? 'text-rose-300'
                                : 'text-sky-300'
                          }`}
                        >
                          {app.stage}
                        </div>
                        <div className="text-slate-400">{app.statusCategory}</div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-200">
                        {app.tokenId ? `CCLT #${app.tokenId}` : '—'}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                        {!isTerminal && (
                          <>
                            <button
                              onClick={() => handleAdvance(app.applicationId, 'advance')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-md transition-colors cursor-pointer"
                            >
                              <span>Advance</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleAdvance(app.applicationId, 'cancel')}
                              className="px-2.5 py-1.5 font-medium text-slate-200 bg-[#232d42] hover:bg-[#2c3954] border border-[#344668] rounded-md transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Integration Outcomes Table + Immutable Hash-Chained Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {integrationReport && (
          <section className="lg:col-span-5 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
            <h3 className="text-base font-semibold text-white mb-1">
              End-to-End Registration Workflow Outcomes
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Wired pipeline run across GIS, Oracle, Legal, Registrar, NFT, and MQTT
            </p>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                  <th className="py-2 pr-4">Application Status</th>
                  <th className="py-2 pr-4 text-right">Frequency</th>
                  <th className="py-2 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                {integrationReport.rows.map((r) => (
                  <tr key={r.status}>
                    <td className="py-2 pr-4 text-slate-200">{r.status}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-white">{r.frequency}</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold text-sky-300">
                      {r.percentage}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[#324466] font-semibold">
                  <td className="py-2 pr-4 text-white">Total</td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-white">
                    {integrationReport.total}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-white">100%</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <section
          className={`${
            integrationReport ? 'lg:col-span-7' : 'lg:col-span-12'
          } bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md`}
        >
          <h3 className="text-base font-semibold text-white mb-4">
            SHA-256 Chained Immutable Audit Trail
          </h3>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#283652] font-semibold text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Application</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Details</th>
                  <th className="py-2 text-right">Entry Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                {auditTrail.slice(0, 20).map((entry) => (
                  <tr key={entry.seq}>
                    <td className="py-2 pr-3 font-mono tabular-nums text-slate-400">{entry.seq}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-sky-300">
                      {entry.applicationId}
                    </td>
                    <td className="py-2 pr-3 text-slate-200">{entry.actorRole}</td>
                    <td className="py-2 pr-3 font-mono text-slate-100">{entry.action}</td>
                    <td className="py-2 pr-3 text-slate-300">{entry.details}</td>
                    <td className="py-2 text-right font-mono text-slate-400">
                      {entry.entryHash.slice(0, 12)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
