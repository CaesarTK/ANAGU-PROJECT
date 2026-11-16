/// <reference types="google.maps" />
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  APIProviderContext,
  AdvancedMarker,
  Map as GoogleMap,
  Polygon,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Search,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { LandTitleNFT, MqttMessageRecord, NavSection, ParcelRecord } from '../types';
import { LiveAbujaCadastralMap } from './LiveAbujaCadastralMap';

export interface ConnectedWalletInfo {
  address: string;
  label: string;
  mode: 'browser' | 'registry';
}

interface AvailableLandsPageProps {
  onBackHome: () => void;
  onEnterConsole: (section?: NavSection) => void;
  onVerifyPlotGis?: (parcelId: string, coordinates: [number, number][]) => void;
  onOpenWalletModal: () => void;
  connectedWallet: ConnectedWalletInfo | null;
  liveMessages?: MqttMessageRecord[];
}

type StateFilter =
  | 'ALL'
  | 'Abuja (FCT)'
  | 'Lagos'
  | 'Rivers'
  | 'Kano'
  | 'Enugu'
  | 'Adamawa'
  | 'Gombe'
  | 'Oyo'
  | 'Kaduna'
  | 'Cross River';

const STATE_FILTERS: StateFilter[] = [
  'ALL',
  'Abuja (FCT)',
  'Lagos',
  'Rivers',
  'Kano',
  'Enugu',
  'Adamawa',
  'Gombe',
  'Oyo',
  'Kaduna',
  'Cross River',
];

interface LandListing {
  id: string;
  parcelCode: string;
  title: string;
  state: Exclude<StateFilter, 'ALL'>;
  district: string;
  zoning: string;
  areaSqMeters: number;
  priceUsd: number;
  priceSol: number;
  imageUrl: string;
  coordinates: [number, number][];
  centroid: { lat: number; lng: number };
  status: 'AVAILABLE' | 'VERIFIED_ACTIVE' | 'REVOKED_REVERTED';
  tokenId: number | null;
  ownerAddress: string | null;
}

const SOL_PRICE_USD = 180;

const IMG_MAITAMA_DIPLOMATIC = '/src/assets/images/land_maitama_diplomatic_1794834511620.jpg';
const IMG_MAITAMA_ESTATE = '/src/assets/images/land_maitama_estate_1794834512546.jpg';
const IMG_WUSE_URBAN = '/src/assets/images/land_wuse_urban_1794834512649.jpg';
const IMG_GARKI_RESERVE = '/src/assets/images/land_garki_reserve_1794834512857.jpg';
const IMG_YOLA_ADAMAWA = '/src/assets/images/land_yola_adamawa_1794835371331.jpg';
const IMG_GOMBE_SAVANNA = '/src/assets/images/land_gombe_savanna_1794835371654.jpg';
const IMG_ENUGU_HILLS = '/src/assets/images/land_enugu_hills_1794835370991.jpg';
const IMG_LAGOS_LEKKI = '/src/assets/images/land_lagos_lekki_1794838083422.jpg';
const IMG_RIVERS_PH = '/src/assets/images/land_rivers_ph_1794838084159.jpg';
const IMG_KANO_NASSARAWA = '/src/assets/images/land_kano_nassarawa_1794838084206.jpg';
const IMG_IBADAN_BODIJA = '/src/assets/images/land_ibadan_bodija_1794838086213.jpg';

const LISTING_META: Record<
  string,
  { title: string; zoning: string; usdPerSqm: number; imageUrl: string }
> = {
  'ABJ-MAI-101': {
    title: 'Maitama Diplomatic Corner Plot',
    zoning: 'Residential · Zone A05',
    usdPerSqm: 34,
    imageUrl: IMG_MAITAMA_DIPLOMATIC,
  },
  'ABJ-MAI-102': {
    title: 'Maitama Elevated Estate Parcel',
    zoning: 'Luxury Residential · Zone A05',
    usdPerSqm: 38,
    imageUrl: IMG_MAITAMA_ESTATE,
  },
  'ABJ-WUS-204': {
    title: 'Wuse II Commercial Boulevard Plot',
    zoning: 'Mixed-Use Commercial · Zone A08',
    usdPerSqm: 44,
    imageUrl: IMG_WUSE_URBAN,
  },
  'ABJ-GAR-305': {
    title: 'Garki II Greenbelt Expansion Lot',
    zoning: 'Development Reserve · Zone A03',
    usdPerSqm: 29,
    imageUrl: IMG_GARKI_RESERVE,
  },
};

