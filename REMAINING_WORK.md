# NSYU System — Production Status & Remaining Work Tracker

**Production web:** https://nsyumnt-rgb.github.io/nsyu/  
**Backend API:** `https://nsyu-backend-api.onrender.com/api`  
**Credentials:** never stored in this file. Ask the platform owner; rotate anything that was ever committed (see Security below).  
**Mobile Release APK (v1.0.9+11):** https://nsyumnt-rgb.github.io/nsyu/downloads/nsyu-business-release.apk  

# NSYU
# MULTI-OWNER, MULTI-SHOP B2B + B2C COMMERCE PLATFORM

**Complete Business Requirements Document (BRD)**

| Document Information | Details |
|---|---|
| Project Name | NSYU |
| Product Type | Multi-Tenant Business & Commerce Platform |
| Business Model | B2B + B2C |
| Business Structure | Multi-Owner, Multi-Shop |
| Supply Chain | Wholesaler, Distributor, Retailer |
| Financial Model | Cash, Partial Payment, Credit / Udhaar |
| Platforms | Website + Android Mobile App |
| Backend | Node.js, Express, TypeScript |
| Frontend Website | React, TypeScript, Vite |
| Mobile Application | Flutter |
| Database | Existing configured relational database |
| API | Shared REST API |
| Authentication | Existing authentication system with role-based access |
| Document Status | Requirements Draft |

---

# 1. EXECUTIVE SUMMARY

NSYU ek digital business commerce platform hoga jahan multiple independent business owners apne multiple shops register aur manage kar sakenge.

Platform ka main purpose wholesalers, distributors, retailers, shopkeepers aur normal customers ko ek common digital business network par connect karna hai.

Har registered shop apne business ke according:

- Products list kar sakegi.
- Online store chala sakegi.
- Normal customers ko products sell kar sakegi.
- Doosre shopkeepers ko wholesale products sell kar sakegi.
- Doosre wholesalers se products purchase kar sakegi.
- Multiple suppliers aur buyers ke saath business kar sakegi.
- Credit / Udhaar par transactions kar sakegi.
- Apna customer ledger maintain kar sakegi.
- Apna supplier / shopkeeper ledger maintain kar sakegi.
- Orders, purchases, sales, bills aur payments manage kar sakegi.

NSYU sirf ek normal e-commerce website nahi hoga.

It will be a connected business network where every participating shop can independently operate as a wholesaler, distributor, retailer, buyer, seller or a combination of these.

**Core Vision:**

One Platform. Multiple Owners. Multiple Shops. Multiple Wholesalers. Connected Businesses. B2B + B2C Commerce. Digital Udhaar.

# 2. BUSINESS OBJECTIVES

1. Traditional offline businesses ko online lana.
2. Multiple wholesalers ko ek platform par connect karna.
3. Retailers ko multiple suppliers se products purchase karne ki facility dena.
4. Shop-to-shop B2B transactions support karna.
5. Normal customers ko multiple shops se shopping ki facility dena.
6. Digital Udhaar / Khata system provide karna.
7. Buyer aur seller ke financial records maintain karna.
8. Multiple shops ke customers aur suppliers manage karna.
9. Website aur mobile application ko synchronize rakhna.
10. Business owners ko complete digital business management provide karna.

# 3. BUSINESS ECOSYSTEM

## 3.1 Participants

Platform par ye participants honge:

1. Platform Super Admin
2. Business Owner
3. Wholesaler
4. Distributor
5. Retailer
6. Shopkeeper
7. Shop Manager
8. Shop Staff
9. B2C Customer
10. B2B Buyer Shop

Important: Wholesaler, Distributor aur Retailer business types hain. Ye mutually exclusive roles nahi hain.

Ek shop wholesaler bhi ho sakti hai aur doosri shop se products purchase karne wali buyer bhi.

## 3.2 Business Network Example

Example:

- Owner A operates Wholesaler A.
- Owner B operates Wholesaler B.
- Owner C operates Distributor C.
- Owner D operates Retail Shop D.
- Owner E operates Retail Shop E.

