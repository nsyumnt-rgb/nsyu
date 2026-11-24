import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar, ChoiceGroup, Icon, SearchInput, Segmented, Switch } from "../../components/ui";
import { messagingApi, type AudienceFilters, type Campaign, type ChannelSel, type MessageTemplate, type Recipient } from "../../api/messaging";
import { listCategories } from "../../api/categories";
import { apiErrorMessage } from "../../api/client";
import type { MessagingCtx } from "./Messaging";
import { Attachments, EmailFrame, StatusChip, VariableChips, WhatsAppBubble, useInsertable } from "./shared";

const AUTO_VARS = ["customer_name", "shop_name", "due_amount", "payment_link", "unsubscribe_link"];
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function RecipientRow({ r, selected, onToggle, multi }: { r: Recipient; selected: boolean; onToggle: () => void; multi: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition ring-1 ring-inset ${selected ? "bg-brand-50/70 ring-brand-500/40" : "ring-transparent hover:bg-slate-50"}`}
    >
      {multi ? (
        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300"}`}>
          {selected && <Icon name="check" className="w-3 h-3" strokeWidth={3} />}
        </span>
      ) : (
        <Avatar name={r.name} size="sm" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-navy-900 truncate">{r.name}</div>
        <div className="text-[11.5px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 min-w-0">
          <span className={`inline-flex items-center gap-1 ${r.whatsapp ? "" : "text-slate-300"}`}>
            <Icon name="message" className="w-3 h-3" /> {r.whatsapp ? `+${r.whatsapp}` : "no WhatsApp"}
          </span>
          <span className={`inline-flex items-center gap-1 min-w-0 ${r.email ? "" : "text-slate-300"}`}>
            <Icon name="mail" className="w-3 h-3 shrink-0" /> <span className="truncate">{r.email || "no email"}</span>
          </span>
        </div>
      </div>
      {r.dueAmount > 0 && <span className="text-[11.5px] font-bold text-rose-600 tabular shrink-0">{inr(r.dueAmount)} due</span>}
    </button>
  );
}

