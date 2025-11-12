
import { kafkaClient, producerFor, consumerFor, jsonEvent } from "./util.js";

const kafka = kafkaClient();
const producer = await producerFor(kafka);
const consumer = await consumerFor(kafka, "payment-service-group");

await consumer.subscribe({ topic: "inventory", fromBeginning: true });

await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      const evt = JSON.parse(message.value.toString());
      if (!evt || !evt.type) return;

      if (evt.type === "InventoryReserved") {
        // Fake payment logic
        const shouldFail = (evt.orderId || "").includes("fail");
        if (!shouldFail) {
          const paid = jsonEvent("PaymentCompleted", evt.orderId, { amount: evt.payload?.amount });
          await producer.send({ topic: "payments", messages: [{ key: evt.orderId, value: JSON.stringify(paid) }] });
          console.log("[payment] completed", evt.orderId);
        } else {
          const failed = jsonEvent("PaymentFailed", evt.orderId, { reason: "CARD_DECLINED", items: evt.payload?.items });
          await producer.send({ topic: "payments", messages: [{ key: evt.orderId, value: JSON.stringify(failed) }] });
          console.log("[payment] failed", evt.orderId);
        }
      }
    } catch (e) { console.error("payment consume error", e); }
  }
});
