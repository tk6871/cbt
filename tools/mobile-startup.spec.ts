import { expect, test } from '@playwright/test';

test('새 모바일 프로필 세 개가 동시에 열려도 각 홈과 회차를 사용할 수 있다', async ({ browser }, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext(info.project.use)));
  try {
    await Promise.all(contexts.map(async context => {
      const page = await context.newPage();
      const failures: string[] = [];
      const styles: string[] = [];
      page.on('requestfailed', request => {
        if (request.resourceType() === 'script' || request.resourceType() === 'stylesheet') failures.push(request.url());
      });
      page.on('request', request => {
        if (new URL(request.url()).pathname.endsWith('/modern/cbt.css')) styles.push(request.url());
      });
      await page.goto('/?safe=1', { waitUntil: 'commit' });
      await expect(page.getByRole('heading', {name:'나의 학습 홈'})).toBeVisible({timeout:15000});
      expect(styles).toHaveLength(1);
      expect(failures).toEqual([]);
      await page.getByRole('button',{name:'회차별 기출 고르기'}).click();
      await expect(page.locator('#round-card-hvac-20160306')).toBeVisible();
    }));
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test('이전 기기 기록을 읽는 동안 교재를 고르고 복원 후 풀이를 시작한다', async ({page,context}, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  const previous = await context.newPage();
  await previous.goto('./cloud-config.js');
  // An open v1 tab holds the upgrade until it closes, as on a returning device.
  const database = await previous.evaluateHandle(() => new Promise<IDBDatabase>((resolve,reject) => {
    const request=indexedDB.open('industrial-cbt',10);
    request.onupgradeneeded=() => {
      const attempts=request.result.createObjectStore('attempts',{keyPath:'id'});
      for (const key of ['at','lastCorrect']) attempts.createIndex(key,key);
      attempts.put({id:'hvac-20211:1',at:1234,count:2,lastChoice:2,lastCorrect:true,correctCount:1,wrongCount:1});
      const exams=request.result.createObjectStore('exams',{keyPath:'id'});
      for (const key of ['qualificationKey','finishedAt','score']) exams.createIndex(key,key);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  }));
  try {
    await page.goto('./');
    await expect(page.locator('.compact-stats')).toHaveAttribute('aria-busy','true');
    await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
    const library=page.locator('.textbook-library');
    await library.getByRole('button',{name:/에너지설비 교재/}).click();
    await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
    await library.getByRole('textbox').fill('414');
    await library.getByRole('button',{name:'문제 풀기 →'}).click();
    await expect(page.getByText('저장한 풀이 기록을 불러오는 중…',{exact:true})).toBeVisible();
    await database.evaluate(db=>db.close());
    const row=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 16번',exact:true})});
    const choice=row.getByRole('button',{name:'이미지에서 3번 선택'});
    await choice.click();
    await expect(choice).toHaveAttribute('aria-pressed','true');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}')
      .attempts?.['hvac-20211:1']?.count)).toBe(2);
  } finally {
    await previous.close();
  }
});

test('첫 공조 회차에서 원문 좌표를 받아 인쇄 번호로 답을 저장한다', async ({page}, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  const layouts: string[] = [];
  page.on('request', req => {
    if (/hvacQuestionLayout-v\d+\.js$/.test(new URL(req.url()).pathname)) layouts.push(req.url());
  });
  await page.addInitScript(() => localStorage.setItem('unified-cbt-answer-layout','hotspot'));
  await page.goto('./');
  const rounds = page.getByRole('button',{name:'회차별 기출 고르기',exact:true});
  await expect(rounds).toBeVisible();
  expect(layouts).toEqual([]);
  await rounds.click();
  await page.locator('#round-card-hvac-20211').getByRole('button',{name:'학습모드',exact:true}).click();
  const card=page.locator('#session-question-1');
  const answer=card.getByRole('button',{name:'이미지에서 2번 선택',exact:true});
  await answer.click();
  await expect(answer).toHaveAttribute('aria-pressed','true');
  expect(layouts).toHaveLength(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}')
    .attempts?.['hvac-20211:1']?.lastChoice)).toBe(2);
});

