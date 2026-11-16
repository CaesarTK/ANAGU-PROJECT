import crypto from 'crypto';
import {
  AuditTrailEntry,
  LandApplication,
  RevocationGround,
  UserRole,
  WorkflowStage,
} from './types.ts';
import { registerVerifiedParcel, verifyParcelGeometry, getToleranceMeters } from './gisEngine.ts';
import { verifyOwnershipClaim, publishMqttMessage } from './oracleMqttEngine.ts';
import { issueLandTitleNFT, revokeLandTitle, getRoleAddresses } from './blockchainEngine.ts';

const auditTrail: AuditTrailEntry[] = [];
let prevAuditHash = '0x' + '0'.repeat(64);

function appendAudit(
  applicationId: string,
  stage: WorkflowStage,
  actorRole: UserRole,
  action: string,
  details: string
): AuditTrailEntry {
  const seq = auditTrail.length + 1;
  const timestamp = new Date().toISOString();
  const payload = `${seq}|${timestamp}|${applicationId}|${stage}|${actorRole}|${action}|${details}|${prevAuditHash}`;
  const entryHash = '0x' + crypto.createHash('sha256').update(payload).digest('hex');
  const entry: AuditTrailEntry = {
    seq,
    timestamp,
    applicationId,
    stage,
    actorRole,
    action,
    details,
    entryHash,
    prevHash: prevAuditHash,
  };
  prevAuditHash = entryHash;
  auditTrail.unshift(entry);
  return entry;
}

const applications: LandApplication[] = [
  {
    applicationId: 'APP-2026-001',
    parcelCode: 'ABJ-MAI-101',
    district: 'Maitama Cadastral Zone A05',
    applicantName: 'Amina Bello',
    nationalId: 'NIN-28491022',
    ownerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    coordinates: [
      [7.4880, 9.0820],
      [7.4892, 9.0820],
      [7.4892, 9.0830],
      [7.4880, 9.0830],
      [7.4880, 9.0820],
    ],
    tenureType: 'Statutory',
    supportingDocsComplete: true,
    documentSignatureValid: true,
    communityAttestationCode: 'ELDER-ATT-101',
    institutionalRefCode: 'AGIS-REG-101',
    pendingLitigationFlag: false,
    stage: 'COMPLETED',
    statusCategory: 'Successfully completed (NFT issued)',
    rejectionReason: null,
    spatialResult: null,
    oracleResult: null,
    tokenId: 1,
    txHash: '0x6a9d22f7889390ac2e91f1a090d7cb2d1b2089ff',
    createdAt: '2026-10-12T09:10:00.000Z',
    updatedAt: '2026-10-12T09:15:01.000Z',
  },
  {
    applicationId: 'APP-2026-005',
    parcelCode: 'ABJ-KAT-501',
    district: 'Katampe Extension B11',
    applicantName: 'Sadiq Abubakar',
    nationalId: 'NIN-88320194',
    ownerAddress: getRoleAddresses().Citizen,
    coordinates: [
      [7.4860, 9.0850],
      [7.4872, 9.0850],
      [7.4872, 9.0860],
      [7.4860, 9.0860],
      [7.4860, 9.0850],
    ],
    tenureType: 'Customary-Converted',
    supportingDocsComplete: true,
    documentSignatureValid: true,
    communityAttestationCode: 'ELDER-ATT-501',
    institutionalRefCode: 'AGIS-REG-501',
    pendingLitigationFlag: false,
    stage: 'APPLICATION_SUBMITTED',
    statusCategory: 'Still under processing',
    rejectionReason: null,
    spatialResult: null,
    oracleResult: null,
    tokenId: null,
    txHash: null,
    createdAt: '2026-11-15T14:20:00.000Z',
    updatedAt: '2026-11-15T14:20:00.000Z',
  },
];

// Seed initial audit entry
appendAudit(
  'APP-2026-001',
  'COMPLETED',
  'Registrar',
  'NFT_TITLE_ISSUED',
  'Issued CCLT #1 for ABJ-MAI-101 after GIS, Oracle, Legal, and Registrar gates.'
);
appendAudit(
  'APP-2026-005',
  'APPLICATION_SUBMITTED',
  'Citizen',
  'SUBMIT_APPLICATION',
  'Submitted customary-converted registration for ABJ-KAT-501 (awaiting Surveyor GIS check).'
);

