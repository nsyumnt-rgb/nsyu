import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPortalProductApi } from "../../api/portal";
import { useStorefront } from "../../store/storefrontStore";
import { ProductCard, ProductCardSkeleton, HeartIcon, type Product } from "../../components/StoreProduct";
import { useCartQty } from "../../components/storefront/useCartQty";

/** Saved products. Ids live in this browser; every product is loaded live from the shop's catalog. */
export default function PortalWishlist() {
  const ids = useStorefront((s) => s.wishlist);
  const remove = useStorefront((s) => s.removeFromWishlist);
  const { cardProps, error } = useCartQty();
  const [products, setProducts] = useState<Record<number, Product | null>>({});

  useEffect(() => {
    const missing = ids.filter((id) => !(id in products));
    if (!missing.length) return;
    Promise.all(missing.map((id) => getPortalProductApi(id).then((p) => [id, p as Product] as const).catch(() => [id, null] as const))).then((rows) =>
      setProducts((prev) => {
        const next = { ...prev };
        for (const [id, p] of rows) next[id] = p;
        return next;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // Drop ids for products that no longer exist in the shop.
  useEffect(() => {
    for (const id of ids) if (products[id] === null) remove(id);
  }, [ids, products, remove]);

  const loading = ids.some((id) => !(id in products));
  const list = ids.map((id) => products[id]).filter(Boolean) as Product[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-navy-900">Wishlist</h1>
        <p className="mt-1 text-[13.5px] text-slate-500">{ids.length ? `${ids.length} saved product${ids.length === 1 ? "" : "s"} · saved on this device` : "Products you save will appear here."}</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">{error}</p>}

      {ids.length === 0 ? (
        <div className="rounded-3xl bg-white ring-1 ring-slate-200 p-10 sm:p-14 text-center">
          <span className="mx-auto w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
            <HeartIcon className="w-9 h-9" />
          </span>
          <p className="mt-4 text-[17px] font-semibold text-navy-900">Your wishlist is empty</p>
          <p className="mt-1 text-[13.5px] text-slate-500">Tap the heart on any product to save it for later.</p>
          <Link to="/portal/catalog" className="btn-primary mt-6 h-11 px-6 rounded-full">Browse products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {list.map((p) => <ProductCard key={p.id} product={p} {...cardProps(p)} />)}
          {loading && Array.from({ length: Math.min(5, ids.length - list.length) }).map((_, i) => <ProductCardSkeleton key={`s${i}`} />)}
        </div>
      )}
    </div>
  );
}
