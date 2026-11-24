import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Icon, Switch, Toast } from "./ui";
import { messagingApi, type MessagingSettings } from "../api/messaging";
import { apiErrorMessage } from "../api/client";

/**
 * Guided setup for where this shop's messages come from: its own email (Gmail App Password
 * or any SMTP mailbox) and its own WhatsApp Business number (official Cloud API).
 * Used in Settings › Communication and Messaging › Channels.
 */

type MailMode = "gmail" | "smtp" | "platform";

const PROVIDERS: { key: string; label: string; host: string; port: number }[] = [
  { key: "hostinger", label: "Hostinger Email", host: "smtp.hostinger.com", port: 465 },
  { key: "zoho", label: "Zoho Mail (India)", host: "smtp.zoho.in", port: 465 },
  { key: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587 },
  { key: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 465 },
  { key: "custom", label: "Other (enter details)", host: "", port: 465 },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-800 underline underline-offset-2">
      {children}
      <Icon name="link" className="w-3 h-3" />
    </a>
  );
}

function Step({ n, title, children }: { n: number; title: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 shrink-0 rounded-full bg-white ring-1 ring-slate-300 text-[11.5px] font-bold text-slate-700 flex items-center justify-center">{n}</span>
      <div className="min-w-0 text-[12.5px] text-slate-700 leading-relaxed pt-0.5">
        <div className="font-semibold text-navy-900">{title}</div>
        {children}
      </div>
    </li>
  );
}

