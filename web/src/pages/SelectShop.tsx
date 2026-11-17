import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listShops, switchShop } from "../api/shops";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import type { Shop } from "../types";
import AuthShell from "../components/AuthShell";
import { initialsOf, shopGradient } from "../components/ProductArt";

export default function SelectShop() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setActiveShop = useAuthStore((s) => s.setActiveShop);
  const accountType = useAuthStore((s) => s.accountType);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accountType === "owner") {
      navigate("/app", { replace: true });
      return;
    }
    listShops()
      .then((res) => setShops(res.data.data ?? []))
      .catch(() => setError("Could not load your assigned shops"))
      .finally(() => setLoading(false));
  }, [accountType, navigate]);

  async function handleSelect(shop: Shop) {
    setSwitchingId(shop.id);
    setError(null);
    try {
      const res = await switchShop(shop.id);
      const { accessToken } = res.data.data!;
      setAccessToken(accessToken, shop.id, shop.roleId ?? null, shop.roleName ?? null);
      setActiveShop(shop);
      navigate("/app");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not switch to that shop"));
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <AuthShell headline="Pick up where you left off.">
      <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight leading-tight">Choose a shop</h1>
      <p className="mt-1.5 text-[14px] text-slate-500">You can switch any time from the top bar. Your role may differ per shop.</p>

      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] text-rose-700">{error}</div>}

      <div className="mt-5 space-y-2.5">
        {loading &&
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[68px] rounded-xl bg-slate-100 animate-pulse" />)}

        {!loading && shops.length === 0 && !error && (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-[13.5px] text-slate-600">
            You haven't been added to a shop yet. Ask your shop owner to assign you.
          </div>
        )}

        {shops.map((shop) => (
          <button
            key={shop.id}
            type="button"
            onClick={() => handleSelect(shop)}
            disabled={switchingId !== null}
            className="w-full flex items-center gap-3 rounded-xl bg-white ring-1 ring-slate-200 px-3.5 py-3 text-left hover:ring-brand-400 hover:shadow-sm transition disabled:opacity-60"
          >
            <span className={`w-11 h-11 rounded-xl bg-gradient-to-br ${shopGradient(shop.name)} text-white text-[14px] font-bold flex items-center justify-center shrink-0`}>
              {initialsOf(shop.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold text-navy-900 truncate">{shop.name}</span>
              <span className="block text-[12px] font-mono text-slate-500 mt-0.5">{shop.code}</span>
            </span>
            {switchingId === shop.id ? (
              <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="badge bg-brand-50 text-brand-700">{shop.roleName || "Assigned"}</span>
            )}
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
