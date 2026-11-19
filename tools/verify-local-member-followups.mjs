import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const env=JSON.parse(await readFile('../cbt-supabase-dev/runtime.json','utf8'));
assert.equal(env.API_URL,'http://127.0.0.1:54321');
const client=key=>createClient(env.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
const service=client(env.SERVICE_ROLE_KEY);
const users=[];
let browser;
const largeDirectory=process.argv.includes('--large-directory');
const cohort='cbt-directory-'+randomUUID();
const sql=statement=>execFileSync('docker',['-H','unix://'+process.env.HOME+'/.colima/cbt-dev/docker.sock','exec','-i','supabase_db_cbt-supabase-dev','psql','-XAtq','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:statement,encoding:'utf8'}).trim();
let seeded=false;
async function account(role) {
  const email='followup-'+randomUUID()+'@example.test', password=randomBytes(24).toString('base64url');
  const created=await service.auth.admin.createUser({email,password,email_confirm:true});
  assert.ifError(created.error);const id=created.data.user.id;
  users.push(id);
  if(role!=='learner'){
    const saved=await service.from('admin_role_members').insert({user_id:id,role:'admin',can_view_members:true,can_manage_members:role==='editor'});
    assert.ifError(saved.error);
  }
  const auth=client(env.ANON_KEY);
  assert.ifError((await auth.auth.signInWithPassword({email,password})).error);
  return {auth,email,password,id};
}
async function login(page,user,hash){
  await page.goto('http://127.0.0.1:4360/admin.html'+hash);
  await page.getByLabel('이메일 또는 사이트 아이디').fill(user.email);
  await page.getByLabel('비밀번호',{exact:true}).fill(user.password);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
}
async function verifyDesk(a,b,member) {
  const left=await browser.newPage(),right=await browser.newPage();
  const home='#/admin/overview';
  const table=c=>c.from('admin_member_followups');
  const inbox=c=>c.from('admin_followup_notifications').select('*').eq('user_id',member.id);
  const result=await table(a.auth).insert({user_id:member.id,note:'홈에서 확인할 건',needs_follow_up:true});
  assert.ifError(result.error);
  await Promise.all([login(left,a,home),login(right,b,home)]);
  const unassigned=left.getByRole('region',{name:'담당자 없는 후속 건'});
  const mine=right.getByRole('region',{name:'내가 맡은 후속 건'});
  await expect(unassigned.getByRole('link',{name:member.email})).toBeVisible();
  if(largeDirectory){
    const snapshot=await a.auth.rpc('cbt_followup_desk',{show_queues:true});
    assert.ifError(snapshot.error);
    assert.ok(snapshot.data.queues.unassigned.total>=206);
    assert.equal(snapshot.data.queues.unassigned.items.length,5);
    await expect(unassigned.locator('strong')).toHaveText(snapshot.data.queues.unassigned.total+'건');
  }
  await unassigned.getByRole('link',{name:'전체 보기'}).click();
  await expect(left.getByLabel('담당자 필터')).toHaveValue('none');
  await expect(left.getByLabel('처리 상태')).toHaveValue('follow');
  await left.goBack();
  await unassigned.getByRole('link',{name:member.email}).click();
  await expect(left.getByLabel('관리자 메모')).toHaveValue('홈에서 확인할 건');
  await left.getByLabel('담당자 지정').selectOption(b.id);
  await left.getByRole('button',{name:'메모 저장'}).click();
  await expect(left.getByText('저장했습니다.',{exact:true})).toBeVisible();
  const toast=right.getByRole('complementary',{name:'새 배정 알림'});
  await expect(toast).toContainText(member.email,{timeout:12000});
  await expect(mine.getByRole('link',{name:member.email})).toBeVisible();
  const onlyB=await inbox(b.auth);assert.ifError(onlyB.error);assert.equal(onlyB.data.length,1);
  assert.equal(onlyB.data[0].recipient_id,b.id);assert.equal(onlyB.data[0].seen,false);
  const other=await inbox(a.auth);assert.ifError(other.error);assert.deepEqual(other.data,[]);
  const denied=await a.auth.from('admin_followup_notifications').update({seen:true}).eq('id',onlyB.data[0].id).select();
  assert.ok(denied.error||!denied.data.length);
  await mine.getByRole('link',{name:'전체 보기'}).click();
  await expect(right.getByLabel('담당자 필터')).toHaveValue(b.id);
  await expect(right.getByLabel('처리 상태')).toHaveValue('follow');
  await toast.getByRole('button',{name:'배정된 기록 열기'}).click();
  await expect(right.getByLabel('관리자 메모')).toHaveValue('홈에서 확인할 건');
  await expect(right.getByLabel('담당자 지정')).toHaveValue(b.id);
  const read=await inbox(b.auth);assert.equal(read.data[0].seen,true);
  await right.reload();
  await expect(right.getByLabel('관리자 메모')).toHaveValue('홈에서 확인할 건');
  await right.getByLabel('관리자 메모').fill('완료');
  await right.getByLabel('후속 확인 필요',{exact:true}).uncheck();
  await right.getByRole('button',{name:'메모 저장'}).click();
  await expect(right.getByText('저장했습니다.',{exact:true})).toBeVisible();
  await right.goto('http://127.0.0.1:4360/admin.html'+home);
  await expect(mine).toContainText('후속 확인이 필요한 회원이 없습니다.');
  assert.equal((await inbox(b.auth)).data.length,1);
  await right.close();
  assert.ifError((await table(a.auth).update({assignee_id:null,needs_follow_up:true}).eq('user_id',member.id)).error);
  assert.ifError((await table(a.auth).update({assignee_id:b.id}).eq('user_id',member.id)).error);
  const returning=await browser.newPage();
  await login(returning,b,home);
  await expect(returning.getByRole('complementary',{name:'새 배정 알림'})).toContainText(member.email);
  await returning.getByText('배정 알림 확인',{exact:true}).click();
  await returning.getByRole('button',{name:'읽음 처리',exact:true}).click();
  await expect(returning.getByText('배정 알림 확인',{exact:true})).toHaveCount(0);
  assert.equal((await inbox(b.auth)).data.filter(n=>!n.seen).length,0);
  const restricted=await member.auth.rpc('cbt_followup_desk',{show_queues:true});assert.ok(restricted.error);
  await Promise.all([left.close(),returning.close()]);
  console.log('PASS two logged-in managers: unassigned and personal queues, live in-app alert without reload, direct record links, recipient-only read status, completion and offline delivery');
}

async function verifyClaim(a,b,reader,member){
  const note='담당자 동시 배정 확인';
  const claim=auth=>auth.rpc('claim_member_followup',{target_member:member.id});
  const record=auth=>auth.from('admin_member_followups');
  assert.ifError((await record(a.auth).insert({user_id:member.id,note,needs_follow_up:true})).error);
  const pages=await Promise.all([browser.newPage(),browser.newPage(),browser.newPage()]);
  const accounts=[a,b,reader];
  const button=page=>page.getByRole('button',{name:member.email+' 내가 맡기',exact:true});
  const queue=page=>page.getByRole('region',{name:'담당자 없는 후속 건'});
  const held=[];
  function resolveRoute(route,resolve){
    held.push({route,resolve});
    if(held.length===2)for(const request of held)request.resolve(request.route.continue());
  }
  try{
    await Promise.all(pages.map((page,i)=>login(page,accounts[i],'#/admin/overview')));
    await expect(queue(pages[2]).getByRole('link',{name:member.email})).toBeVisible();
    await expect(button(pages[2])).toHaveCount(0);
    for(const user of [reader.auth,member.auth,client(env.ANON_KEY)]){
      const denied=await claim(user);assert.equal(denied.error?.code,'42501');
    }
    const editors=pages.slice(0,2);
    // Hold both real requests until both browsers have submitted the same visible record.
    const requests=await Promise.all(editors.map(async page=>{
      await page.route('**/rpc/claim_member_followup',route=>new Promise(resolve=>resolveRoute(route,resolve)));
      const request=page.waitForResponse(r=>r.url().endsWith('/rpc/claim_member_followup') && r.request().method()==='POST');
      await button(page).click();
      return (await request).json();
    }));
    const winnerIndex=requests.findIndex(r=>r.status==='claimed');
    assert.ok(winnerIndex>=0);
    const winner=accounts[winnerIndex],other=1-winnerIndex;
    assert.deepEqual(requests[other],{status:'taken',owner:winner.email});
    await expect(editors[winnerIndex].getByRole('status').filter({hasText:'후속 건을 맡았습니다.'})).toContainText(member.email);
    await expect(editors[other].getByRole('status').filter({hasText:'먼저 맡았습니다.'})).toContainText(winner.email);
    await expect(editors[winnerIndex].getByRole('region',{name:'내가 맡은 후속 건'}).getByRole('link',{name:member.email})).toBeVisible();
    for(const page of editors)await expect(queue(page).getByRole('link',{name:member.email})).toHaveCount(0);
    assert.deepEqual((await claim(winner.auth)).data,{status:'already_mine'});
    const saved=await record(reader.auth).select('revision,note,assignee_id').eq('user_id',member.id).single();
    assert.deepEqual(saved.data,{revision:2,note,assignee_id:winner.id});
    const history=await reader.auth.from('admin_member_followup_history').select('revision,actor_id').eq('user_id',member.id).order('revision');
    assert.deepEqual(history.data,[{revision:1,actor_id:a.id},{revision:2,actor_id:winner.id}]);
    const alerts=await service.from('admin_followup_notifications').select('recipient_id,revision').eq('user_id',member.id);
    assert.deepEqual(alerts.data,[{recipient_id:winner.id,revision:2}]);
    assert.ifError((await record(winner.auth).update({needs_follow_up:false}).eq('user_id',member.id)).error);
    assert.deepEqual((await claim(accounts[other].auth)).data,{status:'closed'});
    console.log('PASS simultaneous claims from two logged-in browsers, winner name, one audit event and notification, idempotent retry, closed record and read-only access');
  }finally{await Promise.all(pages.map(page=>page.close()));}
}

try {
  const editor=await account('editor'), colleague=await account('editor'), reader=await account('reader'), learner=await account('learner');
  if(largeDirectory){
    // Local-only, non-login users share a timestamp to exercise the UUID tie-breaker.
    sql(`insert into auth.users(id,email,aud,role,created_at,updated_at,raw_user_meta_data)
      select gen_random_uuid(),'${cohort}-'||i||'@example.test','authenticated','authenticated',now(),now(),
        jsonb_build_object('directory_test','${cohort}') from generate_series(1,1001) i;`);
    seeded=true;
    sql(`insert into public.admin_member_followups(user_id,note,needs_follow_up)
      select id,'대기 중',true from auth.users where raw_user_meta_data->>'directory_test'='${cohort}' order by id limit 205;`);
    const row=await editor.auth.functions.invoke('sync-account',{body:{action:'admin-list',pageSize:1}});
    assert.ifError(row.error);assert.equal(row.data.accounts.length,1);assert.ok(row.data.nextCursor);
    for(const restricted of [learner.auth,reader.auth,client(env.ANON_KEY)]) {
      const direct=await restricted.rpc('cbt_member_directory_page',{before_created_at:null,before_user_id:null,page_size:2});
      assert.ok(direct.error,'internal projection must not be callable by browser roles');
    }
    const denied=await learner.auth.functions.invoke('sync-account',{body:{action:'admin-list',pageSize:1,cursor:row.data.nextCursor}});
    assert.equal(denied.error?.context.status,403);
  }
  browser=await chromium.launch({channel:'chrome',headless:true});
  await verifyDesk(editor,colleague,await account('learner'));
  await verifyClaim(editor,colleague,reader,await account('learner'));
  async function open(user){
    const page=await browser.newPage();
    const pages=[];
    page.on('response',async response=>{
      if(!response.url().endsWith('/functions/v1/sync-account') || response.request().method()!=='POST' || response.request().postDataJSON()?.action!=='admin-list')return;
      pages.push((await response.json()).accounts);
    });
    await login(page,user,'#/admin/member-followups');
    await expect(page.getByRole('heading',{level:1,name:'회원 후속 관리'})).toBeVisible();
    await page.getByLabel('회원 검색').fill(learner.email);
    await page.getByRole('button',{name:'기록 열기'}).click();
    if(largeDirectory){
      await expect.poll(()=>pages.flat().filter(a=>a.email?.startsWith(cohort)).length).toBe(1001);
      const all=pages.flat();assert.equal(new Set(all.map(a=>a.userId)).size,all.length);
      assert.ok(all.findIndex(a=>a.userId===learner.id)>=1000);
      assert.ok(pages.length>=6);
      assert.ok(pages.every(p=>p.length<=200));
      await page.getByRole('button',{name:'닫기',exact:true}).click();
      await page.getByLabel('회원 검색').fill(cohort);
      await page.getByLabel('처리 상태').selectOption('follow');
      await expect(page.getByRole('status').filter({hasText:'205명 표시'})).toBeVisible();
      await page.getByLabel('처리 상태').selectOption('all');
      await page.getByLabel('회원 검색').fill(learner.email);
      await page.getByRole('button',{name:'기록 열기'}).click();
    }
    return page;
  }
  const page=await open(editor);
  await page.getByLabel('담당자 지정').selectOption(editor.id);
  await page.getByLabel('관리자 메모').fill('개발 검증 메모');
  await page.getByLabel('후속 확인 필요',{exact:true}).check();
  await page.getByRole('button',{name:'메모 저장'}).click();
  await expect(page.getByText('저장했습니다.',{exact:true})).toBeVisible();
  const view=await open(reader);
  await expect(view.getByLabel('관리자 메모')).toHaveValue('개발 검증 메모');
  await expect(view.getByRole('button',{name:'메모 저장'})).toHaveCount(0);
  const history=view.getByRole('region',{name:'처리 이력'});
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history.locator('li strong')).toHaveText(editor.email);
  await expect(view.getByLabel('담당자 지정')).toBeDisabled();
  await expect(view.getByLabel('담당자 지정')).toHaveValue(editor.id);
  const historyRows=c=>c.from('admin_member_followup_history').select('*').eq('user_id',learner.id).order('revision');
  const noteTable=c=>c.from('admin_member_followups');
  const read=c=>noteTable(c).select().eq('user_id',learner.id);
  const viewerRows=await read(reader.auth);assert.ifError(viewerRows.error);assert.equal(viewerRows.data[0].revision,1);
  const hidden=await read(learner.auth);assert.ifError(hidden.error);assert.deepEqual(hidden.data,[]);
  const denied=await noteTable(reader.auth).update({note:'권한 검사'}).eq('user_id',learner.id).select();
  assert.ok(denied.error || !denied.data.length);
  const anon=await read(client(env.ANON_KEY));assert.ok(anon.error || !anon.data.length);
  const deniedAssignment=await noteTable(editor.auth).update({assignee_id:reader.id}).eq('user_id',learner.id);
  assert.equal(deniedAssignment.error?.code,'23514');
  const secondPage=await open(colleague);
  await secondPage.getByLabel('담당자 지정').selectOption(colleague.id);
  await secondPage.getByLabel('관리자 메모').fill('다른 관리 세션 수정');
  await secondPage.getByRole('button',{name:'메모 저장'}).click();
  await expect(secondPage.getByText('저장했습니다.',{exact:true})).toBeVisible();
  await history.getByRole('button',{name:'이력 새로고침'}).click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  const newest=history.getByRole('listitem').first();
  await expect(newest.locator('strong')).toHaveText(colleague.email);
  await expect(newest).toContainText(editor.email+' → '+colleague.email);
  await newest.locator('summary').click();
  await expect(newest).toContainText('변경 전 · 개발 검증 메모');
  await expect(newest).toContainText('변경 후 · 다른 관리 세션 수정');
  const events=await historyRows(reader.auth);assert.ifError(events.error);
  assert.deepEqual(events.data.map(e=>e.actor_id),[editor.id,colleague.id]);
  assert.deepEqual(events.data[1].changes.note,['개발 검증 메모','다른 관리 세션 수정']);
  assert.equal(await newest.locator('time').getAttribute('datetime'),events.data[1].changed_at);
  assert.ok(Number.isFinite(Date.parse(events.data[1].changed_at)));
  const privateEvents=await historyRows(learner.auth);assert.ifError(privateEvents.error);assert.deepEqual(privateEvents.data,[]);
  const anonymousEvents=await historyRows(client(env.ANON_KEY));assert.ok(anonymousEvents.error||!anonymousEvents.data.length);
  const forged=await editor.auth.from('admin_member_followup_history').insert({user_id:learner.id,revision:99,
    changed_at:new Date().toISOString(),actor_name:'임의 이름',actor_id:reader.id,changes:{}});
  assert.ok(forged.error);
  await page.getByLabel('관리자 메모').fill('이전 화면에서 편집');
  await page.getByRole('button',{name:'메모 저장'}).click();
  await expect(page.getByText(/다른 관리자가 먼저 저장/)).toBeVisible();
  await page.reload();
  await page.getByLabel('처리 상태').selectOption('follow');
  await page.getByLabel('회원 검색').fill(learner.email);
  await page.getByRole('button',{name:'기록 열기'}).click();
  await expect(page.getByLabel('관리자 메모')).toHaveValue('다른 관리 세션 수정');
  await page.getByLabel('담당자 필터').selectOption(colleague.id);
  await expect(page.locator('.admin-content tbody tr')).toContainText(learner.email);
  await page.getByLabel('담당자 지정').selectOption('');
  await page.getByLabel('후속 확인 필요',{exact:true}).uncheck();
  await page.getByRole('button',{name:'메모 저장'}).click();
  await expect(page.getByText('저장했습니다.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'기록 열기'})).toHaveCount(0);
  await history.getByRole('button',{name:'이력 새로고침'}).click();
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await expect(history.getByRole('listitem').first()).toContainText('처리 완료');
  await expect(history.getByRole('listitem').first()).toContainText(colleague.email+' → 미지정');
  await expect(history.getByRole('listitem').first().locator('strong')).toHaveText(editor.email);
  const final=await historyRows(reader.auth);
  assert.ifError(final.error);
  assert.deepEqual(final.data.map(e=>e.revision),[1,2,3]);
  assert.deepEqual(final.data[2].changes.followUp,[true,false]);
  assert.deepEqual(final.data[2].changes.assignee,[colleague.email,null]);
  assert.equal(final.data[2].actor_id,editor.id);
  const assigned=await noteTable(editor.auth).update({assignee_id:colleague.id}).eq('user_id',learner.id);assert.ifError(assigned.error);
  const revoked=await service.from('admin_role_members').update({can_manage_members:false}).eq('user_id',colleague.id);
  assert.ifError(revoked.error);
  const cleared=await read(reader.auth);assert.ifError(cleared.error);assert.equal(cleared.data[0].assignee_id,null);
  for(let i=0;i<17;i++){
    const edit=await noteTable(editor.auth).update({note:'쪽 나눔 검사 '+i}).eq('user_id',learner.id);assert.ifError(edit.error);
  }
  await history.getByRole('button',{name:'이력 새로고침'}).click();
  await expect(history.getByRole('listitem')).toHaveCount(20);
  await history.getByRole('button',{name:'이전 이력 더 보기'}).click();
  await expect(history.getByRole('listitem')).toHaveCount(22);
  await expect(history.getByRole('listitem').last().locator('strong')).toHaveText(editor.email);
  console.log('PASS assignment, reassignment, actor and timestamp, note diff, completion, unassignment, role revocation, read-only history and 22 paginated events');
  if(largeDirectory){
    await page.goto('http://127.0.0.1:4360/admin.html#/admin/accounts');
    const search=page.getByPlaceholder('아이디·이메일 검색');
    await search.fill(cohort);
    await expect(page.getByRole('navigation',{name:'회원 목록 페이지'})).toContainText('1,001명');
    await expect(page.locator('.account-panel tbody tr')).toHaveCount(25);
    await page.getByRole('button',{name:'다음',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'회원 목록 페이지'})).toContainText('2 / 41');
    await search.fill(learner.email);
    await expect(page.locator('.account-panel tbody tr')).toHaveCount(1);
    await expect(page.locator('.account-panel tbody')).toContainText(learner.email);
    console.log('PASS 1,001 equal-timestamp fixtures, six or more nonoverlapping API pages, restricted roles, searchable member beyond 1,000, both admin screens');
  }
  console.log('PASS local Supabase Auth, two admin browser sessions, note persistence, RLS, stale edit conflict, follow-up resolution');
} finally {
  await browser?.close();
  if(seeded){
    sql(`delete from auth.users where raw_user_meta_data->>'directory_test'='${cohort}' and email like '${cohort}-%@example.test';`);
    assert.equal(sql(`select count(*) from auth.users where raw_user_meta_data->>'directory_test'='${cohort}';`),'0');
  }
  for(const id of users.reverse())assert.ifError((await service.auth.admin.deleteUser(id)).error);
}
