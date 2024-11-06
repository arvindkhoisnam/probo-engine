"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redis = void 0;
const redis_1 = require("redis");
class Redis {
    constructor() {
        this.publisher = (0, redis_1.createClient)();
        this.client = (0, redis_1.createClient)();
        this.publisher.connect();
        this.client.connect();
        console.log("Redis connected on engine.");
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new Redis();
        }
        return this.instance;
    }
    sendToApi(clientId, message) {
        this.client.publish(clientId, JSON.stringify(message));
    }
    publishToPubSub(channel, payload) {
        this.publisher.publish(channel, payload);
    }
}
exports.Redis = Redis;
