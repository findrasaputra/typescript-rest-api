import { Kafka, Message, Producer, ProducerBatch, TopicMessages } from "kafkajs";

const host = process.env.KAFKA_HOST ?? "localhost";

export const TASK_EVENTS_TOPIC = "task-events";

export default class KafkaProducer {
  private producer: Producer;

  constructor() {
    this.producer = this.createProducer();
  }

  public async start(): Promise<void> {
    try {
      await this.producer.connect();
      console.log("Kafka producer connected");
    } catch (error) {
      console.error("Error connecting Kafka producer:", error);
    }
  }

  public async shutdown(): Promise<void> {
    await this.producer.disconnect();
  }

  /**
   * Publish a batch of domain events to the task-events topic.
   */
  public async sendBatch(events: Array<Record<string, unknown>>): Promise<void> {
    const kafkaMessages: Array<Message> = events.map((event) => ({
      value: JSON.stringify(event),
    }));

    const topicMessages: TopicMessages = {
      topic: TASK_EVENTS_TOPIC,
      messages: kafkaMessages,
    };

    const batch: ProducerBatch = { topicMessages: [topicMessages] };

    await this.producer.sendBatch(batch);
  }

  /**
   * Publish a single domain event.
   */
  public async send(event: Record<string, unknown>): Promise<void> {
    await this.sendBatch([event]);
  }

  private createProducer(): Producer {
    const kafka = new Kafka({
      clientId: "rest-api-producer",
      brokers: [`${host}:9092`, `${host}:9093`, `${host}:9094`],
      retry: { initialRetryTime: 100, retries: 3 },
    });
    return kafka.producer();
  }
}