Transactions:

- Wholesaler A → Distributor C
- Wholesaler B → Distributor C
- Distributor C → Retail Shop D
- Wholesaler A → Retail Shop E
- Retail Shop D → Customer Rahul
- Retail Shop E → Customer Rahul

Har transaction independent hoga aur correct buyer/seller accounts maintain karega.

# 4. MULTI-OWNER MANAGEMENT

Platform multiple independent business owners support karega.

Har owner:

- Account create karega.
- Apni multiple shops register karega.
- Shop information manage karega.
- Employees add karega.
- Roles aur permissions assign karega.
- Products manage karega.
- Inventory maintain karega.
- B2B/B2C sales karega.
- Purchase aur supplier relationships manage karega.
- Financial reports dekhega.

## 4.1 Owner Data Isolation

Owner A ko Owner B ka private data access nahi hona chahiye.

Har record proper owner/shop relationship ke saath stored hona chahiye.

## 4.2 Multiple Shops

Example:

Owner A:

- Wholesale Electronics.
- Mobile Accessories.
- Retail Electronics.

Owner B:

- Electronics Wholesale.
- Computer Accessories.
- Retail Store.

Har shop ka inventory, sales, purchase, ledger aur financial history independent rahega.

Owner ko authorized consolidated reports mil sakti hain.

# 5. MULTIPLE WHOLESALERS AND SUPPLY CHAIN

NSYU unlimited independent wholesalers aur distributors support karega, subject to platform capacity and policies.

## 5.1 Wholesaler Requirements

Har wholesaler:

- Apni shop register karega.
- Multiple products list karega.
- Wholesale prices configure karega.
- Product availability maintain karega.
- Retailers ko sell karega.
- Distributors ko sell karega.
- Doosre wholesalers se purchase kar sakega.
- Credit terms configure kar sakega.
- Buyer-wise outstanding manage karega.
- Purchase aur sales reports dekhega.

## 5.2 Multiple Wholesalers

Example:

| Wholesaler | Product | Wholesale Price |
|---|---|---:|
| A | Mobile Charger | ₹100 |
| B | Mobile Charger | ₹95 |
| C | Mobile Charger | ₹105 |
| D | Mobile Charger | ₹98 |

Same product different wholesalers different prices par sell kar sakte hain.

Prices shop-specific honge.

## 5.3 Distributor Requirements

Distributor:

- Multiple wholesalers se purchase karega.
- Multiple retailers ko supply karega.
- Inventory maintain karega.
- Purchase aur sales manage karega.
- Credit transactions karega.
- Buyer/supplier ledger maintain karega.

## 5.4 Retailer Requirements

Retailer:

- Multiple wholesalers se products purchase karega.
- Distributors se products purchase karega.
- Products normal customers ko sell karega.
- Apna online store operate karega.
- Customer ledger maintain karega.
- Supplier ledger maintain karega.

# 6. BUSINESS RELATIONSHIP MANAGEMENT

Har shop doosri shops ke saath business relationship establish kar sakti hai.

Relationship information:

- Seller Shop.
- Buyer Shop.
- Relationship Type.
- Relationship Status.
- Credit Permission.
- Credit Limit.
- Payment Terms.
- Outstanding.
- Total Purchase.
- Total Sales.
- Last Transaction.

Ek shop multiple sellers aur multiple buyers ke saath connected ho sakti hai.

Relationship approval, blocking aur credit rules seller ke authorized users control karenge.

# 7. B2B — BUSINESS TO BUSINESS

## 7.1 B2B Marketplace

Registered shopkeepers doosri shops ke products browse kar sakenge.

Features:

- Search wholesalers.
- Search distributors.
- Search retailers.
- Browse shop catalogs.
- Product categories.
- Product search.
- Price comparison.
- Stock availability.
- B2B pricing.
- Minimum order quantity where configured.
- Add to cart.
- Place purchase order.

B2B catalog access seller-defined visibility and buyer authorization ke according hoga.

