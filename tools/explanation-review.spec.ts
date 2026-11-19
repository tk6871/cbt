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

for (const sample of [
  {title:'623쪽 증발계수의 무차원 분수와 인쇄 단위',round:'school-energy-topic-6',id:'school-energy-textbook-2025-2:45',source:'2025년 2회 · 원문 45번',result:'단위가 남지 않는다',printed:'1.185 (kJ/kg)',screenshot:'evaporation-factor.png'},
  {title:'340쪽 흡수 가스 체적분율 원문·분수',round:'school-energy-topic-13',id:'school-energy-textbook-2018-2:26',source:'2018년 2회 · 원문 26번',result:'16.4%',printed:'16.4[%]',screenshot:'orsat-volume.png'},
  {title:'344쪽 스케줄 번호의 응력 단위·전사·분수',round:'school-energy-topic-11',id:'school-energy-textbook-2018-2:53',source:'2018년 2회 · 원문 53번',result:'72 kgf/cm²',printed:'72[kgf/cm²]',screenshot:'pipe-schedule.png'},
]) test(sample.title, async ({page}, info) => {
  await prepare(page,'energy-midterm');
  const round = page.locator('#round-card-'+sample.round);
  await round.getByRole('checkbox',{name:/계산 문제 포함/}).check();
  await round.getByRole('button',{name:'학습모드',exact:true}).click();
  const jump = page.getByRole('spinbutton',{name:'이동할 문제 번호'});
  await expect(jump).toBeVisible();
  const questionId = sample.id;
  const findPosition = () => page.evaluate(id => {
    const session = JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}');
    return (session.itemIds || []).indexOf(id) + 1;
  }, questionId);
  await expect.poll(findPosition).toBeGreaterThan(0);
  await jump.fill(String(await findPosition()));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:sample.source})});
  await card.locator('.image-answer-hotspot').nth(1).click();
  const box = card.locator('.explanation-box');
  await expect(box.locator('.beginner-primary-explanation')).toContainText(sample.result);
  await expect(box.locator('.katex mfrac').first()).toBeAttached();
  await expect(box.locator('.transcription-text')).toContainText(sample.printed);
  await expect.poll(()=>page.evaluate(id=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.[id],sample.id)).toBe(2);
  await box.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
  await box.screenshot({path:info.outputPath(sample.screenshot)});
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

test('2002년 5월 CO₂ 가열량의 이의제기와 분수식', async ({page}, info) => {
  await prepare(page, 'energy');
  await page.locator('#round-card-energy-industrial-20020526').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('10');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'평균분자 열용량'});
  await card.locator('.choice-button').nth(2).click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation.locator('.beginner-primary-explanation')).toContainText('1,382 kcal');
  await expect(explanation.locator('.math-formula .mfrac')).toBeVisible();
  const archived = explanation.locator('details').filter({hasText:'저장된 COMCBT 이의제기와 관리자 답변'});
  await archived.locator('summary').click();
  await expect(archived).toContainText('1381.818');
  await archived.locator('summary').click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['energy-industrial-20020526:10'])).toBe(3);
  await explanation.evaluate(box => box.scrollIntoView({block:'center', behavior:'instant'}));
  await explanation.screenshot({path:info.outputPath('co2-heat.png')});
});

test('산업안전기사 최소 컷셋 두 조합과 원본 도식', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20220424').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('28');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'Fussell'});
  await expect(card.locator('img[src^="data:image/svg+xml"]').first()).toBeVisible();
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('{1, 2}와 {1, 3}');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['safety-engineer-20220424:28'])).toBe(2);
});

