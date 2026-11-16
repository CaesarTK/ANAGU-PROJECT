export type UserRole =
  | 'Citizen'
  | 'Surveyor'
  | 'Registrar'
  | 'LandAdministrator'
  | 'Governor';

export type NavSection =
  | 'overview'
  | 'gis'
  | 'blockchain'
  | 'oracle-mqtt'
  | 'workflow'
  | 'evaluation';

export interface ParcelRecord {
  id: string;
  parcelCode: string;
  district: string;
  coordinates: [number, number][];
  areaSqMeters: number;
  spatialHash: string;
  ownerAddress: string | null;
  tokenId: number | null;
  status: 'REGISTERED' | 'PENDING' | 'REVOKED_REVERTED';
  createdAt: string;
}

export interface SpatialValidationResult {
  parcelId: string;
  outcome: 'VALID_NON_OVERLAPPING' | 'INVALID_GEOMETRY' | 'OVERLAPPING_EXISTING_PARCEL';
  isValidGeometry: boolean;
  hasOverlap: boolean;
  overlappingParcelIds: string[];
  toleranceMeters: number;
  areaSqMeters: number;
  spatialHash: string;
  diagnosticMessage: string;
  postgisQuery: string;
  executionMs: number;
}

export interface SpatialTestSuiteResult {
  suiteName: string;
  toleranceMeters: number;
  total: number;
  rows: Array<{ outcome: string; frequency: number; percentage: string }>;
  cases: Array<{
    caseId: string;
    label: string;
    expected: string;
    actual: string;
    passed: boolean;
    diagnosticMessage: string;
  }>;
}

export interface LandTitleNFT {
  tokenId: number;
  parcelId: string;
  parcelIdHash: string;
  spatialHash: string;
  oracleHash: string;
  ownerAddress: string;
  txHash: string;
  blockNumber: number;
  issuedAt: string;
  isRevoked: boolean;
  revocationGround: 'OverridingPublicInterest' | 'BreachOfStatutoryCondition' | null;
  revokedBy: string | null;
  revokedAt: string | null;
  metadata: {
    parcelCode: string;
    district: string;
    areaSqMeters: number;
    tenureType: 'Statutory' | 'Customary-Converted';
  };
}

export interface BlockchainBlock {
  blockNumber: number;
  timestamp: string;
  validator: string;
  validatorWeight: number;
  consensus: string;
  txCount: number;
  blockHash: string;
}

export interface BlockchainEventRecord {
  id: string;
  eventType: string;
  tokenId: number;
  actorRole: string;
  actorAddress: string;
  txHash: string;
  blockNumber: number;
  gasUsed: number;
  confirmationMs: number;
  timestamp: string;
  details: string;
}

export interface BlockchainIsolatedTestResult {
  lifecycleTable: Array<{ event: string; frequency: number }>;
  revocationTable: Array<{ test: string; result: string; notes: string }>;
  tContractMs: number;
  revokeGasCost: number;
}

export interface MqttMessageRecord {
  id: string;
  topic: string;
  qos: 0 | 1 | 2;
  payload: Record<string, unknown>;
  payloadBytes: number;
  timestamp: string;
  delivered: boolean;
  latencyMs: number;
  source: 'live' | 'offline-sync' | 'network-test';
}

export interface LandApplication {
  applicationId: string;
  parcelCode: string;
  district: string;
  applicantName: string;
  nationalId: string;
  ownerAddress: string;
  coordinates: [number, number][];
  tenureType: 'Statutory' | 'Customary-Converted';
  supportingDocsComplete: boolean;
  documentSignatureValid: boolean;
  communityAttestationCode: string;
  institutionalRefCode: string;
  pendingLitigationFlag: boolean;
  stage: string;
  statusCategory: string;
  rejectionReason: string | null;
  tokenId: number | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTrailEntry {
  seq: number;
  timestamp: string;
  applicationId: string;
  stage: string;
  actorRole: UserRole;
  action: string;
  details: string;
  entryHash: string;
  prevHash: string;
}

export interface EvaluationReport {
  trialsPerScenario: number;
  latencyRuns: number;
  fraudTable: Array<{
    scenario: string;
    targetLayer: string;
    trials: number;
    proposedDetected: number;
    proposedRate: string;
    baselineDetected: number;
    baselineRate: string;
  }>;
  latencyTable: Array<{
    stage: string;
    proposed: string;
    baseline: string;
  }>;
  latencyReductionPct: string;
  storage: {
    fields: Array<{ symbol: string; label: string; bits: number }>;
    totalBits: number;
    proposedPerRecordBytes: number;
    baselinePerRecordBytes: number;
    parcelCount: number;
    proposedNetworkBytes: number;
    baselineNetworkBytes: number;
    reductionPct: string;
  };
}