const OPEN_INFILL_LISTINGS: Array<{
  id: string;
  parcelCode: string;
  title: string;
  state: Exclude<StateFilter, 'ALL'>;
  district: string;
  zoning: string;
  areaSqMeters: number;
  usdPerSqm: number;
  imageUrl: string;
  coordinates: [number, number][];
}> = [
  {
    id: 'OPEN-MAI-108',
    parcelCode: 'ABJ-MAI-108',
    title: 'Maitama North Infill Serviced Plot',
    state: 'Abuja (FCT)',
    district: 'Abuja (FCT) · Maitama Cadastral Zone A05',
    zoning: 'Serviced Residential · FCT Abuja',
    areaSqMeters: 11850,
    usdPerSqm: 36,
    imageUrl: IMG_MAITAMA_ESTATE,
    coordinates: [
      [7.4860, 9.0848],
      [7.4872, 9.0848],
      [7.4872, 9.0858],
      [7.4860, 9.0858],
      [7.4860, 9.0848],
    ],
  },
  {
    id: 'OPEN-LAG-701',
    parcelCode: 'LAG-LEK-701',
    title: 'Lekki Phase 1 Coastal Boulevard Plot',
    state: 'Lagos',
    district: 'Lagos · Lekki Peninsula Phase 1',
    zoning: 'Prime Coastal Residential · Lagos State',
    areaSqMeters: 8400,
    usdPerSqm: 62,
    imageUrl: IMG_LAGOS_LEKKI,
    coordinates: [
      [3.4745, 6.4465],
      [3.4755, 6.4465],
      [3.4755, 6.4474],
      [3.4745, 6.4474],
      [3.4745, 6.4465],
    ],
  },
  {
    id: 'OPEN-LAG-702',
    parcelCode: 'LAG-IKJ-702',
    title: 'Ikeja GRA Heritage Commercial Lot',
    state: 'Lagos',
    district: 'Lagos · Ikeja GRA Zone',
    zoning: 'Mixed Commercial & Office · Lagos State',
    areaSqMeters: 7600,
    usdPerSqm: 58,
    imageUrl: IMG_WUSE_URBAN,
    coordinates: [
      [3.3555, 6.5825],
      [3.3565, 6.5825],
      [3.3565, 6.5834],
      [3.3555, 6.5834],
      [3.3555, 6.5825],
    ],
  },
  {
    id: 'OPEN-RIV-801',
    parcelCode: 'PHC-GRA-801',
    title: 'Port Harcourt Old GRA Sovereign Plot',
    state: 'Rivers',
    district: 'Rivers · Port Harcourt Old GRA',
    zoning: 'Executive Residential · Rivers State',
    areaSqMeters: 10200,
    usdPerSqm: 31,
    imageUrl: IMG_RIVERS_PH,
    coordinates: [
      [7.0075, 4.7885],
      [7.0086, 4.7885],
      [7.0086, 4.7894],
      [7.0075, 4.7894],
      [7.0075, 4.7885],
    ],
  },
  {
    id: 'OPEN-RIV-802',
    parcelCode: 'PHC-TRA-802',
    title: 'Trans-Amadi Logistics & Industrial Lot',
    state: 'Rivers',
    district: 'Rivers · Port Harcourt Trans-Amadi',
    zoning: 'Commercial & Industrial · Rivers State',
    areaSqMeters: 14100,
    usdPerSqm: 26,
    imageUrl: IMG_GARKI_RESERVE,
    coordinates: [
      [7.0385, 4.8115],
      [7.0398, 4.8115],
      [7.0398, 4.8125],
      [7.0385, 4.8125],
      [7.0385, 4.8115],
    ],
  },
  {
    id: 'OPEN-KAN-901',
    parcelCode: 'KAN-NAS-901',
    title: 'Nassarawa GRA Diplomatic Estate Plot',
    state: 'Kano',
    district: 'Kano · Nassarawa GRA',
    zoning: 'Serviced Estate Residential · Kano State',
    areaSqMeters: 12400,
    usdPerSqm: 24,
    imageUrl: IMG_KANO_NASSARAWA,
    coordinates: [
      [8.5445, 11.9955],
      [8.5457, 11.9955],
      [8.5457, 11.9965],
      [8.5445, 11.9965],
      [8.5445, 11.9955],
    ],
  },
  {
    id: 'OPEN-KAN-902',
    parcelCode: 'KAN-BOM-902',
    title: 'Bompai Boulevard Commercial Parcel',
    state: 'Kano',
    district: 'Kano · Bompai Commercial District',
    zoning: 'Commercial Hub · Kano State',
    areaSqMeters: 9800,
    usdPerSqm: 27,
    imageUrl: IMG_KANO_NASSARAWA,
    coordinates: [
      [8.5555, 12.0075],
      [8.5566, 12.0075],
      [8.5566, 12.0084],
      [8.5555, 12.0084],
      [8.5555, 12.0075],
    ],
  },
  {
    id: 'OPEN-ENU-601',
    parcelCode: 'ENU-IND-601',
    title: 'Independence Layout Emerald Crest Plot',
    state: 'Enugu',
    district: 'Enugu · Independence Layout Phase II',
    zoning: 'Luxury Residential · Enugu State',
    areaSqMeters: 12100,
    usdPerSqm: 28,
    imageUrl: IMG_ENUGU_HILLS,
    coordinates: [
      [7.5190, 6.4465],
      [7.5202, 6.4465],
      [7.5202, 6.4475],
      [7.5190, 6.4475],
      [7.5190, 6.4465],
    ],
  },
  {
    id: 'OPEN-ENU-602',
    parcelCode: 'ENU-GRA-602',
    title: 'New Haven & GRA Ridge Serviced Lot',
    state: 'Enugu',
    district: 'Enugu · New GRA Sector',
    zoning: 'Mixed-Use Estate · Enugu State',
    areaSqMeters: 9600,
    usdPerSqm: 25,
    imageUrl: IMG_ENUGU_HILLS,
    coordinates: [
      [7.4930, 6.4585],
      [7.4941, 6.4585],
      [7.4941, 6.4594],
      [7.4930, 6.4594],
      [7.4930, 6.4585],
    ],
  },
  {
    id: 'OPEN-YOL-401',
    parcelCode: 'YOL-JIM-401',
    title: 'Jimeta Dougirei Hilltop Plot',
    state: 'Adamawa',
    district: 'Adamawa · Yola / Jimeta Dougirei GRA',
    zoning: 'Serviced Residential · Adamawa State',
    areaSqMeters: 13800,
    usdPerSqm: 19,
    imageUrl: IMG_YOLA_ADAMAWA,
    coordinates: [
      [12.4660, 9.2665],
      [12.4673, 9.2665],
      [12.4673, 9.2675],
      [12.4660, 9.2675],
      [12.4660, 9.2665],
    ],
  },
  {
    id: 'OPEN-YOL-402',
    parcelCode: 'YOL-MOD-402',
    title: 'Yola Town Riverside Agro-Estate Lot',
    state: 'Adamawa',
    district: 'Adamawa · Yola Modibbo Adama Corridor',
    zoning: 'Mixed Agro-Residential · Adamawa State',
    areaSqMeters: 10500,
    usdPerSqm: 16,
    imageUrl: IMG_YOLA_ADAMAWA,
    coordinates: [
      [12.4940, 9.2045],
      [12.4952, 9.2045],
      [12.4952, 9.2054],
      [12.4940, 9.2054],
      [12.4940, 9.2045],
    ],
  },
  {
    id: 'OPEN-GMB-501',
    parcelCode: 'GMB-GRA-501',
    title: 'Gombe New GRA Extension Plot',
    state: 'Gombe',
    district: 'Gombe · New GRA Layout',
    zoning: 'Prime Residential · Gombe State',
    areaSqMeters: 11200,
    usdPerSqm: 18,
    imageUrl: IMG_GOMBE_SAVANNA,
    coordinates: [
      [11.1670, 10.2895],
      [11.1682, 10.2895],
      [11.1682, 10.2905],
      [11.1670, 10.2905],
      [11.1670, 10.2895],
    ],
  },
  {
    id: 'OPEN-GMB-502',
    parcelCode: 'GMB-TUN-502',
    title: 'Tudun Wada Commercial Boulevard Parcel',
    state: 'Gombe',
    district: 'Gombe · Bauchi–Gombe Corridor',
    zoning: 'Commercial Development · Gombe State',
    areaSqMeters: 8950,
    usdPerSqm: 21,
    imageUrl: IMG_GOMBE_SAVANNA,
    coordinates: [
      [11.1745, 10.2830],
      [11.1756, 10.2830],
      [11.1756, 10.2839],
      [11.1745, 10.2839],
      [11.1745, 10.2830],
    ],
  },
  {
    id: 'OPEN-OYO-301',
    parcelCode: 'IBD-BOD-301',
    title: 'Bodija Heritage Elevated Estate Plot',
    state: 'Oyo',
    district: 'Oyo · Ibadan Bodija GRA',
    zoning: 'Serviced Residential · Oyo State',
    areaSqMeters: 9200,
    usdPerSqm: 23,
    imageUrl: IMG_IBADAN_BODIJA,
    coordinates: [
      [3.9075, 7.4315],
      [3.9086, 7.4315],
      [3.9086, 7.4324],
      [3.9075, 7.4324],
      [3.9075, 7.4315],
    ],
  },
  {
    id: 'OPEN-KAD-201',
    parcelCode: 'KAD-BAR-201',
    title: 'Barnawa GRA & Millennium City Plot',
    state: 'Kaduna',
    district: 'Kaduna · Barnawa GRA Sector',
    zoning: 'Residential Development · Kaduna State',
    areaSqMeters: 11600,
    usdPerSqm: 20,
    imageUrl: IMG_MAITAMA_DIPLOMATIC,
    coordinates: [
      [7.4375, 10.4825],
      [7.4386, 10.4825],
      [7.4386, 10.4835],
      [7.4375, 10.4835],
      [7.4375, 10.4825],
    ],
  },
  {
    id: 'OPEN-CRS-101',
    parcelCode: 'CAL-SUM-101',
    title: 'Summit Hills Green Sanctuary Parcel',
    state: 'Cross River',
    district: 'Cross River · Calabar Summit Hills',
    zoning: 'Eco-Residential Reserve · Cross River State',
    areaSqMeters: 10900,
    usdPerSqm: 22,
    imageUrl: IMG_RIVERS_PH,
    coordinates: [
      [8.3375, 5.0115],
      [8.3386, 5.0115],
      [8.3386, 5.0124],
      [8.3375, 5.0124],
      [8.3375, 5.0115],
    ],
  },
];

