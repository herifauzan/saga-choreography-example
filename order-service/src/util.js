
import { Kafka } from "kafkajs";

export function kafkaClient() {
  const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
  return new Kafka({ clientId: process.env.CLIENT_ID || "demo-"+Math.random().toString(16).slice(2), brokers });
}

export function jsonEvent(type, orderId, payload={}){
  return { type, orderId, payload, timestamp: new Date().toISOString() };
}

export async function producerFor(kafka){
  const p = kafka.producer();
  await p.connect();
  return p;
}

export async function consumerFor(kafka, groupId){
  const c = kafka.consumer({ groupId });
  await c.connect();
  return c;
}
