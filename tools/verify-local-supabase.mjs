import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {openMobileBrowser,mobileTestUrl,usbPort} from './mobile-study-browser.mjs';
import {chromium, expect} from '@playwright/test';

const runtimePath = resolve(process.argv[2] || '../cbt-supabase-dev/runtime.json');
const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
const webPort = process.env.CBT_DEV_WEB_PORT || '4360';
assert.ok(/^\d+$/.test(webPort) && Number(webPort) > 0 && Number(webPort) <= 65535, 'Invalid local web port');
const base = 'http://127.0.0.1:' + webPort;
const api = 'http://127.0.0.1:4361/api';
assert.equal(runtime.API_URL, 'http://127.0.0.1:54321', '이 검사는 로컬 개발 서버 전용입니다.');
const admin = createClient(runtime.API_URL, runtime.SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const accountPath = join(dirname(runtimePath), 'qa-account.json');
let account;
try { account = JSON.parse(await readFile(accountPath,'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const email = 'cbt-qa-'+randomUUID()+'@example.test', password = randomBytes(24).toString('base64url');
  const created = await admin.auth.admin.createUser({email,password,email_confirm:true});
  if (created.error) throw created.error;
  account = {email,password,id:created.data.user.id};
  await writeFile(accountPath,JSON.stringify(account),{mode:0o600,flag:'wx'});
}
const membership = await admin.from('campus_preview_members').upsert({user_id:account.id},{onConflict:'user_id',ignoreDuplicates:true});
if (membership.error) throw Error('개발 파일 회원 등록 실패: '+membership.error.message);

const roundId = 'hvac-20160306';
const storeKey = 'cbt-learning-auth-industrial';
async function login(page) {
  page.on('requestfailed',request=>{
    const url=new URL(request.url());
    if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/rest/'))console.error('Request failed:',request.method(),url.origin+url.pathname,request.failure()?.errorText);
  });
  page.on('response',response=>{
    const path=new URL(response.url()).pathname;
    if(path.startsWith('/api/learning/')&&response.status()>=400)console.error('Learning API',response.status(),path);
  });
  page.on('console', async msg=>{
    if(msg.type()==='error' && msg.text().startsWith('학습 기록 동기화 실패')){
      const error=msg.args()[1];
      const detail=error && await error.evaluate(e=>String(e?.message || e?.name || 'unknown')).catch(()=>null);
      console.error('Sync failed during browser verification:',String(detail).replace(/eyJ[\w.-]+/g,'[redacted]').slice(0,240));
    }
  });
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), panel => panel.getByRole('button',{name:'나중에',exact:true}).click());
  await page.goto(mobileTestUrl(page,'/?safe=1#/study/settings',base));
  await page.getByRole('navigation', {name:'설정 목차'}).getByRole('button', {name:'기록·동기화'}).click();
  await expect(page.locator('.cloud-sync-setting')).toBeVisible();
  const destination = await page.evaluate(()=>window.CBT_CLOUD_CONFIG?.supabaseUrl);
  assert.equal(destination,runtime.API_URL);
  const panel = page.locator('.cloud-sync-setting');
  await panel.getByRole('button',{name:'로그인·회원가입'}).click();
  await panel.locator('input[autocomplete=username]').fill(account.email);
  await panel.locator('input[type=password]').fill(account.password);
  await panel.locator('form').getByRole('button',{name:'로그인',exact:true}).click();
  await expect(panel.locator('.cloud-sync-account strong')).toHaveText(account.email);
  await expect(panel.getByRole('status')).toContainText('서버 저장 확인 완료',{timeout:25000});
  const session = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storeKey);
  assert.equal(session.user.id,account.id);
  return session.access_token;
}
async function openRound(page) {
  await page.goto(mobileTestUrl(page,'/?safe=1#/study/rounds',base));
  const start = page.locator('#round-card-'+roundId).getByRole('button',{name:/^(이어 학습|학습모드)$/});
  await start.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await start.click();
  await expect(page.locator('.question-card').first()).toBeVisible();
}
async function goTo(page,n) {
  const jump=page.getByRole('spinbutton',{name:'이동할 문제 번호'});
  await jump.fill(String(n));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const item=page.locator('#session-question-'+n);
  await expect(item).toBeVisible();
  return item;
}
async function choice(page,n,answer,select) {
  const card=await goTo(page,n);
  const button=card.locator('.choice-button').nth(answer-1);
  if(select)await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
}
async function bookChoices(page,book,number,pageNumber) {
  await page.goto(mobileTestUrl(page,'/?safe=1#/study/rounds',base));
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  await page.locator('.textbook-library .library-selection .library-open').click();
  await page.getByRole('button',{name:/☷ 목차·쪽 선택/}).click();
  const dialog=page.locator('#textbook-navigator');
  await dialog.getByRole('button',{name:book==='energy'?'에너지설비 교재':'한솔 공조 교재',exact:true}).click();
  await dialog.getByRole('button',{name:'쪽번호 이동',exact:true}).click();
  await dialog.locator('.page-picker input').first().fill(pageNumber);
  await dialog.locator('.page-picker input').nth(1).fill('');
  const submit=dialog.locator('.page-picker button[type=submit]');
  await expect(submit).toBeEnabled();
  if(usbPort && page===phonePage)await dialog.locator('.page-picker input').nth(1).press('Enter');
  else await submit.click();
  const row=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 '+number+'번',exact:true})});
  return row.locator(book==='energy'?'.source-image-stage':'.direct-question-parts .direct-viewport').first().getByRole('button');
}
async function sync(page) {
  await page.goto(mobileTestUrl(page,'/?safe=1#/study/settings',base));
  await page.getByRole('navigation', {name:'설정 목차'}).getByRole('button', {name:'기록·동기화'}).click();
  const panel=page.locator('.cloud-sync-setting');
  await panel.getByRole('button',{name:'지금 동기화'}).click();
  await expect(panel.getByRole('status')).toContainText('서버 저장 확인 완료',{timeout:25000});
}
async function attempts(token) {
  const response=await fetch(api+'/learning/industrial',{headers:{Authorization:'Bearer '+token}});
  assert.equal(response.status,200);
  return (await response.json()).state?.payload?.store?.attempts || {};
}
// Exercise recovery on a synthetic note in this disposable QA account.
async function verifyRecoveryPanel(page) {
  const key='qa-recovery-panel-note';
  const copy={id:randomUUID(),owner:'industrial:'+account.id,createdAt:Date.now(),
    kind:'note',key,label:'QA 복구 메모',local:'이 기기 연습 답안',remote:'서버 연습 답안'};
  await page.evaluate(row=>new Promise((resolve,reject)=>{
    const open=indexedDB.open('cbt-sync-recovery-v1');
    open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{
      const db=open.result;
      const tx=db.transaction('copies','readwrite');
      tx.objectStore('copies').put(row);
      tx.oncomplete=()=>{db.close();resolve(true);};
      tx.onerror=()=>{db.close();reject(tx.error);};
    };
  }),copy);
  await sync(page);
  const panel=page.locator('.cloud-sync-setting');
  await panel.locator('details.cloud-sync-recovery > summary').click();
  const recovery=panel.getByRole('region',{name:'풀이 복구 사본'});
  const row=recovery.locator('details').filter({hasText:copy.label}).first();
  await row.locator('summary').click();
  const server=row.locator('.sync-recovery-choices > div').nth(1);
  await expect(server.locator('pre')).toHaveText(copy.remote);
  const download=page.waitForEvent('download');
  await recovery.getByRole('button',{name:'사본 파일로 보관'}).click();
  const exported=JSON.parse(await readFile(await (await download).path(),'utf8'));
  assert.ok(exported.copies.some(item=>item.id===copy.id && item.remote===copy.remote));
  page.once('dialog',dialog=>dialog.accept());
  await server.getByRole('button',{name:'이 풀이 복구'}).click();
  await expect(recovery.getByRole('status')).toContainText('선택한 풀이를 복구했습니다.');
  await expect.poll(()=>page.evaluate(k=>JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}').notes?.[k],key)).toBe(copy.remote);
  await panel.getByRole('button',{name:'로그아웃'}).click();
  await panel.getByRole('button',{name:'로그인·회원가입'}).click();
  await expect(panel.locator('input[autocomplete=username]')).toHaveValue(account.email);
  await expect(panel.locator('input[type=password]')).toHaveValue('');
  console.log('PASS recovery export, confirmed note restore, sign-out and remembered identifier');
}
const desktop=await chromium.launch({channel:'chrome'});
let mobile,ctxB,phonePage;
try {
  const ctxA=await desktop.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  mobile=await openMobileBrowser();
  ctxB=await mobile.newPage({serviceWorkers:'block'},base);
  const a=await ctxA.newPage(),b=ctxB.page;
  phonePage=b;
  a.setDefaultTimeout(15000); b.setDefaultTimeout(15000);
  const tokenA=await login(a),tokenB=await login(b);
  assert.ok(tokenA!==tokenB,'로그인 세션이 각각 발급되어야 합니다.');
  console.log('PASS independent desktop/mobile browser logins for one local Supabase user');
  const before=await attempts(tokenA);
  const answer=(n,preferred)=>before[roundId+':'+n]?.lastChoice===preferred ? preferred%4+1 : preferred;
  const first=answer(1,2), second=answer(2,3);
  await openRound(a); await choice(a,1,first,true);
  await expect.poll(async()=>(await attempts(tokenA))[roundId+':1']?.lastChoice,{timeout:20000}).toBe(first);
  await sync(b); await openRound(b); await choice(b,1,first,false);
  await choice(b,2,second,true);
  await expect.poll(async()=>(await attempts(tokenB))[roundId+':2']?.lastChoice,{timeout:20000}).toBe(second);
  await sync(a); await openRound(a); await choice(a,2,second,false);
  await choice(a,1,first,false);
  console.log('PASS two-way selected answers',first,second);
  const direct = await bookChoices(a,'hansol',25,'1-168');
  const firstBookAnswer = await direct.nth(1).getAttribute('aria-pressed') === 'true' ? 3 : 2;
  await direct.nth(firstBookAnswer-1).click();
  await sync(a); await sync(b);
  const imported = await bookChoices(b,'hansol',25,'1-168');
  await expect(imported.nth(firstBookAnswer-1)).toHaveAttribute('aria-pressed','true');
  const linked = await bookChoices(b,'energy',16,'414');
  const secondBookAnswer = await linked.nth(2).getAttribute('aria-pressed') === 'true' ? 4 : 3;
  await linked.nth(secondBookAnswer-1).click();
  await sync(b); await sync(a);
  const received = await bookChoices(a,'energy',16,'414');
  await expect(received.nth(secondBookAnswer-1)).toHaveAttribute('aria-pressed','true');
  const clear = await bookChoices(b,'hansol',25,'1-168');
  await clear.nth(firstBookAnswer-1).click();
  await sync(b); await sync(a);
  const cleared = await bookChoices(a,'hansol',25,'1-168');
  await expect(cleared.nth(firstBookAnswer-1)).toHaveAttribute('aria-pressed','false');
  const retained = await bookChoices(a,'energy',16,'414');
  await expect(retained.nth(secondBookAnswer-1)).toHaveAttribute('aria-pressed','true');
  console.log('PASS printed textbook choices in both directions and remote cancellation',firstBookAnswer,secondBookAnswer);
  const object=account.id+'/qa-'+randomUUID()+'.glb';
  const operation=async(page,method,path)=>page.evaluate(async({method,path,baseUrl,object,storeKey})=>{
    const session=JSON.parse(localStorage.getItem(storeKey));
    const headers={apikey:window.CBT_CLOUD_CONFIG.supabaseAnonKey, Authorization:'Bearer '+session.access_token};
    let bytes;
    if(method==='POST') {
      const source=await fetch(new URL('assets/equipment/centrifugal-pump.glb',document.baseURI));
      if(!source.ok)throw Error('시험 모형 읽기 실패');
      bytes=await source.arrayBuffer(); headers['Content-Type']='model/gltf-binary';
    }
    const response=await fetch(baseUrl+'/storage/v1/object/'+path+'/'+object,{method,headers,body:bytes});
    if(!response.ok)throw Error('Storage '+method+' '+response.status+' '+(await response.text()).slice(0,160));
    if(method==='POST')return;
    const body=await response.arrayBuffer();
    return {bytes:body.byteLength,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),n=>n.toString(16).padStart(2,'0')).join('')};
  },{method,path,baseUrl:runtime.API_URL,object,storeKey});
  await operation(a,'POST','campus-private');
  const saved=await operation(b,'GET','authenticated/campus-private');
  const source=await readFile(new URL('../assets/equipment/centrifugal-pump.glb',import.meta.url));
  assert.deepEqual(saved,{bytes:source.byteLength,hash:createHash('sha256').update(source).digest('hex')});
  await writeFile(join(dirname(runtimePath),usbPort?'verified-usb.json':'verified.json'),JSON.stringify({environment:usbPort?'Android USB':'Mac Chrome mobile emulation',roundId,first,second,object,...saved,checkedAt:new Date().toISOString()},null,2),{mode:0o600});
  console.log('PASS private Storage upload in A, download in B, bytes and SHA-256',saved.bytes,saved.hash);
  await verifyRecoveryPanel(a);
} finally {
  try {await ctxB?.close();} finally {await Promise.all([desktop.close(),mobile?.close()]);}
}