test('대수평균온도차 교정 분수와 답안 저장', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20050306').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('29');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'냉각수 입구수온이'});
 await card.locator('.choice-button').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('3.27 °C');
 await expect(box.locator('.explanation-source-note summary')).toHaveText('자료 대조 해설');
 await expect(box.locator('.katex-html .mfrac')).toBeVisible();
 await expect(box.locator('math mfrac')).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['hvac-20050306:29'])).toBe(2);
 await box.screenshot({path:info.outputPath('lmtd.png')});
});
test('한솔 동결매체 교재 온도 원문과 환산 교정', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-263');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 32번',exact:true})}).locator('.question-card');
 await expect(card.locator('.question-text')).toContainText('저온액화가스');
 await card.locator('.choice-button').nth(2).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('−73.33 °C');
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.transcription-figure');
 await expect(figure.locator('.transcription-text')).toContainText('−77.33℃(−100℉)');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('cryogenic-book.png')});
});
test('코일 바이패스의 혼합 온도와 분수 표시', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20020310').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('7');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'Bypass Factor'});
 await card.locator('.choice-button').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('혼합공기 ③(28 ℃)');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('coil-bypass.png')});
});
test('쇠고기 교재 인쇄 소수점과 교정 해설', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-272');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 2번',exact:true})}).locator('.question-card');
 await expect(card.locator('.question-text')).toContainText('지방이 없는 부분');
 await card.locator('.choice-button').nth(2).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('328.88 kJ');
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('71.5+234.5+22.8=328.88');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('beef-heat.png')});
});

test('2019년 교재 코일 조건 누락과 원본 보기 보존', async ({page}, info) => {
 await prepare(page,'hvac-hansol');
 await page.locator('#round-card-hvac-hansol-2019-2').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('9');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'바이패스 팩터가 0.16'})});
 await expect(card.locator('.choice-copy').nth(1)).toHaveText('15');
 await card.locator('.choice-button').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('이 교재 이미지에는 표면온도가 없고 ②는 15 ℃');
 await box.screenshot({path:info.outputPath('coil-edition.png')});
});

test('교재 냉각수 열수지와 인쇄 결론', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-215');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 122번',exact:true})}).locator('.question-card');
 await card.locator('.image-answer-hotspot').first().click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('방열량도 같으면 온도차는 그대로다');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('출입구의 온도차가 커지고');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('water-heat-balance.png')});
});

test('노벽 두께 22 mm 원문과 외표면 온도 검산', async ({page}, info) => {
 await prepare(page,'energy');
 await page.locator('#round-card-energy-industrial-20030525').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('66');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'내벽의 내화벽돌 두께'})});
 await card.locator('.choice-button').nth(3).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('140.4 ℃');
 await expect(box).toContainText('두께를 22 cm로 넣었을 때');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['energy-industrial-20030525:66'])).toBe(4);
 await box.screenshot({path:info.outputPath('wall-thickness.png')});
});

test('냉동 교재 절대압력과 두 단의 압축비', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-196');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 22번',exact:true})}).locator('.question-card');
 await expect(card.locator('.question-text')).toContainText('100mmHg');
 await card.locator('.choice-button').nth(3).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('0.0880 MPa');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('1.601325');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await box.screenshot({path:info.outputPath('two-stage-pressure.png')});
});

test('병렬 RC 역률 교정과 등록 이의제기 보존', async ({page}, info) => {
 await prepare(page,'electric-craftsman');
 await page.locator('#round-card-electric-craftsman-2002-2').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('9');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'단자에서 본 역률값'});
 await card.locator('.choice-button').first().click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('그림은 병렬 RC다');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 const original=box.locator('.source-explanation-details').filter({hasText:'등록된 이용자 해설과 이의제기'});
 await original.locator('summary').click();
 await expect(original.locator('p')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['electric-craftsman-2002-2:9'])).toBe(1);
 await box.screenshot({path:info.outputPath('parallel-rc.png')});
});

test('교재 브라인 유량과 음수 출구온도', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-160');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 15번',exact:true})}).locator('.question-card');
 await card.locator('.image-answer-hotspot').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('−21.6 ℃');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('냉동부하[kW]');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('brine-balance.png')});
});

test('냉매 잠열 원본의 비교 온도와 교정값', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-93');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 36번',exact:true})}).locator('.question-card');
 await card.locator('.image-answer-hotspot').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('비교 온도는 −15 ℃');
 await expect(box).toContainText('약 142 kJ/kg');
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('R-114 : 144 kJ/kg');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('refrigerant-properties.png')});
});

