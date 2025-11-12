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
+-------------+       +----------------+       +----------------+       +----------------+
| Order Svc   |       | Inventory Svc  |       | Payment Svc    |       | Shipping Svc   |
+-------------+       +----------------+       +----------------+       +----------------+
       |                       |                       |                       |
       | OrderCreated -------->|                       |                       |
       |                       | check stock           |                       |
       |                       | InventoryReserved ---->|                       |
       |                       |                       | process payment        |
       |                       |                       | PaymentCompleted ----->|
       |                       |                       |                       | schedule shipping
       |                       |                       |                       | ShippingScheduled
       |                       |                       |                       | OrderCompleted ---+
       |<----------------------+<----------------------+<----------------------+                   |
       | update status = COMPLETED                                                           (success)
