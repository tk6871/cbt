import {readFile} from 'node:fs/promises';
import {expect,test,type Page} from '@playwright/test';

test.use({serviceWorkers:'block'});

async function openWorkspace(page:Page, role:'super_admin'|'issues'|'members', hash='') {
  const now=new Date().toISOString();
  const id='00000000-0000-4000-8000-000000000001';
  const everything=role==='super_admin';
  const permissions={viewAnalytics:everything,manageIssues:role!=='members',viewMembers:role!=='issues',manageMembers:everything};
  const user={id,email:'preview@example.invalid',app_metadata:{provider:'email'},user_metadata:{sync_username:'검토 계정'},aud:'authenticated',created_at:now};
  const expires=Math.floor(Date.now()/1000)+3600;
  const payload=Buffer.from(JSON.stringify({sub:id,exp:expires})).toString('base64url');
  const session={access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.test',refresh_token:'test-only',token_type:'bearer',expires_in:3600,expires_at:expires,user};
  await page.addInitScript(s=>localStorage.setItem('sb-preview-auth-token',JSON.stringify(s)),session);
  const issue={id:1,space:'industrial',qualification_key:'hvac',qualification:'공조',round_id:'sample',round_title:'예시 회차',question_id:'sample:1',question_number:1,subject:'냉동공학',issue_types:['explanation'],details:'테스트 제보',question_text:'예시 문항',status:'open',created_at:now,updated_at:now,admin_note:''};
  const accounts=[{userId:'sample-member',username:'예시회원',accountType:'site_id',role:'admin' as string|null,permissions:{...permissions},createdAt:now,lastSignInAt:now}];
  const results=Array.from({length:54},(_,i)=>({id:i,title:'연습 '+i,qualification:'공조',mode:i%2?'exam':'learn',score:81+(i%14===0?0:(i%14)*3%11-5),correct_count:4,total_count:5,unanswered_count:0,completed_at:new Date(Date.parse(now)-(i%14)*86400000).toISOString()}));
  const fetched:string[]=[];
  await page.route('**/cloud-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.CBT_CLOUD_CONFIG={enabled:true,supabaseUrl:"https://preview.supabase.co",supabaseAnonKey:"test-public"};'}));
  await page.routeWebSocket(/preview\.supabase\.co/,ws=>ws.close());
  await page.route('https://preview.supabase.co/**',async r=>{
    const url=new URL(r.request().url());fetched.push(url.pathname);
    let data:unknown=[];
    if(url.pathname.endsWith('/rpc/cbt_followup_desk')){
      const empty={total:0,items:[]};
      data={inbox:empty,queues:{mine:empty,unassigned:empty}};
    }else if(url.pathname.startsWith('/functions/')){
      const body=r.request().postDataJSON();
      if(body.action==='admin-set-role')accounts[0]!.role=body.role==='none'?null:body.role;
      data={access:{userId:id,role:everything?'super_admin':'admin',permissions},accounts};
    }else if(url.pathname.endsWith('/user'))data=user;
    else if(url.pathname.endsWith('/token'))data=session;
    else if(url.pathname.endsWith('/exam_results'))data=results;
    else if(url.pathname.endsWith('/visitor_profiles'))data=[{visitor_id:'phone',ip_address:'192.0.2.1',browser:'Chrome',device_type:'Android',last_seen:now},{visitor_id:'desktop',browser:'Firefox',last_seen:now}];
    else if(url.pathname.endsWith('/visit_events'))data=results.slice(0,33).map((result,i)=>({
      visitor_id:'fixture-'+i,visited_at:result.completed_at,space:'industrial'
    }));
    else if(url.pathname.endsWith('/question_issue_reports')){
      if(r.request().method()==='PATCH')Object.assign(issue,r.request().postDataJSON());
      data=r.request().method()==='PATCH'?issue:[issue];
    }
    await r.fulfill({json:data});
  });
  await page.goto('./admin.html'+hash);await expect(page.locator('.admin-intro h1')).toBeVisible();
  return {fetched,issue,accounts};
}

