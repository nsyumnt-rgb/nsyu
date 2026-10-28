import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listShops, switchShop } from "../api/shops";
import { apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import type { Shop } from "../types";

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
    <div className="min-h-screen flex items-center justify-center bg-ink-800 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-9 w-9 rounded-md bg-accent flex items-center justify-center font-display text-base font-semibold text-white">
            N
          </div>
          <span className="font-display text-xl font-semibold text-white tracking-tight">NSYU Business</span>
        </div>

        <div className="card p-7">
          <h1 className="text-lg mb-1">Choose a shop</h1>
          <p className="text-sm text-muted mb-6">
            You can switch shops any time from the top bar. Your role and permissions may differ per shop.
          </p>

          {loading && <p className="text-sm text-muted">Loading your shops…</p>}
          {error && <p className="text-sm text-danger mb-3">{error}</p>}

          {!loading && shops.length === 0 && (
            <p className="text-sm text-muted">
              You haven't been assigned to any shop yet. Ask your owner to assign you.
            </p>
          )}

          <div className="space-y-2">
            {shops.map((shop) => (
              <button
                key={shop.id}
                onClick={() => handleSelect(shop)}
                disabled={switchingId !== null}
                className="w-full flex items-center justify-between rounded-md border border-border px-4 py-3 text-left hover:border-accent-400 hover:bg-accent-50/40 transition-colors disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-medium">{shop.name}</span>
                  <span className="block text-[11px] font-mono text-muted mt-0.5">{shop.code}</span>
                </span>
                <span className="badge-active">{shop.roleName || "Assigned"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
