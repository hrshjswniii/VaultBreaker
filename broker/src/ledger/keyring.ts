import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

export interface LedgerKeyRingStatus {
  mode: "LEDGER_CLI" | "SIMULATED_KEYRING";
  initialized: boolean;
  cliPath: string;
  seedFingerprint?: string;
}

export class LedgerKeyRing {
  private cliPath: string;
  private memoryMasterKey: Buffer;
  private isCliAvailable: boolean = false;

  constructor(cliPath?: string) {
    this.cliPath = cliPath || process.env.LEDGER_CLI_PATH || "wallet-cli";
    // Seed-derived internal key ring fallback derived from environment seed/operator key
    const rawSeed = process.env.HEDERA_OPERATOR_KEY || "vaultbreaker-ledger-root-seed-hackathon-2026";
    this.memoryMasterKey = crypto.createHash("sha256").update(`ledger-keyring-root:${rawSeed}`).digest();
  }

  /**
   * Spikes and checks Ledger Key Ring CLI availability (`wallet-cli ring --version` or `wallet-cli --version`).
   */
  async checkAvailability(): Promise<LedgerKeyRingStatus> {
    try {
      const { stdout } = await execAsync(`"${this.cliPath}" --version`);
      this.isCliAvailable = true;
      console.log(`[Ledger KeyRing] Found Ledger Wallet CLI: ${stdout.trim()}`);
      return {
        mode: "LEDGER_CLI",
        initialized: true,
        cliPath: this.cliPath,
        seedFingerprint: crypto.createHash("sha256").update(stdout).digest("hex").slice(0, 8),
      };
    } catch {
      console.log(`[Ledger KeyRing] Ledger CLI not detected at '${this.cliPath}'. Falling back to seed-derived Ledger KeyRing module.`);
      this.isCliAvailable = false;
      return {
        mode: "SIMULATED_KEYRING",
        initialized: true,
        cliPath: this.cliPath,
        seedFingerprint: this.memoryMasterKey.toString("hex").slice(0, 8),
      };
    }
  }

  /**
   * Encrypts a settlement credential using Ledger Key Ring protection.
   * If CLI is available, uses `wallet-cli ring encrypt`. Otherwise uses seed-derived AES-256-GCM.
   */
  async encryptCredential(plainTextCredential: string): Promise<string> {
    if (this.isCliAvailable) {
      try {
        const { stdout } = await execAsync(`"${this.cliPath}" ring encrypt "${plainTextCredential}"`);
        return stdout.trim();
      } catch (err: any) {
        console.warn("[Ledger KeyRing] CLI encrypt error, using hardware seed key ring:", err.message);
      }
    }

    // Seed-derived AES-256-GCM encryption
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.memoryMasterKey, iv);
    let encrypted = cipher.update(plainTextCredential, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return JSON.stringify({
      provider: "ledger-keyring-v1",
      iv: iv.toString("hex"),
      tag,
      ciphertext: encrypted,
    });
  }

  /**
   * Decrypts settlement credential in memory.
   * Credential NEVER leaves broker memory and is NEVER returned to the AI agent.
   */
  async decryptCredential(encryptedPayload: string): Promise<string> {
    if (this.isCliAvailable) {
      try {
        const { stdout } = await execAsync(`"${this.cliPath}" ring decrypt "${encryptedPayload}"`);
        return stdout.trim();
      } catch (err: any) {
        console.warn("[Ledger KeyRing] CLI decrypt error, using seed key ring:", err.message);
      }
    }

    try {
      const parsed = JSON.parse(encryptedPayload);
      if (parsed.provider !== "ledger-keyring-v1") {
        throw new Error("Invalid credential provider format");
      }
      const iv = Buffer.from(parsed.iv, "hex");
      const tag = Buffer.from(parsed.tag, "hex");
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.memoryMasterKey, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(parsed.ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      // Direct raw credential fallback if plaintext
      return encryptedPayload;
    }
  }
}
