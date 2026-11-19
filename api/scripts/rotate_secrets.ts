/**
 * NSYU Security Credentials & Secrets Rotation Helper.
 * Generates cryptographic 512-bit JWT secrets and bcrypt password hashes.
 * Run via: npx ts-node scripts/rotate_secrets.ts
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";

function generateSecureSecret(bytes = 64): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function generatePassword(length = 18): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pass;
}

async function main() {
  console.log("=================================================");
  console.log("🔐 NSYU Production Secrets & Credential Generator");
  console.log("=================================================\n");

  const jwtAccessSecret = generateSecureSecret(48);
  const jwtRefreshSecret = generateSecureSecret(48);
  const newSuperAdminPass = generatePassword(20);
  const newOwnerPass = generatePassword(20);

  const superAdminHash = await bcrypt.hash(newSuperAdminPass, 12);
  const ownerHash = await bcrypt.hash(newOwnerPass, 12);

  console.log("1. NEW CRYPTOGRAPHIC JWT SECRETS (Set in Render Dashboard -> Environment):");
  console.log("-------------------------------------------------------------------------");
  console.log(`JWT_ACCESS_SECRET=${jwtAccessSecret}`);
  console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
  console.log("\n");

  console.log("2. NEW RANDOMLY GENERATED PASSWORDS (Save in a secure password manager):");
  console.log("-----------------------------------------------------------------------");
  console.log(`Super Admin Password:  ${newSuperAdminPass}`);
  console.log(`Owner Password:        ${newOwnerPass}`);
  console.log("\n");

  console.log("3. SQL TO UPDATE PRODUCTION DATABASE DIRECTLY (Run in Supabase SQL Editor):");
  console.log("--------------------------------------------------------------------------");
  console.log(`-- 1. Update Super Admin Password`);
  console.log(`UPDATE public.owners SET password = '${superAdminHash}', updated_at = NOW() WHERE is_super_admin = true;\n`);
  console.log(`-- 2. Update Primary Business Owner Password`);
  console.log(`UPDATE public.owners SET password = '${ownerHash}', updated_at = NOW() WHERE email = 'nsyu.mnt@gmail.com' OR is_super_admin = false;\n`);

  console.log("4. DATABASE PASSWORD ROTATION:");
  console.log("------------------------------");
  console.log("To rotate the database password:");
  console.log("1. Open Supabase Dashboard -> Project Settings -> Database.");
  console.log("2. Click 'Reset database password' and generate a new secure password.");
  console.log("3. Update 'DATABASE_URL' on Render dashboard with the new password string.");
  console.log("\n=================================================");
  console.log("✅ Credentials generated safely. No keys were stored to disk.");
  console.log("=================================================\n");
}

main().catch(console.error);
