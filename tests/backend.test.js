import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const root=new URL('../',import.meta.url);
test('SQL real: permisos, partida, idempotencia, ranking, consentimiento y retención',async()=>{
 const db=new PGlite();
 try{
 await db.exec('create role anon; create role authenticated;');
 await db.exec(fs.readFileSync(new URL('supabase/01_schema.sql',root),'utf8'));
 await db.exec(fs.readFileSync(new URL('supabase/02_questions.sql',root),'utf8'));
 const rpc=async(sql,args=[]) => (await db.query(sql,args)).rows[0].result;
 await assert.rejects(()=>rpc('select public.trivia_start() as result'),/no está habilitada/);
 await db.exec("update trivia_private.settings set event_end_at=now()+interval '2 hours',privacy_ready=true,enabled=true");
 await db.exec('set role anon');
 await assert.rejects(()=>db.query('select * from trivia_private.participants'),/permission denied/);
 await assert.rejects(()=>db.query('select * from trivia_private.questions'),/permission denied/);
 let s=await rpc('select public.trivia_start() as result');
 const tok=s.token;
 assert.equal(s.answered,0);assert.equal(s.question.answer,undefined);assert.equal(s.score,null);
 await assert.rejects(()=>rpc('select public.trivia_ranking($1) as result',[tok]),/Registrá/);
 await assert.rejects(()=>rpc('select public.trivia_answer($1,$2,$3) as result',[tok,999,0]),/no corresponde/);
 await assert.rejects(()=>rpc('select public.trivia_answer($1,$2,$3) as result',[tok,s.question.id,null]),/inválida/);
 await db.exec('reset role');
 const snap=(await db.query('select questions from trivia_private.sessions where token=$1',[tok])).rows[0].questions;
 assert.equal(snap.length,10);assert.equal(new Set(snap.map(q=>q.id)).size,10);
 const ds=(await db.query('select difficulty,count(*)::int n from trivia_private.questions where id=any($1::int[]) group by difficulty',[snap.map(q=>q.id)])).rows;
 assert.deepEqual(Object.fromEntries(ds.map(d=>[d.difficulty,d.n])),{easy:4,hard:2,medium:4});
 await db.exec('set role anon');
 for(let i=0;i<10;i++){
  s=await rpc('select public.trivia_answer($1,$2,$3) as result',[tok,snap[i].id,snap[i].answer]);
  assert.equal(s.answered,i+1);
  const repeated=await rpc('select public.trivia_answer($1,$2,$3) as result',[tok,snap[i].id,(snap[i].answer+1)%4]);
  assert.equal(repeated.answered,i+1);assert.equal(repeated.score,s.score);
 }
 assert.equal(s.score,100);assert.equal(s.finished,true);assert.equal(s.question,null);
 const elapsed=s.elapsed_ms;
 const reg='select public.trivia_register($1,$2,$3,$4,$5,$6,$7) as result';
 await assert.rejects(()=>rpc(reg,[tok,'Prueba','Calamar','qa@example.com',false,false,'2026-10-22-v1']),/autorización/);
 await assert.rejects(()=>rpc(reg,[tok,'Prueba','Calamar','qa@example.com',true,false,'old']),/cambió/);
 await rpc(reg,[tok,'Prueba','Calamar',' QA@example.com ',true,true,'2026-10-22-v1']);
 await rpc(reg,[tok,'Prueba','Calamar','qa@example.com',true,true,'2026-10-22-v1']);
 const ranking=await rpc('select public.trivia_ranking($1) as result',[tok]);
 assert.equal(ranking.total,1);assert.equal(ranking.mine.name,'Prueba C.');assert.equal(ranking.mine.score,100);assert.equal(ranking.mine.elapsed_ms,elapsed);
 assert.equal(JSON.stringify(ranking).includes('@'),false);assert.equal(JSON.stringify(ranking).includes('Calamar'),false);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from trivia_private.marketing_contacts')).rows[0].n,1);
 // Segunda partida del mismo mail: conserva la primera aunque el nuevo puntaje sea distinto.
 await db.exec('set role anon');
 let s2=await rpc('select public.trivia_start() as result');
 const t2=s2.token;
 for(let i=0;i<10;i++)s2=await rpc('select public.trivia_answer($1,$2,$3) as result',[t2,s2.question.id,0]);
 const duplicate=await rpc(reg,[t2,'Otro','Nombre','qa@example.com',true,false,'2026-10-22-v1']);
 assert.equal(duplicate.duplicate,true);
 assert.equal((await rpc('select public.trivia_ranking($1) as result',[t2])).mine.score,100);
 await db.exec('reset role');
 // Otro participante sin marketing y sin consentimientos implícitos.
 await db.exec('set role anon');
 let s3=await rpc('select public.trivia_start() as result');
 const t3=s3.token;
 for(let i=0;i<10;i++)s3=await rpc('select public.trivia_answer($1,$2,$3) as result',[t3,s3.question.id,0]);
 await rpc(reg,[t3,'Otra','Persona','sinmarketing@example.com',true,false,'2026-10-22-v1']);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from trivia_private.participants')).rows[0].n,2);
 assert.equal((await db.query('select count(*)::int n from trivia_private.marketing_contacts')).rows[0].n,1);
 await db.exec("update trivia_private.settings set event_end_at=now()-interval '91 days'; select trivia_private.cleanup();");
 assert.equal((await db.query('select count(*)::int n from trivia_private.participants')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from trivia_private.sessions')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from trivia_private.marketing_contacts')).rows[0].n,1);
 }finally{await db.close();}
});