test('교재 코일 자기 에너지의 분수와 전사된 전류', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'3-262');
 const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 20번',exact:true})}).locator('.question-card');
 await expect(card.locator('.question-text')).toContainText('5[A]');
 await card.locator('.choice-button').first().click();
 const box=card.locator('.explanation-box');
 const fractions=box.locator('.katex-html .mfrac');
 await expect(fractions).toHaveCount(2);
 await expect(fractions.first()).toBeVisible();
 await expect(fractions.last()).toBeVisible();
 await box.locator('.original-textbook-explanation summary').click();
 const figure=box.locator('.original-textbook-explanation').getByRole('figure');
 await expect(figure.getByRole('paragraph')).toContainText('1.25 [J]');
 await figure.getByRole('button',{name:'이미지로 보기'}).click();
 await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 await box.screenshot({path:info.outputPath('coil-energy.png')});
});

test('메탄 이론공기량과 저장 답안 분리', async ({page}, info) => {
 await prepare(page,'energy');
 await page.locator('#round-card-energy-industrial-20030831').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('6');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'메탄'})}).filter({hasText:'27.2'}).first();
 await card.locator('.choice-button').nth(3).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('건조공기 약 17.2 kg');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['energy-industrial-20030831:6'])).toBe(4);
 await box.screenshot({path:info.outputPath('methane-air.png')});
});

test('조작량 미분 그림과 적분동작 교정', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20030316').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('69');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'조작신호'})});
 await card.locator('.choice-button').nth(3).click();
 await expect(card).toContainText('다른 보기를 선택해 보세요');
 await card.locator('.choice-button').nth(2).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('④ I동작');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['hvac-20030316:69'])).toBe(3);
 await box.screenshot({path:info.outputPath('integral-control.png')});
});

test('산업안전 원표와 순위 이의 확인', async ({page},info)=>{
 await prepare(page,'safety-engineer');
 await page.locator('#round-card-safety-engineer-20220424').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('97');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'다음 표의 가스'});
 await expect(card.locator('table')).toContainText('75.0');
 await card.locator('.choice-button').nth(3).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('③ C–D–A–B');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['safety-engineer-20220424:97'])).toBe(4);
 await box.screenshot({path:info.outputPath('safety-table.png')});
});

test('정보처리 HRN 분수와 답안 저장',async({page},info)=>{
 await prepare(page,'information-engineer');
 await page.locator('#round-card-information-engineer-2006-2').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('60');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'Highest Response'});
 await card.locator('.choice-button').nth(1).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('서비스시간을 S');
 await expect(box.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['information-engineer-2006-2:60'])).toBe(2);
 await box.screenshot({path:info.outputPath('hrn-priority.png')});
});

test('포화액과 포화증기가 다른 공조 두 판본',async({page},info)=>{
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20030525').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('32');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'단위열량을 공급할때'});
 await card.locator('.choice-button').nth(2).click();
 const box=card.locator('.explanation-box');
 await expect(box).toContainText('④의 포화증기');
 const details=box.locator('.source-explanation-details').filter({hasText:'공조 추가 해설'});
 await details.locator('summary').click();
 await expect(details).toContainText('교재에는 포화액');
 await box.screenshot({path:info.outputPath('saturated-vapor-options.png')});
});

test('산업안전 점광원 거리비 분수와 답안 기록', async ({page}, info) => {
 await prepare(page, 'safety-engineer');
 await page.locator('#round-card-safety-engineer-20220305').getByRole('button', {name:'학습모드', exact:true}).click();
 await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('31');
 await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
 const card = page.locator('.question-card').filter({hasText:'반사경 없이'});
 await card.locator('.choice-button').nth(1).click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('675 lx');
 await expect(explanation.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers?.['safety-engineer-20220305:31'])).toBe(2);
 await explanation.screenshot({path:info.outputPath('point-source-illuminance.png')});
});

