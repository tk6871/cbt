import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {problemImage,problemImageHtml} from '../src/cbt/problemImages';
import display from '../data/problem-images-webp90.json' with {type:'json'};
import {textbookDirectImage,textbookDirectPageMap} from '../src/cbt/textbookPages';
import {enterBookReader,chooseBookPage,switchTextbook} from './textbook-reader-test-helpers';
import {rasterDimensions} from './raster-dimensions.mjs';
test.use({serviceWorkers:'block'});
test('전 과목 대체표·해상도·원래 URL/HTML/기록 분리',()=>{
 test.skip(test.info().project.name!=='desktop','동일 파일 전수 검사는 PC에서 한 번만 실행합니다.');
 const mappings:Record<string,string>=display.mappings;
 expect(Object.keys(mappings)).toHaveLength(17605);
 const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const auditPath='data/problem-images-webp90-audit.json';
 const audit=fs.existsSync(auditPath)?JSON.parse(fs.readFileSync(auditPath,'utf8')).entries:JSON.parse(fs.readFileSync('work/problem-webp90/audit.json','utf8')).entries;
 for(const [source,target] of Object.entries(mappings)){
  assert.match(target,/^assets\/problem-webp90\/[a-f0-9]{32}\.webp$/);
  assert.deepEqual(rasterDimensions(target),audit[source].size);
  assert.equal(sha(target),audit[source].sha256);
  assert.equal(problemImage(source),target);
 }
 const first=Object.keys(mappings)[0]!,replacement=mappings[first];
 expect(problemImage(`./${first}?x=1#q`)).toBe(`./${replacement}?x=1#q`);
 expect(problemImage(`/cbt/${first}`)).toBe(`/cbt/${replacement}`);
 expect(problemImage(`https://tk6871.github.io/cbt/${first}`)).toBe(`https://tk6871.github.io/cbt/${replacement}`);
 expect(problemImage(`https://example.com/${first}`)).toBe(`https://example.com/${first}`);
 expect(problemImage('assets/theme/example.png')).toBe('assets/theme/example.png');
 expect(problemImage('blob:example')).toBe('blob:example');
 expect(problemImageHtml(`<p>수식 Q=mcΔT</p><img src="${first}"><img src='${first}'><img src=${first}>`)).toContain(`<img src="${replacement}">`);
 const guards=JSON.parse(fs.readFileSync('tools/hansol-direct-boundary-review.json','utf8')).preservedFiles;
 for(const [p,expected] of Object.entries(guards))expect(sha(p)).toBe(expected);
});
test('교재 문제/해설·선택 좌표·확대·테마와 모바일 화면',async({page},info)=>{
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');localStorage.setItem('unified-cbt-answer-layout','hotspot');
  sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');
 await expect(page.locator('.ios-pwa-floating-trigger,.ios-pwa-popup')).toHaveCount(0);
 if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
 await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 if(!await page.locator('.textbook-library').isVisible())await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 await enterBookReader(page);
 await chooseBookPage(page,'1-25');
 const card=page.locator('[data-source-id="hansol-direct-1-25-16"]');
 const im=card.locator('.direct-question-parts img').first();
 await expect(im).toHaveAttribute('src',problemImage(textbookDirectImage(textbookDirectPageMap.get('1-25')!).asset)!);
 await im.evaluate((el:HTMLImageElement)=>el.decode());
 await expect(im).toHaveJSProperty('naturalWidth',2684);
 await card.getByRole('button',{name:'②',exact:true}).click();await expect(card.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 await card.locator('.direct-solution>summary').click();
 await expect(card.locator('.direct-solution-parts img')).toHaveAttribute('src',/assets\/problem-webp90\//);
 for(const theme of ['dark','light']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const filter=await im.evaluate(el=>getComputedStyle(el).filter);if(theme==='dark')expect(filter).toContain('invert');else expect(filter).toBe('none');}
 await card.locator('.direct-full-page>summary').click();await expect(card.locator('.direct-full-page a')).toHaveAttribute('href',/assets\/problem-webp90\//);
 await card.screenshot({path:`/private/tmp/webp90-book-${info.project.name}.png`});
 await switchTextbook(page,'energy');await chooseBookPage(page,'450');
 const energy=page.locator('.book-sheet-question .question-card').first();
 await expect(energy.locator('.source-image-stage>img')).toHaveAttribute('src',/assets\/problem-webp90\//);
 const choice=energy.locator('.image-answer-hotspot').first();await choice.click();await expect(choice).toHaveClass(/selected/);
 await expect(energy.locator('.explanation-box')).toBeVisible();
 for(const image of await energy.locator('.explanation-box img').all())await expect(image).toHaveAttribute('src',/assets\/problem-webp90\//);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('일반 CBT와 필답형 그림·확대창도 압축본 연결',async({page},info)=>{
 test.skip(info.project.name!=='desktop','대표 추가 화면은 PC에서 검사합니다.');
 await page.addInitScript(()=>{
  localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');
  localStorage.setItem('unified-cbt-answer-layout','hotspot');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
 });
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
 await page.locator('#round-card-hvac-20262').getByRole('button',{name:'학습모드',exact:true}).click();
 const card=page.locator('.question-card').first(),image=card.locator('.source-image-stage>img');
 await expect(image).toHaveAttribute('src',/assets\/problem-webp90\//);await image.evaluate((im:HTMLImageElement)=>im.decode());
 const answer=card.locator('.image-answer-hotspot').first();await answer.click();await expect(answer).toHaveClass(/selected/);
 await page.goto('/?safe=1');await page.locator('.sidebar').getByRole('button',{name:/시험 자료실/}).click();
 await page.getByRole('button',{name:'필답형 문제풀이',exact:true}).click();
 await page.locator('.practical-library-tabs').getByRole('button',{name:/추가 자료/}).click();
 await page.locator('.practical-material-library').getByRole('button',{name:/^WEB 공개 자료/}).click();
 const practical=page.locator('.practical-prompt-image').first();
 await expect(practical).toHaveAttribute('src',/assets\/problem-webp90\//);await practical.evaluate((im:HTMLImageElement)=>im.decode());
 await practical.locator('..').click();
 const lightbox=page.locator('.practical-image-dialog[open]');
 await expect(lightbox.locator('img')).toHaveAttribute('src',/assets\/problem-webp90\//);
 await lightbox.locator('img').click();await expect(lightbox).toHaveCount(0);
});
