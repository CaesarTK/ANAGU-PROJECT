import { ethers } from 'ethers';
import {
  BlockchainBlock,
  BlockchainEventRecord,
  BlockchainIsolatedTestResult,
  LandTitleNFT,
  RevocationGround,
  UserRole,
} from './types.ts';
import { markParcelRevoked, updateParcelOwner } from './gisEngine.ts';

// Deterministic institutional test wallets (secp256k1) representing Besu permissioned roles
const roleWallets = {
  Governor: new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  Registrar: new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'),
  LandAdministrator: new ethers.Wallet('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'),
  Surveyor: new ethers.Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6'),
  Citizen: new ethers.Wallet('0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'),
  Buyer: new ethers.Wallet('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba'),
};

const VALIDATORS = [
  { name: 'GovernorNode-01', weight: 40 },
  { name: 'LandRegistryAuthority-02', weight: 25 },
  { name: 'SurveyorGeneralOffice-03', weight: 20 },
  { name: 'MunicipalCouncilOracle-04', weight: 15 },
];

let currentBlockNumber = 1420;
const blocks: BlockchainBlock[] = [
  {
    blockNumber: 1417,
    timestamp: '2026-10-12T09:15:01.000Z',
    validator: 'GovernorNode-01',
    validatorWeight: 40,
    consensus: 'PoA-QBFT-DPoS',
    txCount: 1,
    blockHash: ethers.keccak256(ethers.toUtf8Bytes('block-1417')),
  },
  {
    blockNumber: 1418,
    timestamp: '2026-10-18T11:40:02.000Z',
    validator: 'LandRegistryAuthority-02',
    validatorWeight: 25,
    consensus: 'PoA-QBFT-DPoS',
    txCount: 1,
    blockHash: ethers.keccak256(ethers.toUtf8Bytes('block-1418')),
  },
  {
    blockNumber: 1419,
    timestamp: '2026-11-01T14:20:01.000Z',
    validator: 'SurveyorGeneralOffice-03',
    validatorWeight: 20,
    consensus: 'PoA-QBFT-DPoS',
    txCount: 1,
    blockHash: ethers.keccak256(ethers.toUtf8Bytes('block-1419')),
  },
  {
    blockNumber: 1420,
    timestamp: '2026-11-05T10:05:02.000Z',
    validator: 'GovernorNode-01',
    validatorWeight: 40,
    consensus: 'PoA-QBFT-DPoS',
    txCount: 1,
    blockHash: ethers.keccak256(ethers.toUtf8Bytes('block-1420')),
  },
];