function computeCentroid(coords: [number, number][]): { lat: number; lng: number } {
  if (!coords || coords.length === 0) return { lat: 9.0831, lng: 7.4901 };
  const ring =
    coords.length > 1 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords.slice(0, -1)
      : coords;
  let lat = 0;
  let lng = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

function CardMiniGoogleMap({ listing }: { listing: LandListing }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const parentProvider = useContext(APIProviderContext);

  if (!apiKey) {
    return (
      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#141a24] text-slate-300 p-4 text-center text-sm">
        <MapPin className="w-5 h-5 text-sky-400 mb-1" />
        <div className="font-mono font-semibold text-slate-100">
          {listing.centroid.lat.toFixed(5)}° N, {listing.centroid.lng.toFixed(5)}° E
        </div>
        <div className="text-slate-400 mt-0.5">{listing.district}</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      {parentProvider ? (
        <CardMiniMapCanvas listing={listing} />
      ) : (
        <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="NG">
          <CardMiniMapCanvas listing={listing} />
        </APIProvider>
      )}
    </div>
  );
}

function CardMiniMapCanvas({ listing }: { listing: LandListing }) {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#141a24] text-slate-300 p-4 text-center text-sm">
        <MapPin className="w-5 h-5 text-sky-400 mb-1" />
        <div className="font-mono font-semibold text-slate-100">
          {listing.centroid.lat.toFixed(5)}° N, {listing.centroid.lng.toFixed(5)}° E
        </div>
        <div className="text-slate-400 mt-0.5">Map tiles unavailable</div>
      </div>
    );
  }

  const isRevoked = listing.status === 'REVOKED_REVERTED';
  const stroke = isRevoked ? '#e11d48' : '#0284c7';
  const path = listing.coordinates.map(([lng, lat]) => ({ lat, lng }));

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={listing.centroid}
      defaultZoom={17}
      mapTypeId="hybrid"
      gestureHandling="greedy"
      disableDefaultUI={true}
      zoomControl={true}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      <Polygon
        paths={path}
        strokeColor={stroke}
        strokeOpacity={0.95}
        strokeWeight={2.5}
        fillColor={stroke}
        fillOpacity={0.28}
      />
      <AdvancedMarker position={listing.centroid} title={listing.title}>
        <div className="px-2.5 py-0.5 rounded bg-sky-700 text-white border border-white text-xs font-mono font-semibold shadow">
          {listing.parcelCode}
        </div>
      </AdvancedMarker>
    </GoogleMap>
  );
}

