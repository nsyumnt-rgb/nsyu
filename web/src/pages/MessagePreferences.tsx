import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Switch } from "../components/ui";
import { publicPrefsApi, type CustomerPrefs } from "../api/messaging";
import { apiErrorMessage } from "../api/client";

type Prefs = CustomerPrefs & { firstName: string; shopName: string };

/** Public page opened from the unsubscribe link at the bottom of every message. */
export default function MessagePreferences() {
  const { token = "" } = useParams();
  const [p, setP] = useState<Prefs | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    publicPrefsApi
      .get(token)
      .then(setP)
      .catch((e) => setError(apiErrorMessage(e, "This link is not valid")));
  }, [token]);

  const save = async (body: Partial<CustomerPrefs> & { unsubscribeAll?: boolean }) => {
    setBusy(true);
    try {
      const r = await publicPrefsApi.save(token, body);
      setP((prev) => (prev ? { ...prev, ...r.data, firstName: prev.firstName, shopName: prev.shopName } : prev));
      setDone(r.message || "Saved");
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-start sm:items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-7 space-y-5 page-enter">
        <div>
          <div className="eyebrow">Message preferences</div>
          <h1 className="text-xl font-extrabold text-navy-900 mt-1">{p ? `Hi ${p.firstName || "there"}` : error ? "Link not valid" : "Loading…"}</h1>
          {p?.shopName && <p className="text-[13px] text-slate-500 mt-1">Choose how {p.shopName} contacts you.</p>}
        </div>
        {error && <p className="text-[13px] rounded-lg px-3 py-2 bg-rose-50 text-rose-700">{error}</p>}
        {p && (
          <>
            <section className="space-y-2">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Order, bill and payment updates</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Switch checked={p.allowWhatsapp} onChange={(v) => setP({ ...p, allowWhatsapp: v })} label="WhatsApp" />
                <Switch checked={p.allowEmail} onChange={(v) => setP({ ...p, allowEmail: v })} label="Email" />
              </div>
            </section>
            <section className="space-y-2">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Offers and greetings</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Switch checked={p.promoWhatsapp} onChange={(v) => setP({ ...p, promoWhatsapp: v })} label="WhatsApp" />
                <Switch checked={p.promoEmail} onChange={(v) => setP({ ...p, promoEmail: v })} label="Email" />
              </div>
            </section>
            {done && <p className="text-[13px] rounded-lg px-3 py-2 bg-emerald-50 text-emerald-800">{done}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                className="btn btn-primary flex-1 justify-center"
                disabled={busy}
                onClick={() => save({ allowWhatsapp: p.allowWhatsapp, allowEmail: p.allowEmail, promoWhatsapp: p.promoWhatsapp, promoEmail: p.promoEmail })}
              >
                Save preferences
              </button>
              <button type="button" className="btn btn-secondary flex-1 justify-center" disabled={busy} onClick={() => save({ unsubscribeAll: true })}>
                Stop all offers
              </button>
            </div>
            <p className="text-[11.5px] text-slate-400">On WhatsApp you can also reply STOP to stop offers, or START to get them again.</p>
          </>
        )}
      </div>
    </div>
  );
}