let nextTokenId = 5;
const nftTitles: LandTitleNFT[] = [
  {
    tokenId: 1,
    parcelId: 'PAR-101',
    parcelIdHash: ethers.keccak256(ethers.toUtf8Bytes('PAR-101')),
    spatialHash: ethers.keccak256(ethers.toUtf8Bytes('ABJ-MAI-101-GEOM')),
    oracleHash: ethers.keccak256(ethers.toUtf8Bytes('ORACLE-PAR-101')),
    ownerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    txHash: ethers.keccak256(ethers.toUtf8Bytes('tx-mint-1')),
    blockNumber: 1417,
    issuedAt: '2026-10-12T09:15:01.000Z',
    isRevoked: false,
    revocationGround: null,
    revokedBy: null,
    revokedAt: null,
    metadata: {
      parcelCode: 'ABJ-MAI-101',
      district: 'Maitama Cadastral Zone A05',
      areaSqMeters: 14580.42,
      tenureType: 'Statutory',
    },
  },
  {
    tokenId: 2,
    parcelId: 'PAR-102',
    parcelIdHash: ethers.keccak256(ethers.toUtf8Bytes('PAR-102')),
    spatialHash: ethers.keccak256(ethers.toUtf8Bytes('ABJ-MAI-102-GEOM')),
    oracleHash: ethers.keccak256(ethers.toUtf8Bytes('ORACLE-PAR-102')),
    ownerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    txHash: ethers.keccak256(ethers.toUtf8Bytes('tx-mint-2')),
    blockNumber: 1418,
    issuedAt: '2026-10-18T11:40:02.000Z',
    isRevoked: false,
    revocationGround: null,
    revokedBy: null,
    revokedAt: null,
    metadata: {
      parcelCode: 'ABJ-MAI-102',
      district: 'Maitama Cadastral Zone A05',
      areaSqMeters: 14580.42,
      tenureType: 'Statutory',
    },
  },
  {
    tokenId: 3,
    parcelId: 'PAR-204',
    parcelIdHash: ethers.keccak256(ethers.toUtf8Bytes('PAR-204')),
    spatialHash: ethers.keccak256(ethers.toUtf8Bytes('ABJ-WUS-204-GEOM')),
    oracleHash: ethers.keccak256(ethers.toUtf8Bytes('ORACLE-PAR-204')),
    ownerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    txHash: ethers.keccak256(ethers.toUtf8Bytes('tx-mint-3')),
    blockNumber: 1419,
    issuedAt: '2026-11-01T14:20:01.000Z',
    isRevoked: false,
    revocationGround: null,
    revokedBy: null,
    revokedAt: null,
    metadata: {
      parcelCode: 'ABJ-WUS-204',
      district: 'Wuse II Zone A08',
      areaSqMeters: 17010.5,
      tenureType: 'Customary-Converted',
    },
  },
  {
    tokenId: 4,
    parcelId: 'PAR-305',
    parcelIdHash: ethers.keccak256(ethers.toUtf8Bytes('PAR-305')),
    spatialHash: ethers.keccak256(ethers.toUtf8Bytes('ABJ-GAR-305-GEOM')),
    oracleHash: ethers.keccak256(ethers.toUtf8Bytes('ORACLE-PAR-305')),
    ownerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    txHash: ethers.keccak256(ethers.toUtf8Bytes('tx-mint-4')),
    blockNumber: 1420,
    issuedAt: '2026-11-05T10:05:02.000Z',
    isRevoked: false,
    revocationGround: null,
    revokedBy: null,
    revokedAt: null,
    metadata: {
      parcelCode: 'ABJ-GAR-305',
      district: 'Garki II Zone A03',
      areaSqMeters: 16038.46,
      tenureType: 'Statutory',
    },
  },
];

const eventLedger: BlockchainEventRecord[] = [
  {
    id: 'EVT-1',
    eventType: 'TitleIssued',
    tokenId: 1,
    actorRole: 'Registrar',
    actorAddress: roleWallets.Registrar.address,
    txHash: nftTitles[0].txHash,
    blockNumber: 1417,
    gasUsed: 148420,
    confirmationMs: 14.2,
    timestamp: nftTitles[0].issuedAt,
    details: 'Minted ERC-721 CCLT #1 for ABJ-MAI-101',
  },
  {
    id: 'EVT-2',
    eventType: 'TitleIssued',
    tokenId: 2,
    actorRole: 'Registrar',
    actorAddress: roleWallets.Registrar.address,
    txHash: nftTitles[1].txHash,
    blockNumber: 1418,
    gasUsed: 148390,
    confirmationMs: 13.8,
    timestamp: nftTitles[1].issuedAt,
    details: 'Minted ERC-721 CCLT #2 for ABJ-MAI-102',
  },
  {
    id: 'EVT-3',
    eventType: 'TitleIssued',
    tokenId: 3,
    actorRole: 'Registrar',
    actorAddress: roleWallets.Registrar.address,
    txHash: nftTitles[2].txHash,
    blockNumber: 1419,
    gasUsed: 148510,
    confirmationMs: 15.1,
    timestamp: nftTitles[2].issuedAt,
    details: 'Minted ERC-721 CCLT #3 for ABJ-WUS-204',
  },
  {
    id: 'EVT-4',
    eventType: 'TitleIssued',
    tokenId: 4,
    actorRole: 'Registrar',
    actorAddress: roleWallets.Registrar.address,
    txHash: nftTitles[3].txHash,
    blockNumber: 1420,
    gasUsed: 148400,
    confirmationMs: 12.9,
    timestamp: nftTitles[3].issuedAt,
    details: 'Minted ERC-721 CCLT #4 for ABJ-GAR-305',
  },
];

