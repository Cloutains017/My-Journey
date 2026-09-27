import { config } from 'dotenv';
import pg from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { loadVerifiedSnapshot, verifyBusinessRestore } from './backup-snapshot.mjs';
import { restoreDatabase } from './restore-database.mjs';
import { restoreR2Objects } from './restore-r2.mjs';
import { parseTarget } from './restore-target.mjs';

config({ path: '.env.local', quiet: true });

function parseArgs(args) {
  const flags = { apply: false, withR2: false, allowLegacySource: false };
  let directory;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') flags.apply = true;
    else if (arg === '--with-r2') flags.withR2 = true;
    else if (arg === '--allow-legacy-source') flags.allowLegacySource = true;
    else if (arg === '--target-ref' && args[i + 1]) flags.targetRef = args[++i];
    else if (!arg.startsWith('-') && !directory) directory = arg;
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!directory) throw new Error('Usage: npm run backup:restore -- backups/<snapshot> [--apply --target-ref <ref>] [--with-r2] [--allow-legacy-source]');
  if (flags.withR2 && !flags.apply) throw new Error('--with-r2 requires --apply');
  if (flags.apply !== Boolean(flags.targetRef)) throw new Error('--apply and --target-ref must be used together');
  return { directory, ...flags };
}

const args = parseArgs(process.argv.slice(2));
const snapshot = await loadVerifiedSnapshot(args.directory);
await verifyBusinessRestore(snapshot.tableData);
console.log(`Verified backup: ${snapshot.root}`);
for (const item of snapshot.tableData) console.log(`${item.table}: ${item.rows.length} rows`);
console.log(`R2: ${snapshot.objects.length} objects`);
if (!args.apply) {
  console.log('Dry run complete. No remote data was changed.');
  process.exit(0);
}

const required = name => {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
  return process.env[name];
};
const dbUrl = parseTarget(required('SUPABASE_DB_URL'), args.targetRef,
  required('NEXT_PUBLIC_SUPABASE_URL'), snapshot.manifest.source, args.allowLegacySource);
const client = new pg.Client({ connectionString: dbUrl.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const result = await client.query('select current_database() as database, current_user as role');
  if (result.rows[0].database !== 'postgres' || !['postgres', `postgres.${args.targetRef}`].includes(result.rows[0].role)) {
    throw new Error('Connected database identity does not match the requested target');
  }
  if (args.withR2) {
    const bucket = required('CLOUDFLARE_R2_BUCKET');
    if (snapshot.manifest.source?.r2Bucket && snapshot.manifest.source.r2Bucket !== bucket) {
      throw new Error('Backup R2 bucket does not match target bucket');
    }
    const r2 = new S3Client({
      region: 'auto', endpoint: `https://${required('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required('CLOUDFLARE_R2_ACCESS_KEY_ID'),
        secretAccessKey: required('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
      },
    });
    try {
      const restored = await restoreR2Objects(r2, bucket, snapshot.objects);
      console.log(`R2 restored: ${restored.uploaded} uploaded, ${restored.present} already present`);
    } finally {
      r2.destroy();
    }
  }
  const tables = await restoreDatabase(client, snapshot.tableData);
  for (const table of tables) console.log(`${table.table}: ${table.inserted} rows restored, ${table.expected - table.inserted} already present`);
  console.log('Database restore complete. Existing rows were preserved.');
} finally {
  await client.end();
}
