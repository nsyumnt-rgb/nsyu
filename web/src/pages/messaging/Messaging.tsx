import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, Segmented, StatCard, Toast, Icon } from "../../components/ui";
import { messagingApi, type MessagingSettings, type Readiness } from "../../api/messaging";
import { apiErrorMessage } from "../../api/client";
import Composer from "./Composer";
import History from "./History";
import Templates from "./Templates";
import Automations from "./Automations";
import Channels from "./Channels";

type Tab = "compose" | "history" | "templates" | "automations" | "channels";
const TABS: { key: Tab; label: string }[] = [
  { key: "compose", label: "Compose" },
  { key: "history", label: "History" },
  { key: "templates", label: "Templates" },
  { key: "automations", label: "Automations" },
  { key: "channels", label: "Channels" },
];

export interface MessagingCtx {
  readiness: Readiness | null;
  settings: MessagingSettings | null;
  variables: { key: string; label: string }[];
  reload: () => Promise<void>;
  toast: (text: string, ok?: boolean) => void;
  goTo: (tab: Tab) => void;
}

export function ChannelPill({ ready, label, reason }: { ready: boolean; label: string; reason?: string }) {
  return (
    <span title={reason} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-inset ${ready ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : "bg-slate-100 text-slate-500 ring-slate-500/10"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-slate-400"}`} />
      {label} {ready ? "ready" : "not ready"}
    </span>
  );
}

export default function Messaging() {
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const tab: Tab = (TABS.find((t) => t.key === tabParam)?.key as Tab) || "compose";
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof messagingApi.overview>> | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const toast = useCallback((text: string, ok = true) => {
    setToastMsg({ text, ok });
    window.setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      setOverview(await messagingApi.overview());
      setLoadErr("");
    } catch (err) {
      setLoadErr(apiErrorMessage(err, "Could not load messaging"));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const ctx: MessagingCtx = {
    readiness: overview?.readiness || null,
    settings: overview?.settings || null,
    variables: overview?.variables || [],
    reload,
    toast,
    goTo: (t) => navigate(`/app/messaging/${t}`),
  };

  const sum = (ch: "whatsapp" | "email", keys: string[]) => keys.reduce((a, k) => a + (overview?.counts?.[ch]?.[k] || 0), 0);
  const delivered = ["sent", "delivered", "read"];

  return (
    <div className="space-y-6 page-enter">
      <PageHeader
        eyebrow="Customer communication"
        title="Messaging"
        subtitle="Send WhatsApp and email messages to one customer or a group, set up automatic notifications and track every delivery."
        actions={
          overview ? (
            <div className="flex flex-wrap gap-2">
              <ChannelPill label="WhatsApp" ready={overview.readiness.whatsapp.ready} reason={overview.readiness.whatsapp.reason} />
              <ChannelPill label="Email" ready={overview.readiness.email.ready} reason={overview.readiness.email.reason} />
            </div>
          ) : null
        }
      />

      {loadErr && (
        <div className="card p-4 flex items-start gap-3 text-[13px] text-rose-700 bg-rose-50/60 border-rose-200">
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" /> {loadErr}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger">
        <StatCard label="WhatsApp sent · 30d" value={sum("whatsapp", delivered)} icon="message" tone="emerald" loading={!overview} hint={`${overview?.counts?.whatsapp?.read || 0} read`} />
        <StatCard label="Emails sent · 30d" value={sum("email", delivered)} icon="mail" tone="sky" loading={!overview} hint="via Gmail / SMTP" />
        <StatCard label="Failed · 30d" value={sum("whatsapp", ["failed"]) + sum("email", ["failed"])} icon="alert" tone="rose" loading={!overview} onClick={() => navigate("/app/messaging/history?status=failed")} hint="Open to retry" />
        <StatCard label="Scheduled" value={overview?.scheduled ?? 0} icon="clock" tone="amber" loading={!overview} onClick={() => navigate("/app/messaging/history?view=scheduled")} hint="One-off & recurring" />
      </div>

      <Segmented options={TABS} value={tab} onChange={(k) => navigate(`/app/messaging/${k}`)} />

      <div key={tab} className="animate-fade-in">
        {tab === "compose" && <Composer ctx={ctx} />}
        {tab === "history" && <History ctx={ctx} />}
        {tab === "templates" && <Templates ctx={ctx} />}
        {tab === "automations" && <Automations ctx={ctx} />}
        {tab === "channels" && <Channels ctx={ctx} />}
      </div>

      {toastMsg && <Toast text={toastMsg.text} ok={toastMsg.ok} />}
    </div>
  );
}
