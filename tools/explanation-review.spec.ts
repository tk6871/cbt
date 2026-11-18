import {test,expect,type Page} from '@playwright/test';
import {enterBookReader,chooseBookPage} from './textbook-reader-test-helpers';
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
for(const [key,round,number] of [
 ['hvac','hvac-20222',33],
 ['hvac-hansol','hvac-hansol-2020-4',35],
 ['hvac-hansol','hvac-hansol-2022-3',33],
 ['hvac-hansol','hvac-hansol-2025-3',25],
] as const){
 test(`동일 문제 텍스트 대체·원문 복귀·저장 ${round}:${number}`,async({page},info)=>{
  await prepare(page,key);
  await page.locator(`#round-card-${round}`).getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill(String(number));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const rendered=page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'12 kW 펌프의 회전수'})});
  await expect(rendered).toBeVisible();
  const index=await rendered.evaluate(el=>Array.from(document.querySelectorAll('.question-card')).indexOf(el));
  const card=page.locator('.question-card').nth(index);
  await expect(card.locator('.question-text')).toContainText('1.5 m³/min');
  await expect(card.locator('.question-text')).toContainText('1.8 m³/min');
  await expect(card.locator('.source-question-image')).toHaveCount(0);
  const choices=card.locator('.choice-copy');
  for(const [i,text] of ['850 rpm','960 rpm','1025 rpm','1365 rpm'].entries())await expect(choices.nth(i)).toHaveText(text);
  await card.locator('.choice-button').nth(1).click();
  const control=card.locator('.question-transcription-control');
  await control.getByRole('button',{name:'이미지로 보기',exact:true}).click();
  await expect(card.locator('.source-question-image')).toBeVisible();
  await card.locator('.source-question-image').evaluate((el:HTMLImageElement)=>el.decode());
  await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
  await control.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
  await expect(card.locator('.choice-button.selected')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.[id],`${round}:${number}`)).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(round==='hvac-hansol-2025-3')await card.screenshot({path:info.outputPath('matched-question-text.png')});
 });
}

test('산업안전기사 휴식시간 풀이의 분수·답안 저장', async ({page}, info) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20220424').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('23');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'A작업의 평균에너지소비량'});
  await card.locator('.choice-button').nth(3).click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation).toContainText('6(60−R)+1.5R=300');
  const formula = explanation.locator('.math-formula');
  await expect(formula.locator('.katex-html .mfrac')).toBeVisible();
  await expect(formula.locator('math mfrac')).toHaveCount(1);
  await expect(formula).toHaveAttribute('aria-label', /13.3분/);
  expect(await formula.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers?.['safety-engineer-20220424:23'])).toBe(4);
  await explanation.screenshot({path:info.outputPath('rest-time-fraction.png')});
});

test('COMCBT 참고 회차와 재배열된 정답 보기', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20220305').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('16');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'사회행동의 기본 형태가 아닌 것은'});
  const first = card.locator('.choice-button').first();
  await expect(first).toContainText('모방');
  await first.click();
  const source = card.locator('.explanation-source-note');
  await source.locator('summary').click();
  await expect(source.locator('p')).toContainText('2011.06.12 6번');
  await expect(source.locator('p')).toContainText('2017.08.26 8번');
  await expect(card.locator('.beginner-primary-explanation')).toContainText('①');
});

async function openDustQuestion(page:Page,position:number) {
  await prepare(page,'energy-midterm');
  const round=page.locator('#round-card-school-energy-topic-1');
  await round.getByRole('checkbox',{name:/계산 문제 포함/}).check();
  await round.getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill(String(position));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
}

test('474쪽 종합 집진율 대입식·인쇄값·답안 저장', async ({page}, info) => {
  await openDustQuestion(page,4);
  const card = page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2022년 1회 · 원문 2번'})});
  await card.locator('.image-answer-hotspot').nth(3).click();
  await expect(card.locator('.beginner-primary-explanation')).toContainText('④ 99.5%');
  const formula=card.locator('.explanation-box .math-formula');
  await expect(formula.locator('.katex-html .mfrac')).toBeVisible();
  await expect(formula).toHaveAttribute('aria-label', /99.5퍼센트/);
  await expect(card.locator('.transcription-text')).toContainText('99.473[%]');
  await card.getByRole('button',{name:'이미지로 보기',exact:true}).click();
  await card.locator('.textbook-explanation-image img').evaluate((img:HTMLImageElement)=>img.decode());
  await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
  await card.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
  expect(await formula.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['school-energy-textbook-2022-1:2'])).toBe(4);
  const box=card.locator('.explanation-box');
  await box.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  await box.screenshot({path:info.outputPath('dust-efficiency.png')});
});
test('636쪽 동일 문제 텍스트·습식 정답·원본 선택 영역',async({page})=>{
  await openDustQuestion(page,8);
  const card=page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2025년 3회 · 원문 33번'})});
  await expect(card.locator('.choice-copy').nth(3)).toHaveText('벤튜리스크러버식');
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.beginner-primary-explanation')).toContainText('습식이므로 이 문항의 정답');
  await card.locator('.question-transcription-control').getByRole('button',{name:'이미지로 보기'}).click();
  await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
});

