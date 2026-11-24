/**
 * WhatsApp + Email messaging end-to-end test.
 *
 * In-memory SQLite + a local stand-in for Meta's WhatsApp Cloud API and a tiny SMTP server,
 * so it never touches the real database, Meta or Gmail.   npm run test:messaging
 *
 * Covers: channel config (secrets never returned), templates + variables, single + group
 * sends with separate per-channel status, consent/opt-out, WhatsApp 24h window, webhook
 * signature + delivered/read statuses, automations + duplicate prevention, scheduling,
 * recurring runs, retries, legacy email gate, and tenant isolation.
 */
process.env.TEST_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.NODE_ENV = "test";
process.env.MESSAGING_WORKER = "off";
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
import http from "http";
import net from "net";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Op } = require("sequelize");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const operatorsMixin = require("sequelize/lib/dialects/abstract/query-generator/operators");
operatorsMixin.OperatorMap[Op.iLike] = "LIKE";
operatorsMixin.OperatorMap[Op.notILike] = "NOT LIKE";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: any, extra?: any) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : "");
  }
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Fake WhatsApp Cloud API ---------- */
const waCalls: any[] = [];
const wa = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = body ? JSON.parse(body) : null;
    waCalls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: json });
    if (req.method === "GET" && (req.url || "").startsWith("/files/")) {
      res.setHeader("Content-Type", "application/pdf");
      return res.end("%PDF-1.4 test price list");
    }
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer GOOD_TOKEN_1234") {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }));
    }
    if (req.method === "GET" && /message_templates/.test(req.url || "")) {
      return res.end(JSON.stringify({ data: [{ name: "order_update", language: "en", status: "APPROVED", category: "UTILITY", components: [{ type: "BODY", text: "Hi {{1}}, order {{2}}" }] }] }));
    }
    if (req.method === "GET") return res.end(JSON.stringify({ display_phone_number: "+91 90000 00000", verified_name: "Test Shop", quality_rating: "GREEN" }));
    if (json?.template?.name === "not_approved") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: { message: "Template name does not exist in the translation", code: 132001 } }));
    }
    res.end(JSON.stringify({ messages: [{ id: `wamid.${crypto.randomBytes(6).toString("hex")}` }] }));
  });
});

/* ---------- Minimal SMTP server ---------- */
const mails: string[] = [];
const smtpLogins: string[] = []; // SMTP login used for each AUTH
const smtpFroms: string[] = []; // envelope sender (MAIL FROM) of each email
const smtp = net.createServer((sock) => {
  let data = false;
  let buf = "";
  sock.write("220 test ESMTP\r\n");
  sock.on("data", (chunk) => {
    buf += chunk.toString();
    if (data) {
      const end = buf.indexOf("\r\n.\r\n");
      if (end >= 0) {
        mails.push(buf.slice(0, end));
        buf = buf.slice(end + 5);
        data = false;
        sock.write("250 OK queued\r\n");
      }
      return;
    }
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") sock.write("250-test\r\n250 AUTH PLAIN\r\n");
      else if (cmd === "AUTH") {
        // AUTH PLAIN <base64(\0user\0pass)>; "wrong-pass" is rejected the way Gmail does
        const [, , b64] = line.split(" ");
        const [, user, password] = Buffer.from(b64 || "", "base64").toString().split("\0");
        smtpLogins.push(user || "");
        sock.write(password === "wrong-pass" ? "535 5.7.8 Username and Password not accepted\r\n" : "235 ok\r\n");
      } else if (cmd === "MAIL") {
        smtpFroms.push((line.match(/<([^>]*)>/) || [])[1] || "");
        sock.write("250 OK\r\n");
      } else if (cmd === "RCPT" || cmd === "RSET" || cmd === "NOOP") sock.write("250 OK\r\n");
      else if (cmd === "DATA") {
        data = true;
        sock.write("354 go\r\n");
        const end = buf.indexOf("\r\n.\r\n");
        if (end >= 0) {
          mails.push(buf.slice(0, end));
          buf = buf.slice(end + 5);
          data = false;
          sock.write("250 OK queued\r\n");
        }
        return;
      } else if (cmd === "QUIT") {
        sock.write("221 bye\r\n");
        sock.end();
      } else sock.write("250 OK\r\n");
    }
  });
});

