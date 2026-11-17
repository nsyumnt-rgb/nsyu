/* Designed stand-ins for products, categories and shops without an uploaded image.
   Everything is derived from the record's own name/category — no invented data. */

type Kind = "audio" | "charger" | "cable" | "power" | "keyboard" | "mouse" | "phone" | "watch" | "speaker" | "case" | "storage" | "generic";

const RULES: [Kind, RegExp][] = [
  ["power", /power\s*bank|battery|mah/i],
  ["charger", /charg|adapter|adaptor|\d+\s*w\b|dock/i],
  ["cable", /cable|cord|usb|type[\s-]?c|lightning|otg|hdmi|aux/i],
  ["audio", /ear|bud|neck|head|tws|bluetooth|airpod|audio|hands?free|\bhf\b/i],
  ["speaker", /speaker|sound|bar/i],
  ["keyboard", /keyboard|keypad/i],
  ["mouse", /mouse/i],
  ["watch", /watch|band|fitness/i],
  ["case", /case|cover|glass|guard|protector/i],
  ["storage", /memory|card|pen\s*drive|ssd|sd\b|storage/i],
  ["phone", /phone|mobile|tablet|smart/i],
];

export function productKind(...hints: (string | null | undefined)[]): Kind {
  const text = hints.filter(Boolean).join(" ");
  for (const [k, re] of RULES) if (re.test(text)) return k;
  return "generic";
}

/* Soft tints that sit well on white; picked by a stable hash so the same item always looks the same. */
const TINTS = [
  { bg: "from-emerald-50 to-teal-100/70", fg: "text-emerald-700", ring: "ring-emerald-200/60" },
  { bg: "from-sky-50 to-cyan-100/70", fg: "text-sky-700", ring: "ring-sky-200/60" },
  { bg: "from-amber-50 to-orange-100/70", fg: "text-amber-700", ring: "ring-amber-200/60" },
  { bg: "from-violet-50 to-indigo-100/70", fg: "text-violet-700", ring: "ring-violet-200/60" },
  { bg: "from-rose-50 to-pink-100/70", fg: "text-rose-700", ring: "ring-rose-200/60" },
  { bg: "from-lime-50 to-green-100/70", fg: "text-lime-700", ring: "ring-lime-200/60" },
];

export function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

const PATHS: Record<Kind, React.ReactNode> = {
  audio: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" /><path d="M3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" /></>,
  charger: <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  cable: <><path d="M7 2v5" /><path d="M11 2v5" /><rect x="5" y="7" width="8" height="5" rx="1" /><path d="M9 12v3a5 5 0 0 0 5 5h3a3 3 0 0 0 3-3v-1" /></>,
  power: <><rect x="2" y="7" width="17" height="10" rx="2" /><path d="M22 11v2" /><path d="M10 9l-2 3h4l-2 3" /></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" /></>,
  mouse: <><rect x="6" y="3" width="12" height="18" rx="6" /><path d="M12 7v4" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></>,
  watch: <><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4" /><path d="M12 10v2l1.5 1" /></>,
  speaker: <><rect x="5" y="2" width="14" height="20" rx="2" /><circle cx="12" cy="14" r="4" /><path d="M12 6h.01" /></>,
  case: <><rect x="6" y="2" width="12" height="20" rx="3" /><circle cx="10" cy="6.5" r="1.2" /></>,
  storage: <><path d="M6 2h9l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M8 2v4M11 2v4M14 2v4" /></>,
  generic: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
};

export function KindIcon({ kind, className = "w-6 h-6" }: { kind: Kind; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[kind]}
    </svg>
  );
}

/** Fills its (positioned) parent with a tinted panel, a category icon and — when large — the brand/category label. */
export function ProductPlaceholder({ name, category, brand, compact = false }: { name: string; category?: string | null; brand?: string | null; compact?: boolean }) {
  const kind = productKind(category, name);
  const t = tintFor(`${category ?? ""}|${kind}`);
  const label = (category && category.trim()) || (brand && brand.trim()) || "";
  return (
    <span className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${t.bg}`} aria-hidden>
      <span className={`${compact ? "w-9 h-9 rounded-xl" : "w-[34%] max-w-[88px] aspect-square rounded-[28%]"} bg-white/80 ring-1 ${t.ring} shadow-sm flex items-center justify-center ${t.fg}`}>
        <KindIcon kind={kind} className={compact ? "w-5 h-5" : "w-[55%] h-[55%]"} />
      </span>
      {!compact && label && <span className={`mt-3 px-3 max-w-full truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] ${t.fg} opacity-70`}>{label}</span>}
    </span>
  );
}

/** Initials avatar with a stable tint — for shops without a logo. */
export function initialsOf(name: string) {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

const SHOP_GRADIENTS = [
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-700",
  "from-amber-500 to-orange-700",
  "from-violet-500 to-fuchsia-700",
  "from-rose-500 to-red-700",
  "from-teal-500 to-cyan-700",
];
export function shopGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return SHOP_GRADIENTS[h % SHOP_GRADIENTS.length];
}