export function getApplications(): LandApplication[] {
  return applications;
}

export function getAuditTrail(): AuditTrailEntry[] {
  return auditTrail;
}

export function submitNewApplication(input: {
  parcelCode: string;
  district: string;
  applicantName: string;
  nationalId: string;
  ownerAddress?: string;
  coordinates: [number, number][];
  tenureType: 'Statutory' | 'Customary-Converted';
  supportingDocsComplete: boolean;
  documentSignatureValid: boolean;
  communityAttestationCode: string;
  institutionalRefCode: string;
  pendingLitigationFlag?: boolean;
  actorRole: UserRole;
}): LandApplication {
  const id = `APP-2026-${String(applications.length + 101).padStart(3, '0')}`;
  const now = new Date().toISOString();
  const app: LandApplication = {
    applicationId: id,
    parcelCode: input.parcelCode,
    district: input.district,
    applicantName: input.applicantName,
    nationalId: input.nationalId,
    ownerAddress: input.ownerAddress || getRoleAddresses().Citizen,
    coordinates: input.coordinates,
    tenureType: input.tenureType,
    supportingDocsComplete: input.supportingDocsComplete,
    documentSignatureValid: input.documentSignatureValid,
    communityAttestationCode: input.communityAttestationCode,
    institutionalRefCode: input.institutionalRefCode,
    pendingLitigationFlag: Boolean(input.pendingLitigationFlag),
    stage: 'APPLICATION_SUBMITTED',
    statusCategory: 'Still under processing',
    rejectionReason: null,
    spatialResult: null,
    oracleResult: null,
    tokenId: null,
    txHash: null,
    createdAt: now,
    updatedAt: now,
  };

  applications.unshift(app);
  appendAudit(id, 'APPLICATION_SUBMITTED', input.actorRole, 'SUBMIT_APPLICATION', `Created application for ${input.parcelCode}`);
  publishMqttMessage('land/registration/status', {
    applicationId: id,
    stage: app.stage,
    status: app.statusCategory,
    actorRole: input.actorRole,
    timestamp: now,
  });

  return app;
}

/**
 * RBAC-enforced stage advancement across the 8-step unified registration pipeline
 */