## 7.2 B2B Order Workflow

1. Buyer Shop login karegi.
2. Seller Shop select karegi.
3. Seller catalog open karegi.
4. Products select karegi.
5. Quantity enter karegi.
6. Price verify karegi.
7. Cart review karegi.
8. Payment terms select karegi, where authorized.
9. Purchase order place karegi.
10. Seller ko notification milegi.
11. Seller order accept/reject karega.
12. Seller order process karega.
13. Invoice generate hoga.
14. Goods handover/delivery status update hoga where supported.
15. Payment receive hogi.
16. Buyer/seller ledgers update honge.

## 7.3 B2B Pricing

Product pricing types:

- Purchase Price.
- Wholesale Price.
- Distributor Price.
- Retailer Price.
- B2C Selling Price.
- Buyer-specific negotiated price where supported.

Pricing seller/shop-specific hogi.

Unauthorized users purchase price aur profit nahi dekh sakenge.

# 8. B2C — BUSINESS TO CUSTOMER

Har shop apna online store operate kar sakegi.

## 8.1 Customer Shopping

Customer:

1. Marketplace open karega.
2. Shops browse karega.
3. Shop select karega.
4. Products browse karega.
5. Product details dekhega.
6. Cart mein add karega.
7. Quantity select karega.
8. Checkout karega.
9. Order place karega.
10. Bill receive karega.
11. Payment karega.
12. Order status track karega.
13. Apna ledger dekhega.

## 8.2 Shop Storefront

Har shop ke liye separate storefront:

- Shop Name.
- Logo.
- Banner.
- Shop Description.
- Contact Information.
- Product Catalog.
- Categories.
- Product Search.
- Cart.
- Orders.
- Customer Reviews, if introduced and supported.

Each shop should have its own branding and catalog visibility settings.

# 9. SHARED CUSTOMER IDENTITY

Same customer multiple shops visit kar sakta hai.

Example:

Rahul:

- Shop A se Mobile kharidta hai.
- Shop B se Charger kharidta hai.
- Shop C se Earphones kharidta hai.

Rahul ki verified identity common ho sakti hai, lekin har shop ka customer relationship separate rahega.

## 9.1 Customer Identity

- Customer Name.
- Mobile Number.
- Email.
- Verified Contact.
- Profile Information.

## 9.2 Shop-Wise Customer Account

| Customer | Shop | Outstanding |
|---|---|---:|
| Rahul | Shop A | ₹5,000 |
| Rahul | Shop B | ₹2,000 |
| Rahul | Shop C | ₹0 |

Shop A sirf apna account dekh sakegi.

Shop B sirf apna account dekh sakegi.

Customer ko authenticated access ke through apne authorized shop-wise records dekhne ki facility hogi.

Customer identity automatically merge nahi hogi without proper verification.

# 10. PRODUCT MANAGEMENT

Har shop apne products independently manage karegi.

Product details:

- Product ID.
- Product Name.
- SKU.
- Barcode.
- Category.
- Brand.
- Description.
- Images.
- Purchase Price.
- Wholesale Price.
- Retail Price.
- GST.
- Stock.
- Product Status.

Same product multiple shops list kar sakti hain.

Har shop ka stock aur selling price separate rahega.

Product availability actual inventory se calculate hogi.

# 11. INVENTORY MANAGEMENT

Features:

- Shop-wise inventory.
- Product-wise stock.
- Stock in.
- Stock out.
- Purchase stock.
- Sales stock.
- Return stock.
- Stock adjustments.
- Stock movement history.
- Low-stock alerts.

B2B sale par seller shop ka stock reduce hoga.

B2B purchase receipt par buyer shop ka stock increase hoga according to the confirmed goods-receipt workflow.

B2C sale par selling shop ka stock reduce hoga.

All stock movements must reference the original transaction.

# 12. DIGITAL UDHAR / KHATA SYSTEM

Ye platform ka core financial feature hoga.

