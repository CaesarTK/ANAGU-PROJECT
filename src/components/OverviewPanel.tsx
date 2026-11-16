import { useState } from 'react';
import { ArrowRight, CheckCircle2, Copy, FileCode2, ShieldCheck } from 'lucide-react';
import { NavSection } from '../types';

export interface OverviewData {
  consensus: {
    mechanism: string;
    qbftBlockPeriodSeconds: number;
    epochLengthBlocks: number;
    chainId: number;
    validators: Array<{ name: string; weight: number }>;
    governorRoleHash: string;
    registrarRoleHash: string;
  };
  roles: Record<string, string>;
  stats: {
    registeredParcels: number;
    issuedNfts: number;
    revokedNfts: number;
    applications: number;
    mqttMessages: number;
    auditEntries: number;
  };
  artifacts: {
    landTitleNftSol: string;
    landRegistrySol: string;
    besuGenesisJson: string;
    postgisSchemaSql: string;
    dockerComposeYml: string;
  };
}

interface Props {
  data: OverviewData | null;
  onNavigate: (section: NavSection) => void;
}

type ArtifactKey =
  | 'landTitleNftSol'
  | 'landRegistrySol'
  | 'besuGenesisJson'
  | 'postgisSchemaSql'
  | 'dockerComposeYml';

const ARTIFACT_TABS: Array<{ key: ArtifactKey; label: string; path: string }> = [
  { key: 'landTitleNftSol', label: 'LandTitleNFT.sol', path: 'contracts/LandTitleNFT.sol' },
  { key: 'landRegistrySol', label: 'LandRegistry.sol', path: 'contracts/LandRegistry.sol' },
  { key: 'besuGenesisJson', label: 'Besu QBFT Genesis', path: 'infra/besu/qbftConfigFile.json' },
  { key: 'postgisSchemaSql', label: 'PostGIS Schema', path: 'infra/sql/schema.sql' },
  { key: 'dockerComposeYml', label: 'Docker Compose', path: 'docker-compose.yml' },
];

