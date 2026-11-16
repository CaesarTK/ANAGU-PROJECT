import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react';
import { ParcelRecord, SpatialTestSuiteResult, SpatialValidationResult } from '../types';
import { LiveAbujaCadastralMap } from './LiveAbujaCadastralMap';

const PRESET_PROBES: Array<{
  label: string;
  parcelId: string;
  coordinates: [number, number][];
}> = [
  {
    label: 'Valid Open Infill Plot',
    parcelId: 'PROBE-VALID-01',
    coordinates: [
      [7.4860, 9.0848],
      [7.4872, 9.0848],
      [7.4872, 9.0858],
      [7.4860, 9.0858],
      [7.4860, 9.0848],
    ],
  },
  {
    label: 'Self-Intersecting Bowtie',
    parcelId: 'PROBE-BOWTIE-02',
    coordinates: [
      [7.4898, 9.0848],
      [7.4910, 9.0858],
      [7.4910, 9.0848],
      [7.4898, 9.0858],
      [7.4898, 9.0848],
    ],
  },
  {
    label: 'Overlapping ABJ-MAI-101',
    parcelId: 'PROBE-OVERLAP-03',
    coordinates: [
      [7.4886, 9.0824],
      [7.4898, 9.0824],
      [7.4898, 9.0833],
      [7.4886, 9.0833],
      [7.4886, 9.0824],
    ],
  },
  {
    label: 'Near-Miss 0.2m Boundary Encroachment',
    parcelId: 'PROBE-NEARMISS-04',
    coordinates: [
      [7.4880, 9.0812],
      [7.4892, 9.0812],
      [7.4892, 9.081998],
      [7.4880, 9.081998],
      [7.4880, 9.0812],
    ],
  },
  {
    label: 'Yola, Adamawa (Dougirei GRA)',
    parcelId: 'YOL-JIM-401',
    coordinates: [
      [12.4660, 9.2665],
      [12.4673, 9.2665],
      [12.4673, 9.2675],
      [12.4660, 9.2675],
      [12.4660, 9.2665],
    ],
  },
  {
    label: 'Gombe (New GRA Extension)',
    parcelId: 'GMB-GRA-501',
    coordinates: [
      [11.1670, 10.2895],
      [11.1682, 10.2895],
      [11.1682, 10.2905],
      [11.1670, 10.2905],
      [11.1670, 10.2895],
    ],
  },
  {
    label: 'Enugu (Independence Layout)',
    parcelId: 'ENU-IND-601',
    coordinates: [
      [7.5190, 6.4465],
      [7.5202, 6.4465],
      [7.5202, 6.4475],
      [7.5190, 6.4475],
      [7.5190, 6.4465],
    ],
  },
];

export interface GisProbeSeed {
  parcelId: string;
  coordinates: [number, number][];
}