function StatusTile({ icon, title, ready, line }: { icon: "mail" | "message"; title: string; ready: boolean; line: string }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ring-inset flex items-start gap-3 min-w-0 ${ready ? "bg-emerald-50/70 ring-emerald-200" : "bg-amber-50/70 ring-amber-200"}`}>
      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-bold text-navy-900">{title}</span>
          <span className={`badge ${ready ? "badge-active" : "badge-warn"}`}>{ready ? "Ready" : "Not set up"}</span>
        </div>
        <p className="text-[12px] text-slate-600 break-words">{line}</p>
      </div>
    </div>
  );
}

export default function CommunicationSetup({ onChanged }: { onChanged?: () => void }) {
  const [s, setS] = useState<MessagingSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // Email
  const [mode, setMode] = useState<MailMode>("gmail");
  const [emOn, setEmOn] = useState(true);
  const [gmail, setGmail] = useState({ user: "", password: "" });
  const [provider, setProvider] = useState("hostinger");
  const [smtp, setSmtp] = useState({ host: "smtp.hostinger.com", port: "465", secure: true, user: "", password: "" });
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [platformAddress, setPlatformAddress] = useState("");
  const [testTo, setTestTo] = useState("");

  // WhatsApp
  const [wa, setWa] = useState({ enabled: false, displayNumber: "", phoneNumberId: "", businessAccountId: "", accessToken: "", appSecret: "", apiVersion: "v21.0", verifyToken: "" });
  const [waTestTo, setWaTestTo] = useState("");
  const [waTpls, setWaTpls] = useState<Awaited<ReturnType<typeof messagingApi.waTemplates>> | null>(null);

  const say = (text: string, ok = true) => {
    setToast({ text, ok });
    window.setTimeout(() => setToast(null), 4500);
  };

  const apply = useCallback((d: MessagingSettings) => {
    setS(d);
    const acct = d.email.account;
    setEmOn(d.email.enabled);
    setSenderName(d.email.senderName || "");
    setReplyTo(d.email.replyTo || "");
    setPlatformAddress(d.email.senderAddress || "");
    if (acct?.connected) {
      if (acct.host === "smtp.gmail.com") {
        setMode("gmail");
        setGmail({ user: acct.user, password: "" });
      } else {
        setMode("smtp");
        const p = PROVIDERS.find((x) => x.host === acct.host);
        setProvider(p ? p.key : "custom");
        setSmtp({ host: acct.host, port: String(acct.port || 465), secure: !!acct.secure, user: acct.user, password: "" });
      }
    } else {
      setMode(d.readiness?.email.ready ? "platform" : "gmail");
    }
    setWa({
      enabled: d.whatsapp.enabled,
      displayNumber: d.whatsapp.displayNumber || "",
      phoneNumberId: d.whatsapp.phoneNumberId || "",
      businessAccountId: d.whatsapp.businessAccountId || "",
      accessToken: "",
      appSecret: "",
      apiVersion: d.whatsapp.apiVersion || "v21.0",
      verifyToken: d.whatsapp.verifyToken || "",
    });
    setWaTestTo((v) => v || d.whatsapp.displayNumber || "");
  }, []);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      apply(await messagingApi.settings());
    } catch (err) {
      setLoadError(apiErrorMessage(err));
    }
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<any>, reload = true) => {
    setBusy(key);
    try {
      const r = await fn();
      say(r?.message || "Saved");
      if (reload) {
        await load();
        onChanged?.();
      }
      return true;
    } catch (err) {
      say(apiErrorMessage(err), false);
      return false;
    } finally {
      setBusy("");
    }
  };

  if (loadError) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-[13px] text-rose-700">Could not load communication settings: {loadError}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!s) {
    return <div className="card p-6 text-[13px] text-slate-500">Loading communication settings…</div>;
  }

  const acct = s.email.account;
  const emailReady = !!s.readiness?.email.ready;
  const waReady = !!s.readiness?.whatsapp.ready;
  const gmailPass = gmail.password.replace(/\s+/g, "");

  const emailBody = (): any | string => {
    const body: any = { enabled: emOn, senderName: senderName.trim(), replyTo: replyTo.trim() };
    if (body.replyTo && !EMAIL_RE.test(body.replyTo)) return "Reply-to email is not valid";
    if (mode === "platform") {
      body.senderAddress = platformAddress.trim();
      if (acct?.connected) body.clearAccount = true;
      return body;
    }
    if (mode === "gmail") {
      if (!EMAIL_RE.test(gmail.user.trim())) return "Enter the shop's Gmail address";
      const keepGmail = !!acct?.connected && acct.host === "smtp.gmail.com" && acct.user === gmail.user.trim();
      if (gmailPass.length !== 16 && !(keepGmail && !gmailPass)) return "The App Password from Google has 16 letters";
      body.account = { host: "smtp.gmail.com", port: 465, secure: true, user: gmail.user.trim(), password: gmailPass || undefined };
      return body;
    }
    if (!smtp.host.trim()) return "Enter the SMTP server";
    if (!EMAIL_RE.test(smtp.user.trim())) return "Enter the full email address";
    const keepSmtp = !!acct?.connected && acct.host === smtp.host.trim().toLowerCase() && acct.user === smtp.user.trim();
    if (!smtp.password && !keepSmtp) return "Enter the email password";
    body.account = { host: smtp.host.trim(), port: Number(smtp.port), secure: smtp.secure, user: smtp.user.trim(), password: smtp.password || undefined };
    return body;
  };

  const saveEmail = async (thenTest: boolean) => {
    const body = emailBody();
    if (typeof body === "string") return say(body, false);
    if (thenTest && !EMAIL_RE.test(testTo.trim())) return say("Enter an email address to send the test to", false);
    const ok = await run("email", () => messagingApi.saveEmail(body));
    if (ok && thenTest) await run("etest", () => messagingApi.testEmail(testTo.trim()), false);
  };

  const saveWhatsApp = async (thenVerify: boolean) => {
    if (wa.enabled && (!wa.phoneNumberId.trim() || (!s.whatsapp.accessTokenSet && !wa.accessToken.trim()))) {
      return say("Enter the Phone number ID and the permanent access token", false);
    }
    const ok = await run("wa", () =>
      messagingApi.saveWhatsApp({ ...wa, accessToken: wa.accessToken.trim() || undefined, appSecret: wa.appSecret.trim() || undefined })
    );
    if (ok && thenVerify) await run("verify", () => messagingApi.verifyWhatsApp());
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => say("Copied"));

  return (
    <div className="space-y-5">
      {toast && <Toast text={toast.text} ok={toast.ok} />}

      {/* Where messages come from right now */}
      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="card-title">Communication setup</h2>
          <p className="text-[12.5px] text-slate-500">
            Bills, payment reminders and offers go to your customers from <b>your shop's own email and WhatsApp number</b>. Both are optional, and each works on its own.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatusTile
            icon="mail"
            title="Email"
            ready={emailReady}
            line={!s.email.enabled ? "Turned off" : acct?.connected ? `Sending from ${acct.user}` : emailReady ? "Sending from the NSYU platform email" : "Not connected yet. Add your Gmail below."}
          />
          <StatusTile
            icon="message"
            title="WhatsApp"
            ready={waReady}
            line={
              waReady
                ? `Sending from ${s.whatsapp.displayNumber || "your WhatsApp Business number"}`
                : !s.whatsapp.enabled
                ? "Turned off. Optional, Meta charges per message."
                : "Not connected yet. Add the details below."
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* ───────────── EMAIL ───────────── */}
        <section className="card p-5 sm:p-6 space-y-5 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-600/10 flex items-center justify-center shrink-0">
                <Icon name="mail" className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="card-title">Email</h3>
                <p className="text-[12.5px] text-slate-500">Free. About 5 minutes with Gmail.</p>
              </div>
            </div>
            <Switch checked={emOn} onChange={setEmOn} label="Send email" />
          </div>

          <div>
            <span className="label">Send emails from</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  ["gmail", "Shop's Gmail", "Recommended · free"],
                  ["smtp", "Business email", "Hostinger, Zoho, Outlook…"],
                  ["platform", "NSYU email", "No setup, shop name shown"],
                ] as const
              ).map(([key, title, sub]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={mode === key}
                  onClick={() => setMode(key)}
                  className={`text-left rounded-xl px-3 py-2.5 ring-1 ring-inset transition ${mode === key ? "bg-sky-50 ring-sky-500" : "bg-white ring-slate-200 hover:ring-slate-300"}`}
                >
                  <div className="text-[13px] font-semibold text-navy-900">{title}</div>
                  <div className="text-[11.5px] text-slate-500">{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {mode === "gmail" && (
            <div className="space-y-4">
              <ol className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-4 space-y-3">
                <Step n={1} title="Sign in to the shop's Gmail and turn on 2-Step Verification">
                  <ExtLink href="https://myaccount.google.com/signinoptions/twosv">Open 2-Step Verification</ExtLink>
                </Step>
                <Step n={2} title="Create an App Password named “NSYU” and copy the 16 letters">
                  <ExtLink href="https://myaccount.google.com/apppasswords">Open App Passwords</ExtLink>
                  <div className="text-[11.5px] text-slate-500">Your normal Gmail password will not work here.</div>
                </Step>
                <Step n={3} title="Paste both below, then Save & send test" />
              </ol>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Shop Gmail address">
                  <input className="input" type="email" autoComplete="off" placeholder="yourshop@gmail.com" value={gmail.user} onChange={(e) => setGmail({ ...gmail, user: e.target.value })} />
                </Field>
                <Field
                  label="App Password"
                  hint={acct?.passwordSet && acct.host === "smtp.gmail.com" && !gmail.password ? "Saved. Leave empty to keep it." : `${gmailPass.length}/16 letters`}
                >
                  <input
                    className="input font-mono"
                    type="password"
                    autoComplete="new-password"
                    placeholder={acct?.passwordSet && acct.host === "smtp.gmail.com" ? "••••••••" : "abcd efgh ijkl mnop"}
                    value={gmail.password}
                    onChange={(e) => setGmail({ ...gmail, password: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}

          {mode === "smtp" && (
            <div className="space-y-4">
              <Field label="Email provider" hint="Ask your email provider for the SMTP details if yours isn't listed">
                <select
                  className="input"
                  value={provider}
                  onChange={(e) => {
                    const p = PROVIDERS.find((x) => x.key === e.target.value)!;
                    setProvider(p.key);
                    if (p.key !== "custom") setSmtp({ ...smtp, host: p.host, port: String(p.port), secure: p.port === 465 });
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email address" hint="Emails are sent from this address">
                  <input className="input" type="email" autoComplete="off" placeholder="sales@yourshop.in" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
                </Field>
                <Field label="Email password" hint={acct?.passwordSet && mode === "smtp" && !smtp.password ? "Saved. Leave empty to keep it." : "The password of this mailbox"}>
                  <input className="input" type="password" autoComplete="new-password" placeholder={acct?.passwordSet ? "••••••••" : ""} value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} />
                </Field>
                {provider === "custom" && (
                  <>
                    <Field label="SMTP server">
                      <input className="input" placeholder="smtp.example.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
                    </Field>
                    <Field label="Port" hint="465 (SSL) or 587">
                      <input
                        className="input"
                        inputMode="numeric"
                        value={smtp.port}
                        onChange={(e) => {
                          const port = e.target.value.replace(/\D/g, "").slice(0, 5);
                          setSmtp({ ...smtp, port, secure: port === "465" ? true : port === "587" ? false : smtp.secure });
                        }}
                      />
                    </Field>
                  </>
                )}
              </div>
              {provider !== "custom" && (
                <p className="text-[11.5px] text-slate-500">
                  Server <span className="font-mono">{smtp.host}</span>, port <span className="font-mono">{smtp.port}</span> (filled in for you).
                </p>
              )}
            </div>
          )}

          {mode === "platform" && (
            <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-4 text-[12.5px] text-slate-600 space-y-3">
              <p>Emails go out from the NSYU platform address with your shop name. Customers' replies go to the reply-to address below.</p>
              <Field label="Sender email (optional)" hint="Gmail may still show the platform address">
                <input className="input" type="email" value={platformAddress} onChange={(e) => setPlatformAddress(e.target.value)} />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name shown to customers" hint="Shown as “From” in the inbox">
              <input className="input" placeholder="Sharma Electronics" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </Field>
            <Field label="Reply-to email (optional)" hint="Where customer replies should go">
              <input className="input" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
            </Field>
          </div>

          <div className="rounded-2xl bg-sky-50/60 ring-1 ring-inset ring-sky-200/70 p-4 space-y-2">
            <span className="label">Send a test email to</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input className="input" type="email" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button type="button" className="btn btn-primary shrink-0" disabled={!!busy} onClick={() => saveEmail(true)}>
                {busy === "email" || busy === "etest" ? "Working…" : "Save & send test"}
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => saveEmail(false)}>
              Save without testing
            </button>
          </div>
        </section>

        {/* ───────────── WHATSAPP ───────────── */}
        <section className="card p-5 sm:p-6 space-y-5 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/10 flex items-center justify-center shrink-0">
                <Icon name="message" className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="card-title">WhatsApp Business</h3>
                <p className="text-[12.5px] text-slate-500">Official Meta Cloud API. Meta charges per message.</p>
              </div>
            </div>
            <Switch checked={wa.enabled} onChange={(v) => setWa({ ...wa, enabled: v })} label="Send WhatsApp" />
          </div>

          <div className="rounded-2xl bg-amber-50/70 ring-1 ring-inset ring-amber-200 p-3.5 text-[12px] text-amber-900 leading-relaxed">
            <b>Cost (paid to Meta, not NSYU):</b> bills and reminders about ₹0.12–0.15 per message, offers about ₹0.80–0.90. Replies within 24 hours of a customer's message are free.
            You need a number that is <b>not</b> already used in the WhatsApp app.
          </div>

          <details className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-4 group" open={!s.whatsapp.accessTokenSet}>
            <summary className="cursor-pointer text-[13px] font-bold text-navy-900 select-none">How to get these details (one time, about 1 hour)</summary>
            <ol className="mt-3 space-y-3">
              <Step n={1} title="Create a Meta Business account">
                <ExtLink href="https://business.facebook.com/">business.facebook.com</ExtLink>
              </Step>
              <Step n={2} title="Create an app (type “Business”) and add the WhatsApp product">
                <ExtLink href="https://developers.facebook.com/apps/">developers.facebook.com/apps</ExtLink>
              </Step>
              <Step n={3} title="WhatsApp › API Setup: add your shop number and verify it by OTP">
                Copy the <b>Phone number ID</b> and <b>WhatsApp Business Account ID</b> shown there.
              </Step>
              <Step n={4} title="Business settings › System users: create an Admin user and generate a token">
                Give it your app and WhatsApp account, tick <span className="font-mono">whatsapp_business_messaging</span> and{" "}
                <span className="font-mono">whatsapp_business_management</span>, and set it to never expire.{" "}
                <ExtLink href="https://business.facebook.com/settings/system-users">Open System users</ExtLink>
              </Step>
              <Step n={5} title="Add a payment method in Meta Business settings" />
              <Step n={6} title="Paste the details below, Save, then send a test message to your phone" />
            </ol>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Shop WhatsApp number" hint="The number customers will see">
              <input className="input" inputMode="tel" placeholder="+91 98765 43210" value={wa.displayNumber} onChange={(e) => setWa({ ...wa, displayNumber: e.target.value })} />
            </Field>
            <Field label="Phone number ID" hint="WhatsApp › API Setup">
              <input className="input font-mono" inputMode="numeric" value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value.trim() })} />
            </Field>
            <Field label="WhatsApp Business Account ID" hint="Same page, needed for templates">
              <input className="input font-mono" inputMode="numeric" value={wa.businessAccountId} onChange={(e) => setWa({ ...wa, businessAccountId: e.target.value.trim() })} />
            </Field>
            <Field
              label="Permanent access token"
              hint={s.whatsapp.accessTokenSet ? `Saved (${s.whatsapp.accessTokenHint || "••••"}). Leave empty to keep it.` : "From System users › Generate token. Not the 24-hour test token."}
            >
              <input className="input" type="password" autoComplete="new-password" placeholder={s.whatsapp.accessTokenSet ? "••••••••" : ""} value={wa.accessToken} onChange={(e) => setWa({ ...wa, accessToken: e.target.value })} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => saveWhatsApp(true)}>
              {busy === "wa" || busy === "verify" ? "Checking…" : "Save & check connection"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => saveWhatsApp(false)}>
              Save only
            </button>
          </div>

          <div className="rounded-2xl bg-emerald-50/60 ring-1 ring-inset ring-emerald-200/70 p-4 space-y-2">
            <span className="label">Send a test WhatsApp to</span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input className="input" inputMode="tel" placeholder="98765 43210" value={waTestTo} onChange={(e) => setWaTestTo(e.target.value)} />
              <button
                type="button"
                className="btn btn-secondary shrink-0"
                disabled={!!busy || !s.whatsapp.accessTokenSet}
                onClick={() => run("watest", () => messagingApi.testWhatsApp(waTestTo), false)}
              >
                {busy === "watest" ? "Sending…" : "Send test"}
              </button>
            </div>
            <p className="field-hint">Sends Meta's “hello_world” message. Save the details first.</p>
          </div>

          <details className="rounded-2xl ring-1 ring-inset ring-slate-200/70 p-4">
            <summary className="cursor-pointer text-[13px] font-semibold text-slate-700 select-none">Advanced: delivery ticks, templates</summary>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="App secret" hint={s.whatsapp.appSecretSet ? "Saved. Leave empty to keep it." : "Meta app › Settings › Basic"}>
                  <input className="input" type="password" autoComplete="new-password" placeholder={s.whatsapp.appSecretSet ? "••••••••" : ""} value={wa.appSecret} onChange={(e) => setWa({ ...wa, appSecret: e.target.value })} />
                </Field>
                <Field label="Graph API version">
                  <input className="input" value={wa.apiVersion} onChange={(e) => setWa({ ...wa, apiVersion: e.target.value })} placeholder="v21.0" />
                </Field>
              </div>
              <div className="min-w-0">
                <span className="label">Webhook callback URL</span>
                <div className="flex gap-2">
                  <input className="input font-mono text-[12px]" readOnly value={s.whatsapp.webhookUrl} />
                  <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => copy(s.whatsapp.webhookUrl)}>
                    Copy
                  </button>
                </div>
              </div>
              <div className="min-w-0">
                <span className="label">Verify token</span>
                <div className="flex gap-2">
                  <input className="input font-mono text-[12px]" value={wa.verifyToken} onChange={(e) => setWa({ ...wa, verifyToken: e.target.value })} />
                  <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => copy(wa.verifyToken)}>
                    Copy
                  </button>
                </div>
              </div>
              <p className="text-[11.5px] text-slate-500">
                In your Meta app, open WhatsApp › Configuration, paste this URL and verify token, and subscribe to <b>messages</b>. Then press Save above.
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!!busy || !s.whatsapp.accessTokenSet}
                onClick={async () => {
                  setBusy("tpl");
                  try {
                    setWaTpls(await messagingApi.waTemplates());
                  } catch (err) {
                    say(apiErrorMessage(err), false);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                Show approved templates
              </button>
              {waTpls && (
                <div className="table-wrap">
                  <div className="table-scroll">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Lang</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waTpls.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-4 text-slate-500">
                              No templates yet. Create them in WhatsApp Manager › Message templates.
                            </td>
                          </tr>
                        )}
                        {waTpls.map((t) => (
                          <tr key={t.name + t.language} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono">{t.name}</td>
                            <td className="px-3 py-2">{t.language}</td>
                            <td className="px-3 py-2">
                              <span className={`badge ${t.status === "APPROVED" ? "badge-active" : "badge-warn"}`}>{t.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
