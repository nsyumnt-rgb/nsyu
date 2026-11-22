import { useSearchParams } from "react-router-dom";
import PageTabs, { useTabParam, type PageTab } from "../components/PageTabs";
import { usePermission } from "../hooks/usePermission";
import Customers from "./Customers";
import Ledger from "./Ledger";

type Tab = "details" | "ledger";

/** /app/customers — customer details and the customer ledger as two tabs. */
export default function CustomersHub() {
  const { can } = usePermission();
  const [, setParams] = useSearchParams();
  const canCustomers = can("customers", "view");
  const canLedger = can("ledger", "view");

  // A role with only one of the two modules goes straight to the one it has
  // (each page still shows its own "no access" screen if reached directly).
  const tabs: PageTab<Tab>[] = [
    { key: "details", label: "Details", icon: "users", hidden: !canCustomers && canLedger },
    { key: "ledger", label: "Ledger", icon: "book", hidden: !canLedger && canCustomers },
  ];
  const tab = useTabParam(tabs);

  return (
    <>
      <PageTabs tabs={tabs} active={tab} onSelect={(k) => setParams(k === "details" ? {} : { tab: k })} />
      {tab === "ledger" ? <Ledger /> : <Customers />}
    </>
  );
}