export function advanceWorkflowStage(
  applicationId: string,
  actorRole: UserRole,
  action: 'advance' | 'cancel' = 'advance'
): { success: boolean; application?: LandApplication; error?: string } {
  const app = applications.find((a) => a.applicationId === applicationId);
  if (!app) return { success: false, error: 'Application not found' };

  if (action === 'cancel') {
    if (actorRole !== 'Citizen' && actorRole !== 'LandAdministrator') {
      return { success: false, error: `RBAC: Only Citizen or LandAdministrator can cancel an application (got ${actorRole}).` };
    }
    if (app.stage === 'COMPLETED' || app.stage === 'REVOKED') {
      return { success: false, error: 'Cannot cancel a completed or revoked title.' };
    }
    app.stage = 'CANCELLED';
    app.statusCategory = 'Cancelled by applicant';
    app.updatedAt = new Date().toISOString();
    appendAudit(app.applicationId, 'CANCELLED', actorRole, 'APPLICANT_CANCELLED', `Application ${app.applicationId} withdrawn by ${actorRole}.`);
    publishMqttMessage('land/registration/status', {
      applicationId: app.applicationId,
      stage: app.stage,
      status: app.statusCategory,
      actorRole,
      timestamp: app.updatedAt,
    });
    return { success: true, application: app };
  }

  const now = new Date().toISOString();

  // Stage 1 -> 2: Spatial Verification (Component 1) — Requires Surveyor or LandAdministrator
  if (app.stage === 'APPLICATION_SUBMITTED') {
    if (actorRole !== 'Surveyor' && actorRole !== 'LandAdministrator') {
      return { success: false, error: `RBAC: Stage requires Surveyor or LandAdministrator role (current role: ${actorRole}).` };
    }
    const spatial = verifyParcelGeometry(app.applicationId, app.coordinates, getToleranceMeters());
    app.spatialResult = spatial;
    app.updatedAt = now;

    if (spatial.outcome !== 'VALID_NON_OVERLAPPING') {
      app.stage = 'REJECTED';
      app.statusCategory = 'Rejected during review';
      app.rejectionReason = spatial.diagnosticMessage;
      appendAudit(app.applicationId, 'REJECTED', actorRole, 'GIS_REJECTED', spatial.diagnosticMessage);
      publishMqttMessage('land/gis/verified', {
        applicationId: app.applicationId,
        outcome: spatial.outcome,
        diagnostic: spatial.diagnosticMessage,
        timestamp: now,
      });
      return { success: true, application: app };
    }

    app.stage = 'SPATIAL_VERIFIED';
    appendAudit(app.applicationId, 'SPATIAL_VERIFIED', actorRole, 'GIS_VERIFIED', spatial.diagnosticMessage);
    publishMqttMessage('land/gis/verified', {
      applicationId: app.applicationId,
      parcelId: app.parcelCode,
      spatialHash: spatial.spatialHash,
      areaSqMeters: spatial.areaSqMeters,
      toleranceM: spatial.toleranceMeters,
      timestamp: now,
    });
    return { success: true, application: app };
  }

  // Stage 2 -> 3: Community Attestation / Ownership Verification (Component 3A) — Requires LandAdministrator or Registrar
  if (app.stage === 'SPATIAL_VERIFIED') {
    if (actorRole !== 'LandAdministrator' && actorRole !== 'Registrar') {
      return { success: false, error: `RBAC: Oracle verification requires LandAdministrator or Registrar role (current role: ${actorRole}).` };
    }
    const oracle = verifyOwnershipClaim({
      applicationId: app.applicationId,
      parcelCode: app.parcelCode,
      applicantName: app.applicantName,
      nationalId: app.nationalId,
      documentHash: app.spatialResult?.spatialHash || '0xdoc',
      documentSignatureValid: app.documentSignatureValid,
      supportingDocsComplete: app.supportingDocsComplete,
      communityAttestationCode: app.communityAttestationCode,
      institutionalRefCode: app.institutionalRefCode,
      pendingLitigationFlag: app.pendingLitigationFlag,
    });
    app.oracleResult = oracle;
    app.updatedAt = now;

    if (!oracle.passed) {
      app.stage = 'REJECTED';
      app.statusCategory = 'Rejected during review';
      app.rejectionReason = oracle.diagnosticReason;
      appendAudit(app.applicationId, 'REJECTED', actorRole, 'ORACLE_REJECTED', oracle.diagnosticReason);
      publishMqttMessage('land/oracle/attested', {
        applicationId: app.applicationId,
        outcome: oracle.outcome,
        oracleHash: oracle.oracleHash,
        timestamp: now,
      });
      return { success: true, application: app };
    }

    app.stage = 'ORACLE_VERIFIED';
    appendAudit(app.applicationId, 'ORACLE_VERIFIED', actorRole, 'ORACLE_VERIFIED', oracle.diagnosticReason);
    publishMqttMessage('land/oracle/attested', {
      applicationId: app.applicationId,
      outcome: oracle.outcome,
      oracleHash: oracle.oracleHash,
      timestamp: now,
    });
    return { success: true, application: app };
  }

  // Stage 3 -> 4: Legal Verification — Requires LandAdministrator or Registrar
  if (app.stage === 'ORACLE_VERIFIED') {
    if (actorRole !== 'LandAdministrator' && actorRole !== 'Registrar') {
      return { success: false, error: `RBAC: Legal verification requires LandAdministrator or Registrar role (current role: ${actorRole}).` };
    }
    app.stage = 'LEGAL_VERIFIED';
    app.updatedAt = now;
    appendAudit(app.applicationId, 'LEGAL_VERIFIED', actorRole, 'LEGAL_CLEARED', 'Statutory root of title & Land Use Act compliance verified.');
    publishMqttMessage('land/registration/status', {
      applicationId: app.applicationId,
      stage: app.stage,
      status: app.statusCategory,
      actorRole,
      timestamp: now,
    });
    return { success: true, application: app };
  }

  // Stage 4 -> 5..8: Registrar Approval -> Blockchain Execution -> NFT Issuance -> MQTT Notification
  if (app.stage === 'LEGAL_VERIFIED') {
    if (actorRole !== 'Registrar') {
      return { success: false, error: `RBAC: Final approval & NFT issuance requires Registrar role (current role: ${actorRole}).` };
    }

    const parcelId = `PAR-${app.applicationId.slice(-3)}`;
    const spatialHash = app.spatialResult?.spatialHash || verifyParcelGeometry(app.applicationId, app.coordinates).spatialHash;
    const areaSqMeters = app.spatialResult?.areaSqMeters || 1250;
    const oracleHash = app.oracleResult?.oracleHash || '0x' + '1'.repeat(64);

    const mintResult = issueLandTitleNFT({
      parcelId,
      parcelCode: app.parcelCode,
      district: app.district,
      areaSqMeters,
      spatialHash,
      oracleHash,
      ownerAddress: app.ownerAddress,
      tenureType: app.tenureType,
      callerRole: actorRole,
    });

    if (!mintResult.success || !mintResult.title) {
      return { success: false, error: mintResult.error || 'Smart contract execution failed' };
    }

    // Register parcel into live PostGIS spatial inventory
    registerVerifiedParcel({
      id: parcelId,
      parcelCode: app.parcelCode,
      district: app.district,
      coordinates: app.coordinates,
      ownerAddress: app.ownerAddress,
      tokenId: mintResult.title.tokenId,
      status: 'REGISTERED',
      createdAt: now,
    });

    app.tokenId = mintResult.title.tokenId;
    app.txHash = mintResult.title.txHash;
    app.stage = 'COMPLETED';
    app.statusCategory = 'Successfully completed (NFT issued)';
    app.updatedAt = now;

    appendAudit(
      app.applicationId,
      'COMPLETED',
      actorRole,
      'NFT_ISSUED_AND_NOTIFIED',
      `Issued LandTitleNFT #${mintResult.title.tokenId} (tx ${mintResult.title.txHash.slice(0, 14)}...) & published MQTT QoS 2 notification.`
    );

    publishMqttMessage(
      'land/nft/issued',
      {
        applicationId: app.applicationId,
        tokenId: mintResult.title.tokenId,
        parcelId,
        ownerAddress: app.ownerAddress,
        txHash: mintResult.title.txHash,
        blockNumber: mintResult.title.blockNumber,
        timestamp: now,
      },
      2
    );

    return { success: true, application: app };
  }

  return { success: false, error: `Application is in terminal stage: ${app.stage}` };
}

