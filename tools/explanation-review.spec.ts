import {test,expect,type Page} from '@playwright/test';
test.use({serviceWorkers:'block'});
async function prepare(page:Page,key:string){
 await page.addInitScript(key=>{
  localStorage.setItem('modern-cbt-qualification-industrial',key);
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  localStorage.setItem('cbt-explanation-display-v1','text');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 },key);
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async notice=>{await notice.getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
}
test('교정된 펌프 해설·단위·지수와 답안 저장',async({page},info)=>{
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20150531').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('36');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'12kW 펌프의 회전수가'});
 await expect(card).toBeVisible();
 await card.locator('.choice-button').nth(1).click();
 await expect(card).toContainText('960 rpm');
 await expect(card).toContainText('H₂/H₁=(N₂/N₁)²');
 await expect(card).toContainText('P₂/P₁=(N₂/N₁)³');
 await expect(card).not.toContainText('N2=91.8');
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['hvac-20150531:36'])).toBe(2);
 await page.screenshot({path:info.outputPath('pump-correction.png'),fullPage:true});
});
test('새 전사·부분 전사 표기·원문 전환과 선택 보존',async({page},info)=>{
 await prepare(page,'energy-midterm');
 await page.locator('#round-card-school-energy-topic-1').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2018년 2회 · 원문 1번'})});
 await card.locator('.image-answer-hotspot').nth(3).click();
 const figure=card.locator('.transcription-figure').first();
 await expect(figure.locator('.transcription-text')).toContainText('핵심 부분 전사');
 await expect(figure.locator('.transcription-text')).toContainText('압력 손실이 적다');
 await expect(figure.locator('img')).toHaveCount(0);
 await figure.getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await expect(figure.locator('img')).toBeVisible();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await figure.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
 await expect(figure.locator('.transcription-text')).toContainText('90~99.5%');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['school-energy-textbook-2018-2:1'])).toBe(4);
 await page.screenshot({path:info.outputPath('energy-transcription.png'),fullPage:true});
});
