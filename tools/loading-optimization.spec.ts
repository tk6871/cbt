import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async () => {
    await page.locator('.pwa-error-notice').getByRole('button', { name: '나중에', exact: true }).click();
  });
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'hvac');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});
async function openGuide(page: Page) {
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', { name:'메뉴 열기',exact:true }).click();
  await page.locator('.sidebar').getByRole('button', { name:'▣ 시험 자료실' }).click();
  await expect(page.locator('.practical-study-room')).toBeVisible();
}
test('필답 자료는 메뉴 진입 때만 로딩하고 저장 답안·커서 복원', async ({page}) => {
  const requests:string[]=[];
  page.on('request', request => { if(request.url().includes('qualificationStudyGuides')) requests.push(request.url()); });
  await page.goto('./?safe=1');
  await expect(page.locator('.sidebar')).toBeAttached();
  expect(requests).toHaveLength(0);
  await openGuide(page);
  expect(requests).toHaveLength(1);
  // Choose a round from the library before writing an answer.
  await page.locator('.practical-year-group button').first().click();
  const answer=page.locator('.practical-answer-input textarea').first();
  await expect(answer).toBeVisible();
  await answer.fill('최적화 전후 저장 답안 확인');
  await page.reload();
  await openGuide(page);
  await page.locator('.practical-resume-round').click();
  await expect(answer).toHaveValue('최적화 전후 저장 답안 확인');
});
test('자료 모듈 실패 시 다른 화면과 저장 기록을 유지한다', async ({page}) => {
  await page.route('**/*qualificationStudyGuides*',route=>route.abort());
  await page.addInitScript(()=>localStorage.setItem('unified-cbt-hvac-practical-session-v1',JSON.stringify({ids:['saved-unloaded-id'],deadline:Date.now()+600000,finished:false,stoppedSeconds:0})));
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', {name:'메뉴 열기',exact:true}).click();
  await page.locator('.sidebar').getByRole('button', {name:'▣ 시험 자료실'}).click();
  await expect(page.getByRole('button',{name:'다시 불러오기',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-hvac-practical-session-v1')!).ids)).toEqual(['saved-unloaded-id']);
  await page.unroute('**/*qualificationStudyGuides*');
  await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'공조냉동 실기 필답형 훈련관'})).toBeVisible();
});

test('저장된 실전 필답 세션은 홈에서도 자료를 준비하고 답안 유지',async({page})=>{
  await page.goto('./?safe=1');
  await openGuide(page);
  await page.locator('.practical-overview > summary').click();
  await page.getByRole('button',{name:/실전 12문제/}).click();
  const answer=page.locator('.practical-answer-input textarea').first();
  await answer.fill('진행 중 실전 답안');
  const saved=await page.evaluate(()=>localStorage.getItem('unified-cbt-hvac-practical-session-v1'));
  expect(JSON.parse(saved!).ids.length).toBeGreaterThan(0);
  await page.reload();
  await openGuide(page);
  await expect(answer).toHaveValue('진행 중 실전 답안');
  expect(await page.evaluate(()=>localStorage.getItem('unified-cbt-hvac-practical-session-v1'))).toBe(saved);
});