export default function Composer({ ctx }: { ctx: MessagingCtx }) {
  const [mode, setMode] = useState<"single" | "group">("single");
  const [groupMode, setGroupMode] = useState<"pick" | "filter">("pick");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Map<number, Recipient>>(new Map());
  const [filters, setFilters] = useState<AudienceFilters>({ customerType: "", dues: "", thisShopOnly: false });
  const dFilters = useDebounced(filters, 400);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  const [channels, setChannels] = useState<ChannelSel>("both");
  const [messageType, setMessageType] = useState<"transactional" | "promotional">("transactional");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [waBody, setWaBody] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});

  const [when, setWhen] = useState<"now" | "later" | "repeat">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [repeat, setRepeat] = useState({ every: "week", interval: 1, until: "" });

  const [summary, setSummary] = useState<Awaited<ReturnType<typeof messagingApi.audience>> | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof messagingApi.preview>> | null>(null);
  const [previewTab, setPreviewTab] = useState<"whatsapp" | "email">("whatsapp");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<(Campaign & { deliveries?: any[] }) | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);
  const waField = useInsertable();
  const emailField = useInsertable();

  useEffect(() => {
    messagingApi.templates().then((t) => setTemplates(t.filter((x) => x.is_active))).catch(() => {});
    listCategories()
      .then((r: any) => setCategories((r.data?.data || r.data || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  // Opened from a customer's page: /app/messaging?customer=<id>
  const [params] = useSearchParams();
  const presetCustomer = Number(params.get("customer")) || 0;
  useEffect(() => {
    if (!presetCustomer) return;
    messagingApi
      .customers("", [presetCustomer])
      .then((r) => r[0] && (setMode("single"), setSelected(new Map([[r[0].id, r[0]]]))))
      .catch(() => {});
  }, [presetCustomer]);

  useEffect(() => {
    let live = true;
    messagingApi.customers(dSearch).then((r) => live && setResults(r)).catch(() => live && setResults([]));
    return () => {
      live = false;
    };
  }, [dSearch]);

  const template = templates.find((t) => t.id === templateId) || null;
  useEffect(() => {
    if (!template) return;
    setWaBody(template.whatsapp_body || "");
    setSubject(template.email_subject || "");
    setEmailBody(template.email_html || "");
    setMessageType(template.message_type);
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const audience = useMemo(() => {
    if (mode === "single" || groupMode === "pick") return { mode: "selected" as const, customerIds: [...selected.keys()] };
    return { mode: "filter" as const, filters: dFilters };
  }, [mode, groupMode, selected, dFilters]);

  useEffect(() => {
    if (audience.mode === "selected" && audience.customerIds.length === 0) {
      setSummary(null);
      return;
    }
    let live = true;
    messagingApi.audience(audience, channels, messageType).then((s) => live && setSummary(s)).catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [audience, channels, messageType]);

  const firstRecipientId = audience.mode === "selected" ? audience.customerIds[0] : summary?.recipients[0]?.id;
  const usedVars = useMemo(() => {
    const all = `${waBody} ${subject} ${emailBody} ${(template?.wa_template_params || []).join(" ")}`;
    return [...new Set([...all.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]))].filter((k) => !AUTO_VARS.includes(k));
  }, [waBody, subject, emailBody, template]);

  // Debounce a string so a new object on every render can't keep re-firing the request
  const previewKey = useDebounced(JSON.stringify({ waBody, subject, emailBody, templateId, firstRecipientId, extraVars, messageType, attachments }), 450);
  const dPreviewInput = useMemo(() => JSON.parse(previewKey) as { waBody: string; subject: string; emailBody: string; templateId: number | ""; firstRecipientId?: number; extraVars: Record<string, string>; messageType: string; attachments: { name: string; url: string }[] }, [previewKey]);
  useEffect(() => {
    messagingApi
      .preview({
        templateId: dPreviewInput.templateId || undefined,
        customerId: dPreviewInput.firstRecipientId,
        whatsappBody: dPreviewInput.waBody,
        emailSubject: dPreviewInput.subject,
        emailHtml: dPreviewInput.emailBody,
        variables: dPreviewInput.extraVars,
        messageType: dPreviewInput.messageType,
        attachments: dPreviewInput.attachments,
      })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [dPreviewInput]);

  useEffect(() => {
    if (channels === "email") setPreviewTab("email");
    if (channels === "whatsapp") setPreviewTab("whatsapp");
  }, [channels]);

  // Live delivery status after sending
  const poll = useRef<number | null>(null);
  useEffect(() => () => {
    if (poll.current) window.clearInterval(poll.current);
  }, []);
  const watch = (id: number) => {
    let n = 0;
    const tick = async () => {
      n++;
      try {
        const c = await messagingApi.campaign(id);
        setSent(c);
        const pending = c.deliveries.some((d) => d.status === "queued" || d.status === "sending");
        if ((!pending && n > 1) || n > 20) {
          if (poll.current) window.clearInterval(poll.current);
          ctx.reload();
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    if (poll.current) window.clearInterval(poll.current);
    poll.current = window.setInterval(tick, 3000);
  };

  const toggle = (r: Recipient) => {
    setSelected((prev) => {
      const next = new Map(mode === "single" ? [] : prev);
      if (prev.has(r.id) && mode === "group") next.delete(r.id);
      else next.set(r.id, r);
      return next;
    });
  };

  const wantWa = channels !== "email";
  const wantEmail = channels !== "whatsapp";
  const waReady = ctx.readiness?.whatsapp.ready;
  const emailReady = ctx.readiness?.email.ready;
  const hasWa = !!(waBody.trim() || template?.wa_template_name);
  const hasEmail = !!emailBody.trim();
  const count = audience.mode === "selected" ? audience.customerIds.length : summary?.total || 0;
  const problems = [
    !count && "Choose who to send to",
    wantWa && !hasWa && "Write the WhatsApp message",
    wantEmail && !hasEmail && "Write the email",
    wantWa && !wantEmail && !waReady && ctx.readiness?.whatsapp.reason,
    wantEmail && !wantWa && !emailReady && ctx.readiness?.email.reason,
    channels === "both" && !waReady && !emailReady && "Neither channel is connected",
    when === "later" && !scheduledAt && "Pick a date and time",
  ].filter(Boolean) as string[];

  const send = async () => {
    setSending(true);
    try {
      const r = await messagingApi.send({
        channels,
        audience,
        messageType,
        templateId: templateId || undefined,
        whatsappBody: wantWa && waBody !== (template?.whatsapp_body || "") ? waBody : wantWa && !template ? waBody : undefined,
        emailSubject: wantEmail && subject !== (template?.email_subject || "") ? subject : wantEmail && !template ? subject : undefined,
        emailHtml: wantEmail && emailBody !== (template?.email_html || "") ? emailBody : wantEmail && !template ? emailBody : undefined,
        attachments,
        variables: extraVars,
        scheduledAt: when === "later" ? new Date(scheduledAt).toISOString() : when === "repeat" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        recurrence: when === "repeat" ? { every: repeat.every, interval: repeat.interval, until: repeat.until || null } : undefined,
      });
      ctx.toast(r.message);
      if (r.data.campaign.status === "scheduled") {
        ctx.reload();
        setSent(null);
      } else watch(r.data.campaign.id);
    } catch (err) {
      ctx.toast(apiErrorMessage(err, "Could not send"), false);
    } finally {
      setSending(false);
    }
  };

  const setF = (patch: Partial<AudienceFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 space-y-5 min-w-0">
        {/* 1. Recipients */}
        <section className="card p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="card-title flex items-center gap-2"><span className="eyebrow !mb-0">1</span> Who should receive it?</h2>
            <Segmented size="sm" value={mode} onChange={(k) => { setMode(k); setSelected(new Map()); }} options={[{ key: "single", label: "One customer" }, { key: "group", label: "Group" }]} />
          </div>

          {mode === "group" && (
            <Segmented size="sm" value={groupMode} onChange={setGroupMode} options={[{ key: "pick", label: "Pick customers", count: selected.size }, { key: "filter", label: "By filters" }]} />
          )}

          {(mode === "single" || groupMode === "pick") && (
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or email" />
              {mode === "group" && results.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[12px]">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected((p) => { const n = new Map(p); results.forEach((r) => n.set(r.id, r)); return n; })}>Select all shown ({results.length})</button>
                  {selected.size > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Map())}>Clear selection</button>}
                </div>
              )}
              <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-1">
                {results.length === 0 && <div className="text-[12.5px] text-slate-400 py-6 text-center">No customers found.</div>}
                {results.map((r) => (
                  <RecipientRow key={r.id} r={r} multi={mode === "group"} selected={selected.has(r.id)} onToggle={() => toggle(r)} />
                ))}
              </div>
              {mode === "single" && selected.size === 1 && (() => {
                const r = [...selected.values()][0];
                return (
                  <div className="rounded-2xl bg-brand-50/60 ring-1 ring-inset ring-brand-600/15 p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12.5px]">
                    <div className="min-w-0"><div className="text-slate-500">Customer</div><div className="font-bold text-navy-900 truncate">{r.name}</div></div>
                    <div className="min-w-0"><div className="text-slate-500">WhatsApp</div><div className="font-semibold text-navy-900 truncate">{r.whatsapp ? `+${r.whatsapp}` : "—"}</div></div>
                    <div className="min-w-0"><div className="text-slate-500">Email</div><div className="font-semibold text-navy-900 truncate">{r.email || "—"}</div></div>
                  </div>
                );
              })()}
            </>
          )}

          {mode === "group" && groupMode === "filter" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block"><span className="label">Customer type</span>
                <select className="input" value={filters.customerType || ""} onChange={(e) => setF({ customerType: e.target.value as any })}>
                  <option value="">All customers</option>
                  <option value="business">Business (GSTIN / firm)</option>
                  <option value="individual">Individual</option>
                  <option value="portal">Has online account</option>
                  <option value="walk_in">Walk-in (no account)</option>
                </select>
              </label>
              <label className="block"><span className="label">Location contains</span>
                <input className="input" value={filters.location || ""} onChange={(e) => setF({ location: e.target.value })} placeholder="Area, city or PIN" />
              </label>
              <label className="block"><span className="label">Outstanding balance</span>
                <select className="input" value={filters.dues || ""} onChange={(e) => setF({ dues: e.target.value as any })}>
                  <option value="">Any</option>
                  <option value="with_dues">Has dues</option>
                  <option value="no_dues">No dues</option>
                </select>
              </label>
              <label className="block"><span className="label">Minimum due (₹)</span>
                <input className="input tabular" type="number" min={0} value={filters.minDue ?? ""} onChange={(e) => setF({ minDue: numOrNull(e.target.value) })} />
              </label>
              <label className="block"><span className="label">Bought in the last (days)</span>
                <input className="input tabular" type="number" min={1} value={filters.purchasedWithinDays ?? ""} onChange={(e) => setF({ purchasedWithinDays: numOrNull(e.target.value) })} />
              </label>
              <label className="block"><span className="label">Not bought for (days)</span>
                <input className="input tabular" type="number" min={1} value={filters.notPurchasedWithinDays ?? ""} onChange={(e) => setF({ notPurchasedWithinDays: numOrNull(e.target.value) })} />
              </label>
              <label className="block"><span className="label">Total spent at least (₹)</span>
                <input className="input tabular" type="number" min={0} value={filters.minTotalSpent ?? ""} onChange={(e) => setF({ minTotalSpent: numOrNull(e.target.value) })} />
              </label>
              <label className="block"><span className="label">Bought from category</span>
                <select className="input" value={filters.categoryId ?? ""} onChange={(e) => setF({ categoryId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Any category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2 pt-1">
                <Switch checked={!!filters.thisShopOnly} onChange={(v) => setF({ thisShopOnly: v })} label="Only customers of this shop" />
                <Switch checked={!!filters.neverPurchased} onChange={(v) => setF({ neverPurchased: v })} label="Never purchased" />
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-3.5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[20px] font-extrabold text-navy-900 tabular">{summary.total}</div><div className="text-[11px] text-slate-500 font-semibold">Recipients</div></div>
                <div><div className="text-[20px] font-extrabold text-emerald-700 tabular">{wantWa ? summary.whatsapp : "—"}</div><div className="text-[11px] text-slate-500 font-semibold">via WhatsApp</div></div>
                <div><div className="text-[20px] font-extrabold text-sky-700 tabular">{wantEmail ? summary.email : "—"}</div><div className="text-[11px] text-slate-500 font-semibold">via Email</div></div>
              </div>
              {summary.total > summary.reachable && (
                <div className="text-[11.5px] text-amber-800 mt-2 text-center">{summary.total - summary.reachable} can’t be reached on the chosen channel (no contact, preference or opt-out) — they’ll be skipped.</div>
              )}
              {mode === "group" && (
                <button type="button" className="mt-2 w-full text-[12px] font-semibold text-brand-700 hover:underline" onClick={() => setShowRecipients((v) => !v)}>
                  {showRecipients ? "Hide" : "Show"} recipient list
                </button>
              )}
              {showRecipients && (
                <div className="mt-2 max-h-[240px] overflow-y-auto divide-y divide-slate-200/70">
                  {summary.recipients.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 py-1.5 text-[12.5px]">
                      <span className="truncate font-medium text-navy-900">{r.name}</span>
                      <span className="flex gap-1.5 shrink-0">
                        {wantWa && <span className={r.willReceive.whatsapp ? "text-emerald-600" : "text-slate-300"} title="WhatsApp"><Icon name="message" className="w-3.5 h-3.5" /></span>}
                        {wantEmail && <span className={r.willReceive.email ? "text-sky-600" : "text-slate-300"} title="Email"><Icon name="mail" className="w-3.5 h-3.5" /></span>}
                      </span>
                    </div>
                  ))}
                  {summary.truncated && <div className="py-1.5 text-[11.5px] text-slate-400">Showing the first 500.</div>}
                </div>
              )}
            </div>
          )}
        </section>

        {/* 2. Channel */}
        <section className="card p-4 sm:p-5 space-y-3">
          <h2 className="card-title flex items-center gap-2"><span className="eyebrow !mb-0">2</span> Channel</h2>
          <ChoiceGroup cols={3} value={channels} onChange={setChannels} options={[["whatsapp", "WhatsApp only"], ["email", "Email only"], ["both", "WhatsApp + Email"]]} />
          {wantWa && !waReady && <p className="text-[12px] text-amber-700">WhatsApp: {ctx.readiness?.whatsapp.reason}. <button type="button" className="font-bold underline" onClick={() => ctx.goTo("channels")}>Connect</button></p>}
          {wantEmail && !emailReady && <p className="text-[12px] text-amber-700">Email: {ctx.readiness?.email.reason}.</p>}
        </section>

        {/* 3. Message */}
        <section className="card p-4 sm:p-5 space-y-4">
          <h2 className="card-title flex items-center gap-2"><span className="eyebrow !mb-0">3</span> Message</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className="label">Template (optional)</span>
              <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Write a custom message</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Message type</span>
              <select className="input" value={messageType} onChange={(e) => setMessageType(e.target.value as any)}>
                <option value="transactional">Informational / service</option>
                <option value="promotional">Promotional (offers, greetings)</option>
              </select>
            </label>
          </div>
          {messageType === "promotional" && <p className="text-[12px] text-slate-500 -mt-2">Customers who opted out of promotions are skipped automatically; emails include an unsubscribe link.</p>}

          {wantWa && (
            <div className="space-y-2">
              <span className="label flex items-center gap-1.5"><Icon name="message" className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp message</span>
              {template?.wa_template_name ? (
                <div className="rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-600/15 px-3 py-2 text-[12.5px] text-emerald-900">
                  Sends the approved WhatsApp template <b className="font-mono">{template.wa_template_name}</b> — works any time, even outside the 24-hour window.
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-600/20 px-3 py-2 text-[12px] text-amber-900">
                  Free-form WhatsApp text is only delivered to customers who messaged you in the last 24 hours. For everyone else, use a template linked to an approved WhatsApp template.
                </div>
              )}
              <textarea ref={waField.ref as any} className="input min-h-[110px]" maxLength={4096} value={waBody} onChange={(e) => setWaBody(e.target.value)} placeholder="Hi {{customer_name}}, …" />
              <VariableChips vars={ctx.variables} onInsert={(t) => waField.insert(waBody, setWaBody, t)} />
            </div>
          )}

          {wantEmail && (
            <div className="space-y-2">
              <span className="label flex items-center gap-1.5"><Icon name="mail" className="w-3.5 h-3.5 text-sky-600" /> Email</span>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={255} />
              <textarea ref={emailField.ref as any} className="input min-h-[150px] font-[inherit]" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder={"Plain text or HTML. Links become clickable.\n\nHi {{customer_name}}, …"} />
              <VariableChips vars={ctx.variables} onInsert={(t) => emailField.insert(emailBody, setEmailBody, t)} />
            </div>
          )}

          <div>
            <span className="label">Attachments</span>
            <Attachments value={attachments} onChange={setAttachments} toast={ctx.toast} />
          </div>

          {usedVars.length > 0 && (
            <div className="rounded-2xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-3.5 space-y-2">
              <div className="text-[12.5px] font-bold text-navy-900">Values for this message</div>
              <p className="text-[11.5px] text-slate-500">Customer name, shop, dues and payment link fill in automatically for each customer.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {usedVars.map((k) => (
                  <label key={k} className="block"><span className="text-[11px] font-mono text-slate-500">{`{{${k}}}`}</span>
                    <input className="input" value={extraVars[k] || ""} onChange={(e) => setExtraVars({ ...extraVars, [k]: e.target.value })} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 4. When */}
        <section className="card p-4 sm:p-5 space-y-3">
          <h2 className="card-title flex items-center gap-2"><span className="eyebrow !mb-0">4</span> When</h2>
          <ChoiceGroup cols={3} value={when} onChange={setWhen} options={[["now", "Send now"], ["later", "Schedule"], ["repeat", "Repeat"]]} />
          {when !== "now" && (
            <label className="block max-w-xs"><span className="label">{when === "repeat" ? "First send (optional)" : "Date & time"}</span>
              <input className="input" type="datetime-local" value={scheduledAt} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
          )}
          {when === "repeat" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block"><span className="label">Every</span>
                <input className="input tabular" type="number" min={1} max={12} value={repeat.interval} onChange={(e) => setRepeat({ ...repeat, interval: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <label className="block"><span className="label">Period</span>
                <select className="input" value={repeat.every} onChange={(e) => setRepeat({ ...repeat, every: e.target.value })}>
                  <option value="day">Day(s)</option>
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                </select>
              </label>
              <label className="block"><span className="label">Until (optional)</span>
                <input className="input" type="date" value={repeat.until} onChange={(e) => setRepeat({ ...repeat, until: e.target.value })} />
              </label>
            </div>
          )}
        </section>
      </div>

      {/* Preview + send */}
      <aside className="lg:col-span-5 lg:sticky lg:top-20 space-y-4 min-w-0">
        <section className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="card-title">Preview</h2>
            {channels === "both" && (
              <Segmented size="sm" value={previewTab} onChange={setPreviewTab} options={[{ key: "whatsapp", label: "WhatsApp" }, { key: "email", label: "Email" }]} />
            )}
          </div>
          <div className="text-[12px] text-slate-500">
            {preview?.customer ? <>As <b className="text-navy-900">{preview.customer.name}</b> will see it</> : "Pick a customer to preview with real details"}
          </div>
          {previewTab === "whatsapp" && wantWa ? (
            <WhatsAppBubble text={preview?.whatsapp.text || ""} template={preview?.whatsapp.approvedTemplate} />
          ) : (
            <EmailFrame subject={preview?.email.subject || ""} html={preview?.email.html || ""} />
          )}
          {attachments.length > 0 && <div className="text-[12px] text-slate-500">{attachments.length} attachment{attachments.length > 1 ? "s" : ""}</div>}
        </section>

        <section className="card p-4 sm:p-5 space-y-3">
          {problems.length > 0 && (
            <ul className="text-[12px] text-slate-500 space-y-1">
              {problems.map((p) => <li key={p} className="flex gap-1.5"><Icon name="alert" className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> {p}</li>)}
            </ul>
          )}
          <button type="button" className="btn btn-primary btn-lg w-full" disabled={sending || problems.length > 0} onClick={send}>
            <Icon name="send" className="w-4 h-4" />
            {sending ? "Sending…" : when === "now" ? `Send to ${count} customer${count === 1 ? "" : "s"}` : when === "later" ? "Schedule message" : "Start recurring message"}
          </button>
          <p className="text-[11.5px] text-slate-400 text-center">Each customer gets their own message — no one sees anyone else’s number or email.</p>
        </section>

        {sent && (
          <section className="card p-4 sm:p-5 space-y-3 animate-fade-up">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title">Delivery status</h2>
              <button type="button" className="text-[12px] font-semibold text-brand-700 hover:underline" onClick={() => ctx.goTo("history")}>Open history</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["sent", "delivered", "read", "queued", "failed", "skipped"].filter((k) => sent.stats?.[k]).map((k) => (
                <span key={k} className="chip text-[11px] capitalize">{k}: {sent.stats[k]}</span>
              ))}
            </div>
            <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100">
              {Object.values(
                (sent.deliveries || []).reduce((acc: Record<string, any[]>, d: any) => {
                  (acc[d.customerId] ||= []).push(d);
                  return acc;
                }, {})
              ).map((rows: any[]) => (
                <div key={rows[0].customerId} className="py-2 flex items-start justify-between gap-2 text-[12.5px]">
                  <div className="min-w-0">
                    <div className="font-semibold text-navy-900 truncate">{rows[0].customerName}</div>
                    {rows.filter((r) => r.failureReason).map((r) => (
                      <div key={r.id} className="text-[11px] text-slate-500 break-words">{r.channel === "whatsapp" ? "WhatsApp" : "Email"}: {r.failureReason}</div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end shrink-0">
                    {rows.map((r) => <StatusChip key={r.id} status={r.status} channel={r.channel} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
