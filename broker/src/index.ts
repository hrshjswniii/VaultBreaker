import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { LedgerKeyRing } from "./ledger/keyring.js";
import { HederaHCSLogger } from "./hedera/hcs.js";
import { PolicyEngine } from "./policy/engine.js";
import { createApiRouter } from "./api/routes.js";

dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const keyring = new LedgerKeyRing();
const hcsLogger = new HederaHCSLogger();
const policyEngine = new PolicyEngine(keyring);

app.use("/api", createApiRouter(keyring, hcsLogger, policyEngine));

app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`[Vaultbreaker Broker] Service running on http://localhost:${PORT}`);
  const status = await keyring.checkAvailability();
  console.log(`[Vaultbreaker KeyRing] Mode: ${status.mode} (Seed fingerprint: ${status.seedFingerprint})`);
  console.log(`=======================================================`);
});
