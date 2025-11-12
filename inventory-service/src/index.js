
import { kafkaClient, producerFor, consumerFor, jsonEvent } from "./util.js";

const kafka = kafkaClient();
const producer = await producerFor(kafka);
const consumer = await consumerFor(kafka, "inventory-service-group");

const ORDERS_TOPIC = "orders";
const INVENTORY_TOPIC = "inventory";

// Fake stock DB
const stock = new Map([["sku-1", 10], ["sku-2", 0]]);

await consumer.subscribe({ topic: ORDERS_TOPIC, fromBeginning: true });
await consumer.subscribe({ topic: "payments", fromBeginning: true }); // listen for PaymentFailed to compensate

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    try {
      const evt = JSON.parse(message.value.toString());
      if (!evt || !evt.type) return;

      if (evt.type === "OrderCreated") {
        const items = evt.payload?.items || [];
        const ok = items.every(i => (stock.get(i.sku) || 0) >= i.qty);
        if (ok) {
          // reserve stock
          items.forEach(i => stock.set(i.sku, (stock.get(i.sku)||0) - i.qty));
          const reserved = jsonEvent("InventoryReserved", evt.orderId, { items });
          await producer.send({ topic: INVENTORY_TOPIC, messages: [{ key: evt.orderId, value: JSON.stringify(reserved) }] });
          console.log("[inventory] reserved", evt.orderId);
        } else {
          const failed = jsonEvent("InventoryFailed", evt.orderId, { reason: "OUT_OF_STOCK" });
          await producer.send({ topic: INVENTORY_TOPIC, messages: [{ key: evt.orderId, value: JSON.stringify(failed) }] });
          const cancelled = jsonEvent("OrderCancelled", evt.orderId, { reason: "OUT_OF_STOCK" });
          await producer.send({ topic: "orders", messages: [{ key: evt.orderId, value: JSON.stringify(cancelled) }] });
          console.log("[inventory] failed for", evt.orderId);
        }
      }

      if (evt.type === "PaymentFailed") {
        // release previous reservation
        const items = evt.payload?.items || [];
        items.forEach(i => stock.set(i.sku, (stock.get(i.sku)||0) + i.qty));
        const released = jsonEvent("InventoryReleased", evt.orderId, { items });
        await producer.send({ topic: INVENTORY_TOPIC, messages: [{ key: evt.orderId, value: JSON.stringify(released) }] });
        const cancelled = jsonEvent("OrderCancelled", evt.orderId, { reason: "PAYMENT_FAILED" });
        await producer.send({ topic: "orders", messages: [{ key: evt.orderId, value: JSON.stringify(cancelled) }] });
        console.log("[inventory] released due to payment failure", evt.orderId);
      }

    } catch (e) { console.error("inventory consume error", e); }
  }
});
