import * as turf from '@turf/turf';
import { ethers } from 'ethers';
import {
  ParcelRecord,
  SpatialOutcome,
  SpatialTestSuiteResult,
  SpatialValidationResult,
} from './types.ts';

// Default survey overlap buffer in meters (0.5m per build guide spec)
let defaultToleranceMeters = 0.5;

// Seeded existing registered parcels around Abuja / Cadastral Zone (WGS 84 EPSG:4326)
const initialParcels: ParcelRecord[] = [
  {
    id: 'PAR-101',
    parcelCode: 'ABJ-MAI-101',
    district: 'Maitama Cadastral Zone A05',
    coordinates: [
      [7.4880, 9.0820],
      [7.4892, 9.0820],
      [7.4892, 9.0830],
      [7.4880, 9.0830],
      [7.4880, 9.0820],
    ],
    areaSqMeters: 0,
    spatialHash: '',
    ownerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tokenId: 1,
    status: 'REGISTERED',
    createdAt: '2026-10-12T09:15:00.000Z',
  },
  {
    id: 'PAR-102',
    parcelCode: 'ABJ-MAI-102',
    district: 'Maitama Cadastral Zone A05',
    coordinates: [
      [7.4895, 9.0820],
      [7.4907, 9.0820],
      [7.4907, 9.0830],
      [7.4895, 9.0830],
      [7.4895, 9.0820],
    ],
    areaSqMeters: 0,
    spatialHash: '',
    ownerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    tokenId: 2,
    status: 'REGISTERED',
    createdAt: '2026-10-18T11:40:00.000Z',
  },
  {
    id: 'PAR-204',
    parcelCode: 'ABJ-WUS-204',
    district: 'Wuse II Zone A08',
    coordinates: [
      [7.4880, 9.0834],
      [7.4894, 9.0834],
      [7.4894, 9.0844],
      [7.4880, 9.0844],
      [7.4880, 9.0834],
    ],
    areaSqMeters: 0,
    spatialHash: '',
    ownerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    tokenId: 3,
    status: 'REGISTERED',
    createdAt: '2026-11-01T14:20:00.000Z',
  },
  {
    id: 'PAR-305',
    parcelCode: 'ABJ-GAR-305',
    district: 'Garki II Zone A03',
    coordinates: [
      [7.4910, 9.0822],
      [7.4922, 9.0822],
      [7.4922, 9.0833],
      [7.4910, 9.0833],
      [7.4910, 9.0822],
    ],
    areaSqMeters: 0,
    spatialHash: '',
    ownerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    tokenId: 4,
    status: 'REGISTERED',
    createdAt: '2026-11-05T10:05:00.000Z',
  },
];

