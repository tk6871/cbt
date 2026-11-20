import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('세 재질이 학습과 관리자에 공유되고 재접속 뒤에도 유지된다',async({page,context})=>{
 const modules:string[]=[];
 page.on('request',r=>{if(r.url().includes('glassOptics-'))modules.push(r.url());});
 await page.goto('./?safe=1#/study/settings');
 const root=page.locator('html'), group=page.locator('[data-setting=glass]');
 await expect(root).toHaveAttribute('data-glass','clear');
 await expect(group.getByRole('button',{name:/클리어 글라스/})).toHaveAttribute('aria-pressed','true');
 for(const [key,name] of [['frost','프로스트'],['clear','클리어']]){
   await group.getByRole('button',{name:new RegExp(name+' 글라스')}).click();
   await expect(root).toHaveAttribute('data-glass',key!);
 }
 await page.reload();await expect(root).toHaveAttribute('data-glass','clear');
 expect(modules).toEqual([]);
 const admin=await context.newPage();
 await admin.route('**/cloud-config.js*', r=>r.fulfill({contentType:'text/javascript',body:'window.CBT_CLOUD_CONFIG={enabled:true,supabaseUrl:"https://preview.invalid",supabaseAnonKey:"test-public"};'}));
 await admin.goto('./admin.html');
 await expect(admin.locator('html')).toHaveAttribute('data-glass','clear');
 await expect(admin.locator('body')).toHaveCSS('background-color','rgb(0, 0, 0)');
 const backdrop=await admin.locator('.admin-login-landscape').evaluate(e=>getComputedStyle(e).backgroundImage);
 expect(backdrop).toContain('url(');
 await admin.locator('.admin-glass-settings > summary').click();
 await admin.getByRole('button',{name:/프리즘 글라스/}).click();
 await expect(root).toHaveAttribute('data-glass','prism');
 await admin.close();await group.getByRole('button',{name:'3D 굴절 미리보기'}).click();
 await expect.poll(()=>modules.length).toBeGreaterThan(0);
 await expect(group.locator('canvas')).toBeVisible();
});
test('Dock 메뉴는 포커스나 터치로 식별되고 실제 회차로 이동한다',async({page},info)=>{
 await page.goto('./?safe=1#/study/settings');
 const dock=page.getByRole('navigation',{name:'학습 Dock'});const rounds=dock.getByRole('button',{name:'회차',exact:true});
 await expect(rounds).toBeVisible();
 if(info.project.name==='desktop'){
   await rounds.focus();await expect.poll(()=>rounds.evaluate(e=>getComputedStyle(e,'::after').visibility)).toBe('visible');
   await rounds.hover();await expect.poll(()=>rounds.evaluate(e=>getComputedStyle(e,'::after').content)).toBe('"회차"');
 }else{await expect(rounds.locator('small')).toBeVisible();}
 const size=await rounds.boundingBox();expect(size!.width).toBeGreaterThanOrEqual(44);expect(size!.height).toBeGreaterThanOrEqual(44);
 await rounds.click();await expect(page.locator('.round-grid .round-card').first()).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-glass','clear');
});

test('기본 회차 카드는 3D를 요청하지 않고 목록 선택을 기억한다',async({page})=>{
 const requests:string[]=[];
 page.on('request',r=>{if(r.url().includes('glassOptics-'))requests.push(r.url());});
 await page.goto('./?safe=1#/study/rounds');
 const grid=page.locator('.round-grid[data-layout]');
 await expect(grid).toHaveAttribute('data-layout','cards');
 const first=grid.locator('article').first();
 await first.hover();
 await expect(first).toBeVisible();
 await expect(grid.locator('.glass-lens,.round-theme-photo')).toHaveCount(0);
 await page.getByRole('button',{name:'목록',exact:true}).click();
 await page.reload();
 await expect(grid).toHaveAttribute('data-layout','list');
 expect(requests).toEqual([]);
});

test('화면별 배경과 직접 선택한 배경이 렌즈·관리자·보석관에 반영된다',async({page,context})=>{
 const html=page.locator('html');
 await page.goto('./?safe=1#/study/settings');
 await expect(html).toHaveAttribute('data-wallpaper','coast');
 const picker=page.locator('.wall-picker');
 const stage=page.locator('.glass-scene');
 const admin=await context.newPage();
 await admin.route('**/cloud-config.js*', r=>r.fulfill({contentType:'text/javascript',body:'window.CBT_CLOUD_CONFIG={enabled:true,supabaseUrl:"https://preview.invalid",supabaseAnonKey:"test-public"};'}));
 await admin.goto('./admin.html');
 await expect(admin.locator('html')).toHaveAttribute('data-wallpaper','nexus');
 for(const [label,filename] of [['허니웨이브','Honeywave'],['자개','Shell'],['넥서스','Nexus'],['빙하','IceCold'],['해안선','Volna']]){
   await picker.getByRole('button',{name:label,exact:true}).click();
   await expect(stage).toHaveCSS('background-image',new RegExp(filename));
   await expect(admin.locator('.admin-login-landscape')).toHaveCSS('background-image',new RegExp(filename));
 }
 await page.reload();await expect(picker.getByRole('button',{name:'해안선'})).toHaveAttribute('aria-pressed','true');
 await picker.getByRole('button',{name:'화면에 맞춤'}).click();
 await page.goto('./jewelry.html?safe=1#/study/rounds');await expect(html).toHaveAttribute('data-wallpaper','shell');
 await admin.close();
});

