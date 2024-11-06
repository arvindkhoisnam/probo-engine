import { Engine } from "./engine";
import { createClient } from "redis";

async function init() {
  const client = createClient();
  await client.connect();
  console.log("Redis Connected");
  while (true) {
    const message = await client.rPop("messages");
    if (message) {
      const parsedMessage = JSON.parse(message);
      Engine.getInstance().process(parsedMessage);
    }
  }
}

init();