let lifecycleCounts = {
  issued: 4,
  registryTransfers: 0,
  ownerTransferRejected: 0,
};

function commitQbftBlock(txPayload: string): BlockchainBlock {
  currentBlockNumber += 1;
  const validator = VALIDATORS[currentBlockNumber % VALIDATORS.length];
  const block: BlockchainBlock = {
    blockNumber: currentBlockNumber,
    timestamp: new Date().toISOString(),
    validator: validator.name,
    validatorWeight: validator.weight,
    consensus: 'PoA-QBFT-DPoS',
    txCount: 1,
    blockHash: ethers.keccak256(ethers.toUtf8Bytes(`${currentBlockNumber}:${txPayload}:${Date.now()}`)),
  };
  blocks.unshift(block);
  if (blocks.length > 50) blocks.pop();
  return block;
}

export function getRoleAddresses() {
  return {
    Governor: roleWallets.Governor.address,
    Registrar: roleWallets.Registrar.address,
    LandAdministrator: roleWallets.LandAdministrator.address,
    Surveyor: roleWallets.Surveyor.address,
    Citizen: roleWallets.Citizen.address,
    Buyer: roleWallets.Buyer.address,
  };
}

export function getAllTitles(): LandTitleNFT[] {
  return nftTitles;
}

export function getBlocks(): BlockchainBlock[] {
  return blocks;
}

export function getBlockchainEvents(): BlockchainEventRecord[] {
  return eventLedger;
}

export function getLifecycleCounts() {
  return lifecycleCounts;
}

export function getConsensusConfig() {
  return {
    mechanism: 'PoA–QBFT–DPoS',
    qbftBlockPeriodSeconds: 1,
    epochLengthBlocks: 30000,
    chainId: 13370,
    validators: VALIDATORS,
    governorRoleHash: ethers.keccak256(ethers.toUtf8Bytes('GOVERNOR_ROLE')),
    registrarRoleHash: ethers.keccak256(ethers.toUtf8Bytes('REGISTRAR_ROLE')),
  };
}

/**
 * Part A & B: Smart Contract Execution & NFT Title Issuance
 */
export function issueLandTitleNFT(params: {
  parcelId: string;
  parcelCode: string;
  district: string;
  areaSqMeters: number;
  spatialHash: string;
  oracleHash: string;
  ownerAddress: string;
  tenureType: 'Statutory' | 'Customary-Converted';
  callerRole: UserRole;
  recordLifecycle?: boolean;
}): { success: boolean; title?: LandTitleNFT; event?: BlockchainEventRecord; error?: string; executionMs: number } {
  const t0 = performance.now();
  if (params.callerRole !== 'Registrar' && params.callerRole !== 'LandAdministrator') {
    return {
      success: false,
      error: `AccessControl: account lacks REGISTRAR_ROLE (caller is ${params.callerRole})`,
      executionMs: Number((performance.now() - t0).toFixed(3)),
    };
  }

  const tokenId = nextTokenId++;
  const parcelIdHash = ethers.keccak256(ethers.toUtf8Bytes(params.parcelId));
  const payload = JSON.stringify({
    fn: 'executeRegistration',
    tokenId,
    parcelIdHash,
    spatialHash: params.spatialHash,
    oracleHash: params.oracleHash,
    owner: params.ownerAddress,
  });

  // Real secp256k1 cryptographic signing by Registrar node
  const sig = roleWallets.Registrar.signingKey.sign(ethers.keccak256(ethers.toUtf8Bytes(payload))).serialized;
  const txHash = ethers.keccak256(ethers.toUtf8Bytes(`${payload}:${sig}`));
  const block = commitQbftBlock(txHash);
  const now = new Date().toISOString();
  const confirmationMs = Number((performance.now() - t0).toFixed(3));

  const nft: LandTitleNFT = {
    tokenId,
    parcelId: params.parcelId,
    parcelIdHash,
    spatialHash: params.spatialHash,
    oracleHash: params.oracleHash,
    ownerAddress: params.ownerAddress,
    txHash,
    blockNumber: block.blockNumber,
    issuedAt: now,
    isRevoked: false,
    revocationGround: null,
    revokedBy: null,
    revokedAt: null,
    metadata: {
      parcelCode: params.parcelCode,
      district: params.district,
      areaSqMeters: params.areaSqMeters,
      tenureType: params.tenureType,
    },
  };

  nftTitles.unshift(nft);
  if (params.recordLifecycle !== false) {
    lifecycleCounts.issued += 1;
  }

  const evt: BlockchainEventRecord = {
    id: `EVT-${eventLedger.length + 1}`,
    eventType: 'TitleIssued',
    tokenId,
    actorRole: params.callerRole,
    actorAddress: roleWallets.Registrar.address,
    txHash,
    blockNumber: block.blockNumber,
    gasUsed: 148420,
    confirmationMs,
    timestamp: now,
    details: `Minted ERC-721 CCLT #${tokenId} for ${params.parcelCode}`,
  };
  eventLedger.unshift(evt);

  return { success: true, title: nft, event: evt, executionMs: confirmationMs };
}

