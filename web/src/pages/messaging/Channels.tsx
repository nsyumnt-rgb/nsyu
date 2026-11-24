import CommunicationSetup from "../../components/CommunicationSetup";
import type { MessagingCtx } from "./Messaging";

/** Messaging › Channels: the same guided setup as Settings › Communication. */
export default function Channels({ ctx }: { ctx: MessagingCtx }) {
  return <CommunicationSetup onChanged={ctx.reload} />;
}
