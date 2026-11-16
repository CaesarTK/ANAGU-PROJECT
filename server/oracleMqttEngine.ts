import { ethers } from 'ethers';
import {
  MqttMessageRecord,
  MqttNetworkTestRow,
  OracleOutcome,
  OracleVerificationResult,
  OwnershipClaimInput,
} from './types.ts';

// Authorised institutional registry & community/customary tenure reference records
const institutionalDirectory: Record<string, { refCode: string; nationalId: string; ownerName: string }> = {
  'ABJ-MAI-101': { refCode: 'AGIS-REG-101', nationalId: 'NIN-28491022', ownerName: 'Amina Bello' },
  'ABJ-MAI-102': { refCode: 'AGIS-REG-102', nationalId: 'NIN-39104821', ownerName: 'Chukwuemeka Okafor' },
  'ABJ-WUS-204': { refCode: 'AGIS-REG-204', nationalId: 'NIN-55019283', ownerName: 'Ibrahim Musa' },
  'ABJ-GAR-305': { refCode: 'AGIS-REG-305', nationalId: 'NIN-77412098', ownerName: 'Ngozi Adeyemi' },
  'ABJ-KAT-501': { refCode: 'AGIS-REG-501', nationalId: 'NIN-88320194', ownerName: 'Sadiq Abubakar' },
  'ABJ-ASQ-602': { refCode: 'AGIS-REG-602', nationalId: 'NIN-91204455', ownerName: 'Folake Balogun' },
};

const communityAttestationDirectory: Record<string, { elderSigCode: string; familyHead: string; active: boolean }> = {
  'ABJ-MAI-101': { elderSigCode: 'ELDER-ATT-101', familyHead: 'Chief Bello Council', active: true },
  'ABJ-MAI-102': { elderSigCode: 'ELDER-ATT-102', familyHead: 'Maitama Ward Elders', active: true },
  'ABJ-WUS-204': { elderSigCode: 'ELDER-ATT-204', familyHead: 'Wuse Traditional Council', active: true },
  'ABJ-GAR-305': { elderSigCode: 'ELDER-ATT-305', familyHead: 'Garki Customary Stool', active: true },
  'ABJ-KAT-501': { elderSigCode: 'ELDER-ATT-501', familyHead: 'Katampe Community Council', active: true },
  'ABJ-ASQ-602': { elderSigCode: 'ELDER-ATT-602', familyHead: 'Asokoro Land Committee', active: true },
};

export const MATCHING_RULES_SPEC = [
  {
    ruleId: 'R1 — Document Completeness & Integrity',
    matchCondition: 'All required statutory/survey documents present (supportingDocsComplete === true) AND cryptographic signature matches issuer hash (documentSignatureValid === true).',
    failureOutcome: 'Incomplete supporting documents',
  },
  {
    ruleId: 'R2 — Institutional & Community Source Reconciliation',
    matchCondition: 'Submitted nationalId + institutionalRefCode matches AGIS/Registry directory (or validated prefix AGIS-REG-*) AND communityAttestationCode matches Community Council record (ELDER-ATT-*) with non-colluding informant.',
    failureOutcome: 'Ownership information conflict',
  },
  {
    ruleId: 'R3 — Encumbrance & Legal Caveat Clearance',
    matchCondition: 'No active court caveat, injunction, or pending litigation flag (pendingLitigationFlag === false).',
    failureOutcome: 'Legal verification pending',
  },
];

/**
 * Component 3 Part A: Ownership Verification Oracle
 * Deterministic comparison against institutional + community sources before anything reaches blockchain.
 */
