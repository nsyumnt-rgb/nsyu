import { useCallback, useEffect, useState } from "react";
import { EmptyState, Icon, Modal, Segmented } from "../../components/ui";
import { messagingApi, type LibraryTemplate, type MessageTemplate } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";
import type { MessagingCtx } from "./Messaging";
import { Attachments, EmailFrame, VariableChips, WhatsAppBubble, useInsertable } from "./shared";

const CATEGORIES = ["general", "orders", "payments", "invoices", "reminders", "offers", "greetings", "welcome"];

type Draft = {
  id?: number;
  name: string;
  category: string;
  messageType: "transactional" | "promotional";
  whatsappBody: string;
  waTemplateName: string;
  waTemplateLanguage: string;
  waTemplateParams: string[];
  emailSubject: string;
  emailHtml: string;
  attachments: { name: string; url: string }[];
  isActive: boolean;
};

const empty: Draft = { name: "", category: "general", messageType: "transactional", whatsappBody: "", waTemplateName: "", waTemplateLanguage: "en", waTemplateParams: [], emailSubject: "", emailHtml: "", attachments: [], isActive: true };

const toDraft = (t: MessageTemplate): Draft => ({
  id: t.id,
  name: t.name,
  category: t.category,
  messageType: t.message_type,
  whatsappBody: t.whatsapp_body || "",
  waTemplateName: t.wa_template_name || "",
  waTemplateLanguage: t.wa_template_language || "en",
  waTemplateParams: t.wa_template_params || [],
  emailSubject: t.email_subject || "",
  emailHtml: t.email_html || "",
  attachments: t.attachments || [],
  isActive: t.is_active,
});