async function navigate(page:Page, id:string, title:string) {
  const nav=page.getByRole('navigation',{name:'관리자 화면 구역'});
  const select=nav.getByRole('combobox');
  if(await select.isVisible()) await select.selectOption(id);
  else await nav.getByRole('link',{name:title,exact:true}).click();
  await expect(page).toHaveURL(new RegExp('#/admin/'+id+'$'));
  await expect(page.getByRole('heading',{level:1})).toHaveText(title);
}

test('관리자 구역 이동·결과 검색·제보 저장·역할 해제',async({page},info)=>{
  const {issue,accounts}=await openWorkspace(page,'super_admin');
  const nav=page.getByRole('navigation',{name:'관리자 화면 구역'});
  await expect(nav.locator('.admin-menu-group a')).toHaveCount(10);
  await expect(page.locator('[data-react-view="admin-overview"]')).toBeAttached();
  const chart = page.locator('.admin-trend-panel');
  await expect(chart.locator('canvas')).toBeVisible();
  if (info.project.name === 'desktop') {
    await chart.evaluate(node => node.scrollIntoView({block:'center',behavior:'instant'}));
    await chart.screenshot({path:info.outputPath('admin-trend.png')});
  }
  await chart.locator('summary').focus();
  await chart.locator('summary').press('Enter');
  await expect(chart.locator('tbody tr')).toHaveCount(14);
  await expect(chart.locator('tbody tr').last()).toContainText('81');
  await navigate(page,'visitors','접속 기록');
  await expect(page.locator('[data-react-view="admin-visitors"]')).toContainText('최근 접속');
  await page.getByRole('searchbox',{name:'접속 기록 검색'}).fill('Android');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Chrome');
  await navigate(page,'results','학습 결과');
  await page.getByRole('button',{name:'다음',exact:true}).click();
  await expect(page.locator('.admin-result-pagination')).toContainText('2 / 2');
  await page.getByRole('searchbox').fill('연습 23');await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('연습 23');
  await navigate(page,'issues','문제 제보');
  const memo=page.getByRole('textbox',{name:'관리자 메모'});await memo.fill('검토 메모');await memo.press('Tab');
  await expect.poll(()=>issue.admin_note).toBe('검토 메모');
  await page.getByRole('button',{name:'집중 검토'}).click();
  await expect(page.locator('.issue-workspace')).toContainText('테스트 제보');
  await navigate(page,'accounts','회원·권한');await page.locator('.role-select').selectOption('');
  await page.getByRole('button',{name:'권한 저장'}).click();await expect.poll(()=>accounts[0]!.role).toBe(null);
});