export function OverviewPanel({ data, onNavigate }: Props) {
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKey>('landTitleNftSol');
  const [copied, setCopied] = useState(false);

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-36 bg-[#182132] border border-[#2a3954] rounded-xl animate-pulse" />
        <div className="h-64 bg-[#182132] border border-[#2a3954] rounded-xl animate-pulse" />
      </div>
    );
  }

  const currentTab = ARTIFACT_TABS.find((t) => t.key === activeArtifact)!;

  const handleCopyArtifact = async () => {
    await navigator.clipboard.writeText(data.artifacts[activeArtifact]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-7">
      {/* Hero Summary Card */}
      <section className="bg-[#182132] border border-[#2a3954] rounded-xl p-7 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-sky-300">
              <span>Step 0 · Environment & Architecture</span>
              <span aria-hidden="true" className="text-slate-600">/</span>
              <span className="text-slate-400">PoA–QBFT–DPoS Permissioned Ledger</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Integrated Blockchain–GIS–NFT Land Administration Framework
            </h1>
            <p className="text-sm leading-relaxed text-slate-300">
              Built sequentially across four validated gates: WGS 84 spatial verification, ERC-721
              tokenisation with Nigeria Land Use Act (1978) Section 28 statutory revocation,
              community/institutional ownership oracle with resilient MQTT sync, and empirical
              cross-cutting evaluation against a conventional baseline.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate('gis')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <span>Begin Step 1: GIS Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mt-7 pt-6 border-t border-[#27354f]">
          <div>
            <div className="text-xs font-medium text-slate-400">Registered Parcels</div>
            <div className="mt-1 text-2xl font-bold text-sky-300 font-mono tabular-nums">
              {data.stats.registeredParcels}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Issued Title NFTs</div>
            <div className="mt-1 text-2xl font-bold text-emerald-300 font-mono tabular-nums">
              {data.stats.issuedNfts}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Section 28 Revoked</div>
            <div className="mt-1 text-2xl font-bold text-rose-300 font-mono tabular-nums">
              {data.stats.revokedNfts}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">QBFT Block Period</div>
            <div className="mt-1 text-2xl font-bold text-white font-mono tabular-nums">
              {data.consensus.qbftBlockPeriodSeconds}s
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Epoch Length</div>
            <div className="mt-1 text-2xl font-bold text-white font-mono tabular-nums">
              {data.consensus.epochLengthBlocks.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">MQTT Events Logged</div>
            <div className="mt-1 text-2xl font-bold text-amber-300 font-mono tabular-nums">
              {data.stats.mqttMessages}
            </div>
          </div>
        </div>
      </section>

      {/* Build Order Validation Gates & Consensus Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Build Order & Component Validation Gates
            </h2>
            <span className="text-xs font-medium text-slate-400">Sequential Isolated Testing</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                  <th className="py-2.5 pr-4">Step</th>
                  <th className="py-2.5 pr-4">Component</th>
                  <th className="py-2.5 pr-4">Validation Gate</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048] text-sm">
                {[
                  {
                    step: '0',
                    name: 'Environment & Consensus Setup',
                    gate: 'PoA–QBFT–DPoS (1s / 30,000), PostGIS, Contracts',
                    nav: 'overview' as NavSection,
                  },
                  {
                    step: '1',
                    name: 'GIS Spatial Verification (Obj. i)',
                    gate: 'ST_IsValid + ST_Intersects clean & messy sets',
                    nav: 'gis' as NavSection,
                  },
                  {
                    step: '2',
                    name: 'NFT Tokenisation & Section 28 (Obj. ii)',
                    gate: '6-case suite + P2P block + Governor revocation',
                    nav: 'blockchain' as NavSection,
                  },
                  {
                    step: '3',
                    name: 'Oracle & MQTT Sync (Obj. iii)',
                    gate: 'Oracle rules + degraded network + offline queue',
                    nav: 'oracle-mqtt' as NavSection,
                  },
                  {
                    step: '4',
                    name: 'Unified Registration Workflow',
                    gate: '8-stage RBAC pipeline + immutable audit trail',
                    nav: 'workflow' as NavSection,
                  },
                  {
                    step: '5',
                    name: 'Cross-Cutting Evaluation (Obj. iv)',
                    gate: '4 fraud scenarios, 5-stage latency, storage bits',
                    nav: 'evaluation' as NavSection,
                  },
                ].map((row) => (
                  <tr key={row.step} className="hover:bg-[#1e2a40] transition-colors">
                    <td className="py-3 pr-4 font-mono tabular-nums font-semibold text-sky-300">{row.step}</td>
                    <td className="py-3 pr-4 font-medium text-slate-100">{row.name}</td>
                    <td className="py-3 pr-4 text-slate-300 text-xs">{row.gate}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onNavigate(row.nav)}
                        className="text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Open module
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              DPoS Institutional Validator Weights
            </h2>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            PoA–QBFT–DPoS yields deterministic 1-second finality while weighting validator authority
            by statutory institutional role rather than computational PoW.
          </p>
          <div className="space-y-3.5">
            {data.consensus.validators.map((v, i) => {
              const barColors = ['bg-sky-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-amber-500'];
              return (
                <div key={v.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{v.name}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-300">
                      {v.weight}% weight
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#0f1522] rounded-full overflow-hidden border border-[#27344d]">
                    <div
                      className={`h-full rounded-full ${barColors[i % barColors.length]}`}
                      style={{ width: `${v.weight}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-[#28354e] space-y-2">
            <div className="text-xs font-semibold text-slate-200">Assigned secp256k1 Role Keys</div>
            {Object.entries(data.roles).map(([role, addr]) => (
              <div key={role} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{role}</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {addr.slice(0, 10)}...{addr.slice(-6)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Specification Source Artifacts Inspector */}
      <section className="bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-semibold text-white">
              Repository Specification Artifacts
            </h2>
            <span className="text-xs font-mono text-slate-400">· {currentTab.path}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0f1522] border border-[#27354f] rounded-lg">
              {ARTIFACT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveArtifact(tab.key)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    activeArtifact === tab.key
                      ? 'bg-[#1d4ed8] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopyArtifact}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#1e293d] hover:bg-[#273651] border border-[#324568] rounded-md transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <pre className="p-4 bg-[#0d121c] border border-[#283652] text-slate-200 rounded-lg text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
          <code>{data.artifacts[activeArtifact]}</code>
        </pre>

        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            Smart contracts, PostGIS spatial schema, and Besu QBFT genesis are loaded in the workspace
            and mirrored by the live API engine.
          </span>
        </div>
      </section>
    </div>
  );
}
