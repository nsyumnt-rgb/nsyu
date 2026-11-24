/**
 * NSYU email relay (Cloudflare Worker, free plan).
 *
 * Render's free plan blocks outgoing SMTP ports, so the API builds each email
 * and POSTs it here over HTTPS. This worker opens the SMTP connection to the
 * shop's own mail server (Gmail, Hostinger, Zoho, ...) and hands the message over.
 *
 * POST /send   Authorization: Bearer <RELAY_SECRET>
 *   { host, port, secure, user, pass, from, to: [..], raw: <base64 RFC 822 message> }
 * -> 200 { ok: true, response }   or   4xx/5xx { ok: false, code, responseCode?, error }
 *
 * Nothing is stored or logged: credentials and message only live for the request.
 */
import { connect } from "cloudflare:sockets";

const ALLOWED_PORTS = new Set([465, 587, 2525]);
const TIMEOUT_MS = 25000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return json(200, { ok: true, service: "nsyu-email-relay" });
    if (request.method !== "POST" || url.pathname !== "/send") return json(404, { ok: false, error: "Not found" });

    if (!env.RELAY_SECRET || !safeEqual(request.headers.get("authorization") || "", `Bearer ${env.RELAY_SECRET}`)) {
      return json(401, { ok: false, code: "EUNAUTHORIZED", error: "Relay key is missing or wrong" });
    }

    let b;
    try {
      b = await request.json();
    } catch {
      return json(400, { ok: false, code: "EINPUT", error: "Body must be JSON" });
    }
    const port = Number(b.port);
    const to = Array.isArray(b.to) ? b.to.filter((x) => typeof x === "string" && x.includes("@")) : [];
    const insecureOk = env.ALLOW_INSECURE === "true"; // local testing only
    if (!b.host || typeof b.host !== "string") return json(400, { ok: false, code: "EINPUT", error: "SMTP host is missing" });
    if (!ALLOWED_PORTS.has(port) && !insecureOk) return json(400, { ok: false, code: "EINPUT", error: "Use SMTP port 465 or 587" });
    if (!b.user || !b.pass) return json(400, { ok: false, code: "EINPUT", error: "SMTP login is missing" });
    if (!b.from || !to.length || !b.raw) return json(400, { ok: false, code: "EINPUT", error: "Sender, recipient or message is missing" });

    let raw;
    try {
      raw = base64ToBytes(b.raw);
    } catch {
      return json(400, { ok: false, code: "EINPUT", error: "Message must be base64" });
    }

    const mode = b.secure === true || port === 465 ? "on" : insecureOk && b.plain === true ? "off" : "starttls";
    try {
      const response = await withTimeout(
        sendSmtp({ host: b.host, port, mode, user: String(b.user), pass: String(b.pass), from: String(b.from), to, raw }),
        TIMEOUT_MS
      );
      return json(200, { ok: true, response });
    } catch (err) {
      return json(err.responseCode ? 400 : 502, {
        ok: false,
        code: err.code || "ESOCKET",
        responseCode: err.responseCode || undefined,
        error: String(err.message || err).slice(0, 300),
      });
    }
  },
};

/* ---------------- SMTP client ---------------- */

async function sendSmtp({ host, port, mode, user, pass, from, to, raw }) {
  let socket;
  try {
    socket = connect({ hostname: host, port }, { secureTransport: mode === "on" ? "on" : mode === "starttls" ? "starttls" : "off", allowHalfOpen: false });
  } catch (e) {
    throw smtpError("ECONNECTION", `Could not connect to ${host}:${port}`);
  }
  let active = socket;
  let conn = wrap(active);
  try {
    await conn.expect(220);
    let caps = await conn.cmd(`EHLO nsyu-relay`, 250);

    if (mode === "starttls") {
      if (!/STARTTLS/i.test(caps)) throw smtpError("ESECURE", "Mail server does not offer STARTTLS");
      await conn.cmd("STARTTLS", 220);
      conn.release();
      active = socket.startTls();
      conn = wrap(active);
      caps = await conn.cmd(`EHLO nsyu-relay`, 250);
    }

    const authLine = (caps.match(/AUTH[ =]([^\r\n]*)/i) || [])[1] || "";
    if (/\bPLAIN\b/i.test(authLine) || !/\bLOGIN\b/i.test(authLine)) {
      await conn.cmd(`AUTH PLAIN ${b64(`\u0000${user}\u0000${pass}`)}`, 235, "EAUTH");
    } else {
      await conn.cmd("AUTH LOGIN", 334, "EAUTH");
      await conn.cmd(b64(user), 334, "EAUTH");
      await conn.cmd(b64(pass), 235, "EAUTH");
    }

    await conn.cmd(`MAIL FROM:<${from}>`, 250, "EENVELOPE");
    for (const r of to) await conn.cmd(`RCPT TO:<${r}>`, [250, 251], "EENVELOPE");
    await conn.cmd("DATA", 354, "EMESSAGE");
    await conn.writeBytes(dotStuff(raw));
    const done = await conn.cmd(".", 250, "EMESSAGE");
    try {
      await conn.write("QUIT\r\n");
    } catch {}
    return done.trim().split("\r\n").pop();
  } finally {
    try {
      conn.release();
      await active.close();
    } catch {}
  }
}

function wrap(socket) {
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";

  async function readReply() {
    // An SMTP reply ends with a line "NNN text" (a space after the code, not "-").
    for (;;) {
      const lines = buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) {
          const reply = lines.slice(0, i + 1).join("\r\n");
          buf = lines.slice(i + 1).join("\r\n");
          return { code: Number(lines[i].slice(0, 3)), text: reply };
        }
      }
      const { value, done } = await reader.read();
      if (done) throw smtpError("ECONNECTION", "Mail server closed the connection");
      buf += dec.decode(value, { stream: true });
    }
  }

  const api = {
    async write(s) {
      await writer.write(enc.encode(s));
    },
    async writeBytes(bytes) {
      await writer.write(bytes);
    },
    async expect(want, errCode = "EPROTOCOL") {
      const r = await readReply();
      const ok = Array.isArray(want) ? want.includes(r.code) : r.code === want;
      if (!ok) throw smtpError(errCode, r.text, r.code);
      return r.text;
    },
    async cmd(line, want, errCode) {
      await api.write(line + "\r\n");
      return api.expect(want, errCode);
    },
    release() {
      try {
        reader.releaseLock();
      } catch {}
      try {
        writer.releaseLock();
      } catch {}
    },
  };
  return api;
}

/** CRLF line endings, a leading "." doubled on each line, and the message ends with CRLF. */
function dotStuff(bytes) {
  const out = [];
  let lineStart = true;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 10 && (i === 0 || bytes[i - 1] !== 13)) out.push(13); // bare LF -> CRLF
    if (lineStart && c === 46) out.push(46);
    out.push(c);
    lineStart = c === 10;
  }
  if (!(out.length >= 2 && out[out.length - 2] === 13 && out[out.length - 1] === 10)) out.push(13, 10);
  return new Uint8Array(out);
}

/* ---------------- helpers ---------------- */

function smtpError(code, message, responseCode) {
  const e = new Error(message);
  e.code = code;
  if (responseCode) e.responseCode = responseCode;
  return e;
}

function withTimeout(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, rej) => (t = setTimeout(() => rej(smtpError("ETIMEDOUT", "Mail server did not answer in time")), ms)))]).finally(() =>
    clearTimeout(t)
  );
}

function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}

function base64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
