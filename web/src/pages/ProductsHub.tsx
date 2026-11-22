import { useSearchParams } from "react-router-dom";
import PageTabs, { useTabParam, type PageTab } from "../components/PageTabs";
import Products from "./Products";
import Categories from "./Categories";

type Tab = "products" | "categories";

const TABS: PageTab<Tab>[] = [
  { key: "products", label: "Products", icon: "box" },
  { key: "categories", label: "Categories", icon: "layers" },
];

/** /app/products — Products and Categories as two tabs of one menu item. */
export default function ProductsHub() {
  const [, setParams] = useSearchParams();
  const tab = useTabParam(TABS);

  return (
    <>
      <PageTabs tabs={TABS} active={tab} onSelect={(k) => setParams(k === "products" ? {} : { tab: k })} />
      {tab === "categories" ? <Categories /> : <Products />}
    </>
  );
}
