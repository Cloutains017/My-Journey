const REF = /^[a-z0-9]{20}$/;

export function parseTarget(dbUrl, targetRef, publicUrl, source, allowLegacySource = false) {
  if (!REF.test(targetRef || '')) throw new Error('Specify --target-ref with the 20-character Supabase project ref');
  let db;
  let publicHost;
  try {
    db = new URL(dbUrl);
    publicHost = new URL(publicUrl).hostname;
  } catch {
    throw new Error('SUPABASE_DB_URL or NEXT_PUBLIC_SUPABASE_URL is invalid');
  }
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.pathname !== '/postgres' || db.port !== '5432') {
    throw new Error('SUPABASE_DB_URL must be a direct or session-pooler PostgreSQL URL on port 5432 for database postgres');
  }
  const direct = db.hostname === `db.${targetRef}.supabase.co` && db.username === 'postgres';
  const pooler = db.hostname.endsWith('.pooler.supabase.com') && db.username === `postgres.${targetRef}`;
  if (!direct && !pooler) throw new Error('Database URL does not match --target-ref');
  if (publicHost !== `${targetRef}.supabase.co`) throw new Error('NEXT_PUBLIC_SUPABASE_URL does not match --target-ref');
  if (source?.supabaseHost) {
    if (source.supabaseHost !== publicHost) throw new Error('Backup source does not match target project');
  } else if (!allowLegacySource) {
    throw new Error('Legacy backup has no source project metadata; pass --allow-legacy-source after checking its origin');
  }
  return db;
}
