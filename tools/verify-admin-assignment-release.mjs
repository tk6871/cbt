import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const mode=process.argv[2];
assert.ok(['development','production'].includes(mode),'Specify development or production');
const prod=mode==='production';
const ref='bjwimcjatdcxjcuxikui';
const site=prod?'https://tk6871.github.io/cbt/':'http://127.0.0.1:4360/';
const api=prod?'https://'+ref+'.supabase.co':'http://127.0.0.1:54321';
const config=await fetch(site+'cloud-config.js',{cache:'no-store'});
assert.ok(config.ok);
const source=await config.text();
assert.ok(source.includes(api));
const key=source.match(/["']?supabaseAnonKey["']?\s*:\s*["']([^"']+)["']/)?.[1];
assert.ok(key,'Browser public key missing');
const client=()=>createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
const prefix='qa'+randomBytes(8).toString('hex');
const names=['a','b','m'].map(suffix=>prefix+suffix);
let signupStarted=false;
const external=process.argv.includes('--external-sql');
const terminal=external?createInterface({input:process.stdin,output:process.stdout}):null;
async function sql(statement){
  if(terminal){
    console.log('연결한 Supabase 프로젝트에서 실행할 테스트 전용 SQL\n'+statement);
    const answer=await terminal.question('SQL 실행 성공을 확인한 후 OK를 입력하세요: ');
    assert.equal(answer.trim(),'OK');
    return;
  }
  const args=['db','query',...(prod?['--remote='+ref,'--yes']:['--local','--workdir','../cbt-supabase-dev']),statement];
  execFileSync('supabase',args,{env:{...process.env,...(!prod&&{DOCKER_HOST:'unix://'+process.env.HOME+'/.colima/cbt-dev/docker.sock'})},stdio:['ignore','pipe','pipe']});
}
async function account(name){
  const password=randomBytes(24).toString('base64url'),auth=client();
  signupStarted=true;
  const added=await auth.functions.invoke('sync-account',{body:{action:'signup',username:name,password}});
  assert.ifError(added.error);
  const login=await auth.auth.signInWithPassword({email:added.data.internalEmail,password});
  assert.ifError(login.error);
  const id=login.data.user.id;
  assert.match(id,/^[a-f0-9-]{36}$/);
  return {id,name,password,auth};
}
async function login(page,account){
  await page.goto(site+'admin.html#/admin/overview');
  await page.getByLabel('이메일 또는 사이트 아이디').fill(account.name);
  await page.getByLabel('비밀번호',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'로그인',exact:true}).click();
}
let browser;
try{
  // Check the selected CLI target before creating any temporary site accounts.
  if(!external)await sql('select 1');
  const a=await account(names[0]),b=await account(names[1]),m=await account(names[2]);
  await sql(`insert into public.admin_role_members(user_id,role,can_view_members,can_manage_members)
       select id,'admin',true,true from auth.users where
       (id,raw_user_meta_data->>'sync_username') in (('${a.id}'::uuid,'${a.name}'),('${b.id}'::uuid,'${b.name}'))`);
  const seeded=await a.auth.from('admin_member_followups').insert({user_id:m.id,note:'배정 알림 공개 경로 점검',needs_follow_up:true});
  assert.ifError(seeded.error);
  browser=await chromium.launch({channel:'chrome'});
  const left=await browser.newPage(),right=await browser.newPage();
  await Promise.all([login(left,a),login(right,b)]);
  const unassigned=left.getByRole('region',{name:'담당자 없는 후속 건'});
  await expect(right.getByRole('region',{name:'담당자 없는 후속 건'}).getByRole('link',{name:m.name})).toBeVisible();
  await unassigned.getByRole('link',{name:m.name}).click();
  await left.getByLabel('담당자 지정').selectOption(b.id);
  await left.getByRole('button',{name:'메모 저장'}).click();
  await expect(left.getByText('저장했습니다.',{exact:true})).toBeVisible();
  const toast=right.getByRole('complementary',{name:'새 배정 알림'});
  await expect(toast).toContainText(m.name,{timeout:15000});
  await expect(right.getByRole('region',{name:'내가 맡은 후속 건'}).getByRole('link',{name:m.name})).toBeVisible();
  const notices=auth=>auth.from('admin_followup_notifications').select('recipient_id,seen').eq('user_id',m.id);
  assert.deepEqual((await notices(a.auth)).data,[]);
  assert.deepEqual((await notices(b.auth)).data,[{recipient_id:b.id,seen:false}]);
  await toast.getByRole('button',{name:'배정된 기록 열기'}).click();
  await expect(right.getByLabel('담당자 지정')).toHaveValue(b.id);
  assert.deepEqual((await notices(b.auth)).data,[{recipient_id:b.id,seen:true}]);
  console.log('PASS',mode,'two independent browser logins, assignment, automatic recipient-only notification and read receipt');
}finally{
  await browser?.close();
  // Handles a lost signup response, too. Both recovery name and Auth metadata must match this run.
  if(signupStarted){
    const list=names.map(name=>"'"+name+"'").join(',');
    await sql(`do $$ begin
      delete from auth.users u using public.sync_account_recovery r where u.id=r.user_id
      and r.username_key in (${list}) and u.raw_user_meta_data->>'sync_username'=r.username_key;
      if exists(select from auth.users where raw_user_meta_data->>'sync_username' in (${list})) then
        raise exception 'Temporary account cleanup needs attention'; end if;
      end $$`);
    console.log('PASS temporary accounts cleaned');
  }
  terminal?.close();
}