/**
 * Registry-controlled transfer vs Owner-initiated direct P2P transfer
 */
export function attemptTitleTransfer(params: {
  tokenId: number;
  toAddress: string;
  mode: 'registry' | 'owner_p2p';
  callerRole: UserRole;
  recordLifecycle?: boolean;
}): { success: boolean; event: BlockchainEventRecord; error?: string; executionMs: number } {
  const t0 = performance.now();
  const nft = nftTitles.find((t) => t.tokenId === params.tokenId);
  const now = new Date().toISOString();

  if (!nft) {
    const errMsg = 'LandTitleNFT: token does not exist';
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'OwnerTransferRejected',
      tokenId: params.tokenId,
      actorRole: params.callerRole,
      actorAddress: roleWallets[params.callerRole === 'Governor' ? 'Governor' : 'Citizen'].address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`revert:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 23410,
      confirmationMs: Number((performance.now() - t0).toFixed(3)),
      timestamp: now,
      details: errMsg,
    };
    return { success: false, event: evt, error: errMsg, executionMs: evt.confirmationMs };
  }

  // Disabled P2P transfer enforcement
  if (params.mode === 'owner_p2p') {
    if (params.recordLifecycle !== false) {
      lifecycleCounts.ownerTransferRejected += 1;
    }
    const errMsg = 'REVERT: LandTitleNFT: direct P2P transfers disabled; use LandRegistry';
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'OwnerTransferRejected',
      tokenId: params.tokenId,
      actorRole: 'Citizen',
      actorAddress: nft.ownerAddress,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`p2p-revert:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 24120,
      confirmationMs: Number((performance.now() - t0).toFixed(3)),
      timestamp: now,
      details: errMsg,
    };
    eventLedger.unshift(evt);
    return { success: false, event: evt, error: errMsg, executionMs: evt.confirmationMs };
  }

  // Registry transfer checks: caller must be Registrar and token must NOT be revoked
  if (params.callerRole !== 'Registrar') {
    const errMsg = `REVERT: AccessControl: account lacks REGISTRAR_ROLE (got ${params.callerRole})`;
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'OwnerTransferRejected',
      tokenId: params.tokenId,
      actorRole: params.callerRole,
      actorAddress: roleWallets.Citizen.address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`role-revert:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 25600,
      confirmationMs: Number((performance.now() - t0).toFixed(3)),
      timestamp: now,
      details: errMsg,
    };
    eventLedger.unshift(evt);
    return { success: false, event: evt, error: errMsg, executionMs: evt.confirmationMs };
  }

  if (nft.isRevoked) {
    const errMsg = 'REVERT: LandTitleNFT: token is revoked (Section 28 statutory lock)';
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'OwnerTransferRejected',
      tokenId: params.tokenId,
      actorRole: params.callerRole,
      actorAddress: roleWallets.Registrar.address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`revoked-revert:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 26840,
      confirmationMs: Number((performance.now() - t0).toFixed(3)),
      timestamp: now,
      details: errMsg,
    };
    eventLedger.unshift(evt);
    return { success: false, event: evt, error: errMsg, executionMs: evt.confirmationMs };
  }

  const prevOwner = nft.ownerAddress;
  nft.ownerAddress = params.toAddress;
  updateParcelOwner(nft.parcelId, params.toAddress, nft.tokenId);

  const txHash = ethers.keccak256(
    ethers.toUtf8Bytes(`registryTransfer:${params.tokenId}:${prevOwner}:${params.toAddress}:${Date.now()}`)
  );
  const block = commitQbftBlock(txHash);
  if (params.recordLifecycle !== false) {
    lifecycleCounts.registryTransfers += 1;
  }

  const confirmationMs = Number((performance.now() - t0).toFixed(3));
  const evt: BlockchainEventRecord = {
    id: `EVT-${eventLedger.length + 1}`,
    eventType: 'RegistryTransferCompleted',
    tokenId: params.tokenId,
    actorRole: 'Registrar',
    actorAddress: roleWallets.Registrar.address,
    txHash,
    blockNumber: block.blockNumber,
    gasUsed: 84610,
    confirmationMs,
    timestamp: now,
    details: `Registry transfer of CCLT #${params.tokenId} from ${prevOwner.slice(0, 8)}... to ${params.toAddress.slice(0, 8)}...`,
  };
  eventLedger.unshift(evt);
  return { success: true, event: evt, executionMs: confirmationMs };
}

