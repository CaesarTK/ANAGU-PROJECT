/// <reference types="google.maps" />
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  APIProviderContext,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Polygon,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Crosshair, Layers, Radio } from 'lucide-react';
import { LandTitleNFT, MqttMessageRecord, ParcelRecord } from '../types';

export interface CandidateProbeOverlay {
  parcelId: string;
  coordinates: [number, number][];
  outcome?: 'VALID_NON_OVERLAPPING' | 'INVALID_GEOMETRY' | 'OVERLAPPING_EXISTING_PARCEL' | null;
}

interface LiveAbujaCadastralMapProps {
  parcels: ParcelRecord[];
  titles?: LandTitleNFT[];
  selectedParcelCode?: string | null;
  onSelectParcel?: (parcelCode: string) => void;
  candidateProbe?: CandidateProbeOverlay | null;
  liveFeedEvent?: MqttMessageRecord | null;
  heightClass?: string;
  defaultMapType?: 'hybrid' | 'roadmap' | 'satellite';
  focusSelectedSignal?: number;
  fitTrigger?: string | number;
}

const ABUJA_DEFAULT_CENTER = { lat: 9.0831, lng: 7.4901 };

function computeCentroid(coords: [number, number][]): google.maps.LatLngLiteral {
  if (!coords || coords.length === 0) return ABUJA_DEFAULT_CENTER;
  const openRing =
    coords.length > 1 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords.slice(0, -1)
      : coords;
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of openRing) {
    latSum += lat;
    lngSum += lng;
  }
  return {
    lat: latSum / openRing.length,
    lng: lngSum / openRing.length,
  };
}

