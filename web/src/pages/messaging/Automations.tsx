import { useEffect, useState } from "react";
import { Icon, Switch } from "../../components/ui";
import { AUTOMATION_LABELS, messagingApi, type AutomationRule, type MessageTemplate } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";
import type { MessagingCtx } from "./Messaging";

export default function Automations({ ctx }: { ctx: MessagingCtx }) {
  const s = ctx.settings;
  const [rules, setRules] = useState<Record<string, AutomationRule>>({});
  const [festivals, setFestivals] = useState<{ name: string; date: string }[]>([]);
  const [creditDays, setCreditDays] = useState(15);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!s) return;
    setRules(s.automations);
    setFestivals(s.festivals || []);
    setCreditDays(s.creditDays ?? 15);
    setDirty(false);
  }, [s]);
  useEffect(() => {
    messagingApi.templates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const set = (ev: string, patch: Partial<AutomationRule>) => {
    setRules((r) => ({ ...r, [ev]: { ...r[ev], ...patch } }));
    setDirty(true);
  };
  const tplById = (id?: number | null) => templates.find((t) => t.id === id);

  const save = async () => {
    setSaving(true);
    try {
      const r = await messagingApi.saveAutomations({ automations: rules, festivals, creditDays });
      ctx.toast(r.message || "Saved");
      await ctx.reload();
    } catch (err) {
      ctx.toast(apiErrorMessage(err), false);
    } finally {
      setSaving(false);
    }
  };

  const waReady = ctx.readiness?.whatsapp.ready;
  const emailReady = ctx.readiness?.email.ready;

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="card-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="card-title">Automatic notifications</h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">Turn WhatsApp and email on or off separately for every event. Each message is sent once — never twice.</p>
          </div>
          <button type="button" className="btn btn-primary shrink-0" disabled={saving || !dirty} onClick={save}>
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
        {(!waReady || !emailReady) && (
          <div className="mx-4 sm:mx-5 mt-4 rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-3.5 py-2.5 text-[12.5px] text-amber-900 flex gap-2">
            <Icon name="alert" className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {!waReady && <>WhatsApp: {ctx.readiness?.whatsapp.reason}. </>}
              {!emailReady && <>Email: {ctx.readiness?.email.reason}. </>}
              Switched-on rules for that channel are skipped (and logged) until it is connected.{" "}
              <button type="button" className="font-bold underline" onClick={() => ctx.goTo("channels")}>Open channels</button>
            </span>
          </div>
        )}
        <ul className="divide-y divide-slate-100 mt-2">
          {Object.entries(AUTOMATION_LABELS).map(([ev, meta]) => {
            const r = rules[ev] || { whatsapp: false, email: false };
            const t = tplById(r.templateId);
            const legacy = s?.legacyEmailEvents?.includes(ev);
            const waNoTemplate = r.whatsapp && !t?.wa_template_name;
            return (
              <li key={ev} className="px-4 sm:px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:items-center">
                <div className="lg:col-span-4 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-navy-900">{meta.label}</span>
                    {meta.promo && <span className="chip text-[10.5px]">Promotional · needs consent</span>}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">{meta.hint}</div>
                </div>
                <div className="lg:col-span-3 flex flex-wrap gap-x-5 gap-y-2">
                  <Switch checked={!!r.whatsapp} onChange={(v) => set(ev, { whatsapp: v })} label="WhatsApp" />
                  <Switch checked={!!r.email} onChange={(v) => set(ev, { email: v })} label="Email" />
                </div>
                <div className="lg:col-span-5 min-w-0 flex flex-col sm:flex-row gap-2 sm:items-start">
                  <div className="min-w-0 flex-1">
                    <select className="input" value={r.templateId || ""} onChange={(e) => set(ev, { templateId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">{legacy ? "Standard system email" : "Built-in message"}</option>
                      {templates.filter((x) => x.is_active).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    {waNoTemplate && (
                      <div className="text-[11.5px] text-amber-700 mt-1">WhatsApp only allows free text within 24 h of the customer’s last message — pick a template linked to an approved WhatsApp template.</div>
                    )}
                  </div>
                  {(ev === "pending_payment" || ev === "due_date_reminder") && (
                    <label className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] font-semibold text-slate-500 whitespace-nowrap">{ev === "pending_payment" ? "Every" : "Days before"}</span>
                      <input className="input tabular w-20" type="number" min={0} max={90} value={r.days ?? ""} onChange={(e) => set(ev, { days: Number(e.target.value) })} />
                      {ev === "pending_payment" && <span className="text-[11.5px] font-semibold text-slate-500">days</span>}
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 space-y-3">
          <h3 className="card-title">Due dates</h3>
          <p className="text-[12.5px] text-slate-500">An invoice is due this many days after its date. Used by the due-date reminder.</p>
          <label className="block max-w-[200px]">
            <span className="label">Credit period (days)</span>
            <input className="input tabular" type="number" min={0} max={365} value={creditDays} onChange={(e) => { setCreditDays(Number(e.target.value)); setDirty(true); }} />
          </label>
        </div>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="card-title">Festival dates</h3>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFestivals([...festivals, { name: "", date: "" }]); setDirty(true); }}>
              <Icon name="plus" className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <p className="text-[12.5px] text-slate-500">Greetings go to this shop’s customers (with promotional consent) on these dates.</p>
          {festivals.length === 0 && <div className="text-[12.5px] text-slate-400">No festivals added.</div>}
          {festivals.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" placeholder="Diwali" value={f.name} onChange={(e) => { const n = [...festivals]; n[i] = { ...f, name: e.target.value }; setFestivals(n); setDirty(true); }} />
              <input className="input w-[150px] shrink-0" type="date" value={f.date} onChange={(e) => { const n = [...festivals]; n[i] = { ...f, date: e.target.value }; setFestivals(n); setDirty(true); }} />
              <button type="button" className="btn btn-ghost btn-sm shrink-0" aria-label="Remove" onClick={() => { setFestivals(festivals.filter((_, j) => j !== i)); setDirty(true); }}>
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
      {dirty && (
        <div className="sticky bottom-20 md:bottom-4 z-20 flex justify-end">
          <button type="button" className="btn btn-primary shadow-pop" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
