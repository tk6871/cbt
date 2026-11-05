import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import confirmed from '../data/image-text/confirmed.json' with {type:'json'};
import families from '../data/image-text/families.json' with {type:'json'};
import {allowedTranscription,escapeTranscription,imageSourceKey,type ImageTranscription} from '../src/cbt/imageTranscription';
test.use({serviceWorkers:'block'});
test('전사 원문 해시 전수·임시/확인 구분·수식 원문 보존',({},info)=>{
 test.skip(info.project.name!=='desktop','파일 전수 검사는 한 번만 실행합니다.');
 const entries={...confirmed,...Object.assign({},...families.map(family=>JSON.parse(fs.readFileSync(`data/image-text/${family}.json`,'utf8'))))} as Record<string,ImageTranscription>;
 expect(Object.keys(entries)).toHaveLength(1976);
 expect(Object.values(entries).filter(e=>e.status==='reviewed')).toHaveLength(13);
 expect(entries['assets/energy-restored/questions/2022-4-8.webp']).toBeUndefined();
 for(const [original,e] of Object.entries(entries)){
  expect(crypto.createHash('sha256').update(fs.readFileSync(e.asset)).digest('hex')).toBe(e.sha256);
  expect(allowedTranscription(e,original,'image')).toBeUndefined();
  if(e.status==='provisional')expect(allowedTranscription(e,original,'text')).toBeUndefined();
  if(e.eligible)expect(allowedTranscription(e,original,'ocr')).toBe(e);
  expect(allowedTranscription({...e,asset:'assets/changed.webp'},original,'ocr')).toBeUndefined();
  if(e.question)expect(e.question.choices).toHaveLength(4);
 }
 expect(escapeTranscription('<img onerror="x"> &')).toBe('&lt;img onerror=&quot;x&quot;&gt; &amp;');
 expect(imageSourceKey('https://untrusted.example/assets/energy-textbook/questions/1.webp')).toBe('');
});
test('문제·해설 OCR/이미지 전환·같은 선택 유지·설정 저장·원문 지연 로딩',async({page},info)=>{
 test.skip(info.project.name!=='desktop','상세 설정 회귀는 PC에서 검사합니다.');
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','energy-midterm');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  localStorage.setItem('cbt-explanation-display-v1','ocr');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('/?safe=1');
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.locator('#round-card-school-energy-topic-5').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').filter({has:page.locator('.school-source-chip').filter({hasText:'2020년 3회 · 원문 8번'})});
 await expect(card.locator('.question-text')).toContainText('틀린 것은?');
 await expect(card.locator('.choice-copy').nth(0)).toContainText('CO₂');
 await expect(card.locator('.source-question-image')).toHaveCount(0);
 expect(requests.some(url=>url.includes('36709bf20772701ba34b8c40434c8d64.webp'))).toBe(false);
 await card.locator('.choice-button').nth(3).click();
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 const figure=card.locator('.transcription-figure').first();
 await expect(figure.locator('.transcription-text')).toContainText('연료소비량이 증가한다');
 await expect(figure.locator('img')).toHaveCount(0);
 await figure.getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await expect(figure.locator('img')).toBeVisible();await figure.locator('img').evaluate((im:HTMLImageElement)=>im.decode());
 await figure.getByRole('button',{name:'텍스트로 보기',exact:true}).click();
 await card.locator('.question-transcription-control').getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await expect(card.locator('.source-question-image')).toBeVisible();
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 await card.locator('.question-transcription-control').getByRole('button',{name:'텍스트로 보기',exact:true}).click();
 await expect(card.locator('.choice-button.selected')).toHaveCount(1);
 const settings=page.locator('[data-setting="explanationDisplay"]');
 await page.locator('.session-tools').getByRole('button',{name:/설정/}).click();
 await settings.getByRole('button',{name:/원문 이미지/}).click();
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(card.locator('.source-question-image')).toBeVisible();
 await expect(card.locator('.transcription-text')).toHaveCount(0);
 await page.locator('.session-tools').getByRole('button',{name:/설정/}).click();
 await settings.getByRole('button',{name:/OCR 텍스트/}).click();
 await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
 await expect(card.locator('.question-text')).toContainText('과잉공기량');
 for(const theme of ['dark','light']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await expect(card.locator('.question-text')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await card.screenshot({path:'/private/tmp/cbt-image-text-energy.png'});
 await page.reload();
 expect(await page.evaluate(()=>localStorage.getItem('cbt-explanation-display-v1'))).toBe('ocr');
 expect(errors).toEqual([]);
});

test('공조 임시 OCR·원문 복귀·교재 데이터 첫 화면 분리',async({page},info)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  localStorage.setItem('cbt-explanation-display-v1','ocr');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/?safe=1');
 if((page.viewportSize()?.width||1440)<=900) await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 expect(requests.some(url=>/textbookPages-v|\/data\/image-text\//.test(url))).toBe(false);
 await page.locator('#round-card-hvac-20261').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').first();
 await expect(card.locator('.question-text')).toContainText('다음 설명 중 옳지 않은 것은?');
 await expect(card.locator('.question-transcription-control')).toContainText('임시');
 expect(requests.some(url=>url.includes('/data/image-text/hvac.json'))).toBe(true);
 expect(requests.some(url=>url.includes('textbookPages-v'))).toBe(false);
 await card.locator('.choice-button').first().click();
 await card.locator('.question-transcription-control').getByRole('button',{name:'이미지로 보기',exact:true}).click();
 await expect(card.locator('.source-question-image')).toHaveAttribute('src',/assets\/problem-webp90\//);
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await card.screenshot({path:`/private/tmp/cbt-v60-ocr-${info.project.name}.png`});
});

test('OCR 파일을 받지 못하면 원문을 풀 수 있음',async({page},info)=>{
 test.skip(info.project.name!=='desktop','네트워크 실패 회귀는 한 번만 실행합니다.');
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');
  localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');
  localStorage.setItem('cbt-explanation-display-v1','ocr');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.route('**/data/image-text/hvac.json?*',route=>route.abort());
 await page.goto('/?safe=1');
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.locator('#round-card-hvac-20261').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').first();
 await expect(card.locator('.source-question-image')).toHaveAttribute('src',/assets\/problem-webp90\//);
 await card.locator('.image-answer-hotspot').first().click();
 await expect(card.locator('.image-answer-hotspot.selected')).toHaveCount(1);
});
