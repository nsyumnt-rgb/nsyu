import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const ACCESS_SECRET: Secret = process.env.JWT_ACCESS_SECRET as string;
const REFRESH_SECRET: Secret = process.env.JWT_REFRESH_SECRET as string;
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
  shopId?: number | null; // null until a shop is selected
  roleId?: number | null;
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