test('홈에서 회차로 전환하고 뒤로 돌아온 뒤 동작 줄이기 설정을 따른다',async({page})=>{
 await page.goto('./?safe=1');
 const start=page.getByRole('button',{name:'회차별 기출 고르기',exact:true});
 await start.click();await expect(page.locator('.round-grid .round-card').first()).toBeVisible();
 await expect(page).toHaveURL(/#\/study\/rounds$/);
 await page.goBack();await expect(start).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await start.click();
 await expect(page.locator('.rounds-heading')).toHaveCSS('animation-name','none');
 await expect(page.locator('html')).not.toHaveAttribute('data-cover-flight','on');
});

for (const theme of ['simpsons','sunjae'] as const) {
  test(theme+' 배경이 홈·회차·풀이에 이어지고 원문 위에 겹치지 않는다', async({page}, info)=>{
    await page.addInitScript(name => {
      localStorage.setItem('unified-industrial-cbt-visual-style',name);
      localStorage.setItem('unified-cbt-sunjae-rotation-seconds','0');
    },theme);
    await page.goto('./?safe=1#/study/home');
    const wall=page.locator('.fan-wallpaper');
    await expect(wall).toHaveCSS('background-image',new RegExp('/'+theme+'/'));
    await expect(page.locator('.sidebar.theme-photo-rail')).toHaveCSS('background-image',new RegExp(theme==='simpsons'?'kwik-e-mart':'wooseok-prada'));
    const home=await wall.evaluate(e=>getComputedStyle(e).backgroundImage);
    await page.locator('.fan-cover').getByRole('button',{name:/회차별 기출/}).click();
    await expect.poll(()=>wall.evaluate(e=>getComputedStyle(e).backgroundImage)).not.toBe(home);
    const list=page.locator('.round-grid');
    const names=await list.locator('.round-theme-photo').evaluateAll(es=>es.map(e=>e.getAttribute('src')));
    expect(new Set(names).size).toBeGreaterThan(2);
    const round=list.locator('#round-card-hvac-20160306');
    const src=await round.locator('img').getAttribute('src');
    await round.getByRole('button',{name:'학습모드',exact:true}).click();
    const card=page.locator('#session-question-1');
    await expect(card).toBeVisible();
    expect(await wall.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain(src!.replace('-small.webp','').split('/').pop());
    await expect(card).toHaveCSS('backdrop-filter','none');
    if(info.project.name!=='desktop'){
      for(const w of [320,390,430]){
        await page.setViewportSize({width:w,height:844});
        const cards=page.locator('.question-columns .question-card');
        await expect(cards).toHaveCount(4);
        const boxes=await cards.evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,width:e.clientWidth})));
        expect(new Set(boxes.map(b=>b.x)).size).toBe(1);
        expect(boxes[0]!.width).toBeGreaterThan(w*.85);
        for(const b of await card.locator('.question-utilities button').all()){
          const target=await b.boundingBox(),face=await b.locator('.utility-face').boundingBox();
          expect(target!.height).toBeGreaterThanOrEqual(44);expect(target!.width).toBeGreaterThanOrEqual(44);
          expect(face!.height).toBe(26);
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(w+1);
      }
    }
    const star=card.locator('.bookmark-button'),pin=card.locator('.keep-button'),flag=card.locator('.question-issue-button');
    await star.click(); await expect(star).toHaveAttribute('aria-pressed','true');
    await pin.click(); await expect(pin).toHaveAttribute('aria-pressed','true');
    await flag.click(); await expect(card.locator('.question-issue-form')).toBeVisible();
    await flag.click(); await expect(card.locator('.question-issue-form')).toHaveCount(0);
    await card.locator('button.choice-button:visible').nth(2).click();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}').attempts?.['hvac-20160306:1']?.lastChoice)).toBe(3);
  });
}

test('산업기사 설정에서 테마를 직접 바꾸고 메뉴·재접속에도 적용한다',async({page},info)=>{
  await page.goto('./?safe=1#/study/settings');
  const group=page.locator('[data-setting=visualStyle]');
  for(const [theme,name] of [['sunjae','선재 테마'],['simpsons','심슨 테마']] as const){
    await group.getByRole('button',{name:new RegExp(name)}).click();
    await expect(page.locator('html')).toHaveAttribute('data-visual-style',theme);
    await page.reload();
    await expect(group.getByRole('button',{name:new RegExp(name)})).toHaveAttribute('aria-pressed','true');
    await expect(group.getByRole('link',{name:'테마 사진 출처'})).toHaveAttribute('href',new RegExp(theme+'/SOURCES.md'));
    if(info.project.name==='iphone-14-pro'){
      await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
      const menu=page.locator('aside.sidebar.open');
      await expect(menu).toHaveCSS('background-image',new RegExp('/'+theme+'/.*-small.webp'));
      await menu.getByRole('button',{name:'메뉴 닫기',exact:true}).click();
    }
  }
});