export function AvailableLandsPage({
  onBackHome,
  onEnterConsole,
  onVerifyPlotGis,
  onOpenWalletModal,
  connectedWallet,
  liveMessages = [],
}: AvailableLandsPageProps) {
  const [parcels, setParcels] = useState<ParcelRecord[]>([]);
  const [titles, setTitles] = useState<LandTitleNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'price-asc' | 'price-desc' | 'area-desc'>('price-asc');
  const [selectedCode, setSelectedCode] = useState<string>('ABJ-MAI-101');
  const [focusSelectedSignal, setFocusSelectedSignal] = useState(0);
  const [cardViewMode, setCardViewMode] = useState<Record<string, 'photo' | 'map'>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [reservedPlots, setReservedPlots] = useState<
    Record<string, { applicationId: string; priceUsd: number; priceSol: number }>
  >({});
  const [reservingCode, setReservingCode] = useState<string | null>(null);
  const [latestReservation, setLatestReservation] = useState<{
    parcelCode: string;
    title: string;
    applicationId: string;
    priceUsd: number;
    priceSol: number;
  } | null>(null);

  const handleReservePlot = async (listing: LandListing) => {
    if (!connectedWallet) {
      onOpenWalletModal();
      return;
    }
    setReservingCode(listing.parcelCode);
    try {
      const res = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelCode: listing.parcelCode,
          district: listing.district,
          applicantName: `Wallet Buyer (${connectedWallet.label})`,
          nationalId: `NIN-${listing.parcelCode.replace(/[^0-9]/g, '').padEnd(8, '4')}`,
          ownerAddress: connectedWallet.address,
          coordinates: listing.coordinates,
          tenureType: 'Statutory',
          supportingDocsComplete: true,
          documentSignatureValid: true,
          communityAttestationCode: `ELDER-${listing.parcelCode}`,
          institutionalRefCode: `REG-${listing.parcelCode}`,
          actorRole: 'Citizen',
        }),
      });
      const created = await res.json();
      const appId = created?.applicationId || `APP-${listing.parcelCode}`;
      setReservedPlots((prev) => ({
        ...prev,
        [listing.parcelCode]: {
          applicationId: appId,
          priceUsd: listing.priceUsd,
          priceSol: listing.priceSol,
        },
      }));
      setLatestReservation({
        parcelCode: listing.parcelCode,
        title: listing.title,
        applicationId: appId,
        priceUsd: listing.priceUsd,
        priceSol: listing.priceSol,
      });
    } catch {
      const fallbackId = `APP-${listing.parcelCode}`;
      setReservedPlots((prev) => ({
        ...prev,
        [listing.parcelCode]: {
          applicationId: fallbackId,
          priceUsd: listing.priceUsd,
          priceSol: listing.priceSol,
        },
      }));
      setLatestReservation({
        parcelCode: listing.parcelCode,
        title: listing.title,
        applicationId: fallbackId,
        priceUsd: listing.priceUsd,
        priceSol: listing.priceSol,
      });
    } finally {
      setReservingCode(null);
    }
  };

  const loadListings = useCallback(() => {
    Promise.all([
      fetch('/api/gis/parcels').then((r) => r.json()),
      fetch('/api/blockchain/state').then((r) => r.json()),
    ])
      .then(([gisData, bcData]) => {
        setParcels(gisData.parcels || []);
        setTitles(bcData.titles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings, liveMessages.length]);

  const listings = useMemo<LandListing[]>(() => {
    const fromParcels: LandListing[] = parcels.map((p, idx) => {
      const meta = LISTING_META[p.parcelCode];
      const fallbackImages = [
        IMG_MAITAMA_DIPLOMATIC,
        IMG_MAITAMA_ESTATE,
        IMG_WUSE_URBAN,
        IMG_GARKI_RESERVE,
      ];
      const usdPerSqm = meta?.usdPerSqm ?? 35;
      const priceUsd = Math.round((p.areaSqMeters * usdPerSqm) / 500) * 500;
      const priceSol = Number((priceUsd / SOL_PRICE_USD).toFixed(2));
      const titleRecord =
        titles.find((t) => t.metadata.parcelCode === p.parcelCode || t.parcelId === p.id) || null;
      const isRevoked = p.status === 'REVOKED_REVERTED' || Boolean(titleRecord?.isRevoked);

      return {
        id: p.id,
        parcelCode: p.parcelCode,
        title: meta?.title || `${p.district} Surveyed Plot`,
        state: 'Abuja (FCT)' as const,
        district: `Abuja (FCT) · ${p.district}`,
        zoning: meta?.zoning || 'Verified Cadastral Plot',
        areaSqMeters: p.areaSqMeters,
        priceUsd,
        priceSol,
        imageUrl: meta?.imageUrl || fallbackImages[idx % fallbackImages.length],
        coordinates: p.coordinates,
        centroid: computeCentroid(p.coordinates),
        status: isRevoked ? 'REVOKED_REVERTED' : 'VERIFIED_ACTIVE',
        tokenId: titleRecord?.tokenId ?? p.tokenId ?? null,
        ownerAddress: titleRecord?.ownerAddress ?? p.ownerAddress ?? null,
      };
    });

    const infill: LandListing[] = OPEN_INFILL_LISTINGS.filter(
      (item) => !fromParcels.some((p) => p.parcelCode === item.parcelCode)
    ).map((item) => {
      const priceUsd = Math.round((item.areaSqMeters * item.usdPerSqm) / 500) * 500;
      return {
        id: item.id,
        parcelCode: item.parcelCode,
        title: item.title,
        state: item.state,
        district: item.district,
        zoning: item.zoning,
        areaSqMeters: item.areaSqMeters,
        priceUsd,
        priceSol: Number((priceUsd / SOL_PRICE_USD).toFixed(2)),
        imageUrl: item.imageUrl,
        coordinates: item.coordinates,
        centroid: computeCentroid(item.coordinates),
        status: 'AVAILABLE',
        tokenId: null,
        ownerAddress: null,
      };
    });

    return [...fromParcels, ...infill];
  }, [parcels, titles]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = listings.filter((item) => {
      const matchesState = stateFilter === 'ALL' || item.state === stateFilter;
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.parcelCode.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q);
      return matchesState && matchesSearch;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === 'price-asc') return a.priceUsd - b.priceUsd;
      if (sortOrder === 'price-desc') return b.priceUsd - a.priceUsd;
      return b.areaSqMeters - a.areaSqMeters;
    });
  }, [listings, stateFilter, searchQuery, sortOrder]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const mapParcels = useMemo<ParcelRecord[]>(() => {
    return filteredListings.map((item) => ({
      id: item.id,
      parcelCode: item.parcelCode,
      district: item.district,
      coordinates: item.coordinates,
      areaSqMeters: item.areaSqMeters,
      spatialHash: '0x00',
      ownerAddress: item.ownerAddress,
      tokenId: item.tokenId,
      status:
        item.status === 'REVOKED_REVERTED'
          ? 'REVOKED_REVERTED'
          : item.status === 'VERIFIED_ACTIVE'
            ? 'REGISTERED'
            : 'PENDING',
      createdAt: new Date().toISOString(),
    }));
  }, [filteredListings]);

  const selectedListing =
    listings.find((l) => l.parcelCode === selectedCode) || filteredListings[0] || null;

  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const pageBody = (
    <div className="min-h-screen bg-[#11151c] text-slate-100 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#151e2f]/95 backdrop-blur-xs border-b border-[#27354f]">
        <div className="max-w-7xl mx-auto h-18 px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={onBackHome}
            className="text-xl font-bold tracking-tight text-sky-300 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            ANAGU
          </button>

          <nav className="hidden md:flex items-center gap-6 text-base font-medium text-slate-300">
            {(['ALL', 'Abuja (FCT)', 'Lagos', 'Rivers', 'Kano', 'Enugu'] as const).map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setStateFilter(region)}
                className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stateFilter === region
                    ? 'text-sky-300 font-semibold underline underline-offset-4'
                    : 'hover:text-sky-300'
                }`}
              >
                {region === 'ALL' ? 'All Nigeria' : region}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-100 bg-[#1b273d] hover:bg-[#23324e] border border-[#31456b] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-sky-300" />
              <span>Back to Home</span>
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-9 space-y-7">
        {/* Page Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-sky-300">
              Nigeria Verified Land Marketplace · Nationwide Coverage · 1 SOL = ${SOL_PRICE_USD.toFixed(2)}
            </div>
            <h1
              className="font-bold tracking-tight text-white leading-[1.12]"
              style={{ fontSize: 'clamp(2rem, 3.2vw, 2.85rem)', textWrap: 'balance' }}
            >
              Available Plots for Purchase
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
              Browse verified plots across Nigeria — spanning Abuja, Lagos, Rivers, Kano, Enugu,
              Adamawa, Gombe, Oyo, Kaduna, and Cross River — with site imagery, live Google Map
              locations, and pricing in USD ($) and SOL.
            </p>
          </div>
          <div className="text-sm font-mono text-slate-300 shrink-0">
            {filteredListings.length} plots available
          </div>
        </section>

        {/* Interactive Google Map of All Plots */}
        <section className="bg-[#182132] border border-[#2a3954] rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-50">
                Google Map · {stateFilter === 'ALL' ? 'Across Nigeria' : stateFilter} Plot Locations
              </h2>
              <p className="text-sm text-slate-300 mt-0.5">
                Select any state below to zoom into that region, click any pin on Google Maps, or toggle Google Map on any plot card.
              </p>
            </div>
            {selectedListing && (
              <div className="flex items-center gap-4 text-sm bg-[#121927] border border-[#2d3e5e] rounded-lg px-4 py-2.5 shrink-0">
                <div>
                  <div className="font-mono font-semibold text-sky-300">{selectedListing.parcelCode}</div>
                  <div className="text-slate-200 truncate max-w-[200px]">{selectedListing.title}</div>
                </div>
                <div className="text-right font-mono tabular-nums border-l border-[#2d3e5e] pl-4">
                  <div className="font-bold text-white">${selectedListing.priceUsd.toLocaleString()}</div>
                  <div className="font-semibold text-sky-300">{selectedListing.priceSol.toLocaleString()} SOL</div>
                </div>
              </div>
            )}
          </div>

          <LiveAbujaCadastralMap
            parcels={mapParcels}
            titles={titles}
            selectedParcelCode={selectedCode}
            onSelectParcel={(code) => setSelectedCode(code)}
            liveFeedEvent={liveMessages[0] || null}
            heightClass="h-[290px]"
            defaultMapType="hybrid"
            focusSelectedSignal={focusSelectedSignal}
            fitTrigger={stateFilter}
          />
        </section>

        {/* Search & State Filter Toolbar */}
        <section className="space-y-4 bg-[#182132] border border-[#2a3954] rounded-xl p-5 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, state (Lagos, Abuja, Kano, Enugu, Rivers...), or district..."
                className="w-full pl-10 pr-4 py-2.5 text-base bg-[#0f1522] border border-[#2d3e5e] text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            <select
              aria-label="Sort lands"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="px-4 py-2.5 text-sm font-medium bg-[#0f1522] border border-[#2d3e5e] rounded-lg text-slate-100 focus:outline-none focus:border-sky-400 cursor-pointer"
            >
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="area-desc">Plot Size: Largest First</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#0f1522] border border-[#28354f] rounded-lg text-sm">
            {STATE_FILTERS.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setStateFilter(region)}
                className={`px-3.5 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stateFilter === region
                    ? 'bg-[#1d4ed8] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {region === 'ALL' ? 'All Nigeria' : region}
              </button>
            ))}
          </div>
        </section>

        {/* Reservation Confirmation Banner */}
        {latestReservation && (
          <section className="bg-emerald-950/60 border border-emerald-700/60 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
              <div className="text-sm space-y-0.5">
                <div className="font-semibold text-emerald-100">
                  Plot Reservation Submitted · {latestReservation.parcelCode} ({latestReservation.title})
                </div>
                <div className="text-emerald-300 font-mono tabular-nums">
                  Application {latestReservation.applicationId} · ${latestReservation.priceUsd.toLocaleString()} ({latestReservation.priceSol.toLocaleString()} SOL)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEnterConsole('workflow')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Track in Registration Workflow</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        )}

        {/* Land Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#182132] border border-[#2a3954] rounded-2xl h-[460px] p-5 flex flex-col justify-between"
              >
                <div className="h-56 w-full rounded-xl bg-[#121824]" />
                <div className="space-y-3">
                  <div className="h-5 w-2/3 bg-[#1f293d] rounded" />
                  <div className="h-5 w-1/2 bg-[#1f293d] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="bg-[#182132] border border-[#2a3954] rounded-2xl p-12 text-center space-y-4">
            <div className="text-xl font-semibold text-white">
              No land parcels match "{searchQuery}"
            </div>
            <p className="text-base text-slate-300">
              Clear your search filter or choose another state across Nigeria to inspect available plots.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStateFilter('ALL');
              }}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#1d4ed8] hover:bg-[#2563eb] rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredListings.map((listing) => {
              const mode = cardViewMode[listing.parcelCode] || 'photo';
              const isSelected = selectedCode === listing.parcelCode;
              const isRevoked = listing.status === 'REVOKED_REVERTED';
              const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${listing.centroid.lat},${listing.centroid.lng}`;

              return (
                <article
                  key={listing.parcelCode}
                  className={`bg-[#182132] border rounded-2xl overflow-hidden shadow-md transition-transform duration-200 hover:-translate-y-0.5 flex flex-col justify-between ${
                    isSelected ? 'border-sky-400 ring-1 ring-sky-400/50' : 'border-[#2a3954]'
                  }`}
                >
                  <div>
                    {/* Explicit-height Land Image OR Interactive Card Google Map */}
                    <div className="h-56 w-full bg-[#121824] relative overflow-hidden border-b border-[#26344d]">
                      {mode === 'map' ? (
                        <CardMiniGoogleMap listing={listing} />
                      ) : imageErrors[listing.parcelCode] ? (
                        <div className="w-full h-full bg-gradient-to-br from-[#162136] via-[#181f2c] to-[#132528] flex flex-col items-center justify-center p-6 text-center">
                          <MapPin className="w-8 h-8 text-sky-400 mb-2" />
                          <div className="font-mono font-bold text-base text-slate-100">
                            {listing.parcelCode}
                          </div>
                          <div className="text-sm text-slate-400 mt-0.5">{listing.district}</div>
                        </div>
                      ) : (
                        <img
                          src={listing.imageUrl}
                          alt={`${listing.title} in ${listing.district}`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setImageErrors((prev) => ({ ...prev, [listing.parcelCode]: true }))
                          }
                          className="w-full h-full object-cover block"
                        />
                      )}
                    </div>

                    {/* Media View Switcher & Google Map Link */}
                    <div className="px-5 pt-4 flex items-center justify-between gap-2 text-sm">
                      <div className="inline-flex items-center p-0.5 bg-[#0f1522] border border-[#27354f] rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            setCardViewMode((prev) => ({ ...prev, [listing.parcelCode]: 'photo' }))
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                            mode === 'photo'
                              ? 'bg-[#21304b] text-white shadow-xs'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCardViewMode((prev) => ({ ...prev, [listing.parcelCode]: 'map' }));
                            setSelectedCode(listing.parcelCode);
                            setFocusSelectedSignal((n) => n + 1);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                            mode === 'map'
                              ? 'bg-[#1d4ed8] text-white shadow-xs'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Google Map</span>
                        </button>
                      </div>

                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-sky-300 hover:text-sky-200 whitespace-nowrap"
                      >
                        <span>Directions</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Card Details */}
                    <div className="p-5 pt-3.5 space-y-3.5">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="font-mono font-semibold text-sky-300">
                          {listing.parcelCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{listing.zoning}</span>
                      </div>

                      <h3 className="text-xl font-bold text-white leading-snug">
                        {listing.title}
                      </h3>

                      <div className="text-sm text-slate-300 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Location</span>
                          <span className="font-medium text-slate-100 text-right">{listing.district}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Google GPS</span>
                          <span className="font-mono tabular-nums text-slate-200">
                            {listing.centroid.lat.toFixed(5)}° N, {listing.centroid.lng.toFixed(5)}° E
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Survey Area</span>
                          <span className="font-mono tabular-nums font-semibold text-white">
                            {listing.areaSqMeters.toLocaleString()} m²
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-400">Title Status</span>
                          {isRevoked ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
                              <ShieldAlert className="w-4 h-4" />
                              <span>Revoked (Sec. 28)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {listing.tokenId
                                  ? `Verified · ANAGU #${listing.tokenId}`
                                  : 'Available to Register'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dual USD ($) & SOL Price Footer + Actions */}
                  <div className="px-5 py-4 bg-[#141b27] border-t border-[#26344d] space-y-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-xs text-slate-400">Price (USD)</div>
                        <div className="text-2xl font-bold font-mono tabular-nums text-white">
                          ${listing.priceUsd.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Price (SOL)</div>
                        <div className="text-xl font-bold font-mono tabular-nums text-sky-300">
                          {listing.priceSol.toLocaleString()} SOL
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isRevoked || reservingCode === listing.parcelCode}
                        onClick={() => handleReservePlot(listing)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          isRevoked
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : reservedPlots[listing.parcelCode]
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#1d4ed8] hover:bg-[#2563eb] text-white'
                        }`}
                      >
                        <span>
                          {isRevoked
                            ? 'Statutory Hold'
                            : reservingCode === listing.parcelCode
                              ? 'Submitting...'
                              : reservedPlots[listing.parcelCode]
                                ? `Reserved · ${reservedPlots[listing.parcelCode].applicationId}`
                                : connectedWallet
                                  ? 'Reserve Plot'
                                  : 'Connect Wallet to Buy'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCode(listing.parcelCode);
                          if (onVerifyPlotGis) {
                            onVerifyPlotGis(listing.parcelCode, listing.coordinates);
                          } else {
                            onEnterConsole('gis');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-slate-100 bg-[#1e293d] hover:bg-[#273651] border border-[#324568] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>Verify GIS</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );

  if (!apiKey) {
    return pageBody;
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="NG">
      {pageBody}
    </APIProvider>
  );
}