export function GisVerificationPanel({ initialProbe = null }: { initialProbe?: GisProbeSeed | null }) {
  const [parcels, setParcels] = useState<ParcelRecord[]>([]);
  const [selectedParcelCode, setSelectedParcelCode] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState<number>(0.5);
  const [probeId, setProbeId] = useState<string>(
    initialProbe?.parcelId || PRESET_PROBES[0].parcelId
  );
  const [coordsText, setCoordsText] = useState<string>(
    JSON.stringify(initialProbe?.coordinates || PRESET_PROBES[0].coordinates)
  );
  const [validationResult, setValidationResult] = useState<SpatialValidationResult | null>(null);
  const [testSuites, setTestSuites] = useState<{
    cleanSuite: SpatialTestSuiteResult;
    messySuite: SpatialTestSuiteResult;
  } | null>(null);
  const [loadingSuite, setLoadingSuite] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const loadParcels = async () => {
    const res = await fetch('/api/gis/parcels');
    const json = await res.json();
    setParcels(json.parcels);
    setTolerance(json.toleranceMeters);
  };

  useEffect(() => {
    loadParcels();
  }, []);

  useEffect(() => {
    if (initialProbe) {
      setProbeId(initialProbe.parcelId);
      setCoordsText(JSON.stringify(initialProbe.coordinates));
      setValidationResult(null);
    }
  }, [initialProbe]);

  const parsedProbeCoords = useMemo<[number, number][] | null>(() => {
    try {
      const parsed = JSON.parse(coordsText);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  }, [coordsText]);

  const handleToleranceChange = async (val: number) => {
    setTolerance(val);
    await fetch('/api/gis/tolerance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toleranceMeters: val }),
    });
  };

  const handleVerifyProbe = async () => {
    setParseError(null);
    if (!parsedProbeCoords) {
      setParseError('Coordinates must be a valid JSON array of [longitude, latitude] pairs.');
      return;
    }
    const res = await fetch('/api/gis/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parcelId: probeId,
        coordinates: parsedProbeCoords,
        toleranceMeters: tolerance,
      }),
    });
    const data = await res.json();
    setValidationResult(data);
  };

  const handleRunSuites = async () => {
    setLoadingSuite(true);
    try {
      const res = await fetch('/api/gis/test-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toleranceMeters: tolerance }),
      });
      const data = await res.json();
      setTestSuites(data);
    } finally {
      setLoadingSuite(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* Header & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-300">Component 1 · Objective i</div>
          <h1 className="text-xl font-bold text-white mt-0.5">
            GIS-Based Spatial Verification (WGS 84 / EPSG:4326)
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Validates polygon well-formedness via <span className="font-mono text-xs text-sky-300">ST_IsValid()</span> and
            boundary encroachment via <span className="font-mono text-xs text-sky-300">ST_Intersects(ST_Buffer(geom, {tolerance}m), existing.geom)</span>.
          </p>
        </div>
        <button
          onClick={handleRunSuites}
          disabled={loadingSuite}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
        >
          <Play className="w-4 h-4" />
          <span>{loadingSuite ? 'Running Spatial Suites...' : 'Run Clean & Messy Test Suites'}</span>
        </button>
      </div>

      {/* Main Spatial Canvas + Interactive Probe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">
                Cadastral Parcel Layer (EPSG:4326)
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="text-emerald-300 font-medium">
                  Registered ({parcels.filter((p) => p.status === 'REGISTERED').length})
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-rose-300 font-medium">
                  Revoked ({parcels.filter((p) => p.status === 'REVOKED_REVERTED').length})
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-sky-300 font-medium">Candidate Probe</span>
              </div>
            </div>

            <LiveAbujaCadastralMap
              parcels={parcels}
              selectedParcelCode={selectedParcelCode}
              onSelectParcel={(code) => setSelectedParcelCode(code)}
              candidateProbe={
                parsedProbeCoords
                  ? {
                      parcelId: probeId,
                      coordinates: parsedProbeCoords,
                      outcome: validationResult?.outcome || null,
                    }
                  : null
              }
              heightClass="h-[360px]"
              defaultMapType="hybrid"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-[#27354f] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label htmlFor="tolerance-slider" className="text-xs font-semibold text-slate-200 block">
                Overlap Tolerance Buffer (ST_Buffer radius)
              </label>
              <span className="text-xs text-slate-400">
                Accounts for survey accuracy tolerances between adjacent beacons
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="tolerance-slider"
                type="range"
                min="0"
                max="5"
                step="0.25"
                value={tolerance}
                onChange={(e) => handleToleranceChange(Number(e.target.value))}
                className="w-36 accent-sky-400 cursor-pointer"
              />
              <span className="font-mono tabular-nums text-sm font-bold text-sky-300 w-16 text-right">
                {tolerance.toFixed(2)} m
              </span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 bg-[#1b212e] border border-[#2c374c] rounded-xl p-6 shadow-md flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Submit Parcel Coordinates</h2>
              <button
                onClick={loadParcels}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh Layer</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRESET_PROBES.map((preset) => (
                <button
                  key={preset.parcelId}
                  onClick={() => {
                    setProbeId(preset.parcelId);
                    setCoordsText(JSON.stringify(preset.coordinates));
                    setValidationResult(null);
                    setParseError(null);
                  }}
                  className={`px-3 py-2 text-left text-xs border rounded-lg transition-colors cursor-pointer ${
                    probeId === preset.parcelId
                      ? 'border-sky-400 bg-[#1e3152] text-white font-semibold'
                      : 'border-[#2c3a54] bg-[#131924] text-slate-300 hover:bg-[#1a2334] hover:text-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                WGS 84 Polygon Ring ([longitude, latitude][])
              </label>
              <textarea
                rows={4}
                value={coordsText}
                onChange={(e) => setCoordsText(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400"
              />
              {parseError && <p className="text-xs text-rose-300 mt-1">{parseError}</p>}
            </div>

            <button
              onClick={handleVerifyProbe}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Verify Geometry & Check Overlaps
            </button>
          </div>

          {validationResult && (
            <div className="mt-5 pt-4 border-t border-[#28354e] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {validationResult.outcome === 'VALID_NON_OVERLAPPING' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : validationResult.outcome === 'INVALID_GEOMETRY' ? (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span className="text-sm font-semibold text-white">
                    {validationResult.outcome === 'VALID_NON_OVERLAPPING'
                      ? 'Valid and non-overlapping'
                      : validationResult.outcome === 'INVALID_GEOMETRY'
                        ? 'Invalid geometry'
                        : 'Overlapping existing parcel'}
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-sky-300 font-semibold">
                  {validationResult.executionMs} ms
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {validationResult.diagnosticMessage}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-slate-400">Area:</span>{' '}
                  <span className="font-mono tabular-nums font-semibold text-white">
                    {validationResult.areaSqMeters.toLocaleString()} m²
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Tolerance:</span>{' '}
                  <span className="font-mono tabular-nums font-semibold text-white">
                    {validationResult.toleranceMeters} m
                  </span>
                </div>
              </div>

              <div className="text-xs font-mono text-slate-400 truncate">
                Hash: {validationResult.spatialHash}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Isolated Test Results Tables (Clean & Messy Sets) */}
      {testSuites && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[testSuites.cleanSuite, testSuites.messySuite].map((suite) => (
            <section
              key={suite.suiteName}
              className="bg-[#182132] border border-[#2a3954] rounded-xl p-6 shadow-md"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{suite.suiteName}</h3>
                  <p className="text-xs text-slate-400">
                    Overlap tolerance buffer: {suite.toleranceMeters} m ·{' '}
                    <span className="font-semibold text-emerald-300">
                      {suite.cases.filter((c) => c.passed).length}/{suite.total} passed
                    </span>
                  </p>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-5">
                <thead>
                  <tr className="border-b border-[#283652] text-xs font-semibold text-slate-400">
                    <th className="py-2 pr-4">Validation Outcome</th>
                    <th className="py-2 pr-4 text-right">Frequency</th>
                    <th className="py-2 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233048] text-sm">
                  {suite.rows.map((r) => (
                    <tr key={r.outcome}>
                      <td className="py-2.5 pr-4 text-slate-200">{r.outcome}</td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-white">
                        {r.frequency}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-white">
                        {r.percentage}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#324466] font-semibold">
                    <td className="py-2.5 pr-4 text-white">Total</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-white">
                      {suite.total}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-white">100%</td>
                  </tr>
                </tbody>
              </table>

              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-sky-300 hover:text-sky-200">
                  Inspect {suite.total} test parcel diagnostics
                </summary>
                <div className="mt-3 divide-y divide-[#233048] max-h-56 overflow-y-auto">
                  {suite.cases.map((c) => (
                    <div key={c.caseId} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-100">
                          <span className="font-mono text-sky-300 mr-1.5">{c.caseId}</span>
                          {c.label}
                        </div>
                        <div className="text-slate-400 mt-0.5">{c.diagnosticMessage}</div>
                      </div>
                      <span
                        className={`font-mono font-semibold shrink-0 ${
                          c.passed ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
