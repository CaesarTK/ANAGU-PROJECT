import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Blocks,
  Compass,
  ExternalLink,
  GitMerge,
  Home,
  Layers,
  Menu,
  Radio,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { MqttMessageRecord, NavSection, UserRole } from './types';
import { HomePage } from './components/HomePage';
import { AvailableLandsPage, ConnectedWalletInfo } from './components/AvailableLandsPage';
import { OverviewData, OverviewPanel } from './components/OverviewPanel';
import { GisProbeSeed, GisVerificationPanel } from './components/GisVerificationPanel';
import { BlockchainRevocationPanel } from './components/BlockchainRevocationPanel';
import { OracleMqttPanel } from './components/OracleMqttPanel';
import { UnifiedWorkflowPanel } from './components/UnifiedWorkflowPanel';
import { EvaluationPanel } from './components/EvaluationPanel';

const NAV_ITEMS: Array<{
  id: NavSection;
  step: string;
  label: string;
  icon: typeof Compass;
}> = [
  { id: 'overview', step: '00', label: 'Environment & Schema', icon: Layers },
  { id: 'gis', step: '01', label: 'GIS Spatial Verification', icon: Compass },
  { id: 'blockchain', step: '02', label: 'NFT & Section 28 Revocation', icon: Blocks },
  { id: 'oracle-mqtt', step: '03', label: 'Oracle & MQTT Sync', icon: Radio },
  { id: 'workflow', step: '04', label: 'Unified Workflow', icon: GitMerge },
  { id: 'evaluation', step: '05', label: 'Cross-Cutting Evaluation', icon: BarChart3 },
];

const ROLES: UserRole[] = [
  'Citizen',
  'Surveyor',
  'Registrar',
  'LandAdministrator',
  'Governor',
];

