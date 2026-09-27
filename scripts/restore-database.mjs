export const RESTORE_TABLES = [
  'trips', 'photos', 'agreement_votes', 'desire_votes', 'city_boundaries',
  'admin_recycle_bin', 'admin_audit_log',
];

const REQUIRED_TABLES = new Set(RESTORE_TABLES.slice(0, 5));

export async function restoreDatabase(client, input) {
  const byName = new Map();
  for (const item of input) {
    if (!RESTORE_TABLES.includes(item.table) || byName.has(item.table) || !Array.isArray(item.rows)) {
      throw new Error('Invalid backup table');
    }
    const ids = item.rows.map(row => row?.id);
    if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      throw new Error(`Invalid or duplicate IDs in ${item.table}`);
    }
    byName.set(item.table, item.rows);
  }
  for (const table of REQUIRED_TABLES) {
    if (!byName.has(table)) throw new Error(`Missing required table: ${table}`);
  }

  const tables = RESTORE_TABLES.filter(table => byName.has(table));
  const results = [];
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await client.query(`LOCK TABLE ${tables.map(table => `public.${table}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
    for (const table of tables) {
      const rows = byName.get(table);
      let inserted = 0;
      if (!rows.length) {
        results.push({ table, expected: 0, inserted: 0 });
        continue;
      }
      const columns = Object.keys(rows[0]);
      if (!columns.includes('id') || columns.some(column => !/^[a-z][a-z0-9_]*$/.test(column)) ||
        rows.some(row => Object.keys(row).length !== columns.length || columns.some(column => !(column in row)))) {
        throw new Error(`Invalid columns in ${table}`);
      }
      const available = await client.query(
        'select column_name from information_schema.columns where table_schema = $1 and table_name = $2',
        ['public', table],
      );
      const known = new Set(available.rows.map(row => row.column_name));
      if (columns.some(column => !known.has(column))) throw new Error(`Backup schema is newer than target: ${table}`);
      const omitted = [...known].filter(column => !columns.includes(column));
      for (let offset = 0; offset < rows.length; offset += 200) {
        const json = JSON.stringify(rows.slice(offset, offset + 200));
        const typedRows = `jsonb_populate_recordset(null::public.${table}, $1::jsonb)`;
        const conflicts = await client.query(
          `select b.id from ${typedRows} as b join public.${table} as t on t.id = b.id
           where (to_jsonb(t) - $2::text[]) is distinct from (to_jsonb(b) - $2::text[]) limit 1`, [json, omitted],
        );
        if (conflicts.rows.length) throw new Error(`Restore conflict in ${table}: existing row differs`);
        const result = await client.query(
          `insert into public.${table} (${columns.join(', ')}) select ${columns.join(', ')} from ${typedRows} on conflict (id) do nothing`, [json],
        );
        inserted += result.rowCount;
        const missing = await client.query(
          `select b.id from ${typedRows} as b left join public.${table} as t on t.id = b.id
           where t.id is null or (to_jsonb(t) - $2::text[]) is distinct from (to_jsonb(b) - $2::text[]) limit 1`, [json, omitted],
        );
        if (missing.rows.length) throw new Error(`Restore verification failed in ${table}`);
      }
      results.push({ table, expected: rows.length, inserted });
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