test('급탕 순환수두 원문 두 판본의 분수와 답안 유지', async ({page}, info) => {
 await prepare(page,'hvac-hansol');
 await page.locator('#round-card-hvac-hansol-2025-2').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('47');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const rendered = page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'0.96876'})});
 await expect(rendered.locator('.question-text')).toContainText('0.98001');
 const index = await rendered.evaluate(el => Array.from(document.querySelectorAll('.question-card')).indexOf(el));
 const card = page.locator('.question-card').nth(index);
 await card.locator('.choice-button').nth(1).click();
 await expect(card.locator('.explanation-box')).toContainText('11.25 kg/m³');
 await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
 const control = card.locator('.question-transcription-control');
 await control.getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await card.locator('.source-question-image').evaluate((img:HTMLImageElement) => img.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await control.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
 await expect(card.locator('.choice-button.selected')).toContainText('112.5');
 await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers?.['hvac-hansol-2025-2:47'])).toBe(2);
 const formula = card.locator('.explanation-box .math-formula').filter({has:page.locator('.mfrac')}).first();
 const endVisible = await formula.evaluate(el => {
   const end = el.scrollWidth - el.clientWidth;
   el.scrollLeft = end;
   return Math.abs(el.scrollLeft - end) <= 1;
 });
 expect(endVisible).toBe(true);
 await card.screenshot({path:info.outputPath('circulation-head-text.png')});
});

test('암모니아 응급처치 안내와 과거 보기·저장 답 유지', async ({page}, info) => {
  await prepare(page, 'gas-craftsman');
  await page.locator('#round-card-gas-craftsman-2014-5').getByRole('button', {name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('20');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'암모니아 취급 시 피부에'});
  const historicalAnswer = card.locator('.choice-button').nth(3);
  await expect(historicalAnswer).toContainText('붕산수');
  await historicalAnswer.click();
  const explanation = card.locator('.explanation-box');
  await expect(explanation).toContainText('최소 15분간 씻고 바로 진료');
  await expect(explanation).toContainText('붕산수를 바르는 단계는 이 지침에 없다');
  const archived = explanation.locator('.source-explanation-details').filter({hasText:'등록된 이용자 해설과 이의제기'});
  await archived.locator('summary').click();
  await expect(archived.locator('p')).toContainText('다량의 물로 세척');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers?.['gas-craftsman-2014-5:20'])).toBe(4);
  await explanation.screenshot({path:info.outputPath('ammonia-first-aid.png')});
});

test('공조 자료 냉수코일 원본 전환 및 분수 계산', async ({page}, info) => {
 await prepare(page, 'hvac');
 await page.locator('#round-card-hvac-20211').getByRole('button', {name:'학습모드', exact:true}).click();
 const card = page.locator('.question-card').first();
 await expect(card.locator('.question-text')).toContainText('83740');
 await expect(card.locator('button.choice-button')).toHaveCount(4);
 await card.locator('button.choice-button').nth(1).click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('66.5 L/min');
 await expect(explanation.locator('.katex-html .mfrac').first()).toBeVisible();
 await explanation.screenshot({path:info.outputPath('coil-flow-rate.png')});
 const toggle = card.locator('.question-transcription-control');
 await toggle.getByRole('button', {name:'이미지로 보기', exact:true}).click();
 await card.locator('.source-question-image').evaluate((im:HTMLImageElement)=>im.decode());
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['hvac-20211:1'])).toBe(2);
});

test('산업안전 지게차 모멘트 경계값과 분수', async ({page}, info) => {
 await prepare(page, 'safety-engineer');
 await page.locator('#round-card-safety-engineer-20210814').getByRole('button', {name:'학습모드', exact:true}).click();
 await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('45');
 await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
 const card = page.locator('.question-card').filter({hasText:'화물중량이 200kgf'});
 await card.locator('button.choice-button').nth(1).click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('0.5 m를 넘어야');
 await expect(explanation.locator('.katex-html .mfrac').first()).toBeVisible();
 await explanation.screenshot({path:info.outputPath('forklift-moment.png')});
});