Shopkeepers ek doosre ko credit par goods sell aur purchase kar sakenge.

Example:

Shop A sells ₹50,000 goods to Shop B.

Shop B pays ₹20,000.

Remaining balance = ₹30,000.

## 12.1 Seller Ledger

Shop A ke records:

- Invoice Amount: ₹50,000.
- Payment Received: ₹20,000.
- Receivable: ₹30,000.

## 12.2 Buyer Ledger

Shop B ke records:

- Purchase Amount: ₹50,000.
- Payment Made: ₹20,000.
- Payable: ₹30,000.

Both entries must have the same linked transaction reference.

## 12.3 Multiple Transactions

| Transaction | Amount |
|---|---:|
| Purchase 1 | ₹50,000 |
| Purchase 2 | ₹20,000 |
| Payment 1 | ₹25,000 |
| Purchase 3 | ₹10,000 |
| Payment 2 | ₹15,000 |

Outstanding = ₹40,000.

## 12.4 Credit Management

Seller controls:

- Credit permission.
- Buyer credit limit.
- Payment terms.
- Due dates.
- Credit suspension.
- Outstanding reminders.

A buyer cannot exceed the approved credit limit unless the seller authorizes an exception.

# 13. CUSTOMER LEDGER

Every shop maintains its own customer ledger.

Features:

- Customer Profile.
- Previous Balance.
- Bills.
- Payments.
- Credit Entries.
- Debit Entries.
- Running Balance.
- Outstanding.
- Transaction Date.
- Invoice Reference.
- Receipt Reference.

Every transaction must update the ledger through the backend financial service.

# 14. SUPPLIER / SHOP LEDGER

Every shop maintains separate supplier accounts.

A supplier can be:

- Wholesaler.
- Distributor.
- Another retailer.
- Another registered shop.

Features:

- Supplier Information.
- Purchase History.
- Purchase Bills.
- Payments.
- Credit.
- Debit.
- Running Payable.
- Outstanding.
- Returns.
- Payment History.

A shop may simultaneously have receivables from another shop in one relationship and payables to that same shop in another transaction.

These must remain correctly classified.

# 15. ORDER MANAGEMENT

Two major order types:

- B2B Order.
- B2C Order.

Order information:

- Order Number.
- Buyer.
- Seller.
- Order Type.
- Shop.
- Items.
- Quantity.
- Unit Price.
- Tax.
- Discount.
- Total.
- Payment Terms.
- Payment Status.
- Order Status.
- Creation Date.
- Reference.

Status transitions must be validated by backend business rules.

Suggested statuses:

- Pending.
- Accepted.
- Rejected.
- Processing.
- Ready.
- Dispatched.
- Completed.
- Cancelled.

Only statuses applicable to the configured fulfillment workflow should be implemented.

# 16. BILLING AND INVOICING

Separate B2B and B2C invoice presentation.

## B2B Invoice

- Seller Shop.
- Buyer Shop.
- Invoice Number.
- Products.
- Quantity.
- Price.
- Tax.
- Discount.
- Total.
- Payment Received.
- Outstanding.
- Payment Terms.

## B2C Invoice

- Selling Shop.
- Customer.
- Products.
- Quantity.
- Price.
- Tax.
- Discount.
- Total.
- Payment.
- Outstanding.

Original invoices must never be destroyed.

Cancellation and returns require proper reversal entries.

# 17. PAYMENT MANAGEMENT

Support:

- Full Payment.
- Partial Payment.
- Credit.
- Multiple Payments.
- Advance Payment, if supported.
- Outstanding Settlement.
- Purchase Return Adjustment.
- Sales Return Adjustment.

Every payment must be linked to the correct transaction, buyer, seller and shop.

All financial operations must use database transactions.

Duplicate payment submissions must be prevented.

Never hard-delete financial records.

# 18. RETURNS AND CANCELLATIONS

## B2B Returns

1. Buyer requests return.
2. Seller receives notification.
3. Seller reviews request.
4. Seller approves/rejects.
5. Return quantity is validated.
6. Inventory adjustment occurs.
7. Buyer payable is adjusted.
8. Seller receivable is adjusted.
9. Return history is preserved.

