import { useEffect, useState } from "react";
import { getMarketCategories, getMarketShops } from "../../api/marketplace";
import ListingBrowser from "./ListingBrowser";

/* MultiShop wireframe 10 — search across every shop. */
export default function MarketSearch() {
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    getMarketCategories().then(setCategories).catch(() => {});
    getMarketShops({ limit: 48 }).then((r) => setShops(r.data.map((s) => ({ id: s.id, name: s.name })))).catch(() => {});
  }, []);

  return (
    <ListingBrowser
      categories={categories}
      shops={shops}
      title={(q, total) => (q ? `Results for “${q}”${total !== null ? ` (${total})` : ""}` : `All products${total !== null ? ` (${total})` : ""}`)}
    />
  );
}