test('교재 단열압축 예제의 교정 수식·인쇄 전사·원본 복귀', async ({page}, info) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-73');
 const example=page.locator('.book-worked-example').filter({has:page.getByRole('heading',{name:/가역단열변화/})});
 await example.locator('summary').click();
 await expect(example.locator('.katex-html .mfrac').first()).toBeVisible();
 await expect(example).toContainText('595.94');
 const figure=example.locator('.transcription-figure');
 await expect(figure.locator('.transcription-text')).toContainText('308.67 K');
 await figure.getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await figure.locator('img').evaluate((img:HTMLImageElement)=>img.decode());
 await figure.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
 await expect(figure.locator('.transcription-text')).toContainText('−78.71 kJ');
 await example.screenshot({path:info.outputPath('adiabatic-worked-example.png')});
});

test('교재 얼음 가열 보기의 숫자 재대조', async ({page}) => {
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'2-87');
 const example=page.locator('.book-worked-example').filter({hasText:'100℃증기'});
 await example.locator('summary').click();
 await expect(example.locator('details strong')).toContainText('보기 ③ 30,306 kJ');
 await expect(example).toContainText('첫 계산은 −10 ℃');
});

test('공조 급수 도면 하단 분기의 관경 계산', async ({page}, info) => {
 await prepare(page, 'hvac');
 await page.locator('#round-card-hvac-20211').getByRole('button', {name:'학습모드', exact:true}).click();
 await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('47');
 await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
 const card = page.locator('.question-card').filter({has:page.getByRole('img', {name:'47번 문제 원문', exact:true})});
 await card.locator('.image-answer-hotspot').nth(3).click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('대변기 세 개');
 await expect(explanation).toContainText('2.4개분');
 await expect(explanation).toContainText('④ 40A');
 await explanation.screenshot({path:info.outputPath('supply-branch-calculation.png')});
});

test('산업안전기사 산소소비량의 질소수지와 분수', async ({page}, info) => {
 await prepare(page, 'safety-engineer');
 await page.locator('#round-card-safety-engineer-20210515').getByRole('button', {name:'학습모드', exact:true}).click();
 await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('36');
 await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
 const card = page.locator('.question-card').filter({hasText:'5분간의 산소소비량'});
 await card.locator('button.choice-button').first().click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('0.948 L/min');
 await expect(explanation.locator('.katex-html .mfrac').first()).toBeVisible();
 await explanation.screenshot({path:info.outputPath('oxygen-consumption.png')});
});

test('지게차 무게중심과 전도축 정답 재확인 안내', async ({page}) => {
 await prepare(page, 'safety');
 await page.locator('#round-card-safety-20020811').getByRole('button', {name:'학습모드', exact:true}).click();
 await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('55');
 await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
 const card = page.locator('.question-card').filter({hasText:'앞바퀴 중심'});
 await card.locator('button.choice-button').nth(1).click();
 const explanation = card.locator('.explanation-box');
 await expect(explanation).toContainText('안정삼각형 안');
 await expect(explanation).toContainText('앞바퀴 접지선');
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
});

test('인양각과 줄당 장력의 분수식', async ({page}) => {
 await prepare(page,'safety');
 await page.locator('#round-card-safety-20040905').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('44');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'로프에 가장 힘이 작게'});
 await card.locator('button.choice-button').first().click();
 const explanation=card.locator('.explanation-box');
 await expect(explanation).toContainText('두 줄 사이의 끼인각');
 await expect(explanation.locator('.katex-html .mfrac').first()).toBeVisible();
});

test('공조 입원실 외기량 원문과 분수식', async ({page}) => {
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20212').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('6');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'6인용 입원실'});
 await card.locator('button.choice-button').nth(3).click();
 await expect(card.locator('.explanation-box')).toContainText('12,857');
 await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
 await card.getByRole('button',{name:'이미지로 보기',exact:true}).first().click();
 await expect(page.getByRole('img',{name:'6번 문제 원문',exact:true})).toBeVisible();
});

test('공조 혼합점 환기온도와 덕트 상승분',async({page},info)=>{
 await prepare(page,'hvac');
 await page.locator('#round-card-hvac-20040808').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('9');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'외기온도가 30'});
 await card.locator('.choice-button').nth(1).click();
 await expect(card.locator('.explanation-box')).toContainText('26 ℃로 도착');
 await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
 await card.screenshot({path:info.outputPath('return-air-mixing.png')});
});