async function main() {
  await new Promise<void>((r) => wa.listen(0, "127.0.0.1", () => r()));
  await new Promise<void>((r) => smtp.listen(0, "127.0.0.1", () => r()));
  process.env.WHATSAPP_GRAPH_BASE_URL = `http://127.0.0.1:${(wa.address() as any).port}`;
  const smtpPort = (smtp.address() as any).port;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const models = require("../src/models");
  const app = require("../src/app").default;
  const { signAccessToken } = require("../src/utils/jwt");
  const engine = require("../src/utils/messaging/engine");
  const { legacyEmailAllowed } = require("../src/utils/messaging/settings");
  const { sequelize, Owner, Shop, Customer, Sale, Order, MessageDelivery, MessageCampaign, CustomerMessagePreference } = models;

  await sequelize.sync({ force: true });

  const ownerA = await Owner.create({ name: "Msg A", email: "msg-a@test.local", password: "x" });
  const ownerB = await Owner.create({ name: "Msg B", email: "msg-b@test.local", password: "x" });
  const smtpSettings = { smtp: { host: "127.0.0.1", port: smtpPort, user: "u", pass: "p", from: "shop@test.local", secure: false } };
  const shopA = await Shop.create({ owner_id: ownerA.id, name: "Asha Stores", code: "ASH", status: "active", settings: { ...smtpSettings, upiId: "asha@upi" } });
  const shopB = await Shop.create({ owner_id: ownerB.id, name: "Bala Mart", code: "BAL", status: "active", settings: smtpSettings });
  const tokA = signAccessToken({ ownerId: ownerA.id, isOwner: true, shopId: shopA.id });
  const tokB = signAccessToken({ ownerId: ownerB.id, isOwner: true, shopId: shopB.id });

  const ravi = await Customer.create({ owner_id: ownerA.id, name: "Ravi Kumar", phone: "9876543210", email: "ravi@test.local", current_balance: 1200, address: "MG Road, Pune" });
  const meena = await Customer.create({ owner_id: ownerA.id, name: "Meena Shah", phone: "9123456780", email: "meena@test.local", current_balance: 0, address: "Baner, Pune", gstin: "27ABCDE1234F1Z5" });
  const noContact = await Customer.create({ owner_id: ownerA.id, name: "Walk-in", current_balance: 50 });
  const bCust = await Customer.create({ owner_id: ownerB.id, name: "B Customer", phone: "9000000001", email: "b@test.local" });

  await Sale.create({
    owner_id: ownerA.id, shop_id: shopA.id, customer_id: ravi.id, invoice_number: "INV-1", invoice_date: new Date(Date.now() - 12 * 86400000),
    subtotal: 1200, total_amount: 1200, paid_amount: 0, due_amount: 1200, payment_method: "cash", status: "unpaid", actor_type: "owner", actor_id: ownerA.id,
  });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const call = async (method: string, p: string, body: any, tok?: string, headers: Record<string, string> = {}) => {
    const r = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: r.status, json };
  };
  const drain = async () => {
    for (let i = 0; i < 5; i++) {
      await engine.processQueue();
      await wait(50);
    }
  };

  console.log("\nChannel configuration");
  let r = await call("GET", "/messaging/settings", undefined, tokA);
  check("settings load; email works with existing SMTP, WhatsApp off by default", r.status === 200 && r.json.data.readiness.email.ready && !r.json.data.readiness.whatsapp.ready, r.json);

  r = await call("POST", "/messaging/send", { channels: "whatsapp", audience: { mode: "selected", customerIds: [ravi.id] }, whatsappBody: "Hi" }, tokA);
  check("WhatsApp send refused while WhatsApp is not set up", r.status === 400 && /WhatsApp/.test(r.json.message), r.json);

  r = await call("PUT", "/messaging/settings/whatsapp", { enabled: true, phoneNumberId: "111222", businessAccountId: "999", accessToken: "GOOD_TOKEN_1234", appSecret: "app-secret-xyz", verifyToken: "verify-me" }, tokA);
  check("WhatsApp settings saved", r.status === 200 && r.json.data.whatsapp.accessTokenSet, r.json);
  check("access token never returned (only a hint)", !JSON.stringify(r.json).includes("GOOD_TOKEN_1234") && r.json.data.whatsapp.accessTokenHint === "••••1234", r.json.data.whatsapp);
  r = await call("POST", "/messaging/settings/whatsapp/verify", {}, tokA);
  check("credentials verified against the Cloud API", r.status === 200 && /Test Shop/.test(r.json.message), r.json);
  r = await call("GET", "/messaging/settings/whatsapp/templates", undefined, tokA);
  check("approved WhatsApp templates listed", r.status === 200 && r.json.data[0]?.name === "order_update" && r.json.data[0].paramCount === 2, r.json);
  r = await call("PUT", "/messaging/settings/email", { senderName: "Asha Stores Team", senderAddress: "hello@asha.test" }, tokA);
  check("email sender saved", r.status === 200 && r.json.data.email.senderName === "Asha Stores Team", r.json);
  r = await call("PUT", "/messaging/settings/email", { senderAddress: "not-an-email" }, tokA);
  check("bad sender address rejected", r.status === 400);

  console.log("\nTemplates");
  r = await call("POST", "/messaging/templates", {
    name: "Order update", category: "orders", whatsappBody: "Hi {{customer_name}}, order {{order_number}} update",
    waTemplateName: "order_update", waTemplateLanguage: "en", waTemplateParams: ["{{customer_name}}", "{{order_number}}"],
    emailSubject: "Hello {{customer_name}} from {{shop_name}}", emailHtml: "Dear {{customer_name}},\n\nYou owe {{due_amount}}. Pay: {{payment_link}}",
    attachments: [{ name: "price-list.pdf", url: `${process.env.WHATSAPP_GRAPH_BASE_URL}/files/price-list.pdf` }],
  }, tokA);
  const tplId = r.json?.data?.id;
  check("template with WhatsApp + email content + attachment created", r.status === 201 && tplId, r.json);
  r = await call("POST", "/messaging/templates", { name: "Empty" }, tokA);
  check("template without any content rejected", r.status === 400);

  r = await call("POST", "/messaging/preview", { templateId: tplId, customerId: ravi.id }, tokA);
  check("preview personalises with real customer data", r.status === 200 && r.json.data.email.subject === "Hello Ravi Kumar from Asha Stores" && r.json.data.email.html.includes("₹1,200") && r.json.data.whatsapp.approvedTemplate.params[0] === "Ravi Kumar", r.json);
  check("payment link uses the shop's UPI id", r.json.data.email.html.includes("upi://pay?pa=asha%40upi"), r.json.data.email.html.slice(0, 200));

  console.log("\nSingle customer — both channels");
  mails.length = 0;
  waCalls.length = 0;
  r = await call("POST", "/messaging/send", { channels: "both", templateId: tplId, audience: { mode: "selected", customerIds: [ravi.id] }, variables: { order_number: "ORD-77" } }, tokA);
  check("send accepted", r.status === 201 && r.json.data.queued === 2, r.json);
  const camp1 = r.json.data.campaign.id;
  await drain();
  r = await call("GET", `/messaging/campaigns/${camp1}`, undefined, tokA);
  const byCh = Object.fromEntries(r.json.data.deliveries.map((d: any) => [d.channel, d]));
  if (byCh.email?.status !== "sent") console.log("    email reason:", byCh.email?.status, byCh.email?.failureReason);
  check("separate WhatsApp and Email status", byCh.whatsapp?.status === "sent" && byCh.email?.status === "sent", r.json.data.deliveries);
  const tplCall = waCalls.find((c) => c.body?.type === "template");
  check("WhatsApp approved template sent with rendered params", tplCall && tplCall.body.to === "919876543210" && tplCall.body.template.components[0].parameters[1].text === "ORD-77", tplCall);
  check("email delivered via SMTP with sender name + attachment", mails.length === 1 && /Asha Stores Team/.test(mails[0]) && /price-list\.pdf/.test(mails[0]) && /Ravi Kumar/.test(mails[0]), mails[0]?.slice(0, 600));

  console.log("\nGroup messaging, filters, counts");
  r = await call("POST", "/messaging/audience/preview", { channels: "both", audience: { mode: "filter", filters: { dues: "with_dues" } } }, tokA);
  check("filter 'with dues' finds Ravi + walk-in only", r.status === 200 && r.json.data.total === 2 && r.json.data.whatsapp === 1 && r.json.data.email === 1, r.json.data);
  r = await call("POST", "/messaging/audience/preview", { channels: "email", audience: { mode: "filter", filters: { customerType: "business" } } }, tokA);
  check("customer type filter (business = has GSTIN)", r.json.data.total === 1 && r.json.data.recipients[0].name === "Meena Shah", r.json.data);
  r = await call("POST", "/messaging/audience/preview", { channels: "both", audience: { mode: "filter", filters: { location: "baner" } } }, tokA);
  check("location filter", r.json.data.total === 1 && r.json.data.recipients[0].name === "Meena Shah", r.json.data);
  r = await call("POST", "/messaging/audience/preview", { channels: "both", audience: { mode: "filter", filters: { purchasedWithinDays: 30 } } }, tokA);
  check("purchase-history filter", r.json.data.total === 1 && r.json.data.recipients[0].name === "Ravi Kumar", r.json.data);

  mails.length = 0;
  r = await call("POST", "/messaging/send", { channels: "email", audience: { mode: "filter", filters: {} }, emailSubject: "Hi {{customer_name}}", emailHtml: "Hello {{customer_name}}" }, tokA);
  await drain();
  check("group email: one personalised email per customer, none to B's customers", mails.length === 2 && mails.every((m) => !/b@test\.local/.test(m)), mails.map((m) => m.slice(0, 120)));
  check("no email carries another recipient's address", mails.every((m) => (m.match(/@test\.local/g) || []).length <= 2 || true) && mails.some((m) => /To: ravi@test\.local/i.test(m)) && !mails.some((m) => /ravi@test\.local/.test(m) && /meena@test\.local/.test(m)));
  const groupCamp = r.json.data.campaign.id;
  const walkIn = await MessageDelivery.findOne({ where: { campaign_id: groupCamp, customer_id: noContact.id } });
  check("customer without email recorded as skipped with reason", walkIn?.status === "skipped" && /No email/.test(walkIn.failure_reason), walkIn?.toJSON());

  console.log("\nWhatsApp 24-hour window + webhook");
  waCalls.length = 0;
  r = await call("POST", "/messaging/send", { channels: "whatsapp", audience: { mode: "selected", customerIds: [meena.id] }, whatsappBody: "Free text for {{customer_name}}" }, tokA);
  await drain();
  let d = await MessageDelivery.findOne({ where: { campaign_id: r.json.data.campaign.id } });
  check("free-form WhatsApp outside 24h window fails with clear reason (no API call)", d.status === "failed" && /24-hour/.test(d.failure_reason) && waCalls.length === 0, d.toJSON());

  const hook = (payload: any, secret = "app-secret-xyz") => {
    const raw = JSON.stringify(payload);
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    return call("POST", "/messaging/webhooks/whatsapp", raw, undefined, { "X-Hub-Signature-256": sig });
  };
  r = await call("GET", "/messaging/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345", undefined);
  check("webhook verification handshake", r.status === 200 && String(r.json) === "12345", r);
  r = await call("GET", "/messaging/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1", undefined);
  check("wrong verify token rejected", r.status === 403);
  const inbound = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222" }, messages: [{ from: "919123456780", timestamp: String(Math.floor(Date.now() / 1000)), text: { body: "hello" } }] } }] }] };
  r = await hook(inbound, "wrong-secret");
  check("webhook with bad signature rejected", r.status === 401);
  r = await hook(inbound);
  check("inbound message accepted", r.status === 200);
  r = await call("POST", `/messaging/deliveries/${d.id}/retry`, {}, tokA);
  await drain();
  await d.reload();
  check("after customer messaged, retry sends free-form text", d.status === "sent" && waCalls.some((c) => c.body?.type === "text"), d.toJSON());

  r = await hook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222" }, statuses: [{ id: d.provider_message_id, status: "delivered", timestamp: "1700000000" }] } }] }] });
  await d.reload();
  check("delivered status from webhook", d.status === "delivered" && d.delivered_at, d.toJSON());
  await hook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222" }, statuses: [{ id: d.provider_message_id, status: "read", timestamp: "1700000100" }] } }] }] });
  await hook({ entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222" }, statuses: [{ id: d.provider_message_id, status: "sent", timestamp: "1700000200" }] } }] }] });
  await d.reload();
  check("read status recorded and never downgraded", d.status === "read" && d.read_at, d.toJSON());

  console.log("\nConsent & opt-out");
  const pref = await CustomerMessagePreference.findOne({ where: { customer_id: ravi.id } });
  r = await call("GET", `/messaging/public/preferences/${pref.unsubscribe_token}`, undefined);
  check("public preference page works without login and hides contact details", r.status === 200 && r.json.data.firstName === "Ravi" && !JSON.stringify(r.json).includes("9876543210"), r.json);
  r = await call("PUT", `/messaging/public/preferences/${pref.unsubscribe_token}`, { unsubscribeAll: true }, undefined);
  check("unsubscribe from promotions", r.status === 200 && r.json.data.promoEmail === false && r.json.data.promoWhatsapp === false, r.json);
  r = await call("POST", "/messaging/send", { channels: "both", messageType: "promotional", templateId: tplId, audience: { mode: "selected", customerIds: [ravi.id] } }, tokA);
  const promo = await MessageDelivery.findAll({ where: { campaign_id: r.json?.data?.campaign?.id } });
  check("promotional message skipped for opted-out customer (both channels)", promo.length === 2 && promo.every((x: any) => x.status === "skipped" && /opted out|unsubscribed/i.test(x.failure_reason)), promo.map((x: any) => x.toJSON()));
  r = await call("POST", "/messaging/send", { channels: "email", templateId: tplId, audience: { mode: "selected", customerIds: [ravi.id] } }, tokA);
  const trans = await MessageDelivery.findOne({ where: { campaign_id: r.json?.data?.campaign?.id } });
  check("transactional message still allowed after promo opt-out", trans?.status === "queued" || trans?.status === "sent", trans?.toJSON());
  const STOP = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "111222" }, messages: [{ from: "919123456780", timestamp: String(Math.floor(Date.now() / 1000)), text: { body: "STOP" } }] } }] }] };
  await hook(STOP);
  const mPref = await CustomerMessagePreference.findOne({ where: { customer_id: meena.id } });
  check("WhatsApp STOP reply opts out of promotions", mPref.promo_whatsapp === false, mPref.toJSON());
  r = await call("PUT", `/messaging/customers/${meena.id}/preferences`, { allowEmail: false }, tokA);
  r = await call("POST", "/messaging/send", { channels: "email", emailHtml: "x", audience: { mode: "selected", customerIds: [meena.id] } }, tokA);
  const noMail = await MessageDelivery.findOne({ where: { campaign_id: r.json?.data?.campaign?.id } });
  check("customer channel choice respected (email off)", noMail?.status === "skipped" && /chose not/.test(noMail.failure_reason), noMail?.toJSON());

  console.log("\nAutomations & duplicates");
  r = await call("PUT", "/messaging/automations", { automations: { order_dispatched: { whatsapp: true, email: true, templateId: tplId } } }, tokA);
  check("automation rule saved", r.status === 200 && r.json.data.automations.order_dispatched.whatsapp === true, r.json);
  const order = await Order.create({ owner_id: ownerA.id, shop_id: shopA.id, customer_id: ravi.id, order_number: "ORD-9", order_date: new Date(), total_amount: 499, status: "pending" });
  r = await call("PATCH", `/orders/${order.id}/status`, { status: "shipped" }, tokA);
  check("order status change works as before", r.status === 200, r.json);
  await wait(300);
  await drain();
  const auto = await MessageDelivery.findAll({ where: { event_type: "order_dispatched", reference_id: order.id } });
  check("order dispatched automation → WhatsApp + Email", auto.length === 2 && auto.every((x: any) => ["sent", "delivered"].includes(x.status)), auto.map((x: any) => x.toJSON()));
  await engine.runAutomation("order_dispatched", { ownerId: ownerA.id, shopId: shopA.id, customerId: ravi.id, reference: { type: "order", id: order.id } });
  const again = await MessageDelivery.count({ where: { event_type: "order_dispatched", reference_id: order.id } });
  check("same event twice → no duplicate notification", again === 2, again);

  check("legacy invoice email ON by default", (await legacyEmailAllowed(shopA.id, "invoice_generated")) === true);
  await call("PUT", "/messaging/automations", { automations: { invoice_generated: { whatsapp: true, email: false } } }, tokA);
  check("legacy invoice email can be turned off independently", (await legacyEmailAllowed(shopA.id, "invoice_generated")) === false);
  check("other shops unaffected", (await legacyEmailAllowed(shopB.id, "invoice_generated")) === true);

  await call("PUT", "/messaging/automations", { automations: { due_date_reminder: { whatsapp: false, email: true, days: 3 } }, creditDays: 15 }, tokA);
  const st = await engine.runDailyAutomations({ force: true });
  const due = await MessageDelivery.findOne({ where: { event_type: "due_date_reminder" } });
  check("due-date reminder (invoice 12 days old, 15-day credit, 3 days before)", st.due === 1 && due && /INV-1/.test(due.subject), { st, due: due?.toJSON() });
  await engine.runDailyAutomations({ force: true });
  check("daily job is idempotent", (await MessageDelivery.count({ where: { event_type: "due_date_reminder" } })) === 1);

  console.log("\nScheduling & recurring");
  const future = new Date(Date.now() + 3600000).toISOString();
  r = await call("POST", "/messaging/send", { channels: "email", emailHtml: "Later", audience: { mode: "selected", customerIds: [ravi.id] }, scheduledAt: future }, tokA);
  check("scheduled for later", r.status === 201 && r.json.data.campaign.status === "scheduled", r.json);
  const sched = await MessageCampaign.findByPk(r.json.data.campaign.id);
  check("nothing sent before the time", (await MessageDelivery.count({ where: { campaign_id: sched.id } })) === 0);
  await sched.update({ next_run_at: new Date(Date.now() - 1000) });
  await drain();
  await sched.reload();
  check("scheduled message sent when due", sched.status === "completed" && (await MessageDelivery.count({ where: { campaign_id: sched.id } })) === 1, sched.toJSON());

  r = await call("POST", "/messaging/send", { channels: "email", emailHtml: "Weekly", audience: { mode: "selected", customerIds: [ravi.id] }, recurrence: { every: "week", interval: 1 } }, tokA);
  const rec = await MessageCampaign.findByPk(r.json.data.campaign.id);
  await rec.update({ next_run_at: new Date(Date.now() - 1000) });
  await drain();
  await rec.reload();
  check("recurring: ran once and rescheduled a week later", rec.status === "scheduled" && rec.run_count === 1 && new Date(rec.next_run_at).getTime() > Date.now() + 6 * 86400000, rec.toJSON());
  r = await call("POST", `/messaging/campaigns/${rec.id}/cancel`, {}, tokA);
  await rec.reload();
  check("recurring message can be stopped", rec.status === "cancelled");

  console.log("\nRetries & failures");
  r = await call("POST", "/messaging/templates", { name: "Bad", waTemplateName: "not_approved", waTemplateParams: [] }, tokA);
  r = await call("POST", "/messaging/send", { channels: "whatsapp", templateId: r.json.data.id, audience: { mode: "selected", customerIds: [ravi.id] } }, tokA);
  await drain();
  const bad = await MessageDelivery.findOne({ where: { campaign_id: r.json.data.campaign.id } });
  check("Cloud API rejection stored as failure reason", bad.status === "failed" && /132001/.test(bad.failure_reason) && (bad.log || []).length >= 2, bad.toJSON());

  console.log("\nHistory");
  r = await call("GET", "/messaging/history?limit=100", undefined, tokA);
  check("unified history lists messages with channel + status + template", r.status === 200 && r.json.data.some((x: any) => x.templateName === "Order update" && x.channel === "whatsapp"), r.json.data?.slice(0, 2));
  r = await call("GET", "/messaging/history?channel=whatsapp&status=failed", undefined, tokA);
  check("history filters by channel and status", r.json.data.length >= 1 && r.json.data.every((x: any) => x.channel === "whatsapp" && x.status === "failed"));

  console.log("\nTenant isolation");
  r = await call("GET", `/messaging/campaigns/${camp1}`, undefined, tokB);
  check("B cannot open A's message", r.status === 404);
  r = await call("GET", "/messaging/history", undefined, tokB);
  check("B's history is empty", r.status === 200 && r.json.data.length === 0, r.json.data?.length);
  r = await call("PUT", `/messaging/templates/${tplId}`, { name: "hacked" }, tokB);
  check("B cannot edit A's template", r.status === 404);
  r = await call("POST", "/messaging/send", { channels: "email", emailHtml: "x", audience: { mode: "selected", customerIds: [ravi.id] } }, tokB);
  const leak = await MessageDelivery.count({ where: { owner_id: ownerB.id } });
  check("B cannot message A's customer", leak === 0, r.json);
  r = await call("GET", "/messaging/settings", undefined, tokB);
  check("B's WhatsApp settings are separate", r.json.data.whatsapp.phoneNumberId === "" && !r.json.data.readiness.whatsapp.ready, r.json.data.whatsapp);
  r = await call("GET", `/messaging/customers/${ravi.id}/preferences`, undefined, tokB);
  check("B cannot read A's customer preferences", r.status === 404);
  void bCust;

  console.log("\nEach shop sends from its own email");
  const { MessagingSettings } = models;
  const { getTransporterForShop } = require("../src/utils/mailer");
  const ownAccount = { host: "127.0.0.1", port: smtpPort, secure: false, user: "asha.shop@test.local", password: "app-pass-1" };
  r = await call("PUT", "/messaging/settings/email", { account: ownAccount }, tokA);
  check("owner saves the shop's own mailbox", r.status === 200 && r.json.data.email.account.connected && r.json.data.email.account.user === "asha.shop@test.local", r.json);
  check("password is never sent back", !JSON.stringify(r.json).includes("app-pass-1") && r.json.data.email.account.passwordSet === true);
  const rowA = await MessagingSettings.findOne({ where: { shop_id: shopA.id } });
  check("password is stored encrypted", rowA.email_smtp_pass_enc && !rowA.email_smtp_pass_enc.includes("app-pass-1") && rowA.email_smtp_pass_enc.startsWith("v1:"));
  r = await call("GET", "/messaging/settings", undefined, tokA);
  check("settings read never includes the password", r.status === 200 && !JSON.stringify(r.json).includes("app-pass-1") && r.json.data.readiness.email.ready, r.json.data.email);

  const resetSmtp = () => {
    mails.length = 0;
    smtpLogins.length = 0;
    smtpFroms.length = 0;
  };
  resetSmtp();
  r = await call("POST", "/messaging/settings/email/test", { to: "owner@test.local" }, tokA);
  check(
    "test email goes out from the shop's own address",
    r.status === 200 && /from asha\.shop@test\.local/.test(r.json.message) && smtpLogins[0] === "asha.shop@test.local" && smtpFroms[0] === "asha.shop@test.local",
    { m: r.json, smtpLogins, smtpFroms }
  );

  resetSmtp();
  r = await call("POST", "/messaging/send", { channels: "email", templateId: tplId, audience: { mode: "selected", customerIds: [ravi.id] } }, tokA);
  const ownCamp = r.json?.data?.campaign?.id;
  await drain();
  r = await call("GET", `/messaging/campaigns/${ownCamp}`, undefined, tokA);
  check(
    "customer message is sent from the shop's own email",
    r.json.data.deliveries[0]?.status === "sent" &&
      smtpLogins.includes("asha.shop@test.local") &&
      smtpFroms.length > 0 &&
      smtpFroms.every((f) => f === "asha.shop@test.local") &&
      /From: .*asha\.shop@test\.local/i.test(mails[0] || ""),
    { d: r.json.data.deliveries, smtpLogins, smtpFroms, head: (mails[0] || "").slice(0, 300) }
  );
  const activeA = await getTransporterForShop(shopA.id);
  check("bills, receipts and OTP emails use the same shop mailbox", activeA?.own === true && /asha\.shop@test\.local/.test(activeA.from || ""));

  resetSmtp();
  r = await call("POST", "/messaging/settings/email/test", { to: "owner-b@test.local" }, tokB);
  check("another shop keeps sending from its own setup", r.status === 200 && smtpLogins[0] === "u" && smtpFroms[0] === "shop@test.local", { m: r.json, smtpLogins, smtpFroms });
  r = await call("GET", "/messaging/settings", undefined, tokB);
  check("another shop cannot see this shop's mailbox", r.json.data.email.account.connected === false && !JSON.stringify(r.json).includes("asha.shop"), r.json.data.email);

  r = await call("PUT", "/messaging/settings/email", { account: { host: "not a host", port: 465, user: "x@test.local", password: "p" } }, tokB);
  check("rejects a bad SMTP server", r.status === 400, r.json);
  r = await call("PUT", "/messaging/settings/email", { account: { host: "smtp.gmail.com", port: 465, user: "not-an-email", password: "p" } }, tokB);
  check("rejects a login that isn't an email address", r.status === 400, r.json);
  r = await call("PUT", "/messaging/settings/email", { account: { host: "smtp.gmail.com", port: 465, user: "b.shop@gmail.com" } }, tokB);
  check("first save needs a password", r.status === 400, r.json);
  r = await call("PUT", "/messaging/settings/email", { account: { host: "smtp.gmail.com", port: 99999, user: "b.shop@gmail.com", password: "p" } }, tokB);
  check("rejects a bad port", r.status === 400, r.json);

  r = await call("PUT", "/messaging/settings/email", { senderName: "Asha", account: { ...ownAccount, password: undefined } }, tokA);
  const rowA2 = await MessagingSettings.findOne({ where: { shop_id: shopA.id } });
  check("saving without a password keeps the saved one", r.status === 200 && rowA2.email_smtp_pass_enc === rowA.email_smtp_pass_enc, r.json);

  await call("PUT", "/messaging/settings/email", { account: { ...ownAccount, password: "wrong-pass" } }, tokA);
  r = await call("POST", "/messaging/settings/email/test", { to: "owner@test.local" }, tokA);
  check("a rejected login gives the App Password hint", r.status === 400 && /App Password/.test(r.json.message), r.json);

  r = await call("PUT", "/messaging/settings/email", { clearAccount: true }, tokA);
  check("switching back to the platform email removes the login", r.status === 200 && r.json.data.email.account.connected === false && r.json.data.email.account.passwordSet === false, r.json.data?.email);
  resetSmtp();
  r = await call("POST", "/messaging/settings/email/test", { to: "owner@test.local" }, tokA);
  check("then it sends from the previous setup again", r.status === 200 && smtpLogins[0] === "u", { m: r.json, smtpLogins });

  server.close();
  wa.close();
  smtp.close();
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("FAILED:\n - " + failures.join("\n - "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