test('제보 담당 권한에 맞는 메뉴와 조회 요청',async({page})=>{
  const {fetched}=await openWorkspace(page,'issues');
  await expect(page.locator('.issue-report-table')).toContainText('테스트 제보');
  const nav=page.getByRole('navigation',{name:'관리자 화면 구역'});
  await expect(nav.locator('.admin-menu-group a')).toHaveCount(3);
  await expect(nav.locator('a[aria-current]')).toHaveText('문제 제보');
  await page.goto('./admin.html#/admin/accounts');
  await expect(page).toHaveURL(/#\/admin\/issues$/);
  await expect(nav.locator('option[value=accounts]')).toHaveCount(0);
  expect(fetched.some(p=>/exam_results|visitor_profiles|visit_events/.test(p))).toBe(false);
});

function textContrast(element:Element){
  const rgb=(value:string)=>(value.match(/[\d.]+/g)||[]).map(Number);
  const luminance=(color:number[])=>color.slice(0,3).reduce((sum,channel,i)=>{
    const value=channel/255;
    return sum+[.2126,.7152,.0722][i]!*(value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  },0);
  const text=luminance(rgb(getComputedStyle(element).color));
  let background=1;
  for(let el:Element|null=element;el;el=el.parentElement){
    const channels=rgb(getComputedStyle(el).backgroundColor);
    if(channels.length>=3 && (channels.length===3 || channels[3]===1)){background=luminance(channels);break;}
  }
  return (Math.max(text,background)+.05)/(Math.min(text,background)+.05);
}

test('4K 전체·절반과 휴대폰의 관리자 메뉴 포커스와 터치 크기',async({page},info)=>{
  test.skip(info.project.name!=='desktop','화면 크기를 한 테스트에서 순회합니다.');
  await openWorkspace(page,'super_admin');
  for(const theme of ['light','dark']){
    await page.evaluate(mode=>{
      localStorage.setItem('unified-cbt-theme',mode);
      window.dispatchEvent(new StorageEvent('storage',{key:'unified-cbt-theme',newValue:mode}));
    },theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    for(const selector of ['.admin-intro h1','.admin-account strong','.admin-account small','.admin-data-scope','.live-status strong','.admin-stat-card span']){
      await expect.poll(() => page.locator(selector).first().evaluate(textContrast), { message: theme + ' ' + selector }).toBeGreaterThanOrEqual(4.5);
    }
  }
  for(const [width,height] of [[3840,2160],[1920,2160],[390,844],[320,740]] as const){
    await page.setViewportSize({width,height});
    const nav=page.getByRole('navigation',{name:'관리자 화면 구역'});
    const items=width>850 ? nav.getByRole('link') : nav.getByRole('combobox');
    for(const item of await items.all()){
      const box=await item.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    if(width>850) {
      const results=nav.getByRole('link',{name:'학습 결과'});
      await results.focus();await expect(results).toBeFocused();await results.press('Enter');
    } else await navigate(page,'results','학습 결과');
    await expect(page.locator('.admin-result-pagination')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if(width===390||width===1920){
      await navigate(page,'overview','운영 요약');
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:info.outputPath('admin-preview-'+width+'.png')});
    }
  }
});

test('성적 집계·제보 상태별 목록과 페이지 주소 복원',async({page})=>{
  await openWorkspace(page,'super_admin','#/admin/qualifications');
  await expect(page.getByRole('heading',{level:1})).toHaveText('종목별 성적');
  await expect(page.locator('tbody tr')).toContainText('54건');
  await page.getByLabel('풀이 모드').selectOption('exam');
  await expect(page.locator('tbody tr')).toContainText('27건');
  await navigate(page,'issue-status','제보 처리 현황');
  await page.getByRole('button',{name:/대기.*1건/}).click();
  await expect(page.locator('.issue-report-table')).toContainText('테스트 제보');
  await page.goBack();
  await expect(page.getByRole('heading',{level:1})).toHaveText('제보 처리 현황');
  await page.reload();
  await expect(page.getByRole('heading',{level:1})).toHaveText('제보 처리 현황');
  await page.getByRole('button',{name:/보류.*0건/}).click();
  await expect(page.locator('.issue-panel-actions select')).toHaveValue('deferred');
  await expect(page.locator('.issue-report-table')).not.toContainText('테스트 제보');
});

test('회원 조회 담당은 직접 주소와 새로고침에서도 회원 목록만 본다',async({page})=>{
  const {fetched}=await openWorkspace(page,'members','#/admin/qualifications');
  await expect(page).toHaveURL(/#\/admin\/overview$/);
  await navigate(page,'accounts','회원·권한');
  await expect(page.locator('.account-panel')).toContainText('예시회원');
  await expect(page.locator('.admin-directory a')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'권한 저장'})).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.account-panel')).toContainText('예시회원');
  expect(fetched.some(p=>/exam_results|visitor_profiles|visit_events|question_issue_reports/.test(p))).toBe(false);
});

test('문제은행 검색과 실제 회차 수, 운영 보고서의 일별 CSV 다운로드',async({page})=>{
  await openWorkspace(page,'super_admin','#/admin/banks');
  const expected=JSON.parse(await readFile('data/admin-bank-index.json','utf8')) as {key:string;rounds:{questions:number}[]}[];
  const book=expected.find(bank=>bank.key==='hvac-hansol')!;
  await page.getByLabel('자료집 검색').fill('hvac-hansol');
  const details=page.locator('.admin-bank').filter({has:page.locator('summary',{hasText:'한솔아카데미 공조 문제'})}).first();
  await details.locator('summary').click();
  await expect(details.locator('li')).toHaveCount(book.rounds.length);
  await page.getByLabel('자료집 검색').fill('존재하지 않는 자료집');
  await expect(page.getByText('검색 조건에 맞는 자료집이 없습니다.')).toBeVisible();
  await navigate(page,'daily-report','일별 운영 보고서');
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'CSV 내려받기'}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/30일.*csv$/);
  const csv=await readFile((await download.path())!,'utf8');
  const [header,...records]=csv.trim().split('\r\n');
  expect(header).toBe('날짜,방문 기록,방문 브라우저,학습 결과,CBT 결과,전체 제출,평균 점수');
  const cells=records.map(line=>line.split(','));
  expect(cells.reduce((n,r)=>n+Number(r[1]),0)).toBe(33);
  expect(cells.reduce((n,r)=>n+Number(r[5]),0)).toBe(54);
  expect(cells.reduce((n,r)=>n+Number(r[4]),0)).toBe(27);
  expect(csv).not.toContain('fixture-');
});

