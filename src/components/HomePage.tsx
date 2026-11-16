import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Compass,
  FileCheck2,
  Landmark,
  MapPin,
  Radio,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { LandTitleNFT, MqttMessageRecord, NavSection, ParcelRecord } from '../types';
import { LiveAbujaCadastralMap } from './LiveAbujaCadastralMap';
import { ConnectedWalletInfo } from './AvailableLandsPage';

interface Props {
  onEnterConsole: (section?: NavSection) => void;
  onOpenLandsPage: () => void;
  onOpenWalletModal: () => void;
  connectedWallet: ConnectedWalletInfo | null;
  liveMessages?: MqttMessageRecord[];
}

export function HomePage({
  onEnterConsole,
  onOpenLandsPage,
  onOpenWalletModal,
  connectedWallet,
  liveMessages = [],
}: Props) {
  const [parcels, setParcels] = useState<ParcelRecord[]>([]);
  const [titles, setTitles] = useState<LandTitleNFT[]>([]);
  const [selectedParcelCode, setSelectedParcelCode] = useState<string>('ABJ-MAI-101');

  const loadRegistryFeed = useCallback(() => {
    Promise.all([
      fetch('/api/gis/parcels').then((r) => r.json()),
      fetch('/api/blockchain/state').then((r) => r.json()),
    ])
      .then(([gisData, bcData]) => {
        setParcels(gisData.parcels || []);
        setTitles(bcData.titles || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRegistryFeed();
  }, [loadRegistryFeed, liveMessages.length]);

  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const activeParcel =
    parcels.find((p) => p.parcelCode === selectedParcelCode) || parcels[0] || null;
  const latestFeedEvent = liveMessages[0] || null;

  const frameworkElements: Array<{
    number: string;
    title: string;
    summary: string;
    description: string;
    actionLabel: string;
    icon: typeof Compass;
    tone: string;
    cardBg: string;
    onClick: () => void;
  }> = [
    {
      number: '01',
      title: 'Spatial Boundary & Encroachment Protection',
      summary: 'Accurate digital surveying and overlap prevention',
      description:
        'Every land parcel is mapped using verified survey coordinates and checked against existing registered boundaries. Irregular or overlapping shapes are flagged early so no two buyers are allocated the same piece of land.',
      actionLabel: 'Open Boundary Checker',
      icon: Compass,
      tone: 'text-sky-400',
      cardBg: 'bg-[#182132] border-[#2a3954]',
      onClick: () => onEnterConsole('gis'),
    },
    {
      number: '02',
      title: 'Tamper-Proof Digital Title Ownership',
      summary: 'Permanent ownership records protected from forgery',
      description:
        'Approved plots receive a unique digital title anchored in an immutable registry. Direct informal transfers are restricted so ownership can only change after official verification, blocking fake deeds and double-selling.',
      actionLabel: 'View Title Registry',
      icon: FileCheck2,
      tone: 'text-emerald-400',
      cardBg: 'bg-[#1b212e] border-[#2c374c]',
      onClick: () => onEnterConsole('blockchain'),
    },
    {
      number: '03',
      title: 'Statutory Governor Oversight & Land Use Act Compliance',
      summary: 'Built-in Nigerian statutory governance safeguards',
      description:
        'Aligned with the Nigeria Land Use Act (1978), statutory revocation for overriding public interest under Section 28 is strictly restricted to authorized Governor oversight, with every decision permanently recorded with clear legal grounds.',
      actionLabel: 'Inspect Governance Controls',
      icon: Landmark,
      tone: 'text-cyan-400',
      cardBg: 'bg-[#1b212e] border-[#2c374c]',
      onClick: () => onEnterConsole('blockchain'),
    },
    {
      number: '04',
      title: 'Community & Institutional Ownership Attestation',
      summary: 'Reconciles state archives with community consent',
      description:
        'Bridges statutory state registries and customary land tenure by cross-checking official deed references, identity records, and recognized traditional council attestations before any title application is cleared.',
      actionLabel: 'Open Verification Desk',
      icon: ShieldCheck,
      tone: 'text-amber-400',
      cardBg: 'bg-[#182132] border-[#2a3954]',
      onClick: () => onEnterConsole('oracle-mqtt'),
    },
    {
      number: '05',
      title: 'Real-Time Registry Sync & Rural Field Support',
      summary: 'Reliable updates even in low-connectivity zones',
      description:
        'Registry approvals, survey clearances, and title updates synchronize live across buyers and state offices—while safely queuing field submissions whenever surveyors operate in areas with weak mobile signal.',
      actionLabel: 'View Live Registry Sync',
      icon: Radio,
      tone: 'text-sky-300',
      cardBg: 'bg-[#182132] border-[#2a3954]',
      onClick: () => onEnterConsole('oracle-mqtt'),
    },
    {
      number: '06',
      title: 'Nationwide Verified Land Marketplace',
      summary: 'Direct access to surveyed plots across Nigeria',
      description:
        'Explore residential, commercial, and development plots across Abuja, Lagos, Rivers, Kano, Enugu, Adamawa, Gombe, Oyo, Kaduna, and Cross River—each paired with real imagery, Google Maps coordinates, and USD ($) / SOL pricing.',
      actionLabel: 'Check Available Plots',
      icon: Building2,
      tone: 'text-emerald-300',
      cardBg: 'bg-[#1b212e] border-[#2c374c]',
      onClick: onOpenLandsPage,
    },
  ];

  const acquisitionSteps = [
    {
      step: 'Step 01',
      title: 'Select a Plot Across Nigeria',
      description:
        'Browse verified listings across multiple Nigerian states with site photography, exact GPS boundaries on Google Maps, and clear USD and SOL pricing.',
    },
    {
      step: 'Step 02',
      title: 'Boundary & Survey Clearance',
      description:
        'Licensed surveyors confirm that plot coordinates form a valid boundary with safe clearance from adjacent registered land parcels.',
    },
    {
      step: 'Step 03',
      title: 'Community & Legal Verification',
      description:
        'Institutional registry deeds, national identity details, and local community attestations are verified together to rule out disputes or caveats.',
    },
    {
      step: 'Step 04',
      title: 'Registrar Approval & Title Issuance',
      description:
        'Authorized land registrars sign off on cleared applications, issuing a permanent digital title record with instant registry synchronization.',
    },
  ];

  const nigerianStates = [
    { state: 'Abuja (FCT)', region: 'North Central · Maitama, Wuse II & Garki II' },
    { state: 'Lagos', region: 'South West · Lekki Phase 1 & Ikeja GRA' },
    { state: 'Rivers', region: 'South South · Port Harcourt Old GRA & Trans-Amadi' },
    { state: 'Kano', region: 'North West · Nassarawa GRA & Bompai Corridor' },
    { state: 'Enugu', region: 'South East · Independence Layout & New GRA' },
    { state: 'Adamawa', region: 'North East · Jimeta Dougirei & Yola Town' },
    { state: 'Gombe', region: 'North East · New GRA & Tudun Wada' },
    { state: 'Oyo', region: 'South West · Bodija Estate & Jericho Reserve' },
    { state: 'Kaduna', region: 'North West · Barnawa GRA & Millennium City' },
    { state: 'Cross River', region: 'South South · Calabar Summit Hills' },
  ];

  return (
    <div className="min-h-screen bg-[#11151c] text-slate-100 flex flex-col">
      {/* Top Bar Contract: Exactly 3 zones */}
      <header className="sticky top-0 z-30 bg-[#151e2f]/95 backdrop-blur-xs border-b border-[#27354f]">
        <div className="max-w-7xl mx-auto h-18 px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#top"
            className="text-xl font-bold tracking-tight text-sky-300 hover:text-white whitespace-nowrap shrink-0"
          >
            ANAGU
          </a>

          {/* Zone 2: 4 single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-base font-medium text-slate-300">
            <a
              href="#elements"
              className="hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
            >
              Platform Elements
            </a>
            <a
              href="#how-it-works"
              className="hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#coverage"
              className="hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
            >
              Nigeria Coverage
            </a>
            <button
              type="button"
              onClick={() => onEnterConsole('overview')}
              className="hover:text-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Registry Console
            </button>
          </nav>

          {/* Zone 3: Two primary top-right corner buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenLandsPage}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-100 bg-[#1b273d] hover:bg-[#23324e] border border-[#31456b] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-sky-300" />
              <span>Check Available Plots</span>
            </button>
            <button
              type="button"
              onClick={onOpenWalletModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Wallet className="w-4 h-4" />
              <span>
                {connectedWallet
                  ? `Wallet: ${shortAddr(connectedWallet.address)}`
                  : 'Connect Your Secure Wallet'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="bg-gradient-to-b from-[#162033] via-[#131a26] to-[#11151c] border-b border-[#25324a]">
          <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Proposition */}
            <div className="lg:col-span-6 flex flex-col justify-center space-y-7">
              <h1
                className="font-bold tracking-tight text-white leading-[1.1]"
                style={{
                  fontSize: 'clamp(2.6rem, 4.4vw, 3.85rem)',
                  textWrap: 'balance',
                }}
              >
                Buy, Verify, Sell and Buy Your Piece of Land
              </h1>

              <div className="flex flex-wrap items-center gap-5 pt-2">
                <button
                  type="button"
                  onClick={() => onEnterConsole('workflow')}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-base font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <span>Launch Registration Workspace</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="#elements"
                  className="px-4 py-3 text-base font-semibold text-sky-300 hover:text-sky-200 transition-colors whitespace-nowrap"
                >
                  Explore Platform Elements
                </a>
              </div>
            </div>

            {/* Right Interactive Live Map Preview */}
            <div className="lg:col-span-6 flex">
              <div className="w-full bg-[#182132] border border-[#2a3954] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-slate-50">
                    Live Nigeria Land Registry Map
                  </span>
                  <span className="text-sm font-mono text-slate-400">
                    {parcels.length} verified parcels
                  </span>
                </div>

                <LiveAbujaCadastralMap
                  parcels={parcels}
                  titles={titles}
                  selectedParcelCode={activeParcel?.parcelCode || null}
                  onSelectParcel={(code) => setSelectedParcelCode(code)}
                  liveFeedEvent={latestFeedEvent}
                  heightClass="h-[320px]"
                  defaultMapType="hybrid"
                />

                <div className="pt-3 border-t border-[#27354f] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                  <span className="text-slate-300">
                    Select any boundary pin on the map or browse verified land plots across Nigeria.
                  </span>
                  <button
                    type="button"
                    onClick={onOpenLandsPage}
                    className="inline-flex items-center gap-1.5 font-semibold text-sky-300 hover:text-sky-200 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Check Available Plots</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Platform Elements — Description-Wise Cards */}
        <section id="elements" className="max-w-7xl mx-auto px-6 py-16 space-y-10">
          <div className="max-w-3xl space-y-2.5">
            <div className="text-sm font-semibold text-sky-300">
              ANAGU Land Administration Architecture
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Core Elements Protecting Land Ownership
            </h2>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Every stage of land acquisition, survey clearance, community attestation, and digital
              title issuance is structured to prevent land disputes and protect buyers and institutions across Nigeria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {frameworkElements.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.number}
                  className={`${item.cardBg} border rounded-2xl p-7 shadow-md flex flex-col justify-between space-y-6`}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-semibold text-sky-300">
                        {item.number}
                      </span>
                      <Icon className={`w-6 h-6 ${item.tone}`} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-50 leading-snug">
                      {item.title}
                    </h3>
                    <div className="text-sm font-medium text-sky-200">
                      {item.summary}
                    </div>
                    <p className="text-base text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#27354f]">
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="inline-flex items-center gap-2 text-base font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* How ANAGU Works — Clear Description Cards */}
        <section id="how-it-works" className="bg-[#151d2d] border-y border-[#27354f] py-16">
          <div className="max-w-7xl mx-auto px-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl space-y-2">
                <div className="text-sm font-semibold text-sky-300">Guided Ownership Journey</div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  From Plot Discovery to Verified Digital Title
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onEnterConsole('workflow')}
                className="inline-flex items-center gap-2 text-base font-semibold text-sky-300 hover:text-sky-200 cursor-pointer whitespace-nowrap"
              >
                <span>Open Application Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {acquisitionSteps.map((s) => (
                <div
                  key={s.step}
                  className="bg-[#1b2436] border border-[#2b3a55] rounded-xl p-6 space-y-3"
                >
                  <div className="text-sm font-mono font-bold text-sky-300">{s.step}</div>
                  <h3 className="text-lg font-bold text-slate-50 leading-snug">{s.title}</h3>
                  <p className="text-base text-slate-300 leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nationwide Coverage Card Section */}
        <section id="coverage" className="max-w-7xl mx-auto px-6 py-16">
          <div className="bg-[#182132] border border-[#2a3954] rounded-2xl p-8 lg:p-10 shadow-md space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-2.5">
                <div className="text-sm font-semibold text-sky-300">Nationwide Availability</div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  Verified Land Plots Across Nigeria
                </h2>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                  Explore surveyed residential, commercial, and development plots across every major
                  region of Nigeria—backed by real satellite photography, live Google Map boundaries,
                  and transparent pricing in USD ($) and SOL.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLandsPage}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
              >
                <MapPin className="w-4 h-4" />
                <span>Check Available Plots</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {nigerianStates.map((loc) => (
                <button
                  key={loc.state}
                  type="button"
                  onClick={onOpenLandsPage}
                  className="text-left bg-[#131a27] hover:bg-[#1e2940] border border-[#2b3a55] rounded-xl p-4 transition-colors cursor-pointer space-y-1"
                >
                  <div className="text-base font-bold text-slate-50">{loc.state}</div>
                  <div className="text-sm text-slate-300 leading-snug">{loc.region}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-[#151d2d] border-t border-[#27354f]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-300">
          <div className="text-base font-bold text-slate-100">ANAGU</div>
          <div className="text-center">
            Verified Land Marketplace &amp; Digital Cadastral Title Registry Across Nigeria
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <button
              type="button"
              onClick={onOpenLandsPage}
              className="font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
            >
              Check Available Plots
            </button>
            <button
              type="button"
              onClick={() => onEnterConsole('overview')}
              className="font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              Open Registry Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
