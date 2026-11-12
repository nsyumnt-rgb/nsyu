import { sequelize } from "../models";

/**
 * Synchronizes customer credentials to Supabase Auth (`auth.users` and `auth.identities`).
 * Uses standard bcrypt hashing and Supabase Auth schemas.
 */
export async function syncCustomerToSupabaseAuth(
  email: string,
  passwordHash: string,
  name: string,
  phone: string
): Promise<string | null> {
  if (!email || !email.includes("@")) return null;

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.trim() : "";

  try {
    // Check if auth.users already has this email
    const [existing]: any = await sequelize.query(
      `SELECT id FROM auth.users WHERE LOWER(email) = LOWER(:cleanEmail) LIMIT 1;`,
      { replacements: { cleanEmail } }
    );

    let userId: string;
    if (existing && existing.length > 0) {
      userId = existing[0].id;
      await sequelize.query(
        `UPDATE auth.users 
         SET encrypted_password = :passwordHash, 
             raw_user_meta_data = jsonb_build_object('role', 'customer', 'name', :name, 'phone', :cleanPhone),
             email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
             updated_at = NOW()
         WHERE id = :userId;`,
        { replacements: { userId, passwordHash, name, cleanPhone } }
      );
    } else {
      const [inserted]: any = await sequelize.query(
        `INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token
        ) VALUES (
          gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          :cleanEmail, :passwordHash, NOW(),
          '{"provider": "email", "providers": ["email"]}'::jsonb,
          jsonb_build_object('role', 'customer', 'name', :name, 'phone', :cleanPhone),
          NOW(), NOW(), ''
        ) RETURNING id;`,
        { replacements: { cleanEmail, passwordHash, name, cleanPhone } }
      );
      userId = inserted[0].id;

      // Also insert into auth.identities (note: email column is generated in newer Supabase schemas)
      await sequelize.query(
        `INSERT INTO auth.identities (
          id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), :userId, :userId,
          jsonb_build_object('sub', :userId, 'email', :cleanEmail),
          'email', NOW(), NOW(), NOW()
        ) ON CONFLICT DO NOTHING;`,
        { replacements: { userId, cleanEmail } }
      );
    }

    return userId;
  } catch (err: any) {
    console.warn("⚠️ Warning: Could not sync to Supabase auth.users:", err.message);
    return null;
  }
}

/**
 * Updates password in Supabase auth.users for an existing user by email or supabase_uid.
 */
export async function updateSupabaseAuthPassword(
  emailOrUid: string,
  newPasswordHash: string
): Promise<boolean> {
  try {
    const isUid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(emailOrUid);
    const query = isUid
      ? `UPDATE auth.users SET encrypted_password = :newPasswordHash, updated_at = NOW() WHERE id = :emailOrUid;`
      : `UPDATE auth.users SET encrypted_password = :newPasswordHash, updated_at = NOW() WHERE LOWER(email) = LOWER(:emailOrUid);`;

    await sequelize.query(query, { replacements: { emailOrUid, newPasswordHash } });
    return true;
  } catch (err: any) {
    console.warn("⚠️ Warning: Could not update Supabase auth password:", err.message);
    return false;
  }
}