test('교재 순환유량 1.46 L/s의 분수식과 인쇄 풀이',async({page},info)=>{
 await prepare(page,'hvac');
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'1-91');
 const card=page.locator('[data-source-id="hansol-direct-1-91-9"]');
 await card.locator('.direct-solution>summary').click();
 await expect(card.locator('.direct-explanation-text')).toContainText('110,000 kJ/h');
 await expect(card.locator('.direct-explanation-text .katex-html .mfrac').first()).toBeVisible();
 await card.locator('.direct-solution-original>summary').click();
 const image=card.locator('.direct-solution-parts img').first();
 await expect(image).toBeVisible();
 await image.evaluate((im:HTMLImageElement)=>im.decode());
 await card.screenshot({path:info.outputPath('book-heating-circulation.png')});
});

test('교재 열당량 분수식과 인쇄 보기',async({page},info)=>{
 await prepare(page,'hvac-hansol');
 await page.locator('#round-card-hvac-hansol-2017-1').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('22');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'일의 열당량(A)'});
 await expect(card.locator('.choice-copy').nth(1)).toContainText('1/427');
 await card.locator('.choice-button').nth(1).click();
 await expect(card.locator('.explanation-box')).toContainText('단위 일에 대응하는 열량');
 await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
 await card.screenshot({path:info.outputPath('heat-equivalent.png')});
});

test('산업안전 소음 휴식시간 환산과 답안 저장',async({page},info)=>{
 await prepare(page,'safety-engineer');
 await page.locator('#round-card-safety-engineer-20210307').getByRole('button',{name:'학습모드',exact:true}).click();
 await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('25');
 await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
 const card=page.locator('.question-card').filter({hasText:'자동차를 생산하는 공장'});
 await card.locator('.choice-button').nth(1).click();
 await expect(card.locator('.explanation-box')).toContainText('92.1 dB(A)');
 await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}').answers?.['safety-engineer-20210307:25'])).toBe(2);
 await card.screenshot({path:info.outputPath('noise-dose-time.png')});
});

test('콘크리트벽 표면 온도차와 전도열 분수 계산', async ({page}) => {
  await prepare(page,'energy');
  await page.locator('#round-card-energy-industrial-20140920').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('47');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.locator('.question-text').filter({hasText:'콘크리트벽'})});
  await card.locator('.choice-button').nth(2).click();
  const solution = card.locator('.explanation-box');
  await expect(solution).toContainText('5 cm=0.05 m');
  await expect(solution).toContainText('80 kcal');
  await expect(solution.locator('.katex-html .mfrac').first()).toBeVisible();
});

