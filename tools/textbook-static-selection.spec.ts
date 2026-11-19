import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test.beforeEach(async ({page}) => {
  await page.route('**/cloud-config.js*', route=>route.fulfill({contentType:'application/javascript',body:'window.CBT_CLOUD_CONFIG = {};'}));
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), notice=>notice.getByRole('button',{name:'나중에',exact:true}).click());
});

test('오프라인 등록 실패가 책 선택을 가리지 않고 홈과 설정에서 복구할 수 있다',async({page},info)=>{
  test.skip(info.project.name !== 'iphone-14-pro');
  await page.goto('./');
  const status=page.getByRole('region',{name:'오프라인 저장 상태'});
  await expect(status.getByRole('button',{name:'자동 복구 열기'})).toBeAttached();
  await expect(status.getByRole('button',{name:'패치노트 보기'})).toBeAttached();
  await expect(page.locator('.update-notice')).toHaveCount(0);
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).tap();
  await page.getByRole('button',{name:/에너지설비 교재/}).tap();
  await expect(page.locator('.library-selection .library-open')).toBeEnabled();
  await page.goto('./?safe=1#/study/settings');
  await page.getByRole('navigation',{name:'설정 목차'}).getByRole('button',{name:'기록·동기화'}).click();
  const setting=page.locator('[data-setting="recovery"]');
  await expect(setting.getByRole('status')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('cbt:pwa-ready')));
  await expect(setting.getByRole('status')).toHaveCount(0);
  await expect(setting.getByRole('button',{name:'복구 화면 열기'})).toBeEnabled();
});

for (const book of ['energy','hansol'] as const) {
  test('빈 모바일 홈에서 선택한 교재 한 권만 받는다 '+book, async ({page}, info) => {
    test.skip(info.project.name !== 'iphone-14-pro');
    const sources: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/\/data\/(?:hvac|energy)[\w-]*\.js$|\/modern\/textbook-[\w-]+\.json$/.test(path)) sources.push(path.split('/').pop()!);
    });
    await page.goto('./');
    await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
    const library = page.locator('.textbook-library');
    await expect(library.locator('.library-books button[aria-pressed=false]')).toHaveCount(2);
    expect(sources).toEqual([]);
    await library.getByRole('button',{name:book==='energy'?/에너지설비 교재/:/한솔 공조 교재/}).click();
    await expect(library.locator('.library-selection .library-open')).toBeEnabled();
    expect(sources).toEqual([expect.stringMatching(new RegExp('^textbook-'+book+'-sources-v\\d+\\.json$'))]);
    await page.reload();
    await expect(library.locator('.library-selection .library-open')).toBeEnabled();
    expect(sources.every(name=>name.startsWith('textbook-'+book+'-sources-'))).toBe(true);
    await page.getByRole('button',{name:'자격증 기출',exact:true}).click();
    await expect(page.locator('#round-card-hvac-20160306')).toBeVisible();
  });
}

test('정적 교재 파일을 읽을 수 없으면 원본 에너지 자료로 복원한다',async ({page},info)=>{
  test.skip(info.project.name !== 'iphone-14-pro');
  await page.route('**/modern/textbook-energy-sources-*.json',route=>route.fulfill({status:404,body:''}));
  await page.goto('./');
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
  const library=page.locator('.textbook-library');
  await library.getByRole('button',{name:/에너지설비 교재/}).click();
  await expect(library.locator('.library-selection .library-open')).toBeEnabled();
  await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
  await library.getByRole('textbox').fill('414');
  await library.getByRole('button',{name:'문제 풀기 →'}).click();
  const question=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 16번',exact:true})});
  await expect(question.getByRole('button',{name:'이미지에서 3번 선택'})).toBeVisible();
});

test('새 홈에서 범위까지 스크롤하면 연도와 학습 범위를 복원한다',async ({page},info)=>{
  test.skip(info.project.name !== 'iphone-14-pro');
  await page.goto('./');
  await expect(page.getByRole('button',{name:'교재에서 풀기',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'연도와 출제 체계 설정',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.locator('.study-builder').getByLabel('시작 연도')).not.toHaveValue('0');
  await expect(page.locator('.study-builder').getByLabel('끝 연도')).toHaveValue('2026');
  await page.locator('.study-builder .learning-start').click();
  await expect(page.locator('#session-question-1')).toBeVisible();
});

test.describe('설치된 정적 교재',()=>{
  test.use({serviceWorkers:'allow'});
  test('공조를 열지 않은 기기에서도 에너지 답을 오프라인 새로고침 후 복원한다',async ({page,context},info)=>{
    test.skip(info.project.name !== 'iphone-14-pro');
    // Service workers can serve cloud-config.js themselves after reload.
    await page.addInitScript(()=>Object.defineProperty(window,'CBT_CLOUD_CONFIG',{
      configurable:true, get:()=>({enabled:false}), set:()=>{},
    }));
    await page.goto('./');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
    const library=page.locator('.textbook-library');
    await library.getByRole('button',{name:/에너지설비 교재/}).click();
    await expect(library.locator('.library-selection .library-open')).toBeEnabled();
    await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
    await library.getByRole('textbox').fill('414');
    await library.getByRole('button',{name:'문제 풀기 →'}).click();
    const row=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 16번',exact:true})});
    const answer=row.getByRole('button',{name:'이미지에서 3번 선택'});
    await answer.click();
    await expect(answer).toHaveAttribute('aria-pressed','true');
    await context.setOffline(true);
    await page.reload();
    await expect(answer).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>row.locator('.source-image-stage img').first().evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  });
});
