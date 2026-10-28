import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCustomerLedger, getSupplierLedger } from "../api/ledger";
import { listCustomers } from "../api/customers";
import { listSuppliers } from "../api/suppliers";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { usePermission } from "../hooks/usePermission";
import RequireModule from "../components/RequireModule";
import ReferenceLink from "../components/ReferenceLink";
import type { Customer, Supplier } from "../types";

function LedgerInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shopId = useAuthStore((s) => s.shopId);
  const activeShop = useAuthStore((s) => s.activeShop);
  const { isOwner } = usePermission();

  const [activeTab, setActiveTab] = useState<"customer" | "supplier">("customer");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");

  const [allShopsToggle, setAllShopsToggle] = useState(false);

  const [customerLedgerData, setCustomerLedgerData] = useState<any | null>(null);
  const [supplierLedgerData, setSupplierLedgerData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCustomers(), listSuppliers()]).then(([c, s]) => {
      const custList = c.data.data ?? [];
      const suppList = s.data.data ?? [];
      setCustomers(custList);
      setSuppliers(suppList);

      const urlCustId = searchParams.get("customerId");
      const urlSuppId = searchParams.get("supplierId");

      if (urlCustId) {
        setSelectedCustomerId(Number(urlCustId));
      } else if (custList.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custList[0].id);
      }

      if (urlSuppId) {
        setActiveTab("supplier");
        setSelectedSupplierId(Number(urlSuppId));
      } else if (suppList.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(suppList[0].id);
      }
    });
  }, [shopId]);

  useEffect(() => {
    if (activeTab === "customer" && selectedCustomerId) {
      setLoading(true);
      setError(null);
      getCustomerLedger(Number(selectedCustomerId), {
        allShops: isOwner && allShopsToggle ? true : undefined,
      })
        .then((res) => setCustomerLedgerData(res.data.data))
        .catch((err) => setError(apiErrorMessage(err, "Could not load customer ledger")))
        .finally(() => setLoading(false));
    } else if (activeTab === "supplier" && selectedSupplierId) {
      setLoading(true);
      setError(null);
      getSupplierLedger(Number(selectedSupplierId), {
        allShops: isOwner && allShopsToggle ? true : undefined,
      })
        .then((res) => setSupplierLedgerData(res.data.data))
        .catch((err) => setError(apiErrorMessage(err, "Could not load supplier ledger")))
        .finally(() => setLoading(false));
    }
  }, [activeTab, selectedCustomerId, selectedSupplierId, shopId, allShopsToggle]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl">Financial Ledgers & Statements</h1>
          <p className="text-sm text-muted mt-1">
            Running accounts, debit/credit attribution, and shop-wise balance reconciliation.
          </p>
        </div>

        {isOwner && (
          <label className="text-xs font-medium text-ink-700 cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={allShopsToggle}
              onChange={(e) => setAllShopsToggle(e.target.checked)}
              className="rounded border-border text-accent-600 focus:ring-accent-500"
            />
            Consolidated (All Shops)
          </label>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-4">
        <button
          onClick={() => setActiveTab("customer")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "customer"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Customer Account Ledger
        </button>
        <button
          onClick={() => setActiveTab("supplier")}
          className={`pb-2.5 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === "supplier"
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-muted hover:text-ink-900"
          }`}
        >
          Supplier Payable Ledger
        </button>
      </div>

      {/* Selector & Balances Summary Bar */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-full sm:w-80">
            <label className="label">
              Select {activeTab === "customer" ? "Customer" : "Supplier"}
            </label>
            {activeTab === "customer" ? (
              <select
                className="input"
                value={selectedCustomerId}
                onChange={(e) => {
                  const val = Number(e.target.value) || "";
                  setSelectedCustomerId(val);
                  setSearchParams({ customerId: String(val) });
                }}
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="input"
                value={selectedSupplierId}
                onChange={(e) => {
                  const val = Number(e.target.value) || "";
                  setSelectedSupplierId(val);
                  setSearchParams({ supplierId: String(val) });
                }}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || "No phone"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Balance KPIs */}
          {activeTab === "customer" && customerLedgerData && (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-3 sm:pt-0">
              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Shop Balance ({activeShop?.name})</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    customerLedgerData.shopBalance > 0
                      ? "text-danger"
                      : customerLedgerData.shopBalance < 0
                      ? "text-accent-600"
                      : "text-ink-900"
                  }`}
                >
                  ₹{Math.abs(customerLedgerData.shopBalance).toFixed(2)}
                  <span className="text-[10px] ml-1 font-normal">
                    {customerLedgerData.shopBalance > 0 ? "Due" : customerLedgerData.shopBalance < 0 ? "Adv" : ""}
                  </span>
                </div>
              </div>

              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Total Balance (Global)</div>
                <div
                  className={`text-lg font-mono font-bold ${
                    customerLedgerData.currentBalance > 0
                      ? "text-danger"
                      : customerLedgerData.currentBalance < 0
                      ? "text-accent-600"
                      : "text-ink-900"
                  }`}
                >
                  ₹{Math.abs(customerLedgerData.currentBalance).toFixed(2)}
                </div>
              </div>

              <div className="bg-canvas p-3 rounded col-span-2 sm:col-span-1">
                <div className="text-[11px] text-muted font-medium">Total Billed / Paid</div>
                <div className="text-xs font-mono mt-1 text-ink-800">
                  <span className="text-danger font-semibold">Dr: ₹{customerLedgerData.totalDebit}</span> |{" "}
                  <span className="text-accent-600 font-semibold">Cr: ₹{customerLedgerData.totalCredit}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "supplier" && supplierLedgerData && (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t sm:border-t-0 sm:border-l sm:pl-4 pt-3 sm:pt-0">
              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Shop Payable ({activeShop?.name})</div>
                <div className="text-lg font-mono font-bold text-danger">
                  ₹{Math.abs(supplierLedgerData.shopBalance).toFixed(2)}
                </div>
              </div>

              <div className="bg-canvas p-3 rounded">
                <div className="text-[11px] text-muted font-medium">Total Payable (Global)</div>
                <div className="text-lg font-mono font-bold text-danger">
                  ₹{Math.abs(supplierLedgerData.currentBalance).toFixed(2)}
                </div>
              </div>

              <div className="bg-canvas p-3 rounded col-span-2 sm:col-span-1">
                <div className="text-[11px] text-muted font-medium">Purchased / Paid</div>
                <div className="text-xs font-mono mt-1 text-ink-800">
                  <span className="text-danger font-semibold">Cr: ₹{supplierLedgerData.totalCredit}</span> |{" "}
                  <span className="text-accent-600 font-semibold">Dr: ₹{supplierLedgerData.totalDebit}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Ledger Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Reference</th>
              {allShopsToggle && <th>Shop</th>}
              <th>Type</th>
              <th className="text-right">Debit (Dr)</th>
              <th className="text-right">Credit (Cr)</th>
              <th className="text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={allShopsToggle ? 7 : 6} className="text-center py-8 text-muted">
                  Loading statement…
                </td>
              </tr>
            ) : activeTab === "customer" ? (
              !customerLedgerData || customerLedgerData.entries.length === 0 ? (
                <tr>
                  <td colSpan={allShopsToggle ? 7 : 6} className="text-center py-8 text-muted">
                    No ledger entries for this customer in selected scope.
                  </td>
                </tr>
              ) : (
                (() => {
                  let running = 0;
                  return customerLedgerData.entries.map((entry: any) => {
                    const amt = Number(entry.amount);
                    if (entry.entry_type === "debit") running += amt;
                    else running -= amt;

                    return (
                      <tr key={entry.id}>
                        <td className="text-xs text-muted">
                          {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td>
                          <div className="font-medium text-xs">{entry.description || entry.reference_type}</div>
                          <div className="font-mono text-[11px] text-muted">
                            Ref:{" "}
                            {entry.reference_type === "Sale" ? (
                              <ReferenceLink type="sale" id={entry.reference_id} refNumber={`Sale #${entry.reference_id}`} />
                            ) : entry.reference_type === "Payment" ? (
                              <ReferenceLink type="payment" id={entry.reference_id} refNumber={`PAY-${entry.reference_id}`} />
                            ) : (
                              `${entry.reference_type} #${entry.reference_id}`
                            )}
                          </div>
                        </td>
                        {allShopsToggle && (
                          <td>
                            <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                              {entry.shop?.name || `Shop #${entry.shop_id}`}
                            </span>
                          </td>
                        )}
                        <td>
                          <span
                            className={`badge ${
                              entry.entry_type === "debit"
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {entry.entry_type === "debit" ? "Invoice / Debit" : "Payment / Credit"}
                          </span>
                        </td>
                        <td className="text-right font-mono font-medium text-danger">
                          {entry.entry_type === "debit" ? `₹${amt.toFixed(2)}` : "—"}
                        </td>
                        <td className="text-right font-mono font-medium text-accent-600">
                          {entry.entry_type === "credit" ? `₹${amt.toFixed(2)}` : "—"}
                        </td>
                        <td className="text-right font-mono font-bold">
                          ₹{Math.abs(running).toFixed(2)} {running > 0 ? "Dr" : running < 0 ? "Cr" : ""}
                        </td>
                      </tr>
                    );
                  });
                })()
              )
            ) : !supplierLedgerData || supplierLedgerData.entries.length === 0 ? (
              <tr>
                <td colSpan={allShopsToggle ? 7 : 6} className="text-center py-8 text-muted">
                  No ledger entries for this supplier in selected scope.
                </td>
              </tr>
            ) : (
              (() => {
                let running = 0;
                return supplierLedgerData.entries.map((entry: any) => {
                  const amt = Number(entry.amount);
                  if (entry.entry_type === "credit") running += amt;
                  else running -= amt;

                  return (
                    <tr key={entry.id}>
                      <td className="text-xs text-muted">
                        {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <div className="font-medium text-xs">{entry.description || entry.reference_type}</div>
                        <div className="font-mono text-[11px] text-muted">
                          Ref:{" "}
                          {entry.reference_type === "Purchase" ? (
                            <ReferenceLink type="purchase" id={entry.reference_id} refNumber={`Purchase #${entry.reference_id}`} />
                          ) : (
                            `${entry.reference_type} #${entry.reference_id}`
                          )}
                        </div>
                      </td>
                      {allShopsToggle && (
                        <td>
                          <span className="badge bg-ink-100 text-ink-700 font-mono text-[11px]">
                            {entry.shop?.name || `Shop #${entry.shop_id}`}
                          </span>
                        </td>
                      )}
                      <td>
                        <span
                          className={`badge ${
                            entry.entry_type === "credit"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {entry.entry_type === "credit" ? "Purchase (Owed)" : "Payment (Settled)"}
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium text-accent-600">
                        {entry.entry_type === "debit" ? `₹${amt.toFixed(2)}` : "—"}
                      </td>
                      <td className="text-right font-mono font-medium text-danger">
                        {entry.entry_type === "credit" ? `₹${amt.toFixed(2)}` : "—"}
                      </td>
                      <td className="text-right font-mono font-bold">
                        ₹{Math.abs(running).toFixed(2)} {running > 0 ? "Cr (Due)" : ""}
                      </td>
                    </tr>
                  );
                });
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Ledger() {
  return (
    <RequireModule module="ledger">
      <LedgerInner />
    </RequireModule>
  );
}
