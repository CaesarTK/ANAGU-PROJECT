import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  getAllParcels,
  getToleranceMeters,
  setToleranceMeters,
  verifyParcelGeometry,
  runIsolatedSpatialTestSuites,
} from './server/gisEngine.ts';
import {
  attemptTitleTransfer,
  getAllTitles,
  getBlockchainEvents,
  getBlocks,
  getConsensusConfig,
  getContractStorageLayout,
  getLifecycleCounts,
  getRoleAddresses,
  issueLandTitleNFT,
  revokeLandTitle,
  runIsolatedBlockchainTestSuite,
} from './server/blockchainEngine.ts';
import {
  getMqttMessages,
  MATCHING_RULES_SPEC,
  MQTT_TOPIC_SCHEMA,
  publishMqttMessage,
  runIsolatedOracleTestSuite,
  runMqttDegradedNetworkTest,
  subscribeMqttBroker,
  verifyOwnershipClaim,
} from './server/oracleMqttEngine.ts';
import {
  advanceWorkflowStage,
  executeRevocationWorkflow,
  getApplications,
  getAuditTrail,
  runUnifiedWorkflowIntegrationSuite,
  submitNewApplication,
} from './server/workflowEngine.ts';
import { runCrossCuttingEvaluation } from './server/evaluationEngine.ts';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws/mqtt' });

  subscribeMqttBroker((msg) => {
    const serialized = JSON.stringify({ type: 'mqtt_message', data: msg });
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(serialized);
      }
    });
  });

  // =========================================================================
  // Step 0: Environment & Architecture Inspection
  // =========================================================================
  app.get('/api/overview', (_req, res) => {
    const readSafe = (rel: string) => {
      try {
        return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      } catch {
        return '';
      }
    };

    res.json({
      consensus: getConsensusConfig(),
      roles: getRoleAddresses(),
      storageLayout: getContractStorageLayout(),
      stats: {
        registeredParcels: getAllParcels().length,
        issuedNfts: getAllTitles().length,
        revokedNfts: getAllTitles().filter((t) => t.isRevoked).length,
        applications: getApplications().length,
        mqttMessages: getMqttMessages().length,
        auditEntries: getAuditTrail().length,
      },
      artifacts: {
        landTitleNftSol: readSafe('contracts/LandTitleNFT.sol'),
        landRegistrySol: readSafe('contracts/LandRegistry.sol'),
        besuGenesisJson: readSafe('infra/besu/qbftConfigFile.json'),
        postgisSchemaSql: readSafe('infra/sql/schema.sql'),
        dockerComposeYml: readSafe('docker-compose.yml'),
      },
    });
  });

  // =========================================================================
  // Component 1: GIS Spatial Verification
  // =========================================================================
  app.get('/api/gis/parcels', (_req, res) => {
    res.json({
      toleranceMeters: getToleranceMeters(),
      parcels: getAllParcels(),
    });
  });

  app.post('/api/gis/tolerance', (req, res) => {
    const meters = Number(req.body?.toleranceMeters);
    if (Number.isNaN(meters) || meters < 0 || meters > 25) {
      return res.status(400).json({ error: 'Tolerance must be between 0 and 25 meters.' });
    }
    const updated = setToleranceMeters(meters);
    res.json({ toleranceMeters: updated });
  });

  app.post('/api/gis/verify', (req, res) => {
    const { parcelId, coordinates, toleranceMeters } = req.body || {};
    const result = verifyParcelGeometry(
      parcelId || `PROBE-${Date.now()}`,
      coordinates,
      toleranceMeters !== undefined ? Number(toleranceMeters) : getToleranceMeters()
    );
    res.json(result);
  });

  app.post('/api/gis/test-suite', (req, res) => {
    const tol = req.body?.toleranceMeters !== undefined ? Number(req.body.toleranceMeters) : getToleranceMeters();
    const suites = runIsolatedSpatialTestSuites(tol);
    res.json(suites);
  });

  // =========================================================================
  // Component 2: Blockchain NFT Tokenisation & Statutory Revocation
  // =========================================================================
  app.get('/api/blockchain/state', (_req, res) => {
    res.json({
      consensus: getConsensusConfig(),
      roles: getRoleAddresses(),
      titles: getAllTitles(),
      blocks: getBlocks(),
      events: getBlockchainEvents(),
      lifecycleCounts: getLifecycleCounts(),
      storageLayout: getContractStorageLayout(),
    });
  });

  app.post('/api/blockchain/mint', (req, res) => {
    const result = issueLandTitleNFT(req.body);
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/blockchain/transfer', (req, res) => {
    const result = attemptTitleTransfer(req.body);
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/blockchain/revoke', (req, res) => {
    const { tokenId, ground, callerRole } = req.body || {};
    const result = revokeLandTitle({
      tokenId: Number(tokenId),
      ground,
      callerRole,
      updateOffchainGis: true,
    });
    if (result.success && result.title) {
      publishMqttMessage(
        'land/title/revoked',
        {
          tokenId: result.title.tokenId,
          parcelId: result.title.parcelId,
          ground,
          revokedBy: result.title.revokedBy,
          txHash: result.event.txHash,
          timestamp: result.title.revokedAt,
        },
        2
      );
    }
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/blockchain/test-suite', (_req, res) => {
    const report = runIsolatedBlockchainTestSuite();
    res.json(report);
  });

  // =========================================================================
  // Component 3: Community Verification Oracle & MQTT Broker
  // =========================================================================
  app.get('/api/oracle/spec', (_req, res) => {
    res.json({
      matchingRules: MATCHING_RULES_SPEC,
      topicSchema: MQTT_TOPIC_SCHEMA,
      messages: getMqttMessages(),
    });
  });

  app.post('/api/oracle/verify', (req, res) => {
    const result = verifyOwnershipClaim(req.body);
    res.json(result);
  });

  app.post('/api/oracle/test-suite', (_req, res) => {
    const report = runIsolatedOracleTestSuite();
    res.json(report);
  });

  app.get('/api/mqtt/messages', (_req, res) => {
    res.json({
      topicSchema: MQTT_TOPIC_SCHEMA,
      messages: getMqttMessages(),
    });
  });

  app.post('/api/mqtt/publish', (req, res) => {
    const { topic, payload, qos } = req.body || {};
    const msg = publishMqttMessage(topic || 'land/registration/status', payload || {}, qos ?? 1, 'live');
    res.json(msg);
  });

  app.post('/api/mqtt/network-test', async (req, res) => {
    const count = Number(req.body?.messagesPerCondition) || 40;
    const rows = await runMqttDegradedNetworkTest(count);
    res.json({ rows });
  });

  app.post('/api/mqtt/offline-sync', (req, res) => {
    const { clientQueueId, parcelCode, applicantName, queuedAt, reconnectTimestamp } = req.body || {};
    const syncedAt = Date.now();
    const reconnectDelayMs = reconnectTimestamp ? Math.max(12, syncedAt - Number(reconnectTimestamp)) : 148;
    const msg = publishMqttMessage(
      'land/sync/offline',
      {
        clientQueueId,
        parcelCode,
        applicantName,
        queuedAt,
        syncedAt: new Date(syncedAt).toISOString(),
        reconnectDelayMs,
      },
      1,
      'offline-sync'
    );
    res.json({
      synced: true,
      reconnectDelaySeconds: Number((reconnectDelayMs / 1000).toFixed(3)),
      message: msg,
    });
  });

  // =========================================================================
  // Integration: Unified 8-Stage Registration Workflow
  // =========================================================================
  app.get('/api/workflow/state', (_req, res) => {
    res.json({
      applications: getApplications(),
      auditTrail: getAuditTrail(),
    });
  });

  app.post('/api/workflow/submit', (req, res) => {
    const created = submitNewApplication(req.body);
    res.json(created);
  });

  app.post('/api/workflow/advance', (req, res) => {
    const { applicationId, actorRole, action } = req.body || {};
    const result = advanceWorkflowStage(applicationId, actorRole, action || 'advance');
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/workflow/revoke', (req, res) => {
    const { tokenId, ground, actorRole } = req.body || {};
    const result = executeRevocationWorkflow(Number(tokenId), ground, actorRole);
    res.status(result.success ? 200 : 403).json(result);
  });

  app.post('/api/workflow/test-suite', (_req, res) => {
    const report = runUnifiedWorkflowIntegrationSuite();
    res.json(report);
  });

  // =========================================================================
  // Component 4: Cross-Cutting Evaluation (Objective iv)
  // =========================================================================
  app.post('/api/evaluation/run', (req, res) => {
    const trials = Math.min(50, Math.max(20, Number(req.body?.trialsPerScenario) || 30));
    const runs = Math.min(60, Math.max(30, Number(req.body?.latencyRuns) || 35));
    const report = runCrossCuttingEvaluation(trials, runs);
    res.json(report);
  });

  // =========================================================================
  // Vite Middleware / Production Static Assets
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`ANAGU Land Administration Framework running on http://0.0.0.0:${port}`);
  });
}

startServer();
