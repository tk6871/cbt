import {expect,test} from '@playwright/test';

test('세 재질이 학습과 관리자에 공유되고 재접속 뒤에도 유지된다',async({page,context})=>{
 const modules:string[]=[];
 page.on('request',r=>{if(r.url().includes('glassOptics-'))modules.push(r.url());});
 await page.goto('./?safe=1#/study/settings');
 const root=page.locator('html'), group=page.locator('[data-setting=glass]');
 await expect(root).toHaveAttribute('data-glass','prism');
 await expect(group.getByRole('button',{name:/프리즘 글라스/})).toHaveAttribute('aria-pressed','true');
 for(const [key,name] of [['frost','프로스트'],['clear','클리어']]){
   await group.getByRole('button',{name:new RegExp(name+' 글라스')}).click();
   await expect(root).toHaveAttribute('data-glass',key!);
 }
 await page.reload();await expect(root).toHaveAttribute('data-glass','clear');
 expect(modules).toEqual([]);
 const admin=await context.newPage();await admin.goto('./admin.html');
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
 await expect(page.locator('html')).toHaveAttribute('data-glass','prism');
});

test('회차 창의 굴절은 데스크톱에서 실제 유리 가장자리를 그리고 모바일에서는 자동 로드하지 않는다',async({page},info)=>{
 const requests:string[]=[];
 page.on('request',r=>{if(r.url().includes('glassOptics-'))requests.push(r.url());});
 await page.goto('./?safe=1#/study/rounds');
 const stage=page.locator('.round-window-landscape');
 await expect(stage.locator('.round-card')).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
 if(info.project.name==='desktop'){
   await stage.hover();
   const canvas=stage.locator('.glass-lens');
   await expect.poll(()=>canvas.evaluate((el:HTMLCanvasElement)=>el.width>400)).toBe(true);
   expect(requests.length).toBeGreaterThan(0);
 }else{
   await expect(stage.locator('.glass-lens')).toHaveCount(0);
   expect(requests).toEqual([]);
 }
});

test('화면별 배경과 직접 선택한 배경이 렌즈·관리자·보석관에 반영된다',async({page,context})=>{
 const html=page.locator('html');
 await page.goto('./?safe=1#/study/settings');
 await expect(html).toHaveAttribute('data-wallpaper','coast');
 const picker=page.locator('.wall-picker');
 const stage=page.locator('.glass-scene');
 const admin=await context.newPage();
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
 await start.click();await expect(page.locator('.round-window .round-card')).toBeVisible();
 await expect(page).toHaveURL(/#\/study\/rounds$/);
 await page.goBack();await expect(start).toBeVisible();
 await page.emulateMedia({reducedMotion:'reduce'});await start.click();
 await expect(page.locator('.round-window')).toHaveCSS('animation-name','none');
 await expect(page.locator('html')).not.toHaveAttribute('data-cover-flight','on');
});
