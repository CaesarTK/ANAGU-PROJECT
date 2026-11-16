import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Play, ShieldAlert } from 'lucide-react';
import {
  BlockchainBlock,
  BlockchainEventRecord,
  BlockchainIsolatedTestResult,
  LandTitleNFT,
  UserRole,
} from '../types';

interface Props {
  activeRole: UserRole;
}

export function BlockchainRevocationPanel({ activeRole }: Props) {
  const [titles, setTitles] = useState<LandTitleNFT[]>([]);
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [events, setEvents] = useState<BlockchainEventRecord[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [lifecycleCounts, setLifecycleCounts] = useState({
    issued: 0,
    registryTransfers: 0,
    ownerTransferRejected: 0,
  });

  const [selectedTokenId, setSelectedTokenId] = useState<number>(1);
  const [revokeGround, setRevokeGround] = useState<
    'OverridingPublicInterest' | 'BreachOfStatutoryCondition'
  >('OverridingPublicInterest');
  const [revokeActor, setRevokeActor] = useState<string>(activeRole);
  const [actionFeedback, setActionFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [isolatedSuite, setIsolatedSuite] = useState<BlockchainIsolatedTestResult | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);

  const loadState = async () => {
    const res = await fetch('/api/blockchain/state');
    const json = await res.json();
    setTitles(json.titles);
    setBlocks(json.blocks);
    setEvents(json.events);
    setRoles(json.roles);
    setLifecycleCounts(json.lifecycleCounts);
    if (json.titles.length > 0 && !json.titles.some((t: LandTitleNFT) => t.tokenId === selectedTokenId)) {
      setSelectedTokenId(json.titles[0].tokenId);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  useEffect(() => {
    setRevokeActor(activeRole);
  }, [activeRole]);

  const handleTransferAttempt = async (mode: 'registry' | 'owner_p2p') => {
    const res = await fetch('/api/blockchain/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: selectedTokenId,
        toAddress: roles.Buyer || '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
        mode,
        callerRole: activeRole,
      }),
    });
    const json = await res.json();
    setActionFeedback({
      ok: Boolean(json.success),
      message: json.success
        ? `Registry transfer confirmed in ${json.executionMs} ms (tx ${json.event.txHash.slice(0, 14)}...)`
        : json.error || 'Transfer reverted by smart contract',
    });
    loadState();
  };

  const handleRevoke = async () => {
    const res = await fetch('/api/blockchain/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenId: selectedTokenId,
        ground: revokeGround,
        callerRole: revokeActor,
      }),
    });
    const json = await res.json();
    setActionFeedback({
      ok: Boolean(json.success),
      message: json.success
        ? `Section 28 revocation confirmed (${json.gasUsed} gas, ${json.confirmationMs} ms). TitleRevoked event emitted and GIS parcel reverted.`
        : json.error || 'Revocation reverted',
    });
    loadState();
  };

  const handleRunIsolatedSuite = async () => {
    setRunningSuite(true);
    try {
      const res = await fetch('/api/blockchain/test-suite', { method: 'POST' });
      const json = await res.json();
      setIsolatedSuite(json);
      loadState();
    } finally {
      setRunningSuite(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-300">Component 2 · Objective ii</div>
          <h1 className="text-xl font-bold text-white mt-0.5">
            Blockchain NFT Tokenisation & Section 28 Statutory Revocation
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            ERC-721 <span className="font-mono text-xs text-sky-300">LandTitleNFT</span> disables direct P2P
            transfers and restricts Nigeria Land Use Act (1978) Section 28 revocation strictly to{' '}
            <span className="font-mono text-xs text-sky-300">GOVERNOR_ROLE</span>.
          </p>
        </div>
        <button
          onClick={handleRunIsolatedSuite}
          disabled={runningSuite}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Play className="w-4 h-4" />
          <span>{runningSuite ? 'Running 6-Case Suite...' : 'Run 6-Case Isolated Test Suite'}</span>
        </button>
      </div>

      {/* Interactive Contract Actions & Revocation Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold text-white">
              Issued LandTitleNFT Registry ({titles.length})
            </h2>
            <div className="text-xs text-slate-300 font-mono tabular-nums">
              Issued: <span className="font-semibold text-emerald-300">{lifecycleCounts.issued}</span> · Reg Transfers:{' '}
              <span className="font-semibold text-sky-300">{lifecycleCounts.registryTransfers}</span> · P2P Blocked:{' '}
              <span className="font-semibold text-rose-300">{lifecycleCounts.ownerTransferRejected}</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                  <th className="py-2 pr-3">Token</th>
                  <th className="py-2 pr-3">Parcel</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Statutory State</th>
                  <th className="py-2 text-right">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048] text-sm">
                {titles.slice(0, 12).map((nft) => (
                  <tr
                    key={nft.tokenId}
                    className={
                      selectedTokenId === nft.tokenId
                        ? 'bg-[#1e3152]/80'
                        : 'hover:bg-[#1e2a40] transition-colors'
                    }
                  >
                    <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-sky-300">
                      #{nft.tokenId}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-100">{nft.metadata.parcelCode}</div>
                      <div className="text-xs text-slate-400">{nft.metadata.tenureType}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-300">
                      {nft.ownerAddress.slice(0, 8)}...{nft.ownerAddress.slice(-4)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {nft.isRevoked ? (
                        <span className="inline-flex items-center gap-1 text-rose-300 font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Revoked ({nft.revocationGround})</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Title</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setSelectedTokenId(nft.tokenId)}
                        className="text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline cursor-pointer"
                      >
                        {selectedTokenId === nft.tokenId ? 'Selected' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Contract Execution & Section 28 Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Token: <span className="font-mono font-semibold text-sky-300">CCLT #{selectedTokenId}</span> · Active Role:{' '}
              <span className="font-semibold text-slate-100">{activeRole}</span>
            </p>
          </div>

          <div className="space-y-2 pb-4 border-b border-[#28354e]">
            <div className="text-xs font-semibold text-slate-200">
              Conveyance & Disabled P2P Transfer Guard
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleTransferAttempt('registry')}
                className="px-3 py-2 text-xs font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer"
              >
                Registry Transfer
              </button>
              <button
                onClick={() => handleTransferAttempt('owner_p2p')}
                className="px-3 py-2 text-xs font-semibold text-slate-200 bg-[#232d42] hover:bg-[#2c3954] border border-[#344668] rounded-lg transition-colors cursor-pointer"
              >
                Attempt Owner P2P
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Nigeria Land Use Act (1978), Section 28 Revocation</span>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Statutory Ground</label>
              <select
                value={revokeGround}
                onChange={(e) =>
                  setRevokeGround(
                    e.target.value as 'OverridingPublicInterest' | 'BreachOfStatutoryCondition'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
              >
                <option value="OverridingPublicInterest">
                  0 · Overriding Public Interest (Sec. 28(2)-(3))
                </option>
                <option value="BreachOfStatutoryCondition">
                  1 · Breach of Statutory Condition (Sec. 28(5))
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Executing Authority (GOVERNOR_ROLE Enforcement)
              </label>
              <select
                value={revokeActor}
                onChange={(e) => setRevokeActor(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
              >
                <option value="Governor">Governor (Authorized GOVERNOR_ROLE)</option>
                <option value="Registrar">Registrar (Lacks GOVERNOR_ROLE — Must Revert)</option>
                <option value="JudicialDispute">Judicial Dispute Mechanism (Must Revert)</option>
                <option value="Citizen">Citizen / Unauthorized User (Must Revert)</option>
              </select>
            </div>

            <button
              onClick={handleRevoke}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-600 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Execute Section 28 Revocation
            </button>
          </div>

          {actionFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                actionFeedback.ok
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-100'
                  : 'bg-rose-950/60 border-rose-700/60 text-rose-100'
              }`}
            >
              {actionFeedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
              )}
              <span className="leading-relaxed">{actionFeedback.message}</span>
            </div>
          )}
        </section>
      </div>

      {/* Isolated 6-Case Test Suite Results (Tables A & B) */}
      {isolatedSuite && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
            <h3 className="text-base font-semibold text-white mb-1">
              Table A — Smart Contract and NFT Lifecycle Events
            </h3>
            <p className="text-xs text-slate-400 mb-4">Isolated test run with mock approved inputs</p>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                  <th className="py-2 pr-4">Blockchain Event</th>
                  <th className="py-2 text-right">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048] text-sm">
                {isolatedSuite.lifecycleTable.map((row) => (
                  <tr key={row.event}>
                    <td className="py-2.5 pr-4 text-slate-200">{row.event}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-sky-300">
                      {row.frequency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="lg:col-span-7 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
            <h3 className="text-base font-semibold text-white mb-1">
              Table B — Statutory Revocation Test Results
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Verifies GOVERNOR_ROLE gate, post-revocation lock, gas cost, and T_contract confirmation time
            </p>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                  <th className="py-2 pr-3">Test</th>
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048] text-sm">
                {isolatedSuite.revocationTable.map((row) => (
                  <tr key={row.test}>
                    <td className="py-2 pr-3 font-medium text-slate-100">{row.test}</td>
                    <td
                      className={`py-2 pr-3 font-mono tabular-nums font-semibold ${
                        row.result === 'Fail' ? 'text-rose-300' : 'text-emerald-300'
                      }`}
                    >
                      {row.result}
                    </td>
                    <td className="py-2 text-xs text-slate-300">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* Immutable Event Ledger & QBFT Block Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md">
          <h3 className="text-base font-semibold text-white mb-4">
            Immutable Smart Contract Event Log
          </h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#283652] font-semibold text-slate-400">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Token</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3 text-right">Gas</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233048]">
                {events.slice(0, 15).map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2 pr-3 font-mono font-semibold text-sky-300">{ev.eventType}</td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-slate-200">#{ev.tokenId}</td>
                    <td className="py-2 pr-3 text-slate-200">{ev.actorRole}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">
                      {ev.gasUsed.toLocaleString()}
                    </td>
                    <td className="py-2 text-slate-300">{ev.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-4 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md">
          <h3 className="text-base font-semibold text-white mb-4">
            Recent PoA–QBFT–DPoS Blocks
          </h3>
          <div className="divide-y divide-[#233048] text-xs max-h-64 overflow-y-auto">
            {blocks.slice(0, 10).map((b) => (
              <div key={b.blockNumber} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono font-semibold text-sky-300">Block #{b.blockNumber}</div>
                  <div className="text-slate-400">{b.validator} ({b.validatorWeight}%)</div>
                </div>
                <div className="font-mono text-slate-400">{b.blockHash.slice(0, 12)}...</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
