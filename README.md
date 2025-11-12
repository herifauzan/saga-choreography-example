# ⚙️ The Saga: Event Flow & Decision Logic

Your setup models an Order Processing Saga — when you create an order, four microservices communicate asynchronously using Kafka topics:

| Service                   | Event Consumed                       | Event Produced                           | Purpose               |
| ------------------------- | ------------------------------------ | ---------------------------------------- | --------------------- |
| **order-service**         | N/A (starts the saga)                | `OrderCreated`                           | Starts a new order    |
| **inventory-service**     | `OrderCreated`                       | `InventoryReserved` or `InventoryFailed` | Checks stock          |
| **payment-service**       | `InventoryReserved`                  | `PaymentCompleted` or `PaymentFailed`    | Processes payment     |
| **shipping-service**      | `PaymentCompleted`                   | `ShippingScheduled` + `OrderCompleted`   | Ships order           |
| *(optional compensation)* | `InventoryFailed` or `PaymentFailed` | `OrderCancelled`                         | Marks order as failed |


# Sequence Diagram
## 🧩 Saga Choreography — Event Sequence (Success Flow)

This diagram shows how the **Order**, **Inventory**, **Payment**, and **Shipping** services
coordinate using **Kafka topics** in a Saga **Choreography pattern** — without a central orchestrator.

Each service listens for specific events and publishes its own events to continue the workflow.

+-------------+ +----------------+ +----------------+ +----------------+
| Order Svc | | Inventory Svc | | Payment Svc | | Shipping Svc |
+-------------+ +----------------+ +----------------+ +----------------+
| | | |
| OrderCreated -------->| | |
| | check stock | |
| | InventoryReserved ---->| |
| | | process payment |
| | | PaymentCompleted ----->|
| | | | schedule shipping
| | | | ShippingScheduled
| | | | OrderCompleted ---+
|<----------------------+<----------------------+<----------------------+ |
| update status = COMPLETED (success)
