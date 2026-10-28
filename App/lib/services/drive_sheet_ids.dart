/// Spreadsheet IDs for every file in the NSYU Google Drive folder.
///
/// ⚠️ As of the "nsyu" consolidation, everything below (except Product,
/// which is still its own separate file) lives in ONE combined Google
/// Sheet, as separate tabs:
///   Dashboard | Settings | Customer | Bills | Bill_Items | Ledger |
///   Orders | Orders_Items | Ledger_History
/// Spreadsheet: https://docs.google.com/spreadsheets/d/1hhN_49-LhRXXApj6O0MRxXStwdXbjdySERkg9vZbXe4
///
/// (The gid/tab-name for reading via CSV export lives next to each
/// read-only service; these IDs are what the Sheets API write calls use.)
class DriveSheetIds {
  /// Product catalog is still a separate file — no "Product" tab exists in
  /// the combined "nsyu" sheet.
  static const String product = '1QfT6PNxOJKpT-PGjkYGWewsFLbtw0CBf8KQrMlEDlME';

  // ⚠️ Set this to the EXACT tab name at the bottom of your Product Google
  // Sheet (open the sheet, look at the tab strip at the bottom — it may not
  // be "Product", e.g. it could be "Sheet1"). Needed so the Inventory
  // screen can write Margin Price updates back to the right tab.
  // ⚠️ UPDATED to match the sheet at gid=372640203 you shared — please
  // confirm this is the exact tab name shown in the tab strip at the
  // bottom of that sheet (it appeared as "Product" when fetched, but the
  // API needs the exact spelling/case).
  static const String productTab = 'Product';

  static const String _combined =
      '1hhN_49-LhRXXApj6O0MRxXStwdXbjdySERkg9vZbXe4';

  static const String customer = _combined;
  static const String bills = _combined;
  static const String billItems = _combined;
  static const String ledger = _combined;
  static const String settings = _combined;

  // Orders and Order Items live in their OWN separate spreadsheets (not the
  // combined "nsyu" file):
  //   Orders:       https://docs.google.com/spreadsheets/d/1BeXiWmBbJReSok7tcqgKY5pBk9Aa1rKdmaNsc54w1rw
  //   Order Items:  https://docs.google.com/spreadsheets/d/13GQrF34qR4nAivcSvKcacVKZvmDzMeuHEV1qDdY1qV0
  static const String orders = '1BeXiWmBbJReSok7tcqgKY5pBk9Aa1rKdmaNsc54w1rw';
  static const String orderItems = '13GQrF34qR4nAivcSvKcacVKZvmDzMeuHEV1qDdY1qV0';

  // Payment receipts now live in the "Ledger_History" tab (columns:
  // ReceiptNumber | Date | Customer | Amount | Method | TransactionId |
  // Remarks | BillNumber | OutstandingAfter — matches what
  // BillsProvider._pushPaymentToDrive writes, in that order).
  static const String payments = _combined;

  // Tab (sheet) names — must match the actual tab name in Google Sheets
  // exactly (case-sensitive).
  static const String billsTab = 'Bills';
  static const String billItemsTab = 'Bill_Items';
  static const String ledgerTab = 'Ledger';
  static const String customerTab = 'Customer';
  // Note the asymmetry: the Orders file's tab is "Orders", but the Order
  // Items file's tab is "Order_Items" (no "s" after "Order") even though
  // the file itself is named "Orders_Items.xlsx".
  static const String ordersTab = 'Orders';
  static const String orderItemsTab = 'Order_Items';
  static const String paymentsTab = 'Ledger_History';
}