function toLatLngPath(coords: [number, number][]): google.maps.LatLngLiteral[] {
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

interface ParcelMarkerWithInfoProps {
  parcel: ParcelRecord;
  titleRecord: LandTitleNFT | null;
  isSelected: boolean;
  isInfoOpen: boolean;
  onSelect: () => void;
  onCloseInfo: () => void;
}

function ParcelMarkerWithInfo({
  parcel,
  titleRecord,
  isSelected,
  isInfoOpen,
  onSelect,
  onCloseInfo,
}: ParcelMarkerWithInfoProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const isRevoked = parcel.status === 'REVOKED_REVERTED' || Boolean(titleRecord?.isRevoked);
  const position = useMemo(() => computeCentroid(parcel.coordinates), [parcel.coordinates]);

  const badgeTone = isRevoked
    ? 'bg-rose-600 border-rose-800 text-white'
    : isSelected
      ? 'bg-sky-600 border-sky-900 text-white ring-2 ring-white/90'
      : 'bg-emerald-600 border-emerald-900 text-white';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        zIndex={isSelected ? 1000 : isRevoked ? 500 : 100}
        title={`${parcel.parcelCode} (${parcel.district})`}
        onClick={onSelect}
      >
        <div
          className={`px-2.5 py-1 rounded border text-xs font-mono font-semibold shadow-md whitespace-nowrap cursor-pointer transition-transform ${
            isSelected ? 'scale-105' : 'hover:scale-105'
          } ${badgeTone}`}
        >
          {parcel.parcelCode}
        </div>
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfo} maxWidth={260}>
          <div className="p-1 text-slate-900 space-y-1.5 text-xs min-w-[190px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
              <span className="font-mono font-bold text-slate-900">{parcel.parcelCode}</span>
              <span
                className={`font-semibold ${
                  isRevoked ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {isRevoked ? 'Revoked (Sec. 28)' : 'Verified Active'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <span className="text-slate-500">District</span>
              <span className="font-medium text-right">{parcel.district}</span>
              <span className="text-slate-500">Area</span>
              <span className="font-mono tabular-nums font-semibold text-right">
                {parcel.areaSqMeters.toLocaleString()} m²
              </span>
              <span className="text-slate-500">Token ID</span>
              <span className="font-mono font-semibold text-sky-700 text-right">
                {titleRecord ? `ANAGU #${titleRecord.tokenId}` : parcel.tokenId ? `#${parcel.tokenId}` : 'Pending'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 truncate pt-0.5 border-t border-slate-100">
              {titleRecord?.ownerAddress || parcel.ownerAddress || 'Governor Statutory Reserve'}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface InnerMapSceneProps {
  parcels: ParcelRecord[];
  titles: LandTitleNFT[];
  selectedParcelCode: string | null;
  onSelectParcel?: (parcelCode: string) => void;
  candidateProbe?: CandidateProbeOverlay | null;
  mapTypeId: 'hybrid' | 'roadmap' | 'satellite';
  recenterSignal: number;
  focusSelectedSignal?: number;
  fitTrigger?: string | number;
}

function InnerMapScene({
  parcels,
  titles,
  selectedParcelCode,
  onSelectParcel,
  candidateProbe,
  mapTypeId,
  recenterSignal,
  focusSelectedSignal = 0,
  fitTrigger,
}: InnerMapSceneProps) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const apiStatus = useApiLoadingStatus();
  const [infoOpenCode, setInfoOpenCode] = useState<string | null>(null);

  const fitRegistryBounds = useCallback(() => {
    if (!map || !coreLib) return;
    const bounds = new coreLib.LatLngBounds();
    let hasPoint = false;

    for (const p of parcels) {
      for (const [lng, lat] of p.coordinates) {
        bounds.extend({ lat, lng });
        hasPoint = true;
      }
    }
    if (candidateProbe && candidateProbe.coordinates.length > 0) {
      for (const [lng, lat] of candidateProbe.coordinates) {
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          bounds.extend({ lat, lng });
          hasPoint = true;
        }
      }
    }

    if (hasPoint) {
      map.fitBounds(bounds, 36);
    } else {
      map.setCenter(ABUJA_DEFAULT_CENTER);
      map.setZoom(16);
    }
  }, [map, coreLib, parcels, candidateProbe]);

  useEffect(() => {
    if (map && coreLib && parcels.length > 0) {
      fitRegistryBounds();
    }
  }, [map, coreLib, parcels.length, recenterSignal, fitTrigger, fitRegistryBounds]);

  // Zoom smoothly to the focused parcel when requested
  useEffect(() => {
    if (!map || !coreLib || !focusSelectedSignal || !selectedParcelCode) return;
    const target = parcels.find((p) => p.parcelCode === selectedParcelCode);
    if (!target || target.coordinates.length === 0) return;
    const bounds = new coreLib.LatLngBounds();
    for (const [lng, lat] of target.coordinates) {
      bounds.extend({ lat, lng });
    }
    map.fitBounds(bounds, 72);
    setInfoOpenCode(target.parcelCode);
  }, [map, coreLib, focusSelectedSignal, selectedParcelCode, parcels]);

  // Smoothly pan to candidate probe when coordinates change
  useEffect(() => {
    if (!map || !coreLib || !candidateProbe || candidateProbe.coordinates.length < 3) return;
    const bounds = new coreLib.LatLngBounds();
    for (const p of parcels) {
      for (const [lng, lat] of p.coordinates) {
        bounds.extend({ lat, lng });
      }
    }
    for (const [lng, lat] of candidateProbe.coordinates) {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        bounds.extend({ lat, lng });
      }
    }
    map.fitBounds(bounds, 36);
  }, [map, coreLib, candidateProbe, parcels]);

  if (apiStatus === APILoadingStatus.FAILED || apiStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#141a24] text-slate-300 p-6 text-center">
        <div className="text-sm font-semibold text-slate-100">
          Live Map Tiles Unavailable
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Unable to authenticate or load Google Maps Platform tiles. Parcel metadata and spatial
          verification remain operational via PostGIS endpoints.
        </p>
      </div>
    );
  }

  const probeStroke =
    candidateProbe?.outcome === 'VALID_NON_OVERLAPPING'
      ? '#059669'
      : candidateProbe?.outcome
        ? '#dc2626'
        : '#0284c7';

  const probeFill =
    candidateProbe?.outcome === 'VALID_NON_OVERLAPPING'
      ? '#10b981'
      : candidateProbe?.outcome
        ? '#ef4444'
        : '#0284c7';

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      defaultCenter={ABUJA_DEFAULT_CENTER}
      defaultZoom={16}
      mapTypeId={mapTypeId}
      gestureHandling="greedy"
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={true}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      style={{ width: '100%', height: '100%' }}
    >
      {parcels.map((parcel) => {
        const titleRecord =
          titles.find((t) => t.metadata.parcelCode === parcel.parcelCode || t.parcelId === parcel.id) ||
          null;
        const isSelected = parcel.parcelCode === selectedParcelCode;
        const isRevoked =
          parcel.status === 'REVOKED_REVERTED' || Boolean(titleRecord?.isRevoked);

        const strokeColor = isRevoked ? '#e11d48' : isSelected ? '#0284c7' : '#059669';
        const fillColor = isRevoked ? '#e11d48' : isSelected ? '#0284c7' : '#10b981';

        return (
          <Polygon
            key={`poly-${parcel.id}-${parcel.status}-${isSelected}`}
            paths={toLatLngPath(parcel.coordinates)}
            strokeColor={strokeColor}
            strokeOpacity={0.95}
            strokeWeight={isSelected ? 3 : 2}
            fillColor={fillColor}
            fillOpacity={isSelected ? 0.34 : 0.22}
            onClick={() => {
              onSelectParcel?.(parcel.parcelCode);
              setInfoOpenCode(parcel.parcelCode);
            }}
          />
        );
      })}

      {parcels.map((parcel) => {
        const titleRecord =
          titles.find((t) => t.metadata.parcelCode === parcel.parcelCode || t.parcelId === parcel.id) ||
          null;
        const isSelected = parcel.parcelCode === selectedParcelCode;
        return (
          <ParcelMarkerWithInfo
            key={`marker-${parcel.id}`}
            parcel={parcel}
            titleRecord={titleRecord}
            isSelected={isSelected}
            isInfoOpen={infoOpenCode === parcel.parcelCode}
            onSelect={() => {
              onSelectParcel?.(parcel.parcelCode);
              setInfoOpenCode(parcel.parcelCode);
            }}
            onCloseInfo={() => setInfoOpenCode(null)}
          />
        );
      })}

      {candidateProbe && candidateProbe.coordinates.length >= 3 && (
        <>
          <Polygon
            key={`probe-${candidateProbe.parcelId}-${candidateProbe.outcome || 'pending'}`}
            paths={toLatLngPath(candidateProbe.coordinates)}
            strokeColor={probeStroke}
            strokeOpacity={1}
            strokeWeight={3}
            fillColor={probeFill}
            fillOpacity={0.28}
          />
          {candidateProbe.coordinates.slice(0, -1).map(([lng, lat], idx) =>
            Number.isFinite(lat) && Number.isFinite(lng) ? (
              <AdvancedMarker
                key={`probe-v-${idx}`}
                position={{ lat, lng }}
                zIndex={900}
                title={`Beacon ${idx + 1} (${lat.toFixed(5)}, ${lng.toFixed(5)})`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full bg-white border-2 shadow"
                  style={{ borderColor: probeStroke }}
                />
              </AdvancedMarker>
            ) : null
          )}
        </>
      )}
    </GoogleMap>
  );
}

