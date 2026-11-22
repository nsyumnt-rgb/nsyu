import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Icon, type IconName } from "./ui";

export interface PageTab<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
  hidden?: boolean;
}

/** Reads `?tab=` and falls back to the first visible tab. */
export function useTabParam<K extends string>(tabs: PageTab<K>[]): K {
  const [params] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const wanted = params.get("tab");
  return (visible.find((t) => t.key === wanted)?.key ?? visible[0]?.key) as K;
}

/**
 * Page-level tab bar driven by the `?tab=` search param, so every tab has its
 * own shareable URL. Switching tabs drops the other params of the old tab.
 */
export default function PageTabs<K extends string>({ tabs, active, onSelect }: { tabs: PageTab<K>[]; active: K; onSelect: (key: K) => void }) {
  const visible = tabs.filter((t) => !t.hidden);
  if (visible.length < 2) return null;
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-slate-200 mb-5 overflow-x-auto overflow-y-hidden scrollbar-none">
      {visible.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.key)}
            className={clsx(
              "relative -mb-px inline-flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2 transition-colors",
              on ? "border-brand-600 text-brand-800" : "border-transparent text-slate-500 hover:text-navy-900 hover:border-slate-300"
            )}
          >
            {t.icon && <Icon name={t.icon} className="w-4 h-4" />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Redirect that keeps the current query string (e.g. `?customerId=5`) and adds
 * the given params, so old deep links keep landing on the same record.
 */
export function RedirectWithQuery({ to, params = {} }: { to: string; params?: Record<string, string> }) {
  const location = useLocation();
  const next = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) next.set(k, v);
  const qs = next.toString();
  return <Navigate to={`${to}${qs ? `?${qs}` : ""}`} replace />;
}
