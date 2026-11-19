import { expect, test } from '@playwright/test';

test.use({serviceWorkers:'block'});

test('에너지 교재는 공유 은행을 한 번 요청하고 실패한 파일만 다시 받아 문제를 연다', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('cbt-textbook-selected','energy'));
  await page.route('**/cloud-config.js*',route => route.fulfill({
    contentType:'application/javascript', body:"window.CBT_CLOUD_CONFIG={serviceApiUrl:'/api'};",
  }));
  const apiRequests: string[] = [];
  await page.route('**/modern/textbook-energy-sources-*.json', route => route.fulfill({status:404}));
  const failedFile = '**/data/energy.js?*';
  let staticRequests = 0;
  let fail = true;
  await page.route('**/api/catalogs/*',route => {
    apiRequests.push(new URL(route.request().url()).pathname.split('/').pop()!);
    return route.fulfill({status:503,body:''});
  });
  await page.route(failedFile,route => {
    staticRequests++;
    return fail ? route.abort() : route.continue();
  });
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), notice => notice.getByRole('button',{name:'나중에',exact:true}).click());
  await page.goto('./?safe=1');
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
  const library = page.locator('.textbook-library');
  await expect(library.getByRole('alert')).toBeVisible();
  expect(staticRequests).toBe(1);
  expect(apiRequests.filter(key=>key==='energy')).toHaveLength(1);
  fail = false;
  await library.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(library.locator('.library-selection .library-open')).toBeEnabled();
  await expect(library.getByRole('alert')).toHaveCount(0);
  expect(apiRequests.sort()).toEqual(['energy','energy','energy-midterm','energy-restored','energy-textbook']);
  expect(staticRequests).toBe(2);
  await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
  await library.getByRole('textbox').fill('414');
  await library.getByRole('button',{name:'문제 풀기 →'}).click();
  const row = page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 16번',exact:true})});
  await expect(row.getByRole('button',{name:'이미지에서 3번 선택'})).toBeVisible();
});
