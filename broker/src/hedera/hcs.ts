// @ts-ignore
import { Client, TopicMessageSubmitTransaction, TopicId, PrivateKey, AccountId } from "@hashgraph/sdk";

export interface HCSAuditEvent {
  type: "CAPABILITY_ISSUED" | "CAPABILITY_SPENT" | "CAPABILITY_REJECTED" | "CAPABILITY_REVOKED";
  capId: string;
  service?: string;
  amount?: number;
  budgetRemaining?: number;
  reason?: string;
  policyHash?: string;
  timestamp: string;
  txHash?: string;
}

export class HederaHCSLogger {
  private client: any = null;
  private topicId: string;
  private inMemoryAuditFeed: HCSAuditEvent[] = [];

  constructor() {
    this.topicId = process.env.HEDERA_HCS_TOPIC_ID || "0.0.654321";
    this.initClient();
  }

  private initClient() {
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (operatorId && operatorKey && operatorId !== "0.0.123456") {
      try {
        this.client = Client.forTestnet();
        this.client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringECDSA(operatorKey));
        console.log(`[Hedera HCS] Initialized Hedera SDK Client for operator ${operatorId}`);
      } catch (err: any) {
        console.warn(`[Hedera HCS] Could not initialize Hedera SDK client: ${err.message}. Using mirror audit feed.`);
        this.client = null;
      }
    } else {
      console.log(`[Hedera HCS] Operator keys not set. Audit logger operating in mirror feed mode.`);
    }
  }

  /**
   * Submits a tamper-evident audit event to the Hedera Consensus Service (HCS) topic.
   */
  async logAuditEvent(event: HCSAuditEvent): Promise<{ success: boolean; sequenceNumber?: number; message: string }> {
    // Add to internal mirror feed for instant local timeline querying
    this.inMemoryAuditFeed.unshift(event);

    if (!this.client || !this.topicId || this.topicId === "0.0.654321") {
      console.log(`[HCS Audit Log] [${event.type}] capId=${event.capId.slice(0, 10)}... amount=${event.amount ?? 0} (Saved to feed)`);
      return {
        success: true,
        message: "Logged to in-memory Hedera audit feed (Local mode)",
      };
    }

    try {
      const messageBytes = Buffer.from(JSON.stringify(event));
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(this.topicId))
        .setMessage(messageBytes);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      console.log(`[Hedera HCS Topic ${this.topicId}] Audit event written. Seq #${receipt.topicSequenceNumber.toString()}`);
      return {
        success: true,
        sequenceNumber: receipt.topicSequenceNumber.toNumber(),
        message: `HCS message submitted to topic ${this.topicId}`,
      };
    } catch (err: any) {
      console.error("[Hedera HCS] Error submitting message to HCS topic:", err.message);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  /**
   * Retrieves the audit log timeline for frontend rendering (merges Hedera Mirror Node messages & local feed).
   */
  async getAuditLog(topicId?: string): Promise<HCSAuditEvent[]> {
    const targetTopic = topicId || this.topicId;

    if (targetTopic && targetTopic !== "0.0.654321") {
      try {
        const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${targetTopic}/messages?order=desc&limit=25`;
        const res = await fetch(mirrorUrl);
        if (res.ok) {
          const data = (await res.json()) as any;
          const remoteEvents: HCSAuditEvent[] = data.messages
            .map((msg: any) => {
              try {
                const decoded = Buffer.from(msg.message, "base64").toString("utf-8");
                return JSON.parse(decoded);
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          if (remoteEvents.length > 0) {
            return remoteEvents;
          }
        }
      } catch (err: any) {
        console.warn("[Hedera HCS] Mirror node fetch notice:", err.message);
      }
    }

    return this.inMemoryAuditFeed;
  }
}
