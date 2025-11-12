
import express from "express";
import bodyParser from "body-parser";
import { kafkaClient, producerFor, consumerFor, jsonEvent } from "./util.js";

const app = express();
app.use(bodyParser.json());

const orders = new Map(); // in-memory order states
const kafka = kafkaClient();
const producer = await producerFor(kafka);
const consumer = await consumerFor(kafka, "order-service-group");

const ORDERS_TOPIC = "orders";
const INVENTORY_TOPIC = "inventory";
const PAYMENTS_TOPIC = "payments";
const SHIPPING_TOPIC = "shipping";

// Start consuming terminal events to update status
await consumer.subscribe({ topic: ORDERS_TOPIC, fromBeginning: true });
await consumer.run({
  eachMessage: async ({ message }) => {
    try {
      const evt = JSON.parse(message.value.toString());
      if (!evt || !evt.type) return;
      const id = evt.orderId;
      if (evt.type === "OrderCompleted") {
        orders.set(id, { ...(orders.get(id) || {}), status: "COMPLETED", history: [...(orders.get(id)?.history||[]), evt] });
        console.log("[order-service] OrderCompleted", id);
      } else if (evt.type === "OrderCancelled") {
        orders.set(id, { ...(orders.get(id) || {}), status: "CANCELLED", reason: evt.payload?.reason, history: [...(orders.get(id)?.history||[]), evt] });
        console.log("[order-service] OrderCancelled", id, evt.payload?.reason);
      }
    } catch (e) { console.error("order-service consume error", e); }
  }
});

// Create order (saga start)
app.post("/orders", async (req, res) => {
  const { orderId, userId, items, amount } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId is required" });
  const order = { orderId, userId, items, amount, status: "PENDING", history: [] };
  orders.set(orderId, order);

  const evt = jsonEvent("OrderCreated", orderId, { userId, items, amount });
  await producer.send({ topic: ORDERS_TOPIC, messages: [{ key: orderId, value: JSON.stringify(evt) }] });
  order.history.push(evt);

  res.json({ ok: true, orderId });
});

app.get("/orders/:id", (req, res) => {
  const o = orders.get(req.params.id);
  if (!o) return res.status(404).json({ error: "not found" });
  res.json(o);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`order-service listening on ${port}`));