test('산업안전 가스켓 생존확률과 표준화 분수',async({page})=>{
  await prepare(page,'safety-engineer');
  await page.locator('#round-card-safety-engineer-20200926').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('32');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('.question-card').filter({hasText:'실린더 블록에 사용하는 가스켓'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('P(Z>−2)=P(Z≤2)=0.9772');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('교재 송풍기 500 Pa의 분수식과 인쇄 계산 차이',async({page})=>{
  await prepare(page,'hvac');
  await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
  await enterBookReader(page);
  await chooseBookPage(page,'1-136');
  const card=page.locator('[data-source-id="hansol-direct-1-136-11"]');
  await card.locator('.direct-solution>summary').click();
  const text=card.locator('.direct-explanation-text');
  await expect(text).toContainText('7.50 kW');
  await expect(text.locator('.katex-html .mfrac').first()).toBeVisible();
  await card.locator('.direct-solution-original>summary').click();
  const image=card.locator('.direct-solution-parts img').first();
  await image.evaluate((im:HTMLImageElement)=>im.decode());
  await expect(image).toBeVisible();
});

test('설비보전 실린더 전진 출력의 원본 보기와 분수식',async({page})=>{
  await prepare(page,'maintenance');
  await page.locator('#round-card-maintenance-20200606').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('11');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('.question-card').filter({hasText:'실린더가 전진할 때'});
  await card.locator('.choice-button').first().click();
  await expect(card.locator('.explanation-box')).toContainText('로드가 없는 쪽');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('에너지 미세압력계의 경사관 눈금과 분수',async({page})=>{
  await prepare(page,'energy');
  await page.locator('#round-card-energy-industrial-20150919').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('35');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('.question-card').filter({hasText:'미세한 압력 측정용'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('수직 액면차');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('랭킨사이클 열효율의 보기와 원본 엔탈피 분수',async({page})=>{
  await prepare(page,'energy');
  await page.locator('#round-card-energy-industrial-20160306').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('14');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('.question-card').filter({hasText:'다음 랭킨사이클에서'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('응축기에서 버린 열은 h₃−h₄');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('강관 외면적 기준 열관류율의 분수와 단위',async({page})=>{
  await prepare(page,'energy');
  await page.locator('#round-card-energy-industrial-20190303').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('58');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('.question-card').filter({hasText:'내경이 2.5cm'});
  await card.locator('.choice-button').first().click();
  await expect(card.locator('.explanation-box')).toContainText('612.82 W/(m²·K)');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 교재 침입외기 잠열의 원보기와 부호', async ({page}) => {
  await prepare(page, 'hvac-hansol');
  await page.locator('#round-card-hvac-hansol-2017-2').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('19');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'겨울철 침입외기'});
  await expect(card.locator('.choice-copy').nth(3)).toContainText('717');
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.explanation-box')).toContainText('실내에서 실외를 뺀다');
});

test('공조 교재 미표기 저항의 회로와 분수', async ({page}) => {
  await prepare(page, 'hvac-hansol');
  await page.locator('#round-card-hvac-hansol-2017-2').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('77');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.getByRole('button',{name:'77번 문제 원문 크게 보기'})});
  await card.getByRole('button',{name:'이미지에서 3번 선택'}).click();
  await expect(card.locator('.explanation-box')).toContainText('R₄=4 Ω일 때');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 2005년 5월 분기전류의 계산과 표시', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20050529').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('68');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'회로에 전압 100V'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('병렬부 전압은 60 V');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('원형 코일 자계의 원문 조건과 정답 확인', async ({page}) => {
  await prepare(page,'hvac');
  await page.locator('#round-card-hvac-20050807').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('71');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'원형코일에 10A'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('1,000 A/m와 같은 보기가 없어');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 급탕 순환수두와 밀도 단위', async ({page}) => {
  await prepare(page,'hvac');
  await page.locator('#round-card-hvac-20060816').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('58');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'탕비기 출구의 온도를'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('0.1125 m');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('산업안전기사 병렬 밸브의 실패확률', async ({page}) => {
  await prepare(page,'safety-engineer');
  await page.locator('#round-card-safety-engineer-20200822').getByRole('button',{name:'학습모드',exact:true}).click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill('35');
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card = page.locator('.question-card').filter({hasText:'병렬밸브계'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('실패확률이므로 ② 0.0595');
  await expect(card.locator('img').first()).toBeVisible();
});

test('산업안전기사 화면 대비의 정의와 보기 대조', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20200606').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('28');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '반사율이 85%'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('약 −322%');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('산업안전기사 와이어로프 사이 각도와 장력', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20190804').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('51');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '질량이 100kg인 물체'});
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.explanation-box')).toContainText('약 980 N');
  await expect(card.locator('img').first()).toBeVisible();
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('산업안전기사 병렬 접지경로와 인체전류', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20190427').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('79');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '누전된 전동기에 인체가 접촉'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('490 mA');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('산업안전기사 광속과 조도의 단위', async ({page}) => {
  await prepare(page, 'safety-engineer');
  await page.locator('#round-card-safety-engineer-20190303').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('28');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '점광원으로부터'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('4.42 lx');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 필기 축전기의 전압 분배와 저장에너지', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20080302').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('74');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '직병렬회로에 180V'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('120 V');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 두 증발기의 냉매 질량유량', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20090510').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('25');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '냉장실용 준비실'});
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.explanation-box')).toContainText('522.6 kg/h');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 교류의 실효전압과 저항 소비전력', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20100725').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('65');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '회로에서 소비하는 전력'});
  await card.locator('.choice-button').first().click();
  await expect(card.locator('.explanation-box')).toContainText('1.2 kW');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 교재 냉동 성적계수 원도와 분수', async ({page}) => {
  await prepare(page, 'hvac-hansol');
  await page.locator('#round-card-hvac-hansol-2017-3').getByRole('button', {name:'학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('37');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({has:page.getByRole('button',{name:'37번 문제 원문 크게 보기'})});
  await card.getByRole('button',{name:'이미지에서 3번 선택'}).click();
  await expect(card.locator('.explanation-box')).toContainText('i₃−i₂');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 필기 열펌프의 고온부 열량과 온도비', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20110821').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('23');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '열펌프의 성적계수를'});
  await card.locator('.choice-button').nth(2).click();
  await expect(card.locator('.explanation-box')).toContainText('고온부로 내보내는 열');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 직렬 저항과 음의 피드백 전압 분배', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20120304').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('74');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '직렬로 연결된 저항회로'});
  await card.locator('.choice-button').first().click();
  await expect(card.locator('.explanation-box')).toContainText('Vᵢ−Vₒ');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 반파정류의 주기 평균 전류', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20140817').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('68');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '일반적인 반파정류회로'});
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.explanation-box')).toContainText('양의 반주기');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 수증기 분압과 상대습도', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20150308').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('16');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '수증기'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('포화 수증기압');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 흡수식 냉동기 성적계수', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20180304').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('35');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: '흡수식냉동기의 성적계수'});
  await card.locator('.choice-button').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('재생기 가열량');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 필기 Y 결선 저항 변환', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20190303').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('65');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({hasText: 'Y결선 회로'});
  await card.locator('.choice-button').first().click();
  await expect(card.locator('.explanation-box')).toContainText('맞은편 Y 저항');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
  await expect(card.locator('img').first()).toBeVisible();
});