function Editor({ ctx, initial, onClose, onSaved }: { ctx: MessagingCtx; initial: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [tab, setTab] = useState<"whatsapp" | "email">("whatsapp");
  const [saving, setSaving] = useState(false);
  const [waTpls, setWaTpls] = useState<{ name: string; language: string; status: string; body: string; paramCount: number }[] | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const wa = useInsertable();
  const em = useInsertable();

  useEffect(() => {
    if (ctx.readiness?.whatsapp.ready) messagingApi.waTemplates().then(setWaTpls).catch(() => setWaTpls(null));
  }, [ctx.readiness?.whatsapp.ready]);

  useEffect(() => {
    const t = setTimeout(() => {
      messagingApi
        .preview({ whatsappBody: d.whatsappBody, emailSubject: d.emailSubject, emailHtml: d.emailHtml, messageType: d.messageType })
        .then(setPreview)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [d.whatsappBody, d.emailSubject, d.emailHtml, d.messageType]);

  const approved = waTpls?.find((t) => t.name === d.waTemplateName);
  const pickApproved = (name: string) => {
    const t = waTpls?.find((x) => x.name === name);
    setD({ ...d, waTemplateName: name, waTemplateLanguage: t?.language || d.waTemplateLanguage, waTemplateParams: Array.from({ length: t?.paramCount || 0 }, (_, i) => d.waTemplateParams[i] || ""), whatsappBody: d.whatsappBody || (t?.body ? t.body : "") });
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...d, waTemplateName: d.waTemplateName || null };
      const r = d.id ? await messagingApi.updateTemplate(d.id, body) : await messagingApi.createTemplate(body);
      ctx.toast(r.message || "Saved");
      onSaved();
    } catch (err) {
      ctx.toast(apiErrorMessage(err), false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      icon="file"
      title={d.id ? "Edit template" : "New template"}
      subtitle="One template can hold separate WhatsApp and email content."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={saving || !d.name.trim()} onClick={save}>{saving ? "Saving…" : "Save template"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-1"><span className="label">Template name</span>
            <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={120} />
          </label>
          <label className="block"><span className="label">Category</span>
            <select className="input capitalize" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">Type</span>
            <select className="input" value={d.messageType} onChange={(e) => setD({ ...d, messageType: e.target.value as any })}>
              <option value="transactional">Informational</option>
              <option value="promotional">Promotional</option>
            </select>
          </label>
        </div>

        <Segmented size="sm" value={tab} onChange={setTab} options={[{ key: "whatsapp", label: "WhatsApp" }, { key: "email", label: "Email" }]} />

        {tab === "whatsapp" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 min-w-0">
              <label className="block"><span className="label">Approved WhatsApp template</span>
                {waTpls ? (
                  <select className="input" value={d.waTemplateName} onChange={(e) => pickApproved(e.target.value)}>
                    <option value="">None — free text (24-hour window only)</option>
                    {waTpls.filter((t) => t.status === "APPROVED").map((t) => <option key={t.name + t.language} value={t.name}>{t.name} ({t.language})</option>)}
                  </select>
                ) : (
                  <input className="input font-mono" value={d.waTemplateName} onChange={(e) => setD({ ...d, waTemplateName: e.target.value })} placeholder="e.g. order_update" />
                )}
                <span className="field-hint">Needed to message customers who haven’t written to you in the last 24 hours.</span>
              </label>
              {d.waTemplateName && (
                <div className="space-y-2">
                  {!waTpls && (
                    <label className="block"><span className="label">Language code</span>
                      <input className="input w-28" value={d.waTemplateLanguage} onChange={(e) => setD({ ...d, waTemplateLanguage: e.target.value })} />
                    </label>
                  )}
                  {approved?.body && <div className="text-[12px] text-slate-500 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap">{approved.body}</div>}
                  <div className="flex items-center justify-between">
                    <span className="label !mb-0">Template values</span>
                    {!approved && (
                      <button type="button" className="text-[12px] font-semibold text-brand-700" onClick={() => setD({ ...d, waTemplateParams: [...d.waTemplateParams, ""] })}>+ Add value</button>
                    )}
                  </div>
                  {d.waTemplateParams.map((p, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 w-10 shrink-0">{`{{${i + 1}}}`}</span>
                      <input className="input" value={p} placeholder="{{customer_name}}" onChange={(e) => { const n = [...d.waTemplateParams]; n[i] = e.target.value; setD({ ...d, waTemplateParams: n }); }} />
                    </label>
                  ))}
                </div>
              )}
              <label className="block"><span className="label">{d.waTemplateName ? "Text for history / preview" : "WhatsApp message"}</span>
                <textarea ref={wa.ref as any} className="input min-h-[120px]" maxLength={4096} value={d.whatsappBody} onChange={(e) => setD({ ...d, whatsappBody: e.target.value })} />
              </label>
              <VariableChips vars={ctx.variables} onInsert={(t) => wa.insert(d.whatsappBody, (v) => setD({ ...d, whatsappBody: v }), t)} />
            </div>
            <div className="min-w-0">
              <span className="label">Preview</span>
              <WhatsAppBubble text={preview?.whatsapp?.text || ""} template={d.waTemplateName ? { name: d.waTemplateName, params: d.waTemplateParams } : null} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 min-w-0">
              <label className="block"><span className="label">Email subject</span>
                <input className="input" value={d.emailSubject} onChange={(e) => setD({ ...d, emailSubject: e.target.value })} maxLength={255} />
              </label>
              <label className="block"><span className="label">Email body (text or HTML)</span>
                <textarea ref={em.ref as any} className="input min-h-[200px] font-mono text-[12.5px]" value={d.emailHtml} onChange={(e) => setD({ ...d, emailHtml: e.target.value })} placeholder={'Hi {{customer_name}},\n\nOr HTML: <p>Hi {{customer_name}}</p> <a href="{{invoice_link}}">View invoice</a>'} />
              </label>
              <VariableChips vars={ctx.variables} onInsert={(t) => em.insert(d.emailHtml, (v) => setD({ ...d, emailHtml: v }), t)} />
              <div>
                <span className="label">Attachments</span>
                <Attachments value={d.attachments} onChange={(a) => setD({ ...d, attachments: a })} toast={ctx.toast} />
              </div>
            </div>
            <div className="min-w-0">
              <span className="label">Preview</span>
              <EmailFrame subject={preview?.email?.subject || ""} html={preview?.email?.html || ""} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** One-click starter templates for every automation and everyday message. */
function Library({ ctx, rows, onAdded }: { ctx: MessagingCtx; rows: MessageTemplate[] | null; onAdded: () => void }) {
  const [items, setItems] = useState<LibraryTemplate[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [waResults, setWaResults] = useState<{ name: string; ok: boolean; error?: string }[] | null>(null);
  const load = useCallback(() => messagingApi.templateLibrary().then(setItems).catch(() => setItems([])), []);
  useEffect(() => {
    load();
  }, [load, rows?.length]);

  const missing = items?.filter((t) => !t.added) || [];
  const waPending = (rows || []).filter((t) => t.whatsapp_body && !t.wa_template_name);
  const waReady = !!ctx.readiness?.whatsapp.ready;

  const add = async (key: string, keys?: string[]) => {
    setBusy(key);
    try {
      const r = await messagingApi.addLibrary(keys);
      ctx.toast(r.message);
      await load();
      onAdded();
    } catch (e) {
      ctx.toast(apiErrorMessage(e), false);
    } finally {
      setBusy("");
    }
  };

  const submitWa = async () => {
    setBusy("wa");
    setWaResults(null);
    try {
      const r = await messagingApi.submitWhatsAppTemplates();
      ctx.toast(r.message, r.data.sent > 0);
      setWaResults(r.data.results);
      onAdded();
    } catch (e) {
      ctx.toast(apiErrorMessage(e), false);
    } finally {
      setBusy("");
    }
  };

  if (!items) return null;
  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-600/10 flex items-center justify-center shrink-0">
            <Icon name="sparkle" className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="card-title">Ready-made templates</h3>
            <p className="text-[12.5px] text-slate-500">
              {missing.length
                ? `${items.length} templates for bills, payments, reminders, orders, offers and greetings. ${missing.length} not added yet.`
                : `All ${items.length} ready-made templates are added. Edit any of them below.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {missing.length > 0 && (
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => add("all")}>
              {busy === "all" ? "Adding…" : `Add all ${missing.length}`}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Hide list" : "See list"}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {items.map((t) => (
            <div key={t.key} className="rounded-xl ring-1 ring-inset ring-slate-200 p-3 flex gap-3 items-start min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] font-semibold text-navy-900">{t.name}</span>
                  <span className="chip text-[10.5px] capitalize">{t.category}</span>
                  {t.event && <span className="chip text-[10.5px]">Automatic</span>}
                  {t.messageType === "promotional" && <span className="chip text-[10.5px]">Promotional</span>}
                </div>
                <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 break-words">{t.whatsappBody}</p>
              </div>
              {t.added ? (
                <span className="badge badge-active shrink-0">Added</span>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm shrink-0" disabled={!!busy} onClick={() => add(t.key, [t.key])}>
                  {busy === t.key ? "…" : "Add"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-slate-500">
        Templates marked <b>Automatic</b> are used for the matching automatic message (Automations tab). Editing the template changes that message too.
      </p>

      {waPending.length > 0 && (
        <div className="rounded-2xl bg-emerald-50/60 ring-1 ring-inset ring-emerald-200/70 p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[12.5px] text-slate-700">
              <b>WhatsApp approval:</b> to message customers who haven't written to you in the last 24 hours, WhatsApp needs each template approved by Meta.{" "}
              {waPending.length} template{waPending.length === 1 ? "" : "s"} can be sent for approval.
            </p>
            <button type="button" className="btn btn-secondary shrink-0" disabled={!!busy || !waReady} onClick={submitWa} title={waReady ? "" : "Connect WhatsApp in Settings › Communication first"}>
              {busy === "wa" ? "Sending…" : "Send to WhatsApp for approval"}
            </button>
          </div>
          {!waReady && <p className="field-hint">Connect WhatsApp in Settings › Communication first.</p>}
          {waResults && waResults.some((x) => !x.ok) && (
            <ul className="text-[12px] text-rose-700 space-y-0.5">
              {waResults
                .filter((x) => !x.ok)
                .map((x) => (
                  <li key={x.name}>
                    {x.name}: {x.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function Templates({ ctx }: { ctx: MessagingCtx }) {
  const [rows, setRows] = useState<MessageTemplate[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const load = useCallback(() => messagingApi.templates().then(setRows).catch((e) => { setRows([]); ctx.toast(apiErrorMessage(e), false); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (t: MessageTemplate) => {
    if (!window.confirm(`Delete template “${t.name}”? Automations using it go back to the built-in message.`)) return;
    try {
      await messagingApi.deleteTemplate(t.id);
      ctx.toast("Template deleted");
      load();
    } catch (e) {
      ctx.toast(apiErrorMessage(e), false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-slate-500 max-w-xl">Reusable messages with separate WhatsApp and email content, variables like <span className="font-mono text-[12px]">{"{{customer_name}}"}</span>, links and attachments.</p>
        <button type="button" className="btn btn-primary shrink-0" onClick={() => setEditing({ ...empty })}><Icon name="plus" className="w-4 h-4" /> New template</button>
      </div>
      <Library ctx={ctx} rows={rows} onAdded={load} />
      {!rows ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon="file" title="No templates yet" text="Add the ready-made templates above in one click, or create your own." action={<button type="button" className="btn btn-primary" onClick={() => setEditing({ ...empty })}>New template</button>} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {rows.map((t) => (
            <div key={t.id} className="card card-hover p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-navy-900 truncate">{t.name}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="chip text-[10.5px] capitalize">{t.category}</span>
                    {t.message_type === "promotional" && <span className="chip text-[10.5px]">Promotional</span>}
                    {!t.is_active && <span className="badge badge-inactive">Inactive</span>}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <button type="button" className="btn-icon w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center" aria-label="Edit" onClick={() => setEditing(toDraft(t))}><Icon name="edit" className="w-4 h-4" /></button>
                  <button type="button" className="btn-icon w-8 h-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center" aria-label="Delete" onClick={() => remove(t)}><Icon name="trash" className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11.5px] font-semibold">
                <span className={`inline-flex items-center gap-1 ${t.whatsapp_body || t.wa_template_name ? "text-emerald-700" : "text-slate-300"}`}><Icon name="message" className="w-3.5 h-3.5" /> WhatsApp{t.wa_template_name ? " · sent to Meta" : ""}</span>
                <span className={`inline-flex items-center gap-1 ${t.email_html ? "text-sky-700" : "text-slate-300"}`}><Icon name="mail" className="w-3.5 h-3.5" /> Email</span>
                {(t.attachments?.length || 0) > 0 && <span className="inline-flex items-center gap-1 text-slate-500"><Icon name="paperclip" className="w-3.5 h-3.5" /> {t.attachments!.length}</span>}
              </div>
              <p className="text-[12.5px] text-slate-500 line-clamp-3 break-words">{t.whatsapp_body || t.email_subject || t.email_html}</p>
            </div>
          ))}
        </div>
      )}
      {editing && <Editor ctx={ctx} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}