function computeSpatialHash(coords: [number, number][]): string {
  const canonical = JSON.stringify(coords.map(([lng, lat]) => [Number(lng.toFixed(7)), Number(lat.toFixed(7))]));
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

function hydrateParcel(p: ParcelRecord): ParcelRecord {
  const poly = turf.polygon([p.coordinates]);
  return {
    ...p,
    areaSqMeters: Math.round(turf.area(poly) * 100) / 100,
    spatialHash: computeSpatialHash(p.coordinates),
  };
}

let parcels: ParcelRecord[] = initialParcels.map(hydrateParcel);

export function getAllParcels(): ParcelRecord[] {
  return parcels;
}

export function getToleranceMeters(): number {
  return defaultToleranceMeters;
}

export function setToleranceMeters(meters: number): number {
  defaultToleranceMeters = Math.max(0, Math.min(25, meters));
  return defaultToleranceMeters;
}

export function registerVerifiedParcel(parcel: Omit<ParcelRecord, 'areaSqMeters' | 'spatialHash'>): ParcelRecord {
  const hydrated = hydrateParcel(parcel as ParcelRecord);
  const idx = parcels.findIndex((p) => p.id === hydrated.id);
  if (idx >= 0) {
    parcels[idx] = hydrated;
  } else {
    parcels.push(hydrated);
  }
  return hydrated;
}

export function markParcelRevoked(parcelId: string): ParcelRecord | null {
  const found = parcels.find((p) => p.id === parcelId);
  if (!found) return null;
  found.status = 'REVOKED_REVERTED';
  return found;
}

export function updateParcelOwner(parcelId: string, ownerAddress: string, tokenId?: number): ParcelRecord | null {
  const found = parcels.find((p) => p.id === parcelId);
  if (!found) return null;
  found.ownerAddress = ownerAddress;
  if (tokenId !== undefined) found.tokenId = tokenId;
  found.status = 'REGISTERED';
  return found;
}

/**
 * Component 1: Exact 7-step GIS-Based Spatial Verification Procedure
 * 1. Receive parcel coordinates
 * 2. Convert coordinates into WGS 84 (EPSG:4326) polygon
 * 3. Validate geometry (ST_IsValid equivalent: closed ring, >=4 vertices, non-self-intersecting, area > 0)
 * 4. Compare polygon against existing registered parcels in spatial DB
 * 5. Detect boundary overlap with explicit tolerance buffer (ST_Intersects(ST_Buffer(geom, tol), existing.geom))
 * 6/7. Approve or reject with specific diagnostic feedback
 */
export function verifyParcelGeometry(
  parcelId: string,
  coordinates: [number, number][],
  toleranceMeters: number = defaultToleranceMeters,
  againstParcels: ParcelRecord[] = parcels
): SpatialValidationResult {
  const t0 = performance.now();
  const postgisQuery = `SELECT existing.id, existing.parcel_code FROM parcels existing WHERE existing.id != '${parcelId}' AND existing.status != 'REVOKED_REVERTED' AND ST_Intersects(ST_Buffer(new_parcel.geom::geography, ${toleranceMeters})::geometry, existing.geom);`;

  // Step 2 & 3: Structural and geometric validity checks (ST_IsValid)
  if (!Array.isArray(coordinates) || coordinates.length < 4) {
    return {
      parcelId,
      outcome: 'INVALID_GEOMETRY',
      isValidGeometry: false,
      hasOverlap: false,
      overlappingParcelIds: [],
      toleranceMeters,
      areaSqMeters: 0,
      spatialHash: ethers.ZeroHash,
      diagnosticMessage: 'ST_IsValid() failed: Polygon linear ring requires at least 4 coordinate pairs.',
      postgisQuery,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  for (const pt of coordinates) {
    if (
      !Array.isArray(pt) ||
      pt.length < 2 ||
      typeof pt[0] !== 'number' ||
      typeof pt[1] !== 'number' ||
      Number.isNaN(pt[0]) ||
      Number.isNaN(pt[1]) ||
      pt[0] < -180 ||
      pt[0] > 180 ||
      pt[1] < -90 ||
      pt[1] > 90
    ) {
      return {
        parcelId,
        outcome: 'INVALID_GEOMETRY',
        isValidGeometry: false,
        hasOverlap: false,
        overlappingParcelIds: [],
        toleranceMeters,
        areaSqMeters: 0,
        spatialHash: ethers.ZeroHash,
        diagnosticMessage: 'ST_IsValid() failed: Coordinates outside valid WGS 84 (EPSG:4326) bounds.',
        postgisQuery,
        executionMs: Number((performance.now() - t0).toFixed(3)),
      };
    }
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
    return {
      parcelId,
      outcome: 'INVALID_GEOMETRY',
      isValidGeometry: false,
      hasOverlap: false,
      overlappingParcelIds: [],
      toleranceMeters,
      areaSqMeters: 0,
      spatialHash: ethers.ZeroHash,
      diagnosticMessage: 'ST_IsValid() failed: Polygon ring is unclosed (first and last vertex must match).',
      postgisQuery,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  let poly: ReturnType<typeof turf.polygon>;
  try {
    poly = turf.polygon([coordinates]);
  } catch (err) {
    return {
      parcelId,
      outcome: 'INVALID_GEOMETRY',
      isValidGeometry: false,
      hasOverlap: false,
      overlappingParcelIds: [],
      toleranceMeters,
      areaSqMeters: 0,
      spatialHash: ethers.ZeroHash,
      diagnosticMessage: `ST_IsValid() failed: Invalid GeoJSON ring (${(err as Error).message}).`,
      postgisQuery,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  const kinks = turf.kinks(poly);
  const area = turf.area(poly);
  if (kinks.features.length > 0) {
    return {
      parcelId,
      outcome: 'INVALID_GEOMETRY',
      isValidGeometry: false,
      hasOverlap: false,
      overlappingParcelIds: [],
      toleranceMeters,
      areaSqMeters: Math.round(area * 100) / 100,
      spatialHash: computeSpatialHash(coordinates),
      diagnosticMessage: `ST_IsValid() failed: Self-intersection detected at ${kinks.features.length} ring crossing(s).`,
      postgisQuery,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  if (area < 1.0) {
    return {
      parcelId,
      outcome: 'INVALID_GEOMETRY',
      isValidGeometry: false,
      hasOverlap: false,
      overlappingParcelIds: [],
      toleranceMeters,
      areaSqMeters: Math.round(area * 100) / 100,
      spatialHash: computeSpatialHash(coordinates),
      diagnosticMessage: `ST_IsValid() failed: Degenerate or sliver polygon area (${area.toFixed(3)} m² < 1.0 m² minimum).`,
      postgisQuery,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  // Step 4 & 5: ST_Buffer(new_parcel.geom, tolerance) & ST_Intersects against active existing parcels
  const bufferedPoly =
    toleranceMeters > 0
      ? turf.buffer(poly, toleranceMeters / 1000, { units: 'kilometers' }) ?? poly
      : poly;

  const overlappingIds: string[] = [];
  for (const existing of againstParcels) {
    if (existing.id === parcelId || existing.status === 'REVOKED_REVERTED') continue;
    const existingPoly = turf.polygon([existing.coordinates]);
    if (turf.booleanIntersects(bufferedPoly, existingPoly)) {
      overlappingIds.push(existing.parcelCode);
    }
  }

  const spatialHash = computeSpatialHash(coordinates);
  const executionMs = Number((performance.now() - t0).toFixed(3));

  if (overlappingIds.length > 0) {
    return {
      parcelId,
      outcome: 'OVERLAPPING_EXISTING_PARCEL',
      isValidGeometry: true,
      hasOverlap: true,
      overlappingParcelIds: overlappingIds,
      toleranceMeters,
      areaSqMeters: Math.round(area * 100) / 100,
      spatialHash,
      diagnosticMessage: `ST_Intersects(ST_Buffer(..., ${toleranceMeters}m)) detected boundary encroachment with: ${overlappingIds.join(', ')}.`,
      postgisQuery,
      executionMs,
    };
  }

  return {
    parcelId,
    outcome: 'VALID_NON_OVERLAPPING',
    isValidGeometry: true,
    hasOverlap: false,
    overlappingParcelIds: [],
    toleranceMeters,
    areaSqMeters: Math.round(area * 100) / 100,
    spatialHash,
    diagnosticMessage: `ST_IsValid() = TRUE and zero intersections within ${toleranceMeters}m survey tolerance buffer.`,
    postgisQuery,
    executionMs,
  };
}

/**
 * Isolated Test Suite for Component 1 (Clean Set & Messy Set)
 */
export function runIsolatedSpatialTestSuites(toleranceMeters: number = defaultToleranceMeters): {
  cleanSuite: SpatialTestSuiteResult;
  messySuite: SpatialTestSuiteResult;
} {
  // Helper to evaluate a suite against seeded parcels
  const evaluateSuite = (
    suiteName: string,
    cases: Array<{ caseId: string; label: string; coordinates: [number, number][]; expected: SpatialOutcome }>
  ): SpatialTestSuiteResult => {
    const counts: Record<SpatialOutcome, number> = {
      VALID_NON_OVERLAPPING: 0,
      INVALID_GEOMETRY: 0,
      OVERLAPPING_EXISTING_PARCEL: 0,
    };

    const evaluated = cases.map((c) => {
      const res = verifyParcelGeometry(c.caseId, c.coordinates, toleranceMeters, parcels);
      counts[res.outcome] += 1;
      return {
        caseId: c.caseId,
        label: c.label,
        expected: c.expected,
        actual: res.outcome,
        passed: res.outcome === c.expected,
        diagnosticMessage: res.diagnosticMessage,
      };
    });

    const total = evaluated.length;
    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

    return {
      suiteName,
      toleranceMeters,
      total,
      rows: [
        { outcome: 'Valid and non-overlapping', frequency: counts.VALID_NON_OVERLAPPING, percentage: pct(counts.VALID_NON_OVERLAPPING) },
        { outcome: 'Invalid geometry', frequency: counts.INVALID_GEOMETRY, percentage: pct(counts.INVALID_GEOMETRY) },
        { outcome: 'Overlapping existing parcel', frequency: counts.OVERLAPPING_EXISTING_PARCEL, percentage: pct(counts.OVERLAPPING_EXISTING_PARCEL) },
      ],
      cases: evaluated,
    };
  };

  // Suite 1: Clean / Controlled Test Set (12 hand-crafted parcels)
  const cleanCases: Array<{ caseId: string; label: string; coordinates: [number, number][]; expected: SpatialOutcome }> = [
    {
      caseId: 'CLN-01',
      label: 'Standard rectangular plot (North sector)',
      coordinates: [[7.4880, 9.0850], [7.4890, 9.0850], [7.4890, 9.0860], [7.4880, 9.0860], [7.4880, 9.0850]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-02',
      label: 'Standard rectangular plot (East sector)',
      coordinates: [[7.4930, 9.0820], [7.4942, 9.0820], [7.4942, 9.0830], [7.4930, 9.0830], [7.4930, 9.0820]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-03',
      label: 'Hexagonal community reserve parcel',
      coordinates: [[7.4928, 9.0842], [7.4934, 9.0840], [7.4940, 9.0844], [7.4938, 9.0850], [7.4931, 9.0851], [7.4926, 9.0847], [7.4928, 9.0842]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-04',
      label: 'South corridor commercial parcel',
      coordinates: [[7.4880, 9.0802], [7.4892, 9.0802], [7.4892, 9.0812], [7.4880, 9.0812], [7.4880, 9.0802]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-05',
      label: 'West agricultural plot',
      coordinates: [[7.4860, 9.0820], [7.4872, 9.0820], [7.4872, 9.0832], [7.4860, 9.0832], [7.4860, 9.0820]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-06',
      label: 'Trapezoidal corner plot',
      coordinates: [[7.4910, 9.0840], [7.4922, 9.0840], [7.4919, 9.0850], [7.4910, 9.0848], [7.4910, 9.0840]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'CLN-07',
      label: 'Self-intersecting bowtie polygon',
      coordinates: [[7.4900, 9.0855], [7.4910, 9.0865], [7.4910, 9.0855], [7.4900, 9.0865], [7.4900, 9.0855]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'CLN-08',
      label: 'Unclosed polygon ring',
      coordinates: [[7.4930, 9.0855], [7.4940, 9.0855], [7.4940, 9.0865], [7.4930, 9.0865]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'CLN-09',
      label: 'Insufficient vertices (triangle missing closure)',
      coordinates: [[7.4930, 9.0855], [7.4940, 9.0855], [7.4935, 9.0865]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'CLN-10',
      label: 'Direct overlap with ABJ-MAI-101',
      coordinates: [[7.4886, 9.0824], [7.4896, 9.0824], [7.4896, 9.0833], [7.4886, 9.0833], [7.4886, 9.0824]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'CLN-11',
      label: 'Direct overlap with ABJ-WUS-204',
      coordinates: [[7.4882, 9.0836], [7.4890, 9.0836], [7.4890, 9.0842], [7.4882, 9.0842], [7.4882, 9.0836]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'CLN-12',
      label: 'Containment overlap inside ABJ-GAR-305',
      coordinates: [[7.4912, 9.0824], [7.4920, 9.0824], [7.4920, 9.0831], [7.4912, 9.0831], [7.4912, 9.0824]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
  ];

  // Suite 2: Messy / Stress Test Set (near-miss boundaries, slivers, slightly rotated overlaps)
  // Note: 0.000009 deg lat ~ 1.0m; 0.000002 deg ~ 0.22m (within 0.5m tolerance)
  const messyCases: Array<{ caseId: string; label: string; coordinates: [number, number][]; expected: SpatialOutcome }> = [
    {
      caseId: 'MSY-01',
      label: 'Near-miss safe gap (3.5m clear of ABJ-MAI-101)',
      coordinates: [[7.4880, 9.0816], [7.4892, 9.0816], [7.4892, 9.08196], [7.4880, 9.08196], [7.4880, 9.0816]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'MSY-02',
      label: 'Concave L-shaped infill around corner',
      coordinates: [[7.4925, 9.0810], [7.4940, 9.0810], [7.4940, 9.0818], [7.4932, 9.0818], [7.4932, 9.0814], [7.4925, 9.0814], [7.4925, 9.0810]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'MSY-03',
      label: 'Valid multi-vertex irregular riverfront boundary',
      coordinates: [[7.4855, 9.0836], [7.4865, 9.0835], [7.4872, 9.0839], [7.4870, 9.0846], [7.4860, 9.0848], [7.4854, 9.0842], [7.4855, 9.0836]],
      expected: 'VALID_NON_OVERLAPPING',
    },
    {
      caseId: 'MSY-04',
      label: 'Collinear zero-width degenerate line polygon',
      coordinates: [[7.4900, 9.0850], [7.4910, 9.0850], [7.4920, 9.0850], [7.4900, 9.0850]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'MSY-05',
      label: 'Micro-sliver polygon (< 1 m² survey artifact)',
      coordinates: [[7.4930, 9.0860], [7.493005, 9.0860], [7.493005, 9.086005], [7.4930, 9.086005], [7.4930, 9.0860]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'MSY-06',
      label: 'Figure-8 double crossing self-intersection',
      coordinates: [[7.4860, 9.0855], [7.4870, 9.0860], [7.4860, 9.0865], [7.4870, 9.0855], [7.4860, 9.0855]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'MSY-07',
      label: 'Pinched vertex touch (self-tangent loop)',
      coordinates: [[7.4945, 9.0840], [7.4955, 9.0840], [7.4950, 9.0845], [7.4955, 9.0850], [7.4945, 9.0850], [7.4950, 9.0845], [7.4945, 9.0840]],
      expected: 'INVALID_GEOMETRY',
    },
    {
      caseId: 'MSY-08',
      label: 'Near-miss boundary encroachment (0.20m gap < 0.5m buffer)',
      coordinates: [[7.4880, 9.0812], [7.4892, 9.0812], [7.4892, 9.081998], [7.4880, 9.081998], [7.4880, 9.0812]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'MSY-09',
      label: 'Slightly rotated 2° corner clip into ABJ-MAI-102',
      coordinates: [[7.4905, 9.0828], [7.4915, 9.0829], [7.4914, 9.0837], [7.4904, 9.0836], [7.4905, 9.0828]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'MSY-10',
      label: 'Boundary sliver overlap (0.3m strip inside ABJ-WUS-204)',
      coordinates: [[7.4880, 9.084397], [7.4894, 9.084397], [7.4894, 9.0852], [7.4880, 9.0852], [7.4880, 9.084397]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'MSY-11',
      label: 'Adjacent shared-edge violation against ABJ-GAR-305',
      coordinates: [[7.4922, 9.0822], [7.4932, 9.0822], [7.4932, 9.0833], [7.4922, 9.0833], [7.4922, 9.0822]],
      expected: 'OVERLAPPING_EXISTING_PARCEL',
    },
    {
      caseId: 'MSY-12',
      label: 'Valid buffer-respecting infill plot (15m east of ABJ-GAR-305)',
      coordinates: [[7.49235, 9.0822], [7.49335, 9.0822], [7.49335, 9.0833], [7.49235, 9.0833], [7.49235, 9.0822]],
      expected: 'VALID_NON_OVERLAPPING',
    },
  ];

  return {
    cleanSuite: evaluateSuite('Clean / Controlled Survey Set', cleanCases),
    messySuite: evaluateSuite('Messy / Adversarial Boundary Set', messyCases),
  };
}
