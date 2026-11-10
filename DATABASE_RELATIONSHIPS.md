# NSYU Business — Database Relationships & Schema Architecture

**Workflow Foundation:** Cart → Order → Bill → Customer Ledger → Inventory Update  
**Engine:** PostgreSQL (Supabase)  

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    OWNERS ||--o{ SHOPS : "owns"
    OWNERS ||--o{ CUSTOMERS : "manages"
    OWNERS ||--o{ PRODUCTS : "owns"
    SHOPS ||--o{ ORDERS : "fulfills"
    SHOPS ||--o{ BILLS : "issues"
    SHOPS ||--o{ PRODUCT_STOCKS : "stocks"
    SHOPS ||--o{ CUSTOMER_LEDGER : "tracks"
    SHOPS ||--o{ PAYMENTS : "receives"

    CUSTOMERS ||--o{ ORDERS : "places"
    CUSTOMERS ||--o{ BILLS : "billed_to"
    CUSTOMERS ||--o{ CUSTOMER_LEDGER : "has_balance"
    CUSTOMERS ||--o{ PAYMENTS : "pays"

    ORDERS ||--|{ ORDER_ITEMS : "contains"
    ORDERS ||--o| BILLS : "converts_to"

    BILLS ||--|{ BILL_ITEMS : "contains"
    BILLS ||--o{ PAYMENTS : "settled_by"
    BILLS ||--o{ CUSTOMER_LEDGER : "creates_debit"

    PRODUCTS ||--o{ ORDER_ITEMS : "ordered"
    PRODUCTS ||--o{ BILL_ITEMS : "billed"
    PRODUCTS ||--o{ PRODUCT_STOCKS : "tracked_in"
    PRODUCTS ||--o{ INVENTORY_TRANSACTIONS : "movement_of"

    CATEGORIES ||--o{ PRODUCTS : "classifies"
    CATEGORIES ||--o{ CATEGORIES : "parent_category"

    CUSTOMERS {
        bigint id PK
        int owner_id FK
        varchar name
        varchar phone
        varchar email
        numeric current_balance
        varchar status
        timestamp created_at
    }

    CUSTOMER_LEDGER {
        bigint id PK
        int customer_id FK
        int shop_id FK
        varchar entry_type "debit | credit"
        numeric amount
        numeric running_balance
        varchar reference_type "bill | payment | adjustment"
        bigint reference_id
        text description
        timestamp transaction_date
    }

    ORDERS {
        bigint id PK
        int shop_id FK
        int customer_id FK
        varchar order_number UK
        varchar status "pending | confirmed | processing | completed | cancelled"
        numeric total_amount
        numeric discount_amount
        numeric tax_amount
        text notes
        timestamp created_at
    }

    ORDER_ITEMS {
        bigint id PK
        bigint order_id FK
        int product_id FK
        varchar product_name
        varchar sku
        int quantity
        numeric unit_price
        numeric total_price
    }

    BILLS {
        bigint id PK
        int shop_id FK
        int customer_id FK
        bigint order_id FK "nullable"
        varchar invoice_number UK
        date invoice_date
        numeric subtotal
        numeric discount_amount
        numeric tax_amount
        numeric total_amount
        numeric paid_amount
        numeric due_amount
        varchar payment_method "cash | upi | card | bank_transfer"
        varchar status "unpaid | partial | paid | cancelled"
        text notes
        timestamp created_at
    }

    BILL_ITEMS {
        bigint id PK
        bigint bill_id FK
        int product_id FK
        varchar product_name
        varchar sku
        int quantity
        numeric rate
        numeric discount_amount
        numeric tax_amount
        numeric total_amount
    }

    PRODUCTS {
        bigint id PK
        int owner_id FK
        int category_id FK
        varchar sku UK
        varchar name
        varchar barcode
        numeric purchase_price
        numeric margin_price
        numeric selling_price
        numeric gst_rate
        int min_stock
        varchar status
    }

    INVENTORY_TRANSACTIONS {
        bigint id PK
        int shop_id FK
        int product_id FK
        varchar transaction_type "stock_in | stock_out | sale | adjustment"
        int quantity
        int previous_stock
        int new_stock
        varchar reference_type "bill | order | adjustment"
        bigint reference_id
        text notes
        timestamp created_at
    }

    PAYMENTS {
        bigint id PK
        int shop_id FK
        int customer_id FK
        bigint bill_id FK "nullable"
        numeric amount
        varchar payment_method
        varchar payment_reference
        timestamp payment_date
    }

    PRODUCT_STOCKS {
        bigint id PK
        int shop_id FK
        int product_id FK
        int current_stock
        int min_stock
    }
```

---

## 2. Business Workflow Specifications

### Step 1: Cart (Client Application)
- **Origin:** Real-time state maintained in Web and Flutter clients.
- **Product Retrieval:** Fetches authoritative product pricing, margin, and stock rules directly from `products` and `product_stocks`.
- **Validation:** Ensures `quantity >= 1`, prevents non-numeric/negative quantities, and validates against `product_stocks.current_stock`.
- **Live Calculation:** Dynamically computes:
  $$\text{Subtotal} = \sum (\text{rate} \times \text{quantity})$$
  $$\text{Grand Total} = \text{Subtotal} - \text{Discount} + \text{Tax}$$

### Step 2: Order (`orders` & `order_items`)
- When user places an order, an atomic transaction inserts:
  1. Header record in `orders` with sequential `order_number` (e.g. `ORD-000001`).
  2. Individual item rows in `order_items`.
- Status lifecycle: `pending` $\rightarrow$ `confirmed` $\rightarrow$ `processing` $\rightarrow$ `completed` / `cancelled`.

### Step 3: Bill (`bills` & `bill_items`)
- Created either directly from Cart ("Create Bill") or converted from a confirmed Order.
- Assigns sequential unique `invoice_number` from `invoice_counters` (e.g. `INV-NSYU-000001`).
- Records item snapshots in `bill_items`.
- Sets initial financial state:
  - If Credit / Udhaar: `paid_amount = 0.0`, `due_amount = total_amount`, `status = 'unpaid'`.
  - If Partial: `paid_amount = X`, `due_amount = total_amount - X`, `status = 'partial'`.
  - If Full Payment: `paid_amount = total_amount`, `due_amount = 0.0`, `status = 'paid'`.

### Step 4: Customer Ledger (`customer_ledger`)
- **Debit Entry (Bill Generated):**
  - Appends row in `customer_ledger`:
    $$\text{entry\_type} = \text{'debit'}, \quad \text{amount} = \text{total\_amount}$$
    $$\text{running\_balance} = \text{previous\_balance} + \text{total\_amount}$$
- **Credit Entry (Payment Received):**
  - When payment is made:
    $$\text{entry\_type} = \text{'credit'}, \quad \text{amount} = \text{paid\_amount}$$
    $$\text{running\_balance} = \text{previous\_balance} - \text{paid\_amount}$$
- Updates `customers.current_balance` synchronously.

### Step 5: Inventory Update (`inventory_transactions` & `product_stocks`)
- For every item on confirmed bill:
  1. Decrements `product_stocks.current_stock`:
     $$\text{current\_stock}_{\text{new}} = \text{current\_stock}_{\text{old}} - \text{quantity}$$
  2. Appends immutable audit entry in `inventory_transactions`:
     $$\text{transaction\_type} = \text{'sale'}, \quad \text{quantity} = -\text{quantity}$$
- Triggers operational low-stock notification if $\text{current\_stock} \le \text{min\_stock}$.
