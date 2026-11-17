import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/**
 * Signing secrets MUST come from the environment. A hard-coded fallback would let
 * anyone who can read this repository forge tokens for any account.
 * Outside production a random per-process secret is used (tokens die on restart).
 */
function requireSecret(name: string): string {
  const v = process.env[name];
  if (v && v.trim().length >= 32) return v.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} is missing or shorter than 32 characters — refusing to start with an insecure JWT secret`);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("crypto").randomBytes(48).toString("hex");
}
const ACCESS_SECRET: Secret = requireSecret("JWT_ACCESS_SECRET");
const REFRESH_SECRET: Secret = requireSecret("JWT_REFRESH_SECRET");
const ACCESS_EXPIRES = (process.env.JWT_ACCESS_EXPIRES || "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES = (process.env.JWT_REFRESH_EXPIRES || "30d") as SignOptions["expiresIn"];

/**
 * Everything the rest of the app needs to know about "who is making
 * this request" is packed into the access token, so no DB lookup is
 * needed on every request just to know owner/shop/role scope.
 * Permission booleans ARE re-checked against the DB on sensitive
 * writes if you want extra safety — see middleware/permission.ts.
 */
export interface AccessTokenPayload {
  ownerId: number;
  isOwner: boolean; // true = the account itself is the Owner, not an Employee
  employeeId?: number;
  customerId?: number;
  accountId?: number;
  phone?: string;
  isSuperAdmin?: boolean;
  isCustomer?: boolean;
  shopId?: number | null; // null until a shop is selected
  roleId?: number | null;
  roleCode?: string | null;
  roleName?: string | null;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: { ownerId: number; employeeId?: number }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { ownerId: number; employeeId?: number } {
  return jwt.verify(token, REFRESH_SECRET) as { ownerId: number; employeeId?: number };
}

export function refreshExpiryDate(): Date {
  // Keep in sync with JWT_REFRESH_EXPIRES (defaults to 30 days)
  const days = 30;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
