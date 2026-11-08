import { useState } from "react";

interface ProductItemIconProps {
  name: string;
  category?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function ProductItemIcon({
  name,
  category,
  sku,
  imageUrl,
  size = "md",
  className = "",
}: ProductItemIconProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg text-xs p-1",
    md: "w-12 h-12 rounded-xl text-sm p-2",
    lg: "w-16 h-16 rounded-2xl text-base p-2.5",
  }[size];

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  }[size];

  // If a valid image URL is provided and has not errored
  if (imageUrl && !imgFailed) {
    return (
      <div
        className={`${sizeClasses} bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-xs overflow-hidden ${className}`}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  // Determine product category and theme based on keyword analysis
  const d = `${name} ${category || ""} ${sku || ""}`.toLowerCase();

  // 1. Mobile Chargers & Dock Adapters
  if (
    d.includes("charger") ||
    d.includes("dock") ||
    d.includes("chg") ||
    d.includes("adapter") ||
    d.includes("tc-") ||
    d.includes("tc0") ||
    d.includes("cc-") ||
    d.includes("dc-") ||
    d.includes("vook") ||
    d.includes("vooc") ||
    d.includes("pd ") ||
    d.includes("qc ")
  ) {
    return (
      <div
        className={`${sizeClasses} bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Charger / Adapter"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {/* Wall Adapter Body & Prongs */}
          <rect x="5" y="8" width="14" height="12" rx="3" fill="currentColor" fillOpacity="0.1" />
          <path d="M8 4v4M16 4v4" strokeLinecap="round" />
          <path d="M11 12l-2 3h4l-2 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  // 2. Cables & Wires
  if (
    d.includes("cable") ||
    d.includes("cbl") ||
    d.includes("wire") ||
    d.includes("uc-") ||
    d.includes("type-c") ||
    d.includes("micro usb") ||
    d.includes("lightning") ||
    d.includes("aux") ||
    d.includes("otg")
  ) {
    return (
      <div
        className={`${sizeClasses} bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Data Cable"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 5L5 19" strokeLinecap="round" />
          <rect x="15" y="2" width="6" height="5" rx="1.5" transform="rotate(45 15 2)" fill="currentColor" fillOpacity="0.15" />
          <rect x="3" y="14" width="6" height="5" rx="1.5" transform="rotate(45 3 14)" fill="currentColor" fillOpacity="0.15" />
        </svg>
      </div>
    );
  }

  // 3. Power Bank
  if (d.includes("power") || d.includes("bank") || d.includes("pb-") || d.includes("mah")) {
    return (
      <div
        className={`${sizeClasses} bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Power Bank"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="3" width="12" height="18" rx="2.5" fill="currentColor" fillOpacity="0.1" />
          <path d="M11 8l-2 3.5h4l-2 3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // 4. Earbuds / TWS
  if (d.includes("earbud") || d.includes("tws") || d.includes("ows") || d.includes("airpod")) {
    return (
      <div
        className={`${sizeClasses} bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="TWS / Wireless Earbuds"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="5" width="14" height="14" rx="4" fill="currentColor" fillOpacity="0.1" />
          <path d="M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM15 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" fill="currentColor" />
          <path d="M9 10v4M15 10v4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 5. Earphones / Headphones
  if (d.includes("earphone") || d.includes("headphone") || d.includes("we-") || d.includes("hf-")) {
    return (
      <div
        className={`${sizeClasses} bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Earphones / Audio"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" strokeLinecap="round" />
          <rect x="2" y="14" width="4" height="6" rx="2" fill="currentColor" fillOpacity="0.15" />
          <rect x="18" y="14" width="4" height="6" rx="2" fill="currentColor" fillOpacity="0.15" />
        </svg>
      </div>
    );
  }

  // 6. Bluetooth Speakers
  if (d.includes("speaker") || d.includes("bts-") || d.includes("bts0")) {
    return (
      <div
        className={`${sizeClasses} bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Bluetooth Speaker"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="3" width="14" height="18" rx="3" fill="currentColor" fillOpacity="0.1" />
          <circle cx="12" cy="8" r="2" />
          <circle cx="12" cy="15" r="3.5" />
        </svg>
      </div>
    );
  }

  // 7. Mobile Batteries
  if (d.includes("battery") || d.includes("bt-") || d.includes("bt0") || d.includes("li-ion")) {
    return (
      <div
        className={`${sizeClasses} bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Mobile Battery"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="6" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.1" />
          <path d="M8 3v3M11 3v3M14 3v3" strokeLinecap="round" />
          <path d="M9 13h6" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 8. Extension Board / Power Strip
  if (d.includes("extension") || d.includes("strip") || d.includes("socket") || d.includes("eb-")) {
    return (
      <div
        className={`${sizeClasses} bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="Power Strip"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="7" width="18" height="10" rx="3" fill="currentColor" fillOpacity="0.1" />
          <circle cx="7" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="17" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // 9. LED Torch / Flashlight
  if (d.includes("torch") || d.includes("tl-")) {
    return (
      <div
        className={`${sizeClasses} bg-yellow-50 border border-yellow-200 text-yellow-700 flex items-center justify-center shrink-0 shadow-xs ${className}`}
        title="LED Torch"
      >
        <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6l-3-3L3 15l3 3 12-12z" fill="currentColor" fillOpacity="0.1" />
          <path d="M15 3l6 6M13 5l3 3M7 17l-4 4" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Default: Clean Modern Accessory Icon
  return (
    <div
      className={`${sizeClasses} bg-emerald-50/80 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs ${className}`}
      title="Product"
    >
      <svg className={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    </div>
  );
}