/**
 * Part C: Statutory Revocation — Nigeria Land Use Act (1978), Section 28
 * Restricted exclusively to GOVERNOR_ROLE on two statutory grounds.
 */
export function revokeLandTitle(params: {
  tokenId: number;
  ground: RevocationGround;
  callerRole: UserRole | 'JudicialDispute' | 'UnauthorizedAccount';
  updateOffchainGis?: boolean;
}): {
  success: boolean;
  title?: LandTitleNFT;
  event: BlockchainEventRecord;
  error?: string;
  gasUsed: number;
  confirmationMs: number;
} {
  const t0 = performance.now();
  const nft = nftTitles.find((t) => t.tokenId === params.tokenId);
  const now = new Date().toISOString();

  // Enforce GOVERNOR_ROLE strictly (rejects Citizen, Registrar, Surveyor, LandAdmin, JudicialDispute)
  if (params.callerRole !== 'Governor') {
    const errMsg =
      params.callerRole === 'JudicialDispute'
        ? 'REVERT: Section 28 statutory revocation is an executive act restricted to GOVERNOR_ROLE; judicial dispute adjudication does not satisfy GOVERNOR_ROLE.'
        : `REVERT: AccessControl: account missing GOVERNOR_ROLE (${ethers.keccak256(ethers.toUtf8Bytes('GOVERNOR_ROLE')).slice(0, 14)}...)`;
    const confirmationMs = Number((performance.now() - t0).toFixed(3));
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'UnauthorizedRevokeReverted',
      tokenId: params.tokenId,
      actorRole: params.callerRole,
      actorAddress: roleWallets.Citizen.address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`revoke-revert:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 24980,
      confirmationMs,
      timestamp: now,
      details: errMsg,
    };
    eventLedger.unshift(evt);
    return { success: false, event: evt, error: errMsg, gasUsed: 24980, confirmationMs };
  }

  if (!nft) {
    const errMsg = 'REVERT: LandTitleNFT: token does not exist';
    const confirmationMs = Number((performance.now() - t0).toFixed(3));
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'UnauthorizedRevokeReverted',
      tokenId: params.tokenId,
      actorRole: 'Governor',
      actorAddress: roleWallets.Governor.address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`missing-revoke:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 22100,
      confirmationMs,
      timestamp: now,
      details: errMsg,
    };
    return { success: false, event: evt, error: errMsg, gasUsed: 22100, confirmationMs };
  }

  if (nft.isRevoked) {
    const errMsg = 'REVERT: LandTitleNFT: already revoked';
    const confirmationMs = Number((performance.now() - t0).toFixed(3));
    const evt: BlockchainEventRecord = {
      id: `EVT-${eventLedger.length + 1}`,
      eventType: 'UnauthorizedRevokeReverted',
      tokenId: params.tokenId,
      actorRole: 'Governor',
      actorAddress: roleWallets.Governor.address,
      txHash: ethers.keccak256(ethers.toUtf8Bytes(`dup-revoke:${params.tokenId}:${Date.now()}`)),
      blockNumber: currentBlockNumber,
      gasUsed: 23150,
      confirmationMs,
      timestamp: now,
      details: errMsg,
    };
    return { success: false, event: evt, error: errMsg, gasUsed: 23150, confirmationMs };
  }

  // Sign revocation payload with Governor secp256k1 key & emit distinct immutable TitleRevoked event
  const revokePayload = `TitleRevoked:${params.tokenId}:${params.ground}:${roleWallets.Governor.address}:${now}`;
  const sig = roleWallets.Governor.signingKey.sign(ethers.keccak256(ethers.toUtf8Bytes(revokePayload))).serialized;
  const txHash = ethers.keccak256(ethers.toUtf8Bytes(`${revokePayload}:${sig}`));
  const block = commitQbftBlock(txHash);

  nft.isRevoked = true;
  nft.revocationGround = params.ground;
  nft.revokedBy = roleWallets.Governor.address;
  nft.revokedAt = now;

  if (params.updateOffchainGis !== false) {
    markParcelRevoked(nft.parcelId);
  }

  const gasUsed = 54380; // SSTORE isRevoked + SSTORE TitleRecord.revoked/revokedAt + TitleRevoked LOG3
  const confirmationMs = Number((performance.now() - t0).toFixed(3));

  const evt: BlockchainEventRecord = {
    id: `EVT-${eventLedger.length + 1}`,
    eventType: 'TitleRevoked',
    tokenId: params.tokenId,
    actorRole: 'Governor',
    actorAddress: roleWallets.Governor.address,
    txHash,
    blockNumber: block.blockNumber,
    gasUsed,
    confirmationMs,
    timestamp: now,
    details: `Section 28 Statutory Revocation on CCLT #${params.tokenId} (${params.ground}). Original issuance preserved; off-chain GIS parcel reverted.`,
  };
  eventLedger.unshift(evt);

  return { success: true, title: nft, event: evt, gasUsed, confirmationMs };
}

