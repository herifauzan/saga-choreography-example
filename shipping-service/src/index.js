
import { kafkaClient, producerFor, consumerFor, jsonEvent } from "./util.js";

const kafka = kafkaClient();
const producer = await producerFor(kafka);
const consumer = await consumerFor(kafka, "shipping-service-group");

await consumer.subscribe({ topic: "payments", fromBeginning: true });

await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      const evt = JSON.parse(message.value.toString());
      if (!evt || !evt.type) return;

      if (evt.type === "PaymentCompleted") {
        const scheduled = jsonEvent("ShippingScheduled", evt.orderId, { carrier: "FAKE-EXPRESS" });
        await producer.send({ topic: "shipping", messages: [{ key: evt.orderId, value: JSON.stringify(scheduled) }] });
        const completed = jsonEvent("OrderCompleted", evt.orderId, {});
        await producer.send({ topic: "orders", messages: [{ key: evt.orderId, value: JSON.stringify(completed) }] });
        console.log("[shipping] scheduled + order completed", evt.orderId);
      }
    } catch (e) { console.error("shipping consume error", e); }
  }
});
