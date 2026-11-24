import { useRef, useState } from "react";
import { Icon } from "../../components/ui";
import { STATUS_STYLE, messagingApi } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";

export function StatusChip({ status, channel }: { status: string; channel?: "whatsapp" | "email" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset capitalize whitespace-nowrap ${STATUS_STYLE[status] || STATUS_STYLE.queued}`}>
      {channel && <Icon name={channel === "whatsapp" ? "message" : "mail"} className="w-3 h-3" />}
      {status === "sending" ? "sending" : status}
    </span>
  );
}

export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Clickable {{variable}} chips that insert at the cursor of the given field. */
export function VariableChips({ vars, onInsert }: { vars: { key: string; label: string }[]; onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {vars.map((v) => (
        <button key={v.key} type="button" title={v.label} onClick={() => onInsert(`{{${v.key}}}`)} className="rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-800 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 transition">
          {`{{${v.key}}}`}
        </button>
      ))}
    </div>
  );
}

export function useInsertable() {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const insert = (value: string, setValue: (v: string) => void, token: string) => {
    const el = ref.current;
    if (!el) return setValue(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return { ref, insert };
}

export function Attachments({ value, onChange, toast }: { value: { name: string; url: string }[]; onChange: (v: { name: string; url: string }[]) => void; toast: (t: string, ok?: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={a.url + i} className="flex items-center gap-2 rounded-xl ring-1 ring-inset ring-slate-200 px-3 py-2 text-[12.5px] min-w-0">
          <Icon name="paperclip" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-brand-700 font-semibold hover:underline min-w-0">{a.name}</a>
          <button type="button" className="ml-auto text-slate-400 hover:text-rose-600 shrink-0" aria-label="Remove attachment" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Icon name="x" className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {value.length < 5 && (
        <>
          <input
            ref={input}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                onChange([...value, await messagingApi.uploadAttachment(f)]);
              } catch (err) {
                toast(apiErrorMessage(err, "Upload failed"), false);
              } finally {
                setBusy(false);
              }
            }}
          />
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => input.current?.click()}>
            <Icon name="paperclip" className="w-3.5 h-3.5" /> {busy ? "Uploading…" : "Attach PDF or image"}
          </button>
        </>
      )}
    </div>
  );
}

/** WhatsApp-style chat bubble preview. */
export function WhatsAppBubble({ text, template }: { text: string; template?: { name: string; params: string[] } | null }) {
  const linked = (text || "").split(/(https?:\/\/\S+|upi:\/\/\S+)/g).map((part, i) =>
    /^(https?|upi):\/\//.test(part) ? (
      <span key={i} className="text-sky-700 underline break-all">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
  return (
    <div className="rounded-2xl bg-[#e9e4dc] p-3 sm:p-4">
      <div className="ml-auto max-w-[92%] w-fit rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 shadow-sm">
        {template && (
          <div className="text-[10.5px] font-bold text-emerald-800 mb-1">Approved template · {template.name}</div>
        )}
        <div className="text-[13px] text-[#111b21] whitespace-pre-wrap break-words">{text ? linked : <span className="text-slate-500">No WhatsApp text</span>}</div>
        {template && template.params.length > 0 && (
          <div className="mt-1.5 text-[11px] text-emerald-900/80">Values: {template.params.map((p, i) => `{{${i + 1}}} ${p || "—"}`).join(" · ")}</div>
        )}
        <div className="text-[10px] text-slate-500 text-right mt-1">now ✓✓</div>
      </div>
    </div>
  );
}

export function EmailFrame({ subject, html }: { subject: string; html: string }) {
  return (
    <div className="rounded-2xl ring-1 ring-inset ring-slate-200 overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-slate-100 text-[12.5px] min-w-0">
        <span className="text-slate-400">Subject: </span>
        <span className="font-semibold text-navy-900 break-words">{subject || "—"}</span>
      </div>
      <iframe title="Email preview" sandbox="" srcDoc={html} className="w-full h-[360px] bg-[#f1f5f4]" />
    </div>
  );
}