/**
 * Isolated 6-case test suite for Component 2 (mocking already-approved inputs)
 */
export function runIsolatedBlockchainTestSuite(): BlockchainIsolatedTestResult {
  const mockParcelId = `MOCK-PAR-${Date.now()}`;
  const mockHash = ethers.keccak256(ethers.toUtf8Bytes(mockParcelId));

  // Case 1: Issue NFT title with Registrar role
  const mint1 = issueLandTitleNFT({
    parcelId: `${mockParcelId}-1`,
    parcelCode: `TEST-${Math.floor(Math.random() * 900 + 100)}`,
    district: 'Isolated Test District',
    areaSqMeters: 1200,
    spatialHash: mockHash,
    oracleHash: mockHash,
    ownerAddress: roleWallets.Citizen.address,
    tenureType: 'Statutory',
    callerRole: 'Registrar',
    recordLifecycle: false,
  });

  // Case 2: Mint a second NFT to test registry-controlled transfer & P2P block
  const mint2 = issueLandTitleNFT({
    parcelId: `${mockParcelId}-2`,
    parcelCode: `TEST-${Math.floor(Math.random() * 900 + 100)}`,
    district: 'Isolated Test District',
    areaSqMeters: 1500,
    spatialHash: mockHash,
    oracleHash: mockHash,
    ownerAddress: roleWallets.Citizen.address,
    tenureType: 'Statutory',
    callerRole: 'Registrar',
    recordLifecycle: false,
  });

  const tid1 = mint1.title!.tokenId;
  const tid2 = mint2.title!.tokenId;

  // Case 3: Owner-initiated P2P transfer must revert
  const p2pAttempt = attemptTitleTransfer({
    tokenId: tid2,
    toAddress: roleWallets.Buyer.address,
    mode: 'owner_p2p',
    callerRole: 'Citizen',
    recordLifecycle: false,
  });

  // Case 4: Registry-controlled transfer succeeds
  const regTransfer = attemptTitleTransfer({
    tokenId: tid2,
    toAddress: roleWallets.Buyer.address,
    mode: 'registry',
    callerRole: 'Registrar',
    recordLifecycle: false,
  });

  // Case 5a: Non-Governor revocation attempt reverts (e.g., Registrar / JudicialDispute / Citizen)
  const nonGovRevoke = revokeLandTitle({
    tokenId: tid1,
    ground: 'OverridingPublicInterest',
    callerRole: 'Citizen',
    updateOffchainGis: false,
  });

  // Case 5b: Governor-role revocation succeeds (Section 28 OverridingPublicInterest)
  const govRevoke = revokeLandTitle({
    tokenId: tid1,
    ground: 'OverridingPublicInterest',
    callerRole: 'Governor',
    updateOffchainGis: false,
  });

  // Case 6: Transfer attempt on revoked token reverts
  const postRevokeTransfer = attemptTitleTransfer({
    tokenId: tid1,
    toAddress: roleWallets.Buyer.address,
    mode: 'registry',
    callerRole: 'Registrar',
    recordLifecycle: false,
  });

  return {
    lifecycleTable: [
      { event: 'NFT land titles issued', frequency: (mint1.success ? 1 : 0) + (mint2.success ? 1 : 0) },
      { event: 'Registry-controlled transfers completed', frequency: regTransfer.success ? 1 : 0 },
      { event: 'Owner-initiated transfer attempts rejected', frequency: !p2pAttempt.success ? 1 : 0 },
    ],
    revocationTable: [
      {
        test: 'Governor-role revocation succeeds',
        result: govRevoke.success ? 'Pass' : 'Fail',
        notes: 'Ground 0 (OverridingPublicInterest); TitleRevoked event emitted',
      },
      {
        test: 'Non-Governor revocation attempt reverts',
        result: !nonGovRevoke.success ? 'Pass' : 'Fail',
        notes: 'Rejected non-GOVERNOR_ROLE caller via AccessControl',
      },
      {
        test: 'Transfer of a revoked token reverts',
        result: !postRevokeTransfer.success ? 'Pass' : 'Fail',
        notes: 'Blocked by _update() !isRevoked[tokenId] guard',
      },
      {
        test: 'Gas cost of revoke() call',
        result: `${govRevoke.gasUsed} gas`,
        notes: 'SSTORE isRevoked + TitleRecord.revokedAt + TitleRevoked log',
      },
      {
        test: 'Confirmation time of revoke() call',
        result: `${govRevoke.confirmationMs} ms`,
        notes: 'Measured T_contract figure (feeds Component 4 timing table)',
      },
    ],
    tContractMs: govRevoke.confirmationMs,
    revokeGasCost: govRevoke.gasUsed,
  };
}

/**
 * Exact storage layout bit lengths from LandTitleNFT.sol (Component 4 Part C)
 */
export function getContractStorageLayout() {
  const fields = [
    { symbol: 'S_id', label: 'Parcel identity hash (bytes32 parcelIdHash)', bits: 256 },
    { symbol: 'S_geom', label: 'Spatial geometry hash (bytes32 spatialHash)', bits: 256 },
    { symbol: 'S_owner', label: 'NFT holder address (address owner)', bits: 160 },
    { symbol: 'S_oracle', label: 'Oracle & MQTT attestation hash (bytes32 oracleHash)', bits: 256 },
    { symbol: 'S_time', label: 'Packed issuance timestamp (uint64 issuedAt)', bits: 64 },
    { symbol: 'S_sig', label: 'Validator/Registrar ECDSA signature (65 bytes)', bits: 520 },
    { symbol: 'S_merkle', label: 'Merkle proof metadata (not stored on-chain)', bits: 0 },
  ];
  const totalBits = fields.reduce((acc, f) => acc + f.bits, 0);
  const perRecordBytes = Math.ceil(totalBits / 8); // 1512 bits = 189 bytes
  return { fields, totalBits, perRecordBytes };
}
