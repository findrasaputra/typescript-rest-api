import { Consumer, ConsumerSubscribeTopics, EachBatchPayload, Kafka } from "kafkajs";
import { cacheTask, invalidateTask } from "~libs/redis";
import { TASK_EVENTS_TOPIC } from "./kafka_producer";

const host = process.env.KAFKA_HOST ?? "localhost";

/**
 * Consumes task-events from Kafka and keeps the Redis cache in sync.
 *
 * Event shape: { type: "task.created" | "task.updated" | "task.deleted", payload: Task }
 */
export default class KafkaConsumer {
  private consumer: Consumer;

  constructor() {
    this.consumer = this.createConsumer();
  }

  public async startConsumer(): Promise<void> {
    const topics: ConsumerSubscribeTopics = {
      topics: [TASK_EVENTS_TOPIC],
      fromBeginning: false,
    };

    await this.connectWithRetry(async () => {
      await this.consumer.subscribe(topics);
      await this.consumer.run({
        eachBatch: async (payload: EachBatchPayload) => {
          const { batch } = payload;
          const records = batch.messages
            .map((msg) => {
              if (!msg.value) return null;
              return JSON.parse(msg.value.toString()) as {
                type: string;
                payload: Record<string, unknown>;
              };
            })
            .filter(Boolean) as { type: string; payload: Record<string, unknown> }[];

          await this.processBatch(records);
        },
      });
    });
  }

  private async processBatch(
    records: { type: string; payload: Record<string, unknown> }[]
  ): Promise<void> {
    await Promise.all(
      records.map(async ({ type, payload }) => {
        switch (type) {
          case "task.created":
          case "task.updated":
            await cacheTask(payload as Parameters<typeof cacheTask>[0]);
            console.log(`[Kafka] ${type}`, payload["id"]);
            break;
          case "task.deleted":
            await invalidateTask(payload["id"] as string);
            console.log("[Kafka] task.deleted", payload["id"]);
            break;
          default:
            console.warn("[Kafka] Unknown event type:", type);
        }
      })
    );
  }

  public async shutdown(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async connectWithRetry(
    action: () => Promise<void>,
    maxRetries = 10,
    baseDelay = 1000
  ): Promise<void> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        console.log(`Connecting to Kafka (attempt ${retries + 1}/${maxRetries})...`);
        await this.consumer.connect();
        console.log("Kafka consumer connected");
        await action();
        return;
      } catch (error: unknown) {
        retries++;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Kafka connection failed: ${message}`);
        const delay = Math.min(baseDelay * 2 ** retries, 60000);
        console.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Failed to connect to Kafka after maximum retries");
  }

  private createConsumer(): Consumer {
    const kafka = new Kafka({
      clientId: "rest-api-consumer",
      brokers: [`${host}:9092`, `${host}:9093`, `${host}:9094`],
    });
    return kafka.consumer({ groupId: "rest-api-consumer-group" });
  }
}
