import {test,expect} from '@playwright/test';
import {chooseBookPage,openBookNavigator,closeBookNavigator,switchTextbook} from './textbook-reader-test-helpers';
test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await expect(page.locator('.textbook-library')).toBeVisible();
});
async function openPage(page:any,value:string){
 await page.getByRole('button',{name:'쪽번호로 바로 열기 ↗',exact:true}).click();
 const dialog=page.locator('.library-page-dialog');
 await dialog.getByRole('textbox',{name:'쪽번호',exact:true}).fill(value);
 await dialog.getByRole('button',{name:'문제 풀기 →',exact:true}).click();
 await expect(page.locator('.textbook-pages')).toBeVisible();
 await expect(page.locator('.textbook-pages .question-card').first()).toBeVisible();
}
test('목차는 앱 안 · 문제만 독립 화면 · 복귀/새로고침/다시 선택',async({page},info)=>{
 await expect(page.locator('.app-frame')).toBeVisible();
 await expect(page.locator('.textbook-pages')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'교재 열기 →',exact:true})).toHaveCount(0);
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`/private/tmp/textbook-library-${info.project.name}.png`});
 const library=page.locator('.textbook-library');
 await library.getByRole('searchbox',{name:'목차·문제 내용 검색'}).fill('브라인');
 const result=library.locator('.contents-results button').filter({hasText:'핵심예상문제'}).first();
 await result.click();
 await expect(library.locator('.library-selection h2')).toHaveText('핵심예상문제');
 await expect(page.locator('.textbook-pages')).toHaveCount(0);
 await expect(library.locator('.library-page-list button')).not.toHaveCount(0);
 await library.getByRole('button',{name:'이 단원 펼치기 →',exact:true}).click();
 await expect(page.locator('.textbook-pages')).toBeVisible();
 await expect(page.locator('.sidebar,.topbar')).toHaveCount(0);
 await expect(page.locator('#textbook-navigator')).not.toBeVisible();
 const before=await page.locator('.book-sheet>footer>strong').innerText();
 await page.reload();await expect(page.locator('.textbook-pages')).toBeVisible();
 await expect(page.locator('#textbook-navigator')).not.toBeVisible();
 await expect(page.locator('.book-sheet>footer>strong')).toHaveText(before);
 await page.getByRole('button',{name:'교재 목록으로 돌아가기',exact:true}).click();
 await expect(library).toBeVisible();
 await expect(library.locator('.library-page-list button')).not.toHaveCount(0);
 await openPage(page,'4-163');
 await page.goBack();await expect(library).toBeVisible();
 await page.goForward();await expect(page.locator('.textbook-pages')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('인쇄 교재 배치 · 제보18번4영역 · 쪽 클릭 이동 · 에너지/다크·라이트/4K',async({page},info)=>{
 await page.evaluate(()=>localStorage.setItem('unified-cbt-hotspot-indicator','area'));await page.reload();await expect(page.locator('.textbook-library')).toBeVisible();
 await openPage(page,'4-163');
 const reader=page.locator('.textbook-pages');
 const card=reader.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 18번',exact:true,includeHidden:true})}).locator('.question-card');
 await expect(card).toBeVisible();await expect(card.locator('.question-head')).toHaveCount(0);
 const img=card.locator('.source-image-stage>img');await img.evaluate(async(img:HTMLImageElement)=>img.decode());
 await expect(reader.locator('.book-sheet')).toHaveCSS('opacity','1');
 expect(await img.evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBe(1286);
 const boxes=card.locator('.image-answer-hotspot');await expect(boxes).toHaveCount(4);
 for(let i=0;i<4;i++){
  const b=await boxes.nth(i).boundingBox(),im=(await img.boundingBox())!;
  expect(b!.x-im.x).toBeCloseTo(im.width*(i%2?0.5:0.07),0);
  expect(b!.y-im.y).toBeCloseTo(im.height*(i<2?.45:.65),0);
  await boxes.nth(i).hover();await boxes.nth(i).click();await expect(boxes.nth(i)).toHaveClass(/selected/);
  const target=await boxes.nth(i).boundingBox(),highlight=await card.locator('.image-answer-area-highlight').boundingBox();
  for(const key of ['x','y','width','height'] as const)expect(highlight![key]).toBeCloseTo(target![key],1);
 }
 await expect(card.locator('.explanation-box')).toBeVisible();
 await boxes.nth(3).click();await expect(card.locator('.explanation-box')).toHaveCount(0);
 await card.getByRole('button',{name:'북마크 추가',exact:true}).click();await expect(card.getByRole('button',{name:'북마크 제거',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await expect(reader.locator('.book-sheet')).toHaveCSS('opacity','1');
  await expect(reader).toHaveCSS('--book-paper',theme==='light'?'#fffefb':'#14202b');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:`/private/tmp/textbook-print-${theme}-${info.project.name}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await reader.getByRole('button',{name:'4-163쪽 · 쪽번호 선택',exact:true}).first().click();
 await expect(reader.locator('#textbook-navigator .navigator-page-panel')).toBeVisible();
 await chooseBookPage(page,'4-10');
 await expect(reader.locator('.book-sheet>footer>strong')).toContainText('4-10');
 await switchTextbook(page,'energy');await chooseBookPage(page,'336');
 await reader.locator('.source-image-stage>img').evaluateAll(async(imgs:HTMLImageElement[])=>Promise.all(imgs.map(img=>img.decode())));
 await expect(reader.locator('.book-sheet')).toHaveCSS('opacity','1');
 await page.screenshot({path:`/private/tmp/textbook-print-energy-${info.project.name}.png`});
 if(info.project.name==='desktop'){
  await page.setViewportSize({width:3840,height:2160});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.resizing)).not.toBe('true');
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo({top:0,behavior:'instant'});resolve();}))));
  expect((await reader.locator('.reader-main').boundingBox())!.width).toBeLessThanOrEqual(1440);
  const cols=reader.locator('.book-sheet-column');expect((await cols.nth(1).boundingBox())!.x).toBeGreaterThan((await cols.nth(0).boundingBox())!.x);
  await page.screenshot({path:'/private/tmp/textbook-print-4k.png'});
 }
 await reader.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 await expect(page.locator('.session-shell')).toBeVisible();await expect(reader).toHaveCount(0);
 await page.goBack();await expect(reader).toBeVisible();await expect(reader.locator('.book-sheet>footer>strong')).toContainText('336');
});
