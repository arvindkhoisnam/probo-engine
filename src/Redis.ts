import { createClient, RedisClientType } from "redis";

export class Redis {
  private publisher: RedisClientType;
  private client: RedisClientType;
  private static instance: Redis;

  constructor() {
    this.publisher = createClient();
    this.client = createClient();
    this.publisher.connect();
    this.client.connect();
    console.log("Redis connected on engine.");
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new Redis();
    }
    return this.instance;
  }
  public sendToApi(clientId: string, message: any) {
    this.client.publish(clientId, JSON.stringify(message));
  }
  public publishToPubSub(channel: string, payload: any) {
    this.publisher.publish(channel, payload);
  }
}