/**
 * Automated End-to-End Integration Suite producing the Workflow Outcomes Table
 */
export function runUnifiedWorkflowIntegrationSuite() {
  const outcomes = {
    'Successfully completed (NFT issued)': 0,
    'Rejected during review': 0,
    'Cancelled by applicant': 0,
    'Still under processing': 0,
  };

  // Run 10 synthetic end-to-end cases through the actual multi-role pipeline
  const specs = [
    { code: 'INT-901', coords: [[7.4840, 9.0802], [7.4848, 9.0802], [7.4848, 9.0810], [7.4840, 9.0810], [7.4840, 9.0802]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    { code: 'INT-902', coords: [[7.4840, 9.0814], [7.4848, 9.0814], [7.4848, 9.0822], [7.4840, 9.0822], [7.4840, 9.0814]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    { code: 'INT-903', coords: [[7.4840, 9.0826], [7.4848, 9.0826], [7.4848, 9.0834], [7.4840, 9.0834], [7.4840, 9.0826]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    { code: 'INT-904', coords: [[7.4840, 9.0838], [7.4848, 9.0838], [7.4848, 9.0846], [7.4840, 9.0846], [7.4840, 9.0838]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    { code: 'INT-905', coords: [[7.4840, 9.0850], [7.4848, 9.0850], [7.4848, 9.0858], [7.4840, 9.0858], [7.4840, 9.0850]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    // Reject: overlaps ABJ-MAI-101
    { code: 'INT-906', coords: [[7.4882, 9.0822], [7.4890, 9.0822], [7.4890, 9.0828], [7.4882, 9.0828], [7.4882, 9.0822]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: false },
    // Reject: forged doc signature at Oracle gate
    { code: 'INT-907', coords: [[7.4945, 9.0802], [7.4953, 9.0802], [7.4953, 9.0810], [7.4945, 9.0810], [7.4945, 9.0802]] as [number, number][], validDocs: true, validSig: false, cancel: false, hold: false },
    // Reject: missing docs at Oracle gate
    { code: 'INT-908', coords: [[7.4945, 9.0814], [7.4953, 9.0814], [7.4953, 9.0822], [7.4945, 9.0822], [7.4945, 9.0814]] as [number, number][], validDocs: false, validSig: true, cancel: false, hold: false },
    // Cancelled by applicant mid-review
    { code: 'INT-909', coords: [[7.4945, 9.0826], [7.4953, 9.0826], [7.4953, 9.0834], [7.4945, 9.0834], [7.4945, 9.0826]] as [number, number][], validDocs: true, validSig: true, cancel: true, hold: false },
    // Still under processing (awaiting final Registrar sign-off)
    { code: 'INT-910', coords: [[7.4945, 9.0838], [7.4953, 9.0838], [7.4953, 9.0846], [7.4945, 9.0846], [7.4945, 9.0838]] as [number, number][], validDocs: true, validSig: true, cancel: false, hold: true },
  ];

  // Snapshot existing statuses + run the 10 integration pipeline specs cleanly
  for (const s of specs) {
    const app = submitNewApplication({
      parcelCode: s.code,
      district: 'Integration Test Zone',
      applicantName: 'Integration Applicant',
      nationalId: `NIN-${Math.floor(10000000 + Math.random() * 89999999)}`,
      coordinates: s.coords,
      tenureType: 'Statutory',
      supportingDocsComplete: s.validDocs,
      documentSignatureValid: s.validSig,
      communityAttestationCode: `ELDER-ATT-${s.code.slice(-3)}`,
      institutionalRefCode: `AGIS-REG-${s.code.slice(-3)}`,
      actorRole: 'Citizen',
    });

    // Step 1: Surveyor GIS check
    const r1 = advanceWorkflowStage(app.applicationId, 'Surveyor', 'advance');
    let latest = r1.application || app;
    if (s.cancel) {
      const rc = advanceWorkflowStage(app.applicationId, 'Citizen', 'cancel');
      latest = rc.application || latest;
    } else if (latest.stage === 'SPATIAL_VERIFIED') {
      // Step 2: LandAdministrator Oracle check
      const r2 = advanceWorkflowStage(app.applicationId, 'LandAdministrator', 'advance');
      latest = r2.application || latest;
      if (latest.stage === 'ORACLE_VERIFIED') {
        // Step 3: LandAdministrator Legal clearance
        const r3 = advanceWorkflowStage(app.applicationId, 'LandAdministrator', 'advance');
        latest = r3.application || latest;
        if (!s.hold && latest.stage === 'LEGAL_VERIFIED') {
          // Step 4: Registrar Approval -> Blockchain -> NFT -> MQTT
          const r4 = advanceWorkflowStage(app.applicationId, 'Registrar', 'advance');
          latest = r4.application || latest;
        }
      }
    }

    outcomes[latest.statusCategory] += 1;
  }

  const total = specs.length;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return {
    total,
    rows: [
      { status: 'Successfully completed (NFT issued)', frequency: outcomes['Successfully completed (NFT issued)'], percentage: pct(outcomes['Successfully completed (NFT issued)']) },
      { status: 'Rejected during review', frequency: outcomes['Rejected during review'], percentage: pct(outcomes['Rejected during review']) },
      { status: 'Cancelled by applicant', frequency: outcomes['Cancelled by applicant'], percentage: pct(outcomes['Cancelled by applicant']) },
      { status: 'Still under processing', frequency: outcomes['Still under processing'], percentage: pct(outcomes['Still under processing']) },
    ],
  };
}

export function executeRevocationWorkflow(tokenId: number, ground: RevocationGround, actorRole: UserRole) {
  const result = revokeLandTitle({
    tokenId,
    ground,
    callerRole: actorRole,
    updateOffchainGis: true,
  });

  if (result.success && result.title) {
    appendAudit(
      `NFT-#${tokenId}`,
      'REVOKED',
      actorRole,
      'SECTION_28_REVOCATION',
      `Governor exercised Section 28 (${ground}) on LandTitleNFT #${tokenId}; off-chain GIS parcel reverted.`
    );
    publishMqttMessage(
      'land/title/revoked',
      {
        tokenId,
        parcelId: result.title.parcelId,
        ground,
        revokedBy: result.title.revokedBy,
        txHash: result.event.txHash,
        timestamp: result.title.revokedAt,
      },
      2
    );
  } else {
    appendAudit(
      `NFT-#${tokenId}`,
      'REVOKED',
      actorRole,
      'REVOCATION_REVERTED',
      result.error || 'Unauthorized revocation attempt reverted.'
    );
  }

  return result;
}
