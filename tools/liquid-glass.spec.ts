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
 await admin.locator('.admin-glass-settings summary').click();
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
