import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ProductVisibility } from "../types";
import { VISIBILITY_META, VISIBILITY_ORDER } from "../utils/productVisibility";

const MENU_W = 236;

/**
 * Compact SHOW badge (BOTH / MKT / POS / HIDE). When `editable`, clicking it
 * opens a dropdown to pick another visibility. The menu is portalled so the
 * table's horizontal scroll never clips it.
 */
export default function VisibilityBadge({
  value,
  editable,
  saving = false,
  onChange,
  size = "sm",
}: {
  value: ProductVisibility;
  editable: boolean;
  saving?: boolean;
  onChange?: (next: ProductVisibility) => void;
  size?: "sm" | "md";
}) {
  const meta = VISIBILITY_META[value];
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - MENU_W / 2), window.innerWidth - MENU_W - 8);
    const below = r.bottom + 6;
    const menuH = menuRef.current?.offsetHeight ?? 220;
    const top = below + menuH > window.innerHeight - 8 ? Math.max(8, r.top - menuH - 6) : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = (e: Event) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const badgeCls = `inline-flex items-center gap-1 rounded-md ring-1 ring-inset font-black tracking-wider ${
    size === "md" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]"
  } ${meta.cls}`;

  if (!editable) {
    return (
      <span className={badgeCls} title={`${meta.label} — ${meta.hint}`}>
        {meta.badge}
      </span>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={saving}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Visibility: ${meta.label}. Change`}
        title={`${meta.label} — click to change`}
        className={`${badgeCls} cursor-pointer hover:brightness-95 transition disabled:opacity-60 disabled:cursor-wait`}
      >
        {saving ? <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : meta.badge}
        <svg className="w-2.5 h-2.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label="Product visibility"
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_W }}
            className="z-[80] rounded-xl border border-slate-200 bg-white p-1 shadow-xl text-left"
          >
            <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Show in</div>
            {VISIBILITY_ORDER.map((v) => {
              const m = VISIBILITY_META[v];
              const on = v === value;
              return (
                <button
                  key={v}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    setOpen(false);
                    if (!on) onChange?.(v);
                  }}
                  className={`w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${on ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <span className={`mt-0.5 inline-flex min-w-[38px] justify-center rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wider ring-1 ring-inset ${m.cls}`}>{m.badge}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-800">{m.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-500">{m.hint}</span>
                  </span>
                  {on && (
                    <svg className="mt-1 w-3.5 h-3.5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