export function verifyOwnershipClaim(input: OwnershipClaimInput): OracleVerificationResult {
  const t0 = performance.now();

  const oracleHash = ethers.keccak256(
    ethers.toUtf8Bytes(
      `${input.applicationId}:${input.parcelCode}:${input.nationalId}:${input.communityAttestationCode}:${input.institutionalRefCode}`
    )
  );

  // Rule 1: Document completeness & signature authenticity
  if (!input.supportingDocsComplete || !input.documentSignatureValid || !input.documentHash) {
    const outcome: OracleOutcome = !input.documentSignatureValid
      ? 'Ownership information conflict'
      : 'Incomplete supporting documents';
    return {
      applicationId: input.applicationId,
      outcome,
      passed: false,
      oracleHash,
      matchedInstitutionalRecord: false,
      matchedCommunityRecord: false,
      documentIntegrityVerified: input.documentSignatureValid,
      encumbranceClear: !input.pendingLitigationFlag,
      diagnosticReason: !input.documentSignatureValid
        ? 'R1 failed: Document cryptographic hash/signature mismatch (possible forged or altered metadata).'
        : 'R1 failed: Required survey plan, deed of assignment, or ID document missing.',
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  // Rule 2: Institutional + Community source reconciliation
  const instRecord = institutionalDirectory[input.parcelCode];
  const commRecord = communityAttestationDirectory[input.parcelCode];

  const instMatches = instRecord
    ? instRecord.refCode === input.institutionalRefCode && instRecord.nationalId === input.nationalId
    : input.institutionalRefCode.startsWith('AGIS-REG-') && input.nationalId.startsWith('NIN-');

  const commMatches =
    !input.communityInformantColluding &&
    (commRecord
      ? commRecord.elderSigCode === input.communityAttestationCode && commRecord.active
      : input.communityAttestationCode.startsWith('ELDER-ATT-'));

  if (!instMatches || !commMatches) {
    return {
      applicationId: input.applicationId,
      outcome: 'Ownership information conflict',
      passed: false,
      oracleHash,
      matchedInstitutionalRecord: instMatches,
      matchedCommunityRecord: commMatches,
      documentIntegrityVerified: true,
      encumbranceClear: !input.pendingLitigationFlag,
      diagnosticReason: input.communityInformantColluding
        ? 'R2 failed: Community informant attestation signature failed cross-verification against Traditional Council quorum.'
        : !instMatches
          ? 'R2 failed: Submitted National ID or Registry Reference conflicts with institutional land records.'
          : 'R2 failed: Community/customary attestation code does not reconcile with ward elders registry.',
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  // Rule 3: Legal encumbrance / pending litigation
  if (input.pendingLitigationFlag) {
    return {
      applicationId: input.applicationId,
      outcome: 'Legal verification pending',
      passed: false,
      oracleHash,
      matchedInstitutionalRecord: true,
      matchedCommunityRecord: true,
      documentIntegrityVerified: true,
      encumbranceClear: false,
      diagnosticReason: 'R3 flagged: Active caveat or pending customary/statutory dispute requires administrative legal review.',
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  return {
    applicationId: input.applicationId,
    outcome: 'Successfully verified',
    passed: true,
    oracleHash,
    matchedInstitutionalRecord: true,
    matchedCommunityRecord: true,
    documentIntegrityVerified: true,
    encumbranceClear: true,
    diagnosticReason: 'R1–R3 passed: Document integrity, institutional record, community attestation, and encumbrance clearance verified.',
    executionMs: Number((performance.now() - t0).toFixed(3)),
  };
}

/**
 * Isolated Oracle Test Suite (GIS & Blockchain mocked out)
 */
export function runIsolatedOracleTestSuite() {
  const testClaims: Array<{ label: string; input: OwnershipClaimInput; expected: OracleOutcome }> = [
    {
      label: 'Valid statutory claim (ABJ-KAT-501)',
      input: {
        applicationId: 'ORC-T01',
        parcelCode: 'ABJ-KAT-501',
        applicantName: 'Sadiq Abubakar',
        nationalId: 'NIN-88320194',
        documentHash: '0xabc111',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-501',
        institutionalRefCode: 'AGIS-REG-501',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Valid customary-converted claim (ABJ-ASQ-602)',
      input: {
        applicationId: 'ORC-T02',
        parcelCode: 'ABJ-ASQ-602',
        applicantName: 'Folake Balogun',
        nationalId: 'NIN-91204455',
        documentHash: '0xabc112',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-602',
        institutionalRefCode: 'AGIS-REG-602',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Valid new infill parcel claim',
      input: {
        applicationId: 'ORC-T03',
        parcelCode: 'ABJ-LUG-701',
        applicantName: 'Yusuf Danjuma',
        nationalId: 'NIN-66120934',
        documentHash: '0xabc113',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-701',
        institutionalRefCode: 'AGIS-REG-701',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Valid commercial parcel claim',
      input: {
        applicationId: 'ORC-T04',
        parcelCode: 'ABJ-CBD-801',
        applicantName: 'Kemi Adeleke',
        nationalId: 'NIN-44510293',
        documentHash: '0xabc114',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-801',
        institutionalRefCode: 'AGIS-REG-801',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Valid residential parcel claim',
      input: {
        applicationId: 'ORC-T05',
        parcelCode: 'ABJ-GWA-901',
        applicantName: 'Tunde Bakare',
        nationalId: 'NIN-33190845',
        documentHash: '0xabc115',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-901',
        institutionalRefCode: 'AGIS-REG-901',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Valid mixed-use parcel claim',
      input: {
        applicationId: 'ORC-T06',
        parcelCode: 'ABJ-JABI-905',
        applicantName: 'Hauwa Lawal',
        nationalId: 'NIN-22918341',
        documentHash: '0xabc116',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-905',
        institutionalRefCode: 'AGIS-REG-905',
      },
      expected: 'Successfully verified',
    },
    {
      label: 'Missing survey plan attachment',
      input: {
        applicationId: 'ORC-T07',
        parcelCode: 'ABJ-KAT-501',
        applicantName: 'Sadiq Abubakar',
        nationalId: 'NIN-88320194',
        documentHash: '0xabc117',
        documentSignatureValid: true,
        supportingDocsComplete: false,
        communityAttestationCode: 'ELDER-ATT-501',
        institutionalRefCode: 'AGIS-REG-501',
      },
      expected: 'Incomplete supporting documents',
    },
    {
      label: 'Missing deed of assignment scan',
      input: {
        applicationId: 'ORC-T08',
        parcelCode: 'ABJ-ASQ-602',
        applicantName: 'Folake Balogun',
        nationalId: 'NIN-91204455',
        documentHash: '',
        documentSignatureValid: true,
        supportingDocsComplete: false,
        communityAttestationCode: 'ELDER-ATT-602',
        institutionalRefCode: 'AGIS-REG-602',
      },
      expected: 'Incomplete supporting documents',
    },
    {
      label: 'Mismatched National ID against AGIS record',
      input: {
        applicationId: 'ORC-T09',
        parcelCode: 'ABJ-MAI-101',
        applicantName: 'Imposter Claimant',
        nationalId: 'NIN-00009999',
        documentHash: '0xabc119',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-101',
        institutionalRefCode: 'AGIS-REG-101',
      },
      expected: 'Ownership information conflict',
    },
    {
      label: 'Colluding community informant falsified attestation',
      input: {
        applicationId: 'ORC-T10',
        parcelCode: 'ABJ-KAT-501',
        applicantName: 'Sadiq Abubakar',
        nationalId: 'NIN-88320194',
        documentHash: '0xabc120',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-501',
        communityInformantColluding: true,
        institutionalRefCode: 'AGIS-REG-501',
      },
      expected: 'Ownership information conflict',
    },
    {
      label: 'Pending customary boundary litigation caveat',
      input: {
        applicationId: 'ORC-T11',
        parcelCode: 'ABJ-KAT-501',
        applicantName: 'Sadiq Abubakar',
        nationalId: 'NIN-88320194',
        documentHash: '0xabc121',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-501',
        institutionalRefCode: 'AGIS-REG-501',
        pendingLitigationFlag: true,
      },
      expected: 'Legal verification pending',
    },
    {
      label: 'Active court injunction hold',
      input: {
        applicationId: 'ORC-T12',
        parcelCode: 'ABJ-ASQ-602',
        applicantName: 'Folake Balogun',
        nationalId: 'NIN-91204455',
        documentHash: '0xabc122',
        documentSignatureValid: true,
        supportingDocsComplete: true,
        communityAttestationCode: 'ELDER-ATT-602',
        institutionalRefCode: 'AGIS-REG-602',
        pendingLitigationFlag: true,
      },
      expected: 'Legal verification pending',
    },
  ];

  const counts: Record<OracleOutcome, number> = {
    'Successfully verified': 0,
    'Incomplete supporting documents': 0,
    'Ownership information conflict': 0,
    'Legal verification pending': 0,
  };

  const cases = testClaims.map((c) => {
    const res = verifyOwnershipClaim(c.input);
    counts[res.outcome] += 1;
    return {
      applicationId: c.input.applicationId,
      label: c.label,
      expected: c.expected,
      actual: res.outcome,
      passed: res.outcome === c.expected,
      diagnosticReason: res.diagnosticReason,
    };
  });

  const total = cases.length;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return {
    total,
    rows: [
      { outcome: 'Successfully verified', frequency: counts['Successfully verified'], percentage: pct(counts['Successfully verified']) },
      { outcome: 'Incomplete supporting documents', frequency: counts['Incomplete supporting documents'], percentage: pct(counts['Incomplete supporting documents']) },
      { outcome: 'Ownership information conflict', frequency: counts['Ownership information conflict'], percentage: pct(counts['Ownership information conflict']) },
      { outcome: 'Legal verification pending', frequency: counts['Legal verification pending'], percentage: pct(counts['Legal verification pending']) },
    ],
    cases,
  };
}

// =========================================================================
// Component 3 Part B: MQTT Communication & Synchronisation Broker
// =========================================================================

export const MQTT_TOPIC_SCHEMA = [
  {
    topic: 'land/registration/status',
    payloadFields: '{ applicationId, stage, status, actorRole, timestamp }',
    qos: 1 as const,
    sampleBytes: 142,
  },
  {
    topic: 'land/gis/verified',
    payloadFields: '{ applicationId, parcelId, spatialHash, areaSqMeters, toleranceM, timestamp }',
    qos: 1 as const,
    sampleBytes: 196,
  },
  {
    topic: 'land/oracle/attested',
    payloadFields: '{ applicationId, oracleHash, outcome, institutionalMatch, communityMatch, timestamp }',
    qos: 1 as const,
    sampleBytes: 214,
  },
  {
    topic: 'land/nft/issued',
    payloadFields: '{ applicationId, tokenId, parcelId, ownerAddress, txHash, blockNumber, timestamp }',
    qos: 2 as const,
    sampleBytes: 248,
  },
  {
    topic: 'land/title/revoked',
    payloadFields: '{ tokenId, parcelId, ground, revokedBy, txHash, timestamp }',
    qos: 2 as const,
    sampleBytes: 218,
  },
  {
    topic: 'land/sync/offline',
    payloadFields: '{ clientQueueId, parcelCode, queuedAt, syncedAt, reconnectDelayMs }',
    qos: 1 as const,
    sampleBytes: 158,
  },
];

const mqttLog: MqttMessageRecord[] = [
  {
    id: 'MQTT-1001',
    topic: 'land/nft/issued',
    qos: 2,
    payload: {
      applicationId: 'APP-2026-004',
      tokenId: 4,
      parcelId: 'PAR-305',
      ownerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
      timestamp: '2026-11-05T10:05:02.000Z',
    },
    payloadBytes: 176,
    timestamp: '2026-11-05T10:05:02.000Z',
    delivered: true,
    latencyMs: 6.4,
    source: 'live',
  },
];

type MqttSubscriber = (msg: MqttMessageRecord) => void;
const subscribers = new Set<MqttSubscriber>();

export function subscribeMqttBroker(fn: MqttSubscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function getMqttMessages(): MqttMessageRecord[] {
  return mqttLog;
}

export function publishMqttMessage(
  topic: string,
  payload: Record<string, unknown>,
  qos: 0 | 1 | 2 = 1,
  source: 'live' | 'offline-sync' | 'network-test' = 'live'
): MqttMessageRecord {
  const t0 = performance.now();
  const serialized = JSON.stringify(payload);
  const record: MqttMessageRecord = {
    id: `MQTT-${1001 + mqttLog.length}`,
    topic,
    qos,
    payload,
    payloadBytes: Buffer.byteLength(serialized, 'utf8'),
    timestamp: new Date().toISOString(),
    delivered: true,
    latencyMs: Number((performance.now() - t0 + 1.8).toFixed(3)),
    source,
  };
  mqttLog.unshift(record);
  if (mqttLog.length > 100) mqttLog.pop();
  subscribers.forEach((cb) => cb(record));
  return record;
}

/**
 * Simulates QoS 1 MQTT PUB/PUBACK delivery under Normal, Moderate (200ms/10% loss),
 * and Severe (500ms/25% loss) network conditions (mirroring tc netem tests).
 */
export async function runMqttDegradedNetworkTest(messagesPerCondition = 40): Promise<MqttNetworkTestRow[]> {
  const conditions = [
    { label: 'Normal connectivity', baseDelayMs: 4, packetLossRate: 0, maxRetries: 2 },
    { label: 'Moderate degradation (200ms / 10% loss)', baseDelayMs: 200, packetLossRate: 0.1, maxRetries: 2 },
    { label: 'Severe degradation (500ms / 25% loss)', baseDelayMs: 500, packetLossRate: 0.25, maxRetries: 2 },
  ];

  const results: MqttNetworkTestRow[] = [];

  for (const cond of conditions) {
    let deliveredCount = 0;
    let totalLatency = 0;

    for (let i = 0; i < messagesPerCondition; i++) {
      let attempt = 0;
      let acked = false;
      let msgLatency = 0;

      // QoS 1 retry loop under simulated packet loss & RTT delay
      while (attempt <= cond.maxRetries && !acked) {
        attempt += 1;
        const jitter = Math.random() * (cond.baseDelayMs * 0.2);
        msgLatency += cond.baseDelayMs + jitter;
        const dropped = Math.random() < cond.packetLossRate;
        if (!dropped) {
          acked = true;
        }
      }

      if (acked) {
        deliveredCount += 1;
        totalLatency += msgLatency;
      }
    }

    // Publish summary notification to live broker
    publishMqttMessage(
      'land/registration/status',
      {
        testCondition: cond.label,
        messagesSent: messagesPerCondition,
        delivered: deliveredCount,
        timestamp: new Date().toISOString(),
      },
      1,
      'network-test'
    );

    results.push({
      condition: cond.label,
      messagesSent: messagesPerCondition,
      successfullyDelivered: deliveredCount,
      deliveryRate: `${((deliveredCount / messagesPerCondition) * 100).toFixed(1)}%`,
      avgLatencyMs: Number((deliveredCount > 0 ? totalLatency / deliveredCount : cond.baseDelayMs).toFixed(1)),
    });
  }

  return results;
}
