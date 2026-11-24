import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, Icon, Pagination, SearchInput, Segmented } from "../../components/ui";
import { AUTOMATION_LABELS, messagingApi, type Campaign, type HistoryItem } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";
import type { MessagingCtx } from "./Messaging";
import { StatusChip, fmtDateTime } from "./shared";

const EVENT_LABEL = (e?: string | null) =>
  e ? AUTOMATION_LABELS[e]?.label || ({ bill_created: "Invoice email", payment_received: "Payment receipt", payment_reminder: "Payment reminder" } as any)[e] || e.replace(/_/g, " ") : null;

function Detail({ items, onRetry }: { items: HistoryItem[]; onRetry: (id: number | string) => void }) {
  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((d) => (
        <div key={d.id} className="rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200/70 p-3 text-[12.5px] min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <StatusChip status={d.status} channel={d.channel} />
            <span className="text-[11px] text-slate-400 truncate">{d.recipient}</span>
          </div>
          {d.subject && <div className="font-semibold text-navy-900 break-words">{d.subject}</div>}
          {d.body && <div className="text-slate-600 whitespace-pre-wrap break-words line-clamp-6">{d.body}</div>}
          <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-500 pt-1">
            <div><div className="font-bold text-slate-400 uppercase text-[9.5px]">Sent</div>{fmtDateTime(d.sentAt)}</div>
            <div><div className="font-bold text-slate-400 uppercase text-[9.5px]">Delivered</div>{d.channel === "email" ? "n/a" : fmtDateTime(d.deliveredAt)}</div>
            <div><div className="font-bold text-slate-400 uppercase text-[9.5px]">Read</div>{d.channel === "email" ? "n/a" : fmtDateTime(d.readAt)}</div>
          </div>
          {d.failureReason && <div className="text-rose-700 bg-rose-50 rounded-lg px-2 py-1.5 break-words">{d.failureReason}</div>}
          {d.log?.length > 0 && (
            <details className="text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold">Attempts & log ({d.attempts} attempt{d.attempts === 1 ? "" : "s"})</summary>
              <ul className="mt-1 space-y-0.5">
                {d.log.map((l, i) => (
                  <li key={i} className="break-words">{fmtDateTime(l.at)} · {l.event.replace(/_/g, " ")}{l.detail ? ` — ${l.detail}` : ""}</li>
                ))}
              </ul>
            </details>
          )}
          {d.status === "failed" && d.source === "messaging" && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRetry(d.id)}>
              <Icon name="refresh" className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Scheduled({ ctx }: { ctx: MessagingCtx }) {
  const [rows, setRows] = useState<Campaign[] | null>(null);
  const load = useCallback(() => messagingApi.campaigns().then(setRows).catch(() => setRows([])), []);
  useEffect(() => {
    load();
  }, [load]);
  if (!rows) return <div className="card p-6"><div className="skeleton h-24 rounded-xl" /></div>;
  const list = rows.filter((c) => c.status === "scheduled" || c.recurrence);
  const recent = rows.filter((c) => !(c.status === "scheduled" || c.recurrence)).slice(0, 15);
  const Row = ({ c }: { c: Campaign }) => (
    <li className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-navy-900 truncate">{c.title || c.template?.name || (c.kind === "single" ? "Message to one customer" : "Group message")}</div>
        <div className="text-[11.5px] text-slate-500 flex flex-wrap gap-x-3">
          <span className="capitalize">{c.channels === "both" ? "WhatsApp + Email" : c.channels}</span>
          {c.recurrence && <span className="inline-flex items-center gap-1"><Icon name="repeat" className="w-3 h-3" /> every {c.recurrence.interval > 1 ? `${c.recurrence.interval} ` : ""}{c.recurrence.every}{c.recurrence.interval > 1 ? "s" : ""}</span>}
          {c.next_run_at && <span>Next: {fmtDateTime(c.next_run_at)}</span>}
          <span>Sent {c.run_count}×</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip text-[11px] capitalize">{c.status}</span>
        {c.stats?.total > 0 && <span className="chip text-[11px]">{c.stats.sent + c.stats.delivered + c.stats.read}/{c.stats.total} sent</span>}
        {(c.status === "scheduled" || c.status === "queued") && (
          <button
            type="button"
            className="btn btn-ghost btn-sm text-rose-600"
            onClick={async () => {
              try {
                const r = await messagingApi.cancelCampaign(c.id);
                ctx.toast(r.message);
                load();
                ctx.reload();
              } catch (err) {
                ctx.toast(apiErrorMessage(err), false);
              }
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </li>
  );
  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="card-header"><h2 className="card-title">Scheduled & recurring</h2></div>
        {list.length === 0 ? <EmptyState compact icon="clock" title="Nothing scheduled" text="Schedule a message from Compose to see it here." /> : <ul className="divide-y divide-slate-100">{list.map((c) => <Row key={c.id} c={c} />)}</ul>}
      </div>
      <div className="card overflow-hidden">
        <div className="card-header"><h2 className="card-title">Recent sends</h2></div>
        {recent.length === 0 ? <EmptyState compact icon="send" title="No messages sent yet" /> : <ul className="divide-y divide-slate-100">{recent.map((c) => <Row key={c.id} c={c} />)}</ul>}
      </div>
    </div>
  );
}

export default function History({ ctx }: { ctx: MessagingCtx }) {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "scheduled" ? "scheduled" : "all";
  const [channel, setChannel] = useState(params.get("channel") || "");
  const [status, setStatus] = useState(params.get("status") || "");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: HistoryItem[]; pagination: any } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await messagingApi.history({ channel, status, search, page, limit: 30 }));
      setErr("");
    } catch (e) {
      setErr(apiErrorMessage(e));
    }
  }, [channel, status, search, page]);

  useEffect(() => {
    if (view !== "all") return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, view]);

  // Group WhatsApp + Email copies of the same message into one row
  const groups = useMemo(() => {
    const m = new Map<string, HistoryItem[]>();
    for (const d of data?.data || []) m.set(d.groupKey, [...(m.get(d.groupKey) || []), d]);
    return [...m.entries()];
  }, [data]);

  const retry = async (id: number | string) => {
    try {
      await messagingApi.retry(id);
      ctx.toast("Retrying…");
      setTimeout(load, 2500);
    } catch (e) {
      ctx.toast(apiErrorMessage(e), false);
    }
  };

  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        value={view}
        onChange={(k) => setParams(k === "scheduled" ? { view: "scheduled" } : {})}
        options={[{ key: "all", label: "All messages" }, { key: "scheduled", label: "Scheduled & sends" }]}
      />
      {view === "scheduled" ? (
        <Scheduled ctx={ctx} />
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-slate-100">
            <SearchInput className="lg:max-w-xs w-full" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search customer or text" />
            <div className="flex flex-wrap gap-2">
              <select className="input w-auto" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }}>
                <option value="">All channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
              <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Any status</option>
                {["queued", "sent", "delivered", "read", "failed", "skipped", "cancelled"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
              <button type="button" className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh"><Icon name="refresh" className="w-4 h-4" /></button>
            </div>
          </div>
          {err && <div className="px-5 py-3 text-[12.5px] text-rose-700">{err}</div>}
          {!data ? (
            <div className="p-5 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
          ) : groups.length === 0 ? (
            <EmptyState icon="message" title="No messages yet" text="Messages you send and automatic notifications will appear here with their delivery status." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map(([key, items]) => {
                const first = items[0];
                const isOpen = open === key;
                return (
                  <li key={key} className="px-4 sm:px-5 py-3">
                    <button type="button" className="w-full text-left flex flex-col md:flex-row md:items-center gap-2 md:gap-4" onClick={() => setOpen(isOpen ? null : key)}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-navy-900 truncate">{first.customerName || first.recipient || "Customer"}</span>
                          {EVENT_LABEL(first.eventType) && <span className="chip text-[10.5px]">{EVENT_LABEL(first.eventType)}</span>}
                          {first.messageType === "promotional" && <span className="chip text-[10.5px]">Promotional</span>}
                        </div>
                        <div className="text-[12px] text-slate-500 truncate">{first.subject || first.body || "—"}</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3">
                          <span>{fmtDateTime(first.createdAt)}</span>
                          {first.templateName && <span>Template: {first.templateName}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 md:justify-end shrink-0">
                        {items.map((d) => <StatusChip key={d.id} status={d.status} channel={d.channel} />)}
                        <Icon name={isOpen ? "arrowUp" : "arrowDown"} className="w-3.5 h-3.5 text-slate-400 ml-1" />
                      </div>
                    </button>
                    {isOpen && <Detail items={items} onRetry={retry} />}
                  </li>
                );
              })}
            </ul>
          )}
          {data && data.pagination.total > 0 && (
            <Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} pageSize={data.pagination.limit} onPage={setPage} noun="messages" />
          )}
        </div>
      )}
    </div>
  );
}
