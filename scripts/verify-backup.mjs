import { loadVerifiedSnapshot, verifyBusinessRestore } from './backup-snapshot.mjs';

if (!process.argv[2]) throw new Error('Usage: npm run backup:verify -- backups/<snapshot>');
const snapshot = await loadVerifiedSnapshot(process.argv[2]);
await verifyBusinessRestore(snapshot.tableData);
for (const item of snapshot.tableData) console.log(`Verified table: ${item.table} ${item.rows.length}`);
console.log(`Verified ${snapshot.objects.length} R2 objects. Business data restored in memory; production was not modified.`);