## B2C Returns

1. Customer requests return where supported.
2. Shop reviews.
3. Shop approves/rejects.
4. Inventory updates.
5. Customer ledger adjusts.
6. Return history is preserved.

# 19. NOTIFICATION SYSTEM

Notifications must be generated from actual backend events.

## B2B Notifications

- New Purchase Order.
- Order Accepted.
- Order Rejected.
- Order Processing.
- Goods Dispatched.
- Invoice Generated.
- Payment Received.
- Outstanding Reminder.
- Credit Limit Warning.
- Return Approved/Rejected.

## B2C Notifications

- Order Placed.
- Order Confirmed.
- Bill Generated.
- Payment Received.
- Order Status Changed.
- Return Status.
- Outstanding Reminder.

Notification fields:

- Recipient.
- Shop.
- Event.
- Title.
- Description.
- Related Record.
- Read Status.
- Created Date.
- Delivery Status where applicable.

Web and mobile notification status must synchronize.

External delivery must not be marked successful without provider confirmation.

# 20. CUSTOMER DEFAULTER MANAGEMENT

Each shop can see its own customers with outstanding balances.

Display:

- Customer.
- Outstanding Amount.
- Last Payment.
- Last Bill.
- Outstanding Days.
- Number of Unpaid Bills.

Shop-to-shop credit defaulters must also be supported.

Wholesalers can identify retailers with overdue payments.

Reminder actions:

- In-app reminder.
- Email where configured.
- SMS/WhatsApp where integrated and confirmed.

Never expose one seller's private defaulter list to another shop.

# 21. WEBSITE REQUIREMENTS

Separate website interfaces:

1. Public Marketplace.
2. Individual Shop Storefront.
3. B2C Customer Portal.
4. B2B Buyer Portal.
5. Business Owner Dashboard.
6. Employee Dashboard.
7. Platform Super Admin.

## 21.1 Public Marketplace

- Shop discovery.
- Search shops.
- Browse B2C catalogs.
- Product categories.
- Product search.
- Shop details.

## 21.2 B2B Marketplace

- Registered shop discovery.
- Wholesaler discovery.
- Distributor discovery.
- Authorized product catalogs.
- Wholesale prices.
- B2B cart.
- Purchase orders.
- Shop relationships.

## 21.3 Owner Dashboard

- Shop overview.
- B2B sales.
- B2B purchases.
- B2C sales.
- Customers.
- Suppliers.
- Outstanding.
- Inventory.
- Reports.

# 22. MOBILE APPLICATION REQUIREMENTS

Flutter application must support:

- Owner Dashboard.
- Shop Switching.
- B2B Marketplace.
- B2C Marketplace.
- Product Catalog.
- Cart.
- Billing.
- Orders.
- Purchases.
- Customer Ledger.
- Supplier Ledger.
- B2B Ledger.
- Payments.
- Notifications.
- Defaulter Management.
- Inventory.
- Reports.
- Settings.

Website and mobile application must use the same APIs and database.

Transactions on one platform must appear on the other platform.

# 23. PLATFORM SUPER ADMIN

Super Admin manages the platform, not the private day-to-day business of individual shops.

Features:

- Owner Management.
- Shop Registration.
- Shop Activation.
- Shop Suspension.
- Platform Dashboard.
- Platform Usage Statistics.
- User Management.
- Platform Configuration.
- Audit Logs.

Private shop financial records require explicit authorized access.

# 24. USER ROLES AND PERMISSIONS

## Super Admin
Platform management.

## Owner
Full authorized access to owned shops.

## Manager
Authorized shop operations.

## Staff
Restricted operational access.

## B2C Customer
Personal customer account access.

## B2B Buyer
Authorized shop purchasing and payable access.

## B2B Seller
Authorized shop selling and receivable access.

B2B buyer and seller are transaction capabilities, not exclusive global user roles.