test('회원 후속 관리에서 가입·미로그인·역할 조건을 조합한다',async({page})=>{
  const {accounts}=await openWorkspace(page,'super_admin');
  const old=new Date(Date.now()-45*86400000).toISOString();
  accounts.push({...accounts[0]!,userId:'member-old',username:'장기 미로그인 회원',role:null,createdAt:old,lastSignInAt:old});
  await navigate(page,'member-followups','회원 후속 관리');
  const table=page.locator('.admin-content tbody');
  await page.getByLabel('계정 활동').selectOption('inactive');
  await expect(table.locator('tr')).toHaveCount(1);
  await expect(table).toContainText('장기 미로그인 회원');
  await page.getByLabel('계정 활동').selectOption('new');
  await expect(table).toContainText('예시회원');
  await page.getByLabel('회원 역할').selectOption('member');
  await expect(table).toContainText('조건에 맞는 회원이 없습니다.');
  await page.getByLabel('계정 활동').selectOption('never');
  await expect(table).toContainText('조건에 맞는 회원이 없습니다.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('회원 처리 이력에서 담당자와 한국 시각, 메모 변경 전후를 확인한다',async({page})=>{
  await openWorkspace(page,'super_admin');
  const stamp='2026-11-19T02:34:56Z';
  await page.route('**/rest/v1/admin_member_followups?**',route=>route.fulfill({json:[{
    user_id:'sample-member',assignee_id:'sample-member',note:'교재 안내 완료',needs_follow_up:false,revision:2,updated_at:stamp
  }]}));
  await page.route('**/rest/v1/admin_member_followup_history?**',route=>route.fulfill({json:[{
    revision:2,changed_at:stamp,actor_name:'지원 담당',changes:{note:['대기','교재 안내 완료'],followUp:[true,false],assignee:[null,'예시회원']}
  }]}));
  await navigate(page,'member-followups','회원 후속 관리');
  await page.getByLabel('담당자 필터').selectOption('sample-member');
  await page.getByRole('button',{name:'기록 열기'}).click();
  await expect(page.getByLabel('담당자 지정')).toHaveValue('sample-member');
  const history=page.getByRole('region',{name:'처리 이력'});
  await expect(history).toContainText('지원 담당');
  await expect(history).toContainText('미지정 → 예시회원');
  await expect(history).toContainText('처리 완료');
  await expect(history.locator('time')).toHaveAttribute('datetime',stamp);
  await expect(history.locator('time')).toContainText('11:34:56');
  await history.locator('summary').focus();
  await history.locator('summary').press('Enter');
  await expect(history.getByText('변경 전 · 대기')).toBeVisible();
  await expect(history.getByText('변경 후 · 교재 안내 완료')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('회원 담당자 홈에서 두 후속 목록과 모바일 배정 알림을 바로 연다',async({page})=>{
  const {accounts}=await openWorkspace(page,'super_admin');
  const member='12340000-0000-4000-8000-000000000001';
  accounts[0].userId=member;
  const item={member,name:'예시회원'};
  let unread=true;
  await page.route('**/rpc/cbt_followup_desk',r=>r.fulfill({json:{
    inbox:unread?{total:1,items:[{...item,id:'test-notice',at:'2026-11-19T02:34:56Z'}]}:{total:0,items:[]},
    queues:{mine:{total:1,items:[item]},unassigned:{total:0,items:[]}}
  }}));
  await page.route('**/rest/v1/admin_followup_notifications?**',r=>{unread=false;return r.fulfill({json:{id:'test-notice'}});});
  await navigate(page,'accounts','회원·권한');
  await navigate(page,'overview','운영 요약');
  await expect(page.getByRole('region',{name:'내가 맡은 후속 건'}).getByRole('link',{name:'예시회원'})).toHaveAttribute('href',/#.*member=/);
  await expect(page.getByRole('region',{name:'담당자 없는 후속 건'})).toContainText('0건');
  const open=page.getByRole('complementary',{name:'새 배정 알림'}).getByRole('button',{name:'배정된 기록 열기'});
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await open.focus();await open.press('Enter');
  await expect(page.getByRole('heading',{name:'예시회원 운영 메모'})).toBeVisible();
  expect(unread).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('운영 요약에서 키보드로 미지정 건을 맡고 먼저 배정된 담당자를 확인한다',async({page})=>{
  await openWorkspace(page,'super_admin');
  const empty={total:0,items:[]};
  const item={member:'sample-member',name:'공조후속확인회원'.repeat(5)};
  let available=true;
  await page.route('**/rpc/cbt_followup_desk',r=>r.fulfill({json:{
    inbox:empty,queues:{mine:empty,unassigned:available?{total:1,items:[item]}:empty}
  }}));
  await page.route('**/rpc/claim_member_followup',r=>{
    expect(r.request().postDataJSON()).toEqual({target_member:item.member});
    available=false;
    return r.fulfill({json:{status:'taken',owner:'김담당'}});
  });
  await navigate(page,'accounts','회원·권한');
  await navigate(page,'overview','운영 요약');
  const button=page.getByRole('button',{name:item.name+' 내가 맡기'});
  await expect(button).toBeVisible();
  const box=(await button.boundingBox())!;
  expect(Math.min(box.width,box.height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await button.focus();
  await expect(button).toBeFocused();
  await button.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'김담당 담당자가 먼저 맡았습니다.'})).toBeVisible();
  await expect(button).toHaveCount(0);
});

test('후속 관리 DB 업데이트 대기 중에도 운영 요약을 열고 준비 후 다시 조회한다',async({page})=>{
  await openWorkspace(page,'super_admin');
  const empty={total:0,items:[]};
  let ready=false;
  await page.route('**/rpc/cbt_followup_desk',r=>ready
    ?r.fulfill({json:{inbox:empty,queues:{mine:empty,unassigned:empty}}})
    :r.fulfill({status:404,json:{code:'PGRST202',message:'Missing function'}}));
  await navigate(page,'accounts','회원·권한');
  await navigate(page,'overview','운영 요약');
  await expect(page.getByRole('status').filter({hasText:'서버 업데이트 후'})).toBeVisible();
  await expect(page.getByRole('region',{name:'담당자 없는 후속 건'})).toHaveCount(0);
  ready=true;
  await page.getByRole('button',{name:'다시 확인',exact:true}).click();
  await expect(page.getByRole('region',{name:'담당자 없는 후속 건'})).toContainText('0건');
});
