import React from "react";
import { Link } from "react-router-dom";

export type ReferenceType =
  | "sale"
  | "invoice"
  | "purchase"
  | "payment"
  | "transfer"
  | "movement"
  | "product"
  | "customer"
  | "supplier"
  | "employee"
  | "emi"
  | "payroll"
  | "auto";

interface ReferenceLinkProps {
  type?: ReferenceType;
  id?: number | string | null;
  refNumber?: string | null;
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
  title?: string;
  badge?: boolean;
}

/**
 * Universal Reference Link Component:
 * Clickable reference link that opens the dedicated detail page
 * for any business document or entity.
 * Handles stopPropagation to avoid table row selection conflicts.
 */
export default function ReferenceLink({
  type = "auto",
  id,
  refNumber,
  children,
  className = "",
  showIcon = false,
  title,
  badge = false,
}: ReferenceLinkProps) {
  // If neither id nor refNumber is present, render fallback or plain text
  if (!id && !refNumber && !children) {
    return <span className="text-slate-400 font-mono text-xs">—</span>;
  }

  // Determine effective type if "auto"
  let effectiveType: ReferenceType = type;
  const rawRef = String(refNumber || id || "").trim();
  const upper = rawRef.toUpperCase();

  if (effectiveType === "auto" || effectiveType === "invoice") {
    if (upper.startsWith("INV") || upper.includes("INV-")) {
      effectiveType = "sale";
    } else if (upper.startsWith("PUR") || upper.includes("PUR-")) {
      effectiveType = "purchase";
    } else if (upper.startsWith("TRF") || upper.includes("TRF-")) {
      effectiveType = "transfer";
    } else if (upper.startsWith("PAY") || upper.includes("PAY-")) {
      effectiveType = "payment";
    } else if (upper.startsWith("EMI") || upper.includes("EMI-")) {
      effectiveType = "emi";
    } else if (upper.startsWith("MOV") || upper.includes("MOV-")) {
      effectiveType = "movement";
    } else if (upper.startsWith("CUST") || upper.includes("CUST-")) {
      effectiveType = "customer";
    } else if (upper.startsWith("SUPP") || upper.includes("SUPP-")) {
      effectiveType = "supplier";
    } else if (upper.startsWith("EMP") || upper.includes("EMP-")) {
      effectiveType = "employee";
    } else {
      effectiveType = "sale"; // default to sale if indeterminate
    }
  }

  // Determine canonical route target
  const targetId = id !== undefined && id !== null && id !== "" ? id : encodeURIComponent(rawRef);
  let route = `/app/sales/${targetId}`;

  switch (effectiveType) {
    case "sale":
      route = `/app/sales/${targetId}`;
      break;
    case "purchase":
      route = `/app/purchase/${targetId}`;
      break;
    case "payment":
      route = `/app/payments/${targetId}`;
      break;
    case "transfer":
      route = `/app/inventory/transfers/${targetId}`;
      break;
    case "movement":
      route = `/app/inventory/movements/${targetId}`;
      break;
    case "product":
      route = `/app/products/${targetId}`;
      break;
    case "customer":
      route = `/app/customers/${targetId}`;
      break;
    case "supplier":
      route = `/app/suppliers/${targetId}`;
      break;
    case "employee":
      route = `/app/employees/${targetId}`;
      break;
    case "emi":
      route = `/app/emi/${targetId}`;
      break;
    case "payroll":
      route = `/app/payroll/${targetId}`;
      break;
  }

  const displayText = children || refNumber || `#${id}`;

  const defaultClasses = badge
    ? "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-colors shadow-2xs cursor-pointer"
    : "inline-flex items-center gap-1 font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer";

  return (
    <Link
      to={route}
      onClick={(e) => e.stopPropagation()}
      title={title || `View details for ${rawRef}`}
      className={`${defaultClasses} ${className}`}
    >
      {showIcon && (
        <svg className="w-3 h-3 text-blue-500 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
      <span>{displayText}</span>
    </Link>
  );
}