test('급수처리 원문 반응식과 교정식·답안 저장', async ({page}, info) => {
  await prepare(page, 'energy-midterm');
  await page.locator('#round-card-school-energy-topic-3').getByRole('button', {name:'학습모드', exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2022년 2회 · 원문 75번'})});
  const jump = page.getByRole('spinbutton', {name:'이동할 문제 번호'});
  const last = Number(await jump.getAttribute('max'));
  await jump.fill(String(last));
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  await card.locator('.image-answer-hotspot').nth(2).click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('N₂H₄ + O₂ → N₂ + 2H₂O');
  await expect(explanation.locator('.transcription-text')).toContainText('N₂H₄ + O₂ → 2H₂O');
  await explanation.getByRole('button',{name:'이미지로 보기',exact:true}).click();
  await explanation.locator('.textbook-explanation-image img').evaluate((img:HTMLImageElement)=>img.decode());
  await explanation.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['school-energy-textbook-2022-2:75'])).toBe(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await explanation.screenshot({path:info.outputPath('boiler-water.png')});
});

test('2002년 연도가스 CO₂ 보정 분수와 답안 저장', async ({page}, info) => {
  await prepare(page, 'energy');
  await page.locator('#round-card-energy-industrial-20020310').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('16');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'연도가스를 분석'});
  await card.locator('.choice-button').first().click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('16.8%');
  const formula = explanation.locator('.math-formula');
  await expect(formula.locator('.katex-html .mfrac')).toBeVisible();
  await expect(formula).toHaveAttribute('aria-label', /16.8퍼센트/);
  expect(await formula.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['energy-industrial-20020310:16'])).toBe(1);
  await explanation.screenshot({path:info.outputPath('flue-gas.png')});
});

test('버드의 경상 20건 환산 분수와 참고 회차', async ({page}, info) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20220424').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('12');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'버드(Bird)의 재해분포'});
  await card.locator('.choice-button').nth(2).click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('1,200건');
  const formula = explanation.locator('.math-formula');
  await expect(formula.locator('.katex-html .mfrac')).toBeVisible();
  await expect(formula).toHaveAttribute('aria-label', /1200건/);
  await card.locator('.explanation-source-note summary').click();
  await expect(card.locator('.explanation-source-note p')).toContainText('2013.06.02 13번');
  expect(await formula.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['safety-engineer-20220424:12'])).toBe(3);
  await explanation.screenshot({path:info.outputPath('bird-ratio.png')});
});

test('펌프 출구압력의 두 해석·저장 답과 이의제기 보존', async ({page}, info) => {
  await prepare(page, 'energy');
  await page.locator('#round-card-energy-industrial-20020310').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('33');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'996.016'});
  await card.locator('.choice-button').nth(1).click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('−0.0954 kJ/kg');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('4.92 kJ/kg');
  await expect(explanation.locator('.math-formula .mfrac')).toBeVisible();
  const archived = card.locator('details').filter({has:page.locator('summary', {hasText:'저장된 COMCBT 이의제기와 관리자 답변'})});
  await archived.locator('summary').click();
  await expect(archived).toContainText('문제지 사진원본 확인해 봤는데 5kpa가 맞습니다');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['energy-industrial-20020310:33'])).toBe(2);
  await archived.locator('summary').click();
  await explanation.screenshot({path:info.outputPath('pump-dispute.png')});
});

test('623쪽 증발계수의 무차원 분수와 인쇄 단위', async ({page}, info) => {
  await prepare(page,'energy-midterm');
  const round = page.locator('#round-card-school-energy-topic-6');
  await round.getByRole('checkbox',{name:/계산 문제 포함/}).check();
  await round.getByRole('button',{name:'학습모드',exact:true}).click();
  const jump = page.getByRole('spinbutton',{name:'이동할 문제 번호'});
  await expect(jump).toBeVisible();
  const questionId = 'school-energy-textbook-2025-2:45';
  const findPosition = () => page.evaluate(id => {
    const session = JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}');
    return (session.itemIds || []).indexOf(id) + 1;
  }, questionId);
  await expect.poll(findPosition).toBeGreaterThan(0);
  await jump.fill(String(await findPosition()));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2025년 2회 · 원문 45번'})});
  await card.locator('.image-answer-hotspot').nth(1).click();
  const box = card.locator('.explanation-box');
  await expect(box.locator('.beginner-primary-explanation')).toContainText('단위가 남지 않는다');
  await expect(box.locator('.katex mfrac').first()).toBeAttached();
  await expect(box.locator('.transcription-text')).toContainText('1.185 (kJ/kg)');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['school-energy-textbook-2025-2:45'])).toBe(2);
  await box.screenshot({path:info.outputPath('evaporation-factor.png')});
});

test('한솔 1-225쪽 유효흡입수두 원문·분수·보기',async({page},info)=>{
  await prepare(page,'hvac');
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  await enterBookReader(page);
  await chooseBookPage(page,'1-225');
  const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 1번',exact:true})}).locator('.question-card');
  await card.locator('.image-answer-hotspot').nth(1).click();
  const box=card.locator('.explanation-box');
  await expect(box).toContainText('10.98 mAq');
  await expect(box).toContainText('10.97 mAq');
  await expect(box.locator('.math-formula .mfrac')).toBeVisible();
  await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
  await box.screenshot({path:info.outputPath('hansol-suction-head.png')});
});
