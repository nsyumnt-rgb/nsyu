import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, Switch } from "../../components/ui";
import { messagingApi, type CustomerPrefs } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";

/** Shop-side view of one customer's messaging consent, shown on the customer page. */
export default function CustomerMessagingCard({ customerId }: { customerId: number }) {
  const [p, setP] = useState<CustomerPrefs | null>(null);
  const [saved, setSaved] = useState<CustomerPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    messagingApi
      .customerPrefs(customerId)
      .then((r) => {
        setP(r);
        setSaved(r);
      })
      .catch(() => setP(null));
  }, [customerId]);

  if (!p) return null;
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await messagingApi.saveCustomerPrefs(customerId, p);
      setP(r.data);
      setSaved(r.data);
      setMsg({ ok: true, text: "Saved" });
    } catch (err) {
      setMsg({ ok: false, text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="card-title">Messaging</h2>
          <p className="text-[12.5px] text-slate-500">Which channels this customer agreed to. Nothing is sent on a channel that is off.</p>
        </div>
        <Link to={`/app/messaging?customer=${customerId}`} className="btn btn-secondary btn-sm">
          <Icon name="send" className="w-3.5 h-3.5" /> Send message
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl ring-1 ring-inset ring-slate-200 p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Updates (orders, bills, payments)</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Switch checked={p.allowWhatsapp} onChange={(v) => setP({ ...p, allowWhatsapp: v })} label="WhatsApp" />
            <Switch checked={p.allowEmail} onChange={(v) => setP({ ...p, allowEmail: v })} label="Email" />
          </div>
        </div>
        <div className="rounded-xl ring-1 ring-inset ring-slate-200 p-3 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Offers & greetings</div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Switch checked={p.promoWhatsapp} onChange={(v) => setP({ ...p, promoWhatsapp: v })} label="WhatsApp" />
            <Switch checked={p.promoEmail} onChange={(v) => setP({ ...p, promoEmail: v })} label="Email" />
          </div>
        </div>
        <label className="block">
          <span className="label">WhatsApp number</span>
          <input className="input tabular" inputMode="tel" value={p.whatsappNumber} onChange={(e) => setP({ ...p, whatsappNumber: e.target.value })} placeholder="Leave empty to use the phone number" />
        </label>
        <label className="block">
          <span className="label">Date of birth</span>
          <input className="input" type="date" value={p.dateOfBirth} onChange={(e) => setP({ ...p, dateOfBirth: e.target.value })} />
          <span className="field-hint">Used for the birthday greeting, if switched on.</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {p.optedOutAt && <span className="text-[12px] text-amber-700 mr-auto">Opted out of offers on {new Date(p.optedOutAt).toLocaleDateString("en-IN")}</span>}
        {msg && <span className={`text-[12.5px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