export default function App() {
  const [viewMode, setViewMode] = useState<'home' | 'lands' | 'console'>('home');
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [activeRole, setActiveRole] = useState<UserRole>('Registrar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [mqttMessages, setMqttMessages] = useState<MqttMessageRecord[]>([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWalletInfo | null>(null);
  const [metamaskAddressInput, setMetamaskAddressInput] = useState('');
  const [eip6963MetaMaskProvider, setEip6963MetaMaskProvider] = useState<{
    request: (args: { method: string }) => Promise<string[]>;
  } | null>(null);
  const [initialGisProbe, setInitialGisProbe] = useState<GisProbeSeed | null>(null);

  const loadOverview = async () => {
    const res = await fetch('/api/overview');
    const json = await res.json();
    setOverviewData(json);
  };

  const loadMqttMessages = async () => {
    const res = await fetch('/api/mqtt/messages');
    const json = await res.json();
    setMqttMessages(json.messages || []);
  };

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);

    loadOverview();
    loadMqttMessages();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/mqtt`);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'mqtt_message' && parsed.data) {
          setMqttMessages((prev) => [parsed.data, ...prev].slice(0, 100));
        }
      } catch {
        // Ignore malformed frame
      }
    };
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuota);
      ws.close();
    };
  }, []);

  useEffect(() => {
    type Eip6963Detail = {
      info?: { rdns?: string; name?: string };
      provider?: { request: (args: { method: string }) => Promise<string[]> };
    };
    const onAnnounce = (event: Event) => {
      const custom = event as CustomEvent<Eip6963Detail>;
      const detail = custom.detail;
      if (
        detail?.provider &&
        (detail.info?.rdns === 'io.metamask' ||
          detail.info?.name?.toLowerCase().includes('metamask'))
      ) {
        setEip6963MetaMaskProvider(detail.provider);
      }
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
    };
  }, []);

  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const getMetaMaskProvider = () => {
    if (eip6963MetaMaskProvider) return eip6963MetaMaskProvider;
    const win = window as unknown as {
      ethereum?: {
        isMetaMask?: boolean;
        providers?: Array<{
          isMetaMask?: boolean;
          request: (args: { method: string }) => Promise<string[]>;
        }>;
        request: (args: { method: string }) => Promise<string[]>;
      };
    };
    if (win.ethereum?.providers && Array.isArray(win.ethereum.providers)) {
      const mm = win.ethereum.providers.find((p) => p.isMetaMask);
      if (mm) return mm;
    }
    if (win.ethereum) {
      return win.ethereum;
    }
    return null;
  };

  const handleConnectMetaMask = async () => {
    setWalletError(null);
    setConnectingWallet(true);
    try {
      const provider = getMetaMaskProvider();
      if (provider) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          setConnectedWallet({
            address: accounts[0],
            label: 'MetaMask',
            mode: 'browser',
          });
          setWalletModalOpen(false);
          return;
        }
      }

      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      setWalletError(
        inIframe
          ? 'MetaMask extension cannot inject inside an embedded preview frame. Open the app in a standalone tab below, launch MetaMask Mobile, or paste your MetaMask 0x address.'
          : 'MetaMask extension not detected in this browser. Install MetaMask, or paste your MetaMask 0x address below.'
      );
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'MetaMask connection request was cancelled.');
    } finally {
      setConnectingWallet(false);
    }
  };

  const handleConnectManualMetaMask = (e: React.FormEvent) => {
    e.preventDefault();
    setWalletError(null);
    const trimmed = metamaskAddressInput.trim();
    const isValidEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isValidEvmAddress) {
      setWalletError('Enter a valid MetaMask wallet address (0x followed by 40 hex characters).');
      return;
    }
    setConnectedWallet({
      address: trimmed,
      label: 'MetaMask',
      mode: 'browser',
    });
    setMetamaskAddressInput('');
    setWalletModalOpen(false);
  };

  const isMetaMaskDetected = Boolean(getMetaMaskProvider());
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const dappPath =
    typeof window !== 'undefined' ? `${window.location.host}${window.location.pathname}` : '';
  const metamaskDeepLink = `https://metamask.app.link/dapp/${dappPath}`;

  const walletModal = walletModalOpen ? (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect Your Secure Wallet"
    >
      <div className="bg-[#162033] border border-[#2a3954] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-[#283652] bg-[#131b2b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-slate-50">Connect Your Secure Wallet</h2>
          </div>
          <button
            type="button"
            onClick={() => setWalletModalOpen(false)}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {connectedWallet && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-200">
                  Connected ({connectedWallet.label})
                </span>
                <button
                  type="button"
                  onClick={() => setConnectedWallet(null)}
                  className="text-rose-300 font-semibold hover:underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
              <div className="font-mono text-emerald-300 break-all">{connectedWallet.address}</div>
            </div>
          )}

          {/* MetaMask Wallet Connection Section */}
          <div className="p-4 rounded-xl border border-[#2c3c5a] bg-[#1b2433] space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-100">MetaMask Wallet</span>
              <span className="font-mono text-xs text-sky-300">
                {isMetaMaskDetected ? 'Extension Ready' : 'Connect via Extension or Address'}
              </span>
            </div>

            <button
              type="button"
              disabled={connectingWallet}
              onClick={handleConnectMetaMask}
              className="w-full flex items-center justify-between px-4 py-3 text-base font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4" />
                <span>
                  {connectingWallet ? 'Connecting MetaMask...' : 'Connect MetaMask Wallet'}
                </span>
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <form onSubmit={handleConnectManualMetaMask} className="flex gap-2">
              <input
                type="text"
                value={metamaskAddressInput}
                onChange={(e) => setMetamaskAddressInput(e.target.value)}
                placeholder="Or paste MetaMask 0x... address"
                className="flex-1 px-3 py-2.5 text-sm font-mono bg-[#0f1522] border border-[#2d3e5e] text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                className="px-3.5 py-2.5 text-sm font-semibold text-slate-100 bg-[#222d42] hover:bg-[#2b3954] border border-[#34476b] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Link Address
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-300 pt-0.5">
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold hover:text-sky-200 hover:underline"
              >
                <span>Open Standalone Tab for Extension</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={metamaskDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold hover:text-sky-200 hover:underline"
              >
                <span>MetaMask Mobile App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {walletError && (
            <div className="text-sm text-amber-200 bg-amber-950/60 border border-amber-700/60 rounded-lg p-3.5 space-y-2">
              <p>{walletError}</p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200 hover:underline"
              >
                <span>Download MetaMask</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  ) : null;

  const quotaBanner = quotaExceeded ? (
    <div className="bg-amber-950/90 border-b border-amber-700/70 text-amber-100 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
      <span>
        Google Maps Platform quota reached. If you are the app owner, visit{' '}
        <a
          href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold text-amber-200 hover:text-white"
        >
          maps developer site
        </a>{' '}
        for instructions to update your account.
      </span>
    </div>
  ) : null;

  if (viewMode === 'home') {
    return (
      <>
        {quotaBanner}
        <HomePage
          liveMessages={mqttMessages}
          connectedWallet={connectedWallet}
          onOpenWalletModal={() => {
            setWalletError(null);
            setWalletModalOpen(true);
          }}
          onOpenLandsPage={() => {
            setViewMode('lands');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onEnterConsole={(section) => {
            if (section) setActiveSection(section);
            setViewMode('console');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        {walletModal}
      </>
    );
  }

  if (viewMode === 'lands') {
    return (
      <>
        {quotaBanner}
        <AvailableLandsPage
          liveMessages={mqttMessages}
          connectedWallet={connectedWallet}
          onOpenWalletModal={() => {
            setWalletError(null);
            setWalletModalOpen(true);
          }}
          onBackHome={() => {
            setViewMode('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onEnterConsole={(section) => {
            if (section) setActiveSection(section);
            setViewMode('console');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onVerifyPlotGis={(parcelId, coordinates) => {
            setInitialGisProbe({ parcelId, coordinates });
            setActiveSection('gis');
            setViewMode('console');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
        {walletModal}
      </>
    );
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection)!;

  return (
    <div className="min-h-screen bg-[#11151c] text-slate-100 flex flex-col">
      {quotaBanner}
      <div className="flex-1 flex min-h-0">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#151e2f] border-r border-[#27354f]">
        <div className="h-16 px-5 flex items-center border-b border-[#27354f]">
          <button
            onClick={() => setViewMode('home')}
            className="text-lg font-bold tracking-tight text-sky-300 hover:text-white whitespace-nowrap cursor-pointer"
          >
            ANAGU
          </button>
        </div>

        <nav className="flex-1 p-3.5 space-y-1" aria-label="Framework Components">
          <button
            onClick={() => setViewMode('home')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left cursor-pointer text-slate-300 hover:bg-[#1e2b42] hover:text-white mb-2"
          >
            <Home className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Homepage</span>
          </button>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-[#1d4ed8] text-white font-medium shadow-xs'
                    : 'text-slate-300 hover:bg-[#1e2b42] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sky-100' : 'text-slate-400'}`} />
                <span className="truncate">
                  <span
                    className={`font-mono text-xs mr-1.5 ${
                      active ? 'text-sky-100' : 'text-slate-400'
                    }`}
                  >
                    {item.step}.
                  </span>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#27354f] bg-[#121927] text-xs text-slate-300 space-y-1">
          <div className="font-semibold text-slate-100">Nigeria Land Use Act (1978)</div>
          <div className="text-slate-400">PoA–QBFT–DPoS · WGS 84 · ERC-721</div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-[#151e2f] h-full border-r border-[#27354f] flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#27354f]">
              <span className="text-lg font-bold text-sky-300">ANAGU</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-2 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3.5 space-y-1">
              <button
                onClick={() => {
                  setViewMode('home');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-left text-slate-300 hover:bg-[#1e2b42]"
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Homepage</span>
              </button>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-left ${
                      active ? 'bg-[#1d4ed8] text-white font-medium' : 'text-slate-300 hover:bg-[#1e2b42]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {item.step}. {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-16 bg-[#151e2f] border-b border-[#27354f] px-6 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-base truncate">
              <button
                onClick={() => setViewMode('home')}
                className="text-slate-400 hover:text-sky-300 whitespace-nowrap cursor-pointer"
              >
                ANAGU
              </button>
              <span className="text-slate-600" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-50 truncate">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label htmlFor="role-select" className="hidden sm:inline text-sm font-medium text-slate-400 whitespace-nowrap">
              Active Role
            </label>
            <select
              id="role-select"
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value as UserRole)}
              className="px-3 py-2 text-sm font-medium bg-[#0f1522] border border-[#2d3e5e] rounded-md text-slate-100 whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus:border-sky-400"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              onClick={() => setActiveSection('evaluation')}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              Evaluate Framework
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewPanel data={overviewData} onNavigate={setActiveSection} />
          )}
          {activeSection === 'gis' && <GisVerificationPanel initialProbe={initialGisProbe} />}
          {activeSection === 'blockchain' && (
            <BlockchainRevocationPanel activeRole={activeRole} />
          )}
          {activeSection === 'oracle-mqtt' && (
            <OracleMqttPanel
              liveMessages={mqttMessages}
              onRefreshMessages={() => {
                loadMqttMessages();
                loadOverview();
              }}
            />
          )}
          {activeSection === 'workflow' && (
            <UnifiedWorkflowPanel
              activeRole={activeRole}
              onRefreshMessages={() => {
                loadMqttMessages();
                loadOverview();
              }}
            />
          )}
          {activeSection === 'evaluation' && <EvaluationPanel />}
        </main>
      </div>
      </div>
    </div>
  );
}
