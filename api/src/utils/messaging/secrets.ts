import crypto from "crypto";

/**
 * AES-256-GCM for channel secrets (WhatsApp access token, app secret) at rest.
 * Key: MESSAGING_ENCRYPTION_KEY, else JWT_ACCESS_SECRET (required in production).
 * Secrets are never returned to any client — only "is set" flags and the last 4 characters.
 */
function key(): Buffer {
  const material = process.env.MESSAGING_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!material) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MESSAGING_ENCRYPTION_KEY (or JWT_ACCESS_SECRET) must be set to store messaging credentials");
    }
    return crypto.createHash("sha256").update("nsyu-local-development-only").digest();
  }
  return crypto.createHash("sha256").update(material).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored?: string | null): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function secretHint(stored?: string | null): string | null {
  const plain = decryptSecret(stored);
  if (!plain) return null;
  return `••••${plain.slice(-4)}`;
}