for (const [route, file] of [
  ['/', '**/data/hvac.js?*'],
  ['/jewelry.html', '**/data/jewelry.js?*'],
  ['/', '**/modern/chunks/main-v*.js'],
] as const) {
  test('필수 파일 실패 후 같은 설정 주소 복구 '+file, async ({page}, info) => {
    test.skip(info.project.name !== 'iphone-14-pro');
    await page.route(file, request => request.abort('connectionreset'));
    await page.goto(route+'?safe=1#/study/settings');
    const retry = page.getByRole('button',{name:'다시 시도',exact:true});
    await expect(retry).toBeVisible();
    await expect(page.getByRole('status')).toContainText('불러오지 못했습니다');
    await page.evaluate(() => localStorage.setItem('unified-cbt-font-family','bold'));
    await page.unroute(file);
    await retry.click();
    await expect(page.getByRole('navigation',{name:'설정 목차'})).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#/study/settings');
    expect(await page.evaluate(() => localStorage.getItem('unified-cbt-font-family'))).toBe('bold');
  });
}

test('설치 후 오프라인으로 다시 열어 저장된 답까지 복원한다', async ({page, context}, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  await page.goto('/?safe=1#/study/rounds');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload();
  const round = page.locator('#round-card-hvac-20160306');
  await round.getByRole('button',{name:'학습모드'}).click();
  const answer = page.locator('#session-question-1 .choice-button').nth(1);
  await answer.click();
  await expect(answer).toHaveAttribute('aria-pressed','true');
  await context.setOffline(true);
  await page.goto('/?safe=1#/study/rounds');
  await page.reload();
  await round.getByRole('button',{name:'이어 학습'}).click();
  await expect(answer).toHaveAttribute('aria-pressed','true');
});


test('회차 주소에서 느린 문제은행을 기다리는 동안 재시도를 제공하고 도착하면 회차를 연다', async ({page}, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.clock.install();
  await page.route('**/data/hvac.js?*', async route => { await gate; await route.continue(); });
  const bankRequested = page.waitForRequest('**/data/hvac.js?*');
  try {
    await page.goto('/?safe=1#/study/rounds', {waitUntil:'commit'});
    await bankRequested;
    await page.clock.fastForward(13000);
    await expect(page.getByRole('button',{name:'다시 시도',exact:true})).toBeVisible();
    await expect(page.getByRole('status')).toContainText('연결이 느립니다');
  } finally {
    release();
  }
  await expect(page.locator('#round-card-hvac-20160306')).toBeVisible();
});

test('홈의 기본 글꼴은 작은 파일로 표시하고 드문 한글은 원본 글꼴로 표시한다', async ({page}, info) => {
  test.skip(info.project.name !== 'iphone-14-pro');
  const fontRequests: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'font') fontRequests.push(new URL(request.url()).pathname);
  });
  await page.goto('./');
  await expect(page.getByRole('button',{name:'교재에서 풀기',exact:true})).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(fontRequests.some(path => path.includes('CBTHomeSans-Regular'))).toBe(true);
  expect(fontRequests.some(path => path.includes('CBTStudySans-Regular'))).toBe(false);
  expect(fontRequests.some(path => path.includes('NanumGothic-Regular'))).toBe(false);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  await page.evaluate(async () => {
    for (const [id, text] of [['home','학습'],['common','닭'],['rare','힣']]) {
      const span = document.createElement('span');
      span.id = 'font-probe-'+id;
      span.style.fontFamily = '"Nanum Gothic", sans-serif';
      span.textContent = text;
      document.body.appendChild(span);
      span.getBoundingClientRect();
    }
    await document.fonts.ready;
  });
  const {root} = await cdp.send('DOM.getDocument');
  for (const [id, name] of [['home','CBTHomeSans-Regular'],['common','CBTStudySans-Regular'],['rare','NanumGothic']]) {
    const {nodeId} = await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#font-probe-'+id});
    await expect.poll(async () => {
      const {fonts} = await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
      return fonts.filter(font=>font.isCustomFont && font.glyphCount > 0).map(font=>font.postScriptName);
    }).toContain(name);
  }
});