export function LiveAbujaCadastralMap({
  parcels,
  titles = [],
  selectedParcelCode = null,
  onSelectParcel,
  candidateProbe = null,
  liveFeedEvent = null,
  heightClass = 'h-[310px]',
  defaultMapType = 'hybrid',
  focusSelectedSignal = 0,
  fitTrigger,
}: LiveAbujaCadastralMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const parentProvider = useContext(APIProviderContext);
  const [mapTypeId, setMapTypeId] = useState<'hybrid' | 'roadmap' | 'satellite'>(defaultMapType);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const scene = (
    <InnerMapScene
      parcels={parcels}
      titles={titles}
      selectedParcelCode={selectedParcelCode}
      onSelectParcel={onSelectParcel}
      candidateProbe={candidateProbe}
      mapTypeId={mapTypeId}
      recenterSignal={recenterSignal}
      focusSelectedSignal={focusSelectedSignal}
      fitTrigger={fitTrigger}
    />
  );

  return (
    <div className="space-y-3">
      {/* Compact Live Toolbar & Feed Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 text-slate-300 min-w-0">
          <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-100 shrink-0">Nigeria Live Cadastral Feed</span>
          {liveFeedEvent && (
            <span className="hidden sm:inline font-mono text-xs text-sky-300 truncate">
              · {liveFeedEvent.topic}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-[#2c3b57] bg-[#0f1522] p-0.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
            {(['hybrid', 'satellite', 'roadmap'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMapTypeId(mode)}
                className={`px-2.5 py-1 rounded capitalize cursor-pointer transition-colors ${
                  mapTypeId === mode
                    ? 'bg-[#1d4ed8] text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRecenterSignal((n) => n + 1)}
            title="Fit cadastral parcels"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2c3b57] bg-[#1b2435] hover:bg-[#233047] text-xs font-medium text-slate-200 cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-300" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Explicit-height Map Container (CF2 compliance) */}
      <div
        className={`w-full ${heightClass} border border-[#2b3a55] rounded-xl overflow-hidden bg-[#121823] relative`}
      >
        {!apiKey ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300">
            <div className="text-sm font-semibold text-slate-100">
              Google Maps API Key Not Configured
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Set <span className="font-mono text-sky-300">VITE_GOOGLE_MAPS_API_KEY</span> in your environment to
              stream live satellite and cadastral map tiles.
            </p>
          </div>
        ) : parentProvider ? (
          scene
        ) : (
          <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="NG">
            {scene}
          </APIProvider>
        )}
      </div>
    </div>
  );
}
