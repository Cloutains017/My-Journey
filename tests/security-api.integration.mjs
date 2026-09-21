import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('real Next handlers enforce sessions, origin, rate limits and recoverable deletion', { timeout: 180_000 }, async () => {
  const db = new PGlite();
  let app;
  let output = '';
  let unavailable = false;
  const backend = createServer(async (req,res) => {
    const send = (status,value) => { res.writeHead(status,{'Content-Type':'application/json'}); res.end(JSON.stringify(value)); };
    try {
      assert.equal(req.headers.apikey,'local-test-service-key');
      let body = '';
      for await (const chunk of req) body += chunk;
      const data = body ? JSON.parse(body) : {};
      const url = new URL(req.url,'http://localhost');
      if (unavailable) return send(503,{message:'test outage'});
      if (url.pathname === '/rest/v1/rpc/admin_login_attempt') {
        const r = await db.query('select admin_login_attempt($1) as allowed',[data.source_key]);
        return send(200,r.rows[0].allowed);
      }
      if (url.pathname === '/rest/v1/admin_audit_log' && req.method === 'POST') {
        await db.query('insert into admin_audit_log(action,target,actor) values ($1,$2,$3)',[data.action,data.target,data.actor]);
        return send(201,null);
      }
      if (url.pathname === '/rest/v1/rpc/admin_archive_delete') {
        const r = await db.query('select admin_archive_delete($1,$2) as id',[data.target_table,data.target_id]);
        return send(200,r.rows[0].id);
      }
      if (url.pathname === '/rest/v1/rpc/admin_restore') {
        await db.query('select admin_restore($1)',[data.archive_id]);
        return send(200,null);
      }
      if (url.pathname === '/rest/v1/admin_recycle_bin') return send(200,(await db.query('select id,target,label,created_at from admin_recycle_bin where restored_at is null')).rows);
      if (url.pathname === '/rest/v1/admin_audit_log') return send(200,(await db.query('select id,action,target,created_at,record_id from admin_audit_log order by created_at desc limit 100')).rows);
      return send(500,{message:'Unexpected local test request'});
    } catch (error) { send(409,{message:error.message,code:error.code || 'TEST'}); }
  });
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
    await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/security.sql',import.meta.url),'utf8'));
    const id = '33333333-3333-4333-8333-333333333333';
    await db.exec(`insert into trips(id,title,slug,date,location,latitude,longitude,rating) values('${id}','本地测试','local-test','2026-01-01','福州市',1,1,3); set role service_role;`);
    backend.listen(0,'127.0.0.1'); await once(backend,'listening');
    const reservation = createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
    const port = reservation.address().port; await new Promise(r=>reservation.close(r));
    const base = `http://127.0.0.1:${port}`;
    const environment = { ...process.env, NODE_ENV:'development', NEXT_TELEMETRY_DISABLED:'1', VERCEL:'', NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`, NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-test-anon-key', SUPABASE_SERVICE_ROLE_KEY:'local-test-service-key', ADMIN_PASSWORD:'local-test-strong-password', ADMIN_SESSION_SECRET:'local-test-session-secret-32-bytes', CLOUDFLARE_R2_PUBLIC_URL:'https://images.test' };
    // No cloud credentials are available to this test server.
    for (const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_BUCKET','VERCEL_OIDC_TOKEN']) environment[key]='';
    app = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{env:environment,stdio:['ignore','pipe','pipe'],windowsHide:true});
    app.stdout.on('data',chunk=>{output += chunk.toString();}); app.stderr.on('data',chunk=>{output += chunk.toString();});
    let ready = false;
    for (let n=0;n<100;n++) {
      if (app.exitCode !== null) throw new Error(output.slice(-3000));
      try { const res=await fetch(base+'/api/admin/recycle-bin',{signal:AbortSignal.timeout(2000)}); if(res.status===401){ready=true;break;} } catch {}
      await new Promise(r=>setTimeout(r,500));
    }
    assert.equal(ready,true,output.slice(-3000));
    const login = (password,origin=base) => fetch(base+'/api/admin/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({password})});
    assert.equal((await login('local-test-strong-password','https://evil.test')).status,403);
    let response = await login('local-test-strong-password');
    assert.equal(response.status,200,(await response.clone().text()) + output.slice(-2000));
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'),/HttpOnly/i);
    const authenticated = {Cookie:cookie,Origin:base,'Content-Type':'application/json'};
    assert.equal((await fetch(base+`/api/admin/trips/${id}`,{method:'DELETE',headers:{...authenticated,Origin:'https://evil.test'}})).status,401);
    for (const path of [`/trips/${id}`,`/photos/${id}`,`/votes/agreement/${id}`,`/votes/desire/${id}`]) {
      assert.equal((await fetch(base+'/api/admin'+path,{method:'DELETE',headers:{...authenticated,Cookie:'admin_token=authenticated'}})).status,401);
    }
    unavailable = true;
    assert.equal((await login('local-test-strong-password')).status,503);
    assert.equal((await fetch(base+`/api/admin/trips/${id}`,{method:'DELETE',headers:authenticated})).status,503);
    assert.equal((await db.query('select * from trips')).rows.length,1);
    unavailable = false;
    response = await fetch(base+`/api/admin/trips/${id}`,{method:'DELETE',headers:authenticated});
    assert.equal(response.status,200,await response.clone().text());
    const archive = (await response.json()).archiveId;
    assert.equal((await db.query('select * from trips')).rows.length,0);
    response = await fetch(base+'/api/admin/recycle-bin',{method:'POST',headers:authenticated,body:JSON.stringify({id:archive})});
    assert.equal(response.status,200,await response.clone().text());
    assert.equal((await db.query('select * from trips')).rows.length,1);
    for(let n=0;n<9;n++) assert.equal((await login('wrong')).status,401);
    assert.equal((await login('local-test-strong-password')).status,429);
    response = await fetch(base+'/api/admin/auth',{method:'DELETE',headers:authenticated});
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie'),/Max-Age=0/i);
  } finally {
    if(app && app.exitCode===null) { app.kill(); await Promise.race([once(app,'exit'),new Promise(r=>setTimeout(r,5000))]); }
    backend.closeAllConnections(); await new Promise(r=>backend.close(r));
    await db.close();
  }
});
