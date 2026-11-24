import { useEffect, useState } from "react";
import { Icon, Switch } from "../../components/ui";
import { messagingApi } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";
import type { MessagingCtx } from "./Messaging";
import { ChannelPill } from "./Messaging";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export default function Channels({ ctx }: { ctx: MessagingCtx }) {
  const s = ctx.settings;
  const [wa, setWa] = useState({ enabled: false, phoneNumberId: "", businessAccountId: "", displayNumber: "", apiVersion: "v21.0", accessToken: "", appSecret: "", verifyToken: "" });
  const [em, setEm] = useState({ enabled: true, senderName: "", senderAddress: "", replyTo: "" });
  const [busy, setBusy] = useState("");
  const [testTo, setTestTo] = useState("");
  const [waTpls, setWaTpls] = useState<Awaited<ReturnType<typeof messagingApi.waTemplates>> | null>(null);

  useEffect(() => {
    if (!s) return;
    setWa({ ...s.whatsapp, accessToken: "", appSecret: "" } as any);
    setEm(s.email);
  }, [s]);

  const run = async (key: string, fn: () => Promise<any>, after?: () => void) => {
    setBusy(key);
    try {
      const r = await fn();
      ctx.toast(r?.message || "Saved");
      await ctx.reload();
      after?.();
    } catch (err) {
      ctx.toast(apiErrorMessage(err), false);
    } finally {
      setBusy("");
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => ctx.toast("Copied"));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* WhatsApp */}
      <section className="card p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="icon-tile bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/10 w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
              <Icon name="message" className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">WhatsApp Business</h2>
              <p className="text-[12.5px] text-slate-500">Official WhatsApp Business Cloud API (Meta)</p>
            </div>
          </div>
          {ctx.readiness && <ChannelPill label="WhatsApp" ready={ctx.readiness.whatsapp.ready} reason={ctx.readiness.whatsapp.reason} />}
        </div>

        <Switch checked={wa.enabled} onChange={(v) => setWa({ ...wa, enabled: v })} label="Send messages through WhatsApp" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone number ID" hint="WhatsApp Manager → API setup">
            <input className="input" value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="WhatsApp Business Account ID" hint="Needed to load approved templates">
            <input className="input" value={wa.businessAccountId} onChange={(e) => setWa({ ...wa, businessAccountId: e.target.value })} inputMode="numeric" />
          </Field>
          <Field label="Sending number" hint="Shown to you only, e.g. +91 98…">
            <input className="input" value={wa.displayNumber} onChange={(e) => setWa({ ...wa, displayNumber: e.target.value })} />
          </Field>
          <Field label="Graph API version">
            <input className="input" value={wa.apiVersion} onChange={(e) => setWa({ ...wa, apiVersion: e.target.value })} placeholder="v21.0" />
          </Field>
          <Field label="Permanent access token" hint={s?.whatsapp.accessTokenSet ? `Saved (${s.whatsapp.accessTokenHint}). Leave empty to keep it.` : "System-user token with whatsapp_business_messaging"}>
            <input className="input" type="password" autoComplete="new-password" value={wa.accessToken} onChange={(e) => setWa({ ...wa, accessToken: e.target.value })} placeholder={s?.whatsapp.accessTokenSet ? "••••••••" : ""} />
          </Field>
          <Field label="App secret" hint={s?.whatsapp.appSecretSet ? "Saved. Leave empty to keep it." : "Meta app → Settings → Basic. Verifies webhook calls."}>
            <input className="input" type="password" autoComplete="new-password" value={wa.appSecret} onChange={(e) => setWa({ ...wa, appSecret: e.target.value })} placeholder={s?.whatsapp.appSecretSet ? "••••••••" : ""} />
          </Field>
        </div>

        <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-4 space-y-3">
          <div className="text-[12.5px] font-bold text-navy-900">Webhook (delivery & read receipts)</div>
          <div className="grid grid-cols-1 gap-3">
            <div className="min-w-0">
              <span className="label">Callback URL</span>
              <div className="flex gap-2">
                <input className="input font-mono text-[12px]" readOnly value={s?.whatsapp.webhookUrl || ""} />
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => copy(s?.whatsapp.webhookUrl || "")}>Copy</button>
              </div>
            </div>
            <div className="min-w-0">
              <span className="label">Verify token</span>
              <div className="flex gap-2">
                <input className="input font-mono text-[12px]" value={wa.verifyToken} onChange={(e) => setWa({ ...wa, verifyToken: e.target.value })} />
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => copy(wa.verifyToken)}>Copy</button>
              </div>
            </div>
          </div>
          <p className="text-[11.5px] text-slate-500">In your Meta app, add this URL and verify token under WhatsApp → Configuration, then subscribe to the <b>messages</b> field.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy === "wa"}
            onClick={() =>
              run("wa", () =>
                messagingApi.saveWhatsApp({
                  ...wa,
                  accessToken: wa.accessToken || undefined,
                  appSecret: wa.appSecret || undefined,
                })
              )
            }
          >
            {busy === "wa" ? "Saving…" : "Save WhatsApp"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy === "verify" || !s?.whatsapp.accessTokenSet} onClick={() => run("verify", () => messagingApi.verifyWhatsApp())}>
            {busy === "verify" ? "Checking…" : "Test connection"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy === "tpl" || !s?.whatsapp.accessTokenSet}
            onClick={async () => {
              setBusy("tpl");
              try {
                setWaTpls(await messagingApi.waTemplates());
              } catch (err) {
                ctx.toast(apiErrorMessage(err), false);
              } finally {
                setBusy("");
              }
            }}
          >
            Approved templates
          </button>
        </div>

        {waTpls && (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Lang</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Variables</th>
                  </tr>
                </thead>
                <tbody>
                  {waTpls.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500">No templates on this WhatsApp Business Account yet. Create them in WhatsApp Manager.</td>
                    </tr>
                  )}
                  {waTpls.map((t) => (
                    <tr key={t.name + t.language} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{t.name}</td>
                      <td className="px-3 py-2">{t.language}</td>
                      <td className="px-3 py-2">
                        <span className={`badge ${t.status === "APPROVED" ? "badge-active" : "badge-warn"}`}>{t.status}</span>
                      </td>
                      <td className="px-3 py-2 tabular">{t.paramCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Email */}
      <section className="card p-5 sm:p-6 space-y-5 min-w-0 self-start">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/10 flex items-center justify-center shrink-0">
              <Icon name="mail" className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title">Email</h2>
              <p className="text-[12.5px] text-slate-500">Uses your existing Gmail / SMTP setup — nothing to reconnect</p>
            </div>
          </div>
          {ctx.readiness && <ChannelPill label="Email" ready={ctx.readiness.email.ready} reason={ctx.readiness.email.reason} />}
        </div>
        <Switch checked={em.enabled} onChange={(v) => setEm({ ...em, enabled: v })} label="Send messages by email" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Sender name" hint="Shown as “From” in the inbox">
            <input className="input" value={em.senderName} onChange={(e) => setEm({ ...em, senderName: e.target.value })} />
          </Field>
          <Field label="Sender email" hint="Gmail may send as the signed-in address">
            <input className="input" type="email" value={em.senderAddress} onChange={(e) => setEm({ ...em, senderAddress: e.target.value })} />
          </Field>
          <Field label="Reply-to email">
            <input className="input" type="email" value={em.replyTo} onChange={(e) => setEm({ ...em, replyTo: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={busy === "email"} onClick={() => run("email", () => messagingApi.saveEmail(em))}>
            {busy === "email" ? "Saving…" : "Save email"}
          </button>
        </div>
        <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-4">
          <span className="label">Send a test email</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="input" type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button type="button" className="btn btn-secondary shrink-0" disabled={busy === "test" || !testTo} onClick={() => run("test", () => messagingApi.testEmail(testTo))}>
              {busy === "test" ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          WhatsApp and email work independently — if one is off or not connected, messages still go out on the other.
        </p>
      </section>
    </div>
  );
}