# 25. DATABASE AND DOMAIN ARCHITECTURE

First inspect existing NSYU database models.

Do not create duplicate models or tables unnecessarily.

Conceptual entities:

### Identity and Ownership
- Owners.
- Users.
- Shops.
- Shop Memberships.
- Roles.
- Permissions.

### Customer and Business Relationships
- Customers.
- Customer-Shop Relationships.
- Shop-to-Shop Relationships.
- Credit Terms.

### Catalog and Inventory
- Products.
- Categories.
- Shop Products.
- Inventory.
- Inventory Transactions.

### Commerce
- B2B Orders.
- B2C Orders.
- Order Items.
- Purchases.
- Sales.
- Bills.
- Returns.

### Financial Records
- Payments.
- Customer Ledger.
- Supplier Ledger.
- Shop Receivables.
- Shop Payables.
- Credit Notes.
- Audit Entries.

### Communication
- Notifications.
- Notification Events.
- Reminder History.

These are conceptual requirements. Reuse existing models where they already provide the required functionality.

The design must maintain proper relationships, unique transaction references and tenant isolation.

# 26. FINANCIAL ACCOUNTING RULES

1. Buyer and seller ledgers are separate.
2. Every B2B transaction has linked buyer/seller references.
3. Every payment must have an original transaction reference.
4. Partial payments must update outstanding correctly.
5. Returns must reverse the appropriate financial amounts.
6. Cancelled transactions must retain original records.
7. No hard deletion of financial records.
8. Financial operations must use database transactions.
9. Prevent duplicate ledger entries.
10. Running balances must reconcile with ledger entries.
11. Use proper precision for monetary calculations.
12. Currency and tax configuration must be respected.

# 27. SECURITY AND MULTI-TENANT ISOLATION

- Owner sees only owned shops.
- Employee sees only assigned shops.
- Customer sees only authorized personal accounts.
- Seller sees own sales and receivables.
- Buyer sees own purchases and payables.
- One shop cannot access another shop's private customer records.
- Sensitive fields must use existing field-level permission checks.
- Shop IDs must be verified server-side.
- All API operations must validate ownership and relationship permissions.
- All financial changes must be auditable.

# 28. DEVELOPMENT RULES

Mandatory:

- No fake data.
- No dummy business records.
- No Faker.
- No MLT/PTL.
- No hardcoded products.
- No hardcoded shops.
- No hardcoded customers.
- No hardcoded balances.
- No fake notifications.
- No hardcoded dashboard statistics.
- No frontend mock business arrays.
- All business data must come from the actual database through APIs.
- Preserve existing application architecture.
- No unnecessary duplicate APIs/models/controllers.
- No breaking existing functionality.
- No unnecessary dependencies.
- Do not hard-delete financial records.
- Do not trust frontend-only validation.

Test fixtures are permitted only in isolated automated testing environments and must not become production business data.

# 29. CROSS-PLATFORM SYNCHRONIZATION

Test the same operations across website and mobile:

| Operation | Website | Mobile |
|---|---|---|
| Create Shop | Yes | Verify |
| Add Product | Yes | Verify |
| Update Price | Yes | Verify |
| Create B2B Order | Yes | Verify |
| Accept Order | Yes | Verify |
| Create B2C Bill | Yes | Verify |
| Receive Payment | Yes | Verify |
| Update Ledger | Yes | Verify |
| Change Status | Yes | Verify |
| Read Notification | Yes | Verify |
| Purchase Return | Yes | Verify |

Every operation must persist in the shared database.

# 30. END-TO-END ACCEPTANCE TESTS

## Test 1 — Multiple Wholesalers

Create multiple independent wholesalers.

Verify each has separate products, stock, pricing and accounts.

## Test 2 — Multiple Buyers

Multiple retailers purchase from the same wholesaler.

Verify each buyer has independent credit terms and ledger.

## Test 3 — Multiple Suppliers

One retailer purchases from three wholesalers.

Verify three separate payable accounts.

## Test 4 — B2B Credit

