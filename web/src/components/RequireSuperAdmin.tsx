import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export const RequireSuperAdmin: React.FC = () => {
  const { accessToken, accountType, isSuperAdmin } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (accountType !== "super_admin" && !isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Super Admin privileges are required to access this portal. Your account is not authorized.
          </p>
          <a
            href="#/app"
            className="inline-block px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Go to Shop Management
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default RequireSuperAdmin;

