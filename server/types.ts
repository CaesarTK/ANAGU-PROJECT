export type UserRole =
  | 'Citizen'
  | 'Surveyor'
  | 'Registrar'
  | 'LandAdministrator'
  | 'Governor';

export type SpatialOutcome =
  | 'VALID_NON_OVERLAPPING'
  | 'INVALID_GEOMETRY'
  | 'OVERLAPPING_EXISTING_PARCEL';

export interface ParcelRecord {
  id: string;
  parcelCode: string;
  district: string;
  coordinates: [number, number][]; // [lng, lat] closed WGS 84 ring
  areaSqMeters: number;
  spatialHash: string;
  ownerAddress: string | null;
  tokenId: number | null;
  status: 'REGISTERED' | 'PENDING' | 'REVOKED_REVERTED';
  createdAt: string;
}

export interface SpatialValidationResult {
  parcelId: string;
  outcome: SpatialOutcome;
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

export interface SpatialTestRow {
  outcome: string;
  frequency: number;
  percentage: string;
}

export interface SpatialTestSuiteResult {
  suiteName: string;
  toleranceMeters: number;
  total: number;
  rows: SpatialTestRow[];
  cases: Array<{
    caseId: string;
    label: string;
    expected: SpatialOutcome;
    actual: SpatialOutcome;
    passed: boolean;
    diagnosticMessage: string;
  }>;
}

export type RevocationGround =
  | 'OverridingPublicInterest'
  | 'BreachOfStatutoryCondition';

export interface BlockchainBlock {
  blockNumber: number;
  timestamp: string;
  validator: string;
  validatorWeight: number;
  consensus: 'PoA-QBFT-DPoS';
  txCount: number;
  blockHash: string;
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
  revocationGround: RevocationGround | null;
  revokedBy: string | null;
  revokedAt: string | null;
  metadata: {
    parcelCode: string;
    district: string;
    areaSqMeters: number;
    tenureType: 'Statutory' | 'Customary-Converted';
  };
}

export interface BlockchainEventRecord {
  id: string;
  eventType:
    | 'TitleIssued'
    | 'RegistryTransferCompleted'
    | 'OwnerTransferRejected'
    | 'TitleRevoked'
    | 'UnauthorizedRevokeReverted';
  tokenId: number;
  actorRole: UserRole | 'JudicialDispute' | 'UnauthorizedAccount';
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

export type OracleOutcome =
  | 'Successfully verified'
  | 'Incomplete supporting documents'
  | 'Ownership information conflict'
  | 'Legal verification pending';

export interface OwnershipClaimInput {
  applicationId: string;
  parcelCode: string;
  applicantName: string;
  nationalId: string;
  documentHash: string;
  documentSignatureValid: boolean;
  supportingDocsComplete: boolean;
  communityAttestationCode: string;
  communityInformantColluding?: boolean;
  institutionalRefCode: string;
  pendingLitigationFlag?: boolean;
}

export interface OracleVerificationResult {
  applicationId: string;
  outcome: OracleOutcome;
  passed: boolean;
  oracleHash: string;
  matchedInstitutionalRecord: boolean;
  matchedCommunityRecord: boolean;
  documentIntegrityVerified: boolean;
  encumbranceClear: boolean;
  diagnosticReason: string;
  executionMs: number;
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

export interface MqttNetworkTestRow {
  condition: string;
  messagesSent: number;
  successfullyDelivered: number;
  deliveryRate: string;
  avgLatencyMs: number;
}

export type WorkflowStage =
  | 'APPLICATION_SUBMITTED'
  | 'SPATIAL_VERIFIED'
  | 'ORACLE_VERIFIED'
  | 'LEGAL_VERIFIED'
  | 'REGISTRAR_APPROVED'
  | 'BLOCKCHAIN_RECORDED'
  | 'NFT_ISSUED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVOKED';

export interface AuditTrailEntry {
  seq: number;
  timestamp: string;
  applicationId: string;
  stage: WorkflowStage;
  actorRole: UserRole;
  action: string;
  details: string;
  entryHash: string;
  prevHash: string;
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
  stage: WorkflowStage;
  statusCategory:
    | 'Successfully completed (NFT issued)'
    | 'Rejected during review'
    | 'Cancelled by applicant'
    | 'Still under processing';
  rejectionReason: string | null;
  spatialResult: SpatialValidationResult | null;
  oracleResult: OracleVerificationResult | null;
  tokenId: number | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
}