Shop A sells ₹50,000 to Shop B.

Shop B pays ₹20,000.

Verify ₹30,000 outstanding on both sides.

## Test 5 — B2C Sale

Customer Rahul purchases from Shop A.

Verify Shop A's customer ledger and inventory.

## Test 6 — Same Customer Multiple Shops

Rahul purchases from Shop A and Shop B.

Verify separate shop-wise customer ledgers.

## Test 7 — Shop as Buyer and Seller

Shop B buys from Shop A and sells to Shop C.

Verify independent transactions.

## Test 8 — Returns

Return B2B goods.

Verify stock and financial reversals.

## Test 9 — Notifications

Change order/payment status.

Verify actual notification creation and synchronization.

## Test 10 — Multi-Owner Isolation

Owner A and Owner B attempt to access each other's records.

Verify unauthorized access is rejected.

# 31. PHASE-WISE IMPLEMENTATION PLAN

| Phase | Work |
|---|---|
| 1 | Existing NSYU architecture audit |
| 2 | Multi-owner/multi-shop foundation |
| 3 | Business types and shop relationships |
| 4 | Shared customer identity and shop-wise accounts |
| 5 | Multi-wholesaler catalog |
| 6 | B2C marketplace |
| 7 | B2B marketplace |
| 8 | Cart and order management |
| 9 | Purchase and sales |
| 10 | Billing and invoicing |
| 11 | B2B digital udhaar and linked ledgers |
| 12 | Payments and settlements |
| 13 | Returns and cancellations |
| 14 | Notifications and reminders |
| 15 | Reports and analytics |
| 16 | Website and mobile integration |
| 17 | Security and isolation testing |
| 18 | Production readiness |

Do not attempt uncontrolled implementation of every module simultaneously.

Complete, test and document each phase.

# 32. OPEN BUSINESS DECISIONS

The following policies need owner approval before final implementation:

1. Public marketplace versus individual shop stores versus both.
2. Whether B2B prices are public, registered-shop-only or seller-controlled.
3. Whether credit requires seller approval or can be automatic under configured terms.
4. Whether all customers use one verified platform identity or can maintain separate shop-specific login accounts.
5. Whether delivery/dispatch is managed inside NSYU or outside the platform.
6. Which payment methods and payment gateways will be supported.
7. Which GST/tax and invoice configurations apply to each transaction.
8. Whether platform commissions or subscription fees will exist.
9. Whether customer ratings and product reviews will be included.
10. Whether shops can sell outside their local area or only within defined service areas.

Do not assume these policies without approval.

# 33. FINAL ACCEPTANCE CRITERIA

NSYU can be declared production-ready only when:

- Multiple owners can operate independently.
- Each owner can manage multiple shops.
- Multiple wholesalers can register and sell.
- Distributors can purchase and resell.
- Retailers can purchase and sell.
- Every shop can act as buyer and seller.
- B2B orders work correctly.
- B2C orders work correctly.
- Shop-to-shop credit works correctly.
- Buyer/seller ledgers reconcile.
- Same customer can transact with multiple shops.
- Customer ledgers remain shop-specific.
- Inventory is accurate.
- Payments and returns reconcile.
- Notifications are database-backed.
- Status changes are validated.
- Website and mobile remain synchronized.
- Sensitive information is protected.
- Automated tests pass.
- No critical UI or security defects remain.
- No fake business data exists.

# 34. FINAL PRODUCT VISION

NSYU will be a connected digital business ecosystem.

A wholesaler can sell to multiple distributors and retailers.

A distributor can purchase from multiple wholesalers and supply multiple retailers.

A retailer can purchase from multiple wholesalers, sell to other shops and sell directly to customers.

A customer can purchase from multiple shops with separate shop-wise transaction histories.

Every business relationship can maintain its own credit terms, receivables, payables, payments and transaction history.

**NSYU — One Connected Platform for Multiple Businesses, Multiple Wholesalers, B2B + B2C Commerce and Digital Udhaar.**