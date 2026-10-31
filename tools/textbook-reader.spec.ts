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
 await expect(page.locator('#textbook-navigator')).toBeVisible();
});
test('독립 풀이 화면 · 팝업 취소/선택 · 키보드 포커스 · 새로고침/뒤로/앞으로',async({page},info)=>{
 const reader=page.locator('.textbook-pages'),dialog=page.locator('#textbook-navigator');
 await expect(page.locator('.sidebar,.topbar,.mobile-tabbar,.native-app-tabbar')).toHaveCount(0);
 await expect(dialog.getByRole('heading',{name:'어디부터 풀까요?'})).toBeVisible();
 await page.screenshot({path:`/private/tmp/textbook-reader-contents-${info.project.name}.png`});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
 await expect(reader.locator('.reader-navigator-trigger')).toBeFocused();
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('4-10');
 await openBookNavigator(page,'pages');
 await dialog.locator('.page-picker input').first().fill('2-32');
 await closeBookNavigator(page);
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('4-10');
 await openBookNavigator(page,'pages');
 await expect(dialog.locator('.page-picker input').first()).toHaveValue('4-10');
 await dialog.locator('.page-picker input').first().fill('문자');
 await expect(dialog.getByRole('button',{name:'이 쪽 열기 →',exact:true})).toBeDisabled();
 await chooseBookPage(page,'2-32');
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('2-32');
 await expect(reader.locator('.reader-main .book-contents')).toHaveCount(0);
 await expect(reader.locator('.reader-main .book-comparison-summary')).toHaveCount(0);
 await page.reload();await expect(dialog).toBeVisible();await closeBookNavigator(page);
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('2-32');
 await page.goBack();await expect(reader).toHaveCount(0);await expect(page.locator('.app-frame')).toBeVisible();
 await page.goForward();await expect(dialog).toBeVisible();await closeBookNavigator(page);
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('2-32');
 await reader.getByRole('button',{name:'교재 목록으로 돌아가기',exact:true}).click();await expect(reader).toHaveCount(0);
});
test('두 교재 · 화면 폭 제한 · 답안/설명 · CBT 갔다가 같은 교재 쪽으로 복귀',async({page},info)=>{
 const reader=page.locator('.textbook-pages');await closeBookNavigator(page);
 await expect(reader.getByRole('button',{name:'공학용 계산기 열기',exact:true})).toBeVisible();
 await expect(reader.locator('.question-card').first().locator('.image-answer-hotspot')).toHaveCount(4);
 await reader.locator('.image-answer-hotspot').nth(2).click();
 await expect(reader.locator('.question-card').first().locator('.explanation-box')).toBeVisible();
 await reader.locator('.reader-toolbar').getByRole('button',{name:/설정/}).click();
 await expect(page.locator('.settings-dialog,.settings-modal,[role="dialog"]').filter({hasText:'설정'}).first()).toBeVisible();
 await page.keyboard.press('Escape');
 // Settings uses its own close action rather than relying on browser Escape.
 const settingsClose=page.getByRole('button',{name:/설정 닫기/}).first();
 if(await settingsClose.isVisible())await settingsClose.click();
 await switchTextbook(page,'energy');await chooseBookPage(page,'336');
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('336');
 await expect(reader.locator('.question-card')).not.toHaveCount(0);
 await expect(reader.locator('.book-sheet')).toHaveCSS('opacity','1');
 await reader.locator('.source-image-stage>img').first().evaluate(async(img:HTMLImageElement)=>{await img.decode();});
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/private/tmp/textbook-reader-${theme}-${info.project.name}.png`});
 }
 if(info.project.name==='desktop'){
  await page.setViewportSize({width:3840,height:2160});
  expect((await reader.locator('.reader-main').boundingBox())!.width).toBeLessThanOrEqual(1450);
  await page.screenshot({path:'/private/tmp/textbook-reader-4k.png'});
 }
 await reader.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true}).click();
 await expect(page.locator('.session-shell')).toBeVisible();await expect(reader).toHaveCount(0);
 await expect(page.locator('.explanation-box')).toHaveCount(0);
 await page.goBack();await expect(reader).toBeVisible();await closeBookNavigator(page);
 await expect(reader.locator('.book-sheet>footer>strong')).toHaveText('336');
 await expect(page.locator('.sidebar')).toHaveCount(0);
});