test('공조 복원 열유속 원문 전환과 단위 오류', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20213').getByRole('button', {name: '학습모드', exact: true}).click();
  await page.getByRole('spinbutton', {name: '이동할 문제 번호'}).fill('33');
  await page.locator('.session-jump-form').getByRole('button', {name: '이동', exact: true}).click();
  const card = page.locator('.question-card').filter({has: page.locator('.question-text').filter({hasText: '열유속(heat flux)'})});
  await expect(card.locator('.question-text')).toContainText('0.4 W/m²');
  await card.locator('.choice-button').nth(3).click();
  await expect(card.locator('.explanation-box')).toContainText('20.04 ℃');
  await expect(card.locator('.explanation-box .mfrac').first()).toBeVisible();
  await card.getByRole('button', {name:'이미지로 보기', exact:true}).click();
  const selected = page.locator('.question-card').filter({has: page.locator('.image-answer-hotspot.selected')});
  await expect(selected.locator('.source-question-image')).toBeVisible();
  await selected.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
  await expect(card.locator('.choice-button.selected')).toHaveCount(1);
});

test('공조 복원 물 전체와 단위질량당 엔트로피', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20221').getByRole('button', {name: '학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('37');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({has: page.getByRole('img', {name:'37번 문제 원문', exact:true})});
  await card.locator('.image-answer-hotspot').nth(1).click();
  await expect(card.locator('.explanation-box')).toContainText('13.1 kJ/K');
  await expect(card.locator('.explanation-box')).toContainText('1.31');
  await expect(card.locator('.explanation-box .katex-html .mfrac').first()).toBeVisible();
});

test('공조 복원 전열저항과 절연저항 원문', async ({page}) => {
  await prepare(page, 'hvac');
  await page.locator('#round-card-hvac-20223').getByRole('button', {name: '학습모드', exact:true}).click();
  await page.getByRole('spinbutton', {name:'이동할 문제 번호'}).fill('53');
  await page.locator('.session-jump-form').getByRole('button', {name:'이동', exact:true}).click();
  const card = page.locator('.question-card').filter({has: page.getByRole('img', {name:'53번 문제 원문', exact:true})});
  await card.locator('.image-answer-hotspot').first().click();
  await expect(card.locator('.explanation-box')).toContainText('메거');
  await expect(card.locator('.explanation-box')).toContainText('전열저항');
});
