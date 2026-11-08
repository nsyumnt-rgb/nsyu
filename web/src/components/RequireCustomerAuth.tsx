import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { usePortalStore } from "../store/portalStore";
import { getCartApi, getPortalUnreadCountApi } from "../api/portal";

export default function RequireCustomerAuth() {
  const { accessToken, setCart, setUnreadCount } = usePortalStore();

  useEffect(() => {
    if (accessToken) {
      getCartApi().then(setCart).catch(() => {});
      getPortalUnreadCountApi().then(setUnreadCount).catch(() => {});
    }
  }, [accessToken, setCart, setUnreadCount]);

  if (!accessToken) {
    return <Navigate to="/portal/login" replace />;
  }

  return <Outlet />;
}

