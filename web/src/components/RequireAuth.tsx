import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchMe } from "../api/auth";

/**
 * Guards every /app/* route. Ensures we have a token, then resolves
 * "who am I / what can I do right now" via GET /auth/me so the
 * sidebar and field visibility are correct on a hard refresh.
 */
export default function RequireAuth() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const accountType = useAuthStore((s) => s.accountType);
  const setMe = useAuthStore((s) => s.setMe);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setStatus("loading");
    fetchMe()
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data!;
        setMe(data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        logout();
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-sm text-muted">Loading your workspace…</div>
      </div>
    );
  }

  if (status === "error") {
    return <Navigate to="/login" replace />;
  }

  // Employees must pick a shop before touching any module route.
  const shopId = useAuthStore.getState().shopId;
  if (accountType === "employee" && !shopId && location.pathname !== "/select-shop") {
    return <Navigate to="/select-shop" replace />;
  }

  return <Outlet />;
}
