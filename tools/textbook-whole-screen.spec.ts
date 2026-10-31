import {test,expect} from '@playwright/test';
import {openBookNavigator,chooseBookPage,switchTextbook} from './textbook-reader-test-helpers';
import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
import screenLinks from '../data/hansol-screen-links.json' with {type:'json'};
import audit from '../data/textbook-page-audit.json' with {type:'json'};
import examples from '../data/textbook-worked-examples.json' with {type:'json'};
import {textbookEntries,textbookAssetUrl} from '../src/cbt/textbookPages';
import {bookContents} from '../src/cbt/textbookContents';
import {rasterDimensions} from './raster-dimensions.mjs';
test.use({serviceWorkers:'block'});
test('전체 화면 대조의 연결 범위·기존 기록 보존·목차·비공개 원문 제외',()=>{
 expect(audit.normalScreensRead).toBe(620);expect(audit.columnOcrRegions).toBe(2480);expect(audit.readerEndObserved).toBe(true);expect(audit.readerSettingsRestored).toBe(true);
 expect(audit.status).toContain('review-continues');expect(audit.pages.length).toBeGreaterThan(1100);
 expect(audit.sourceImagesRechecked).toBe(1529);expect(audit.sourceImageCandidatesCompared).toBe(1362);
 expect(new Set(audit.pages.map(r=>r.page)).size).toBe(audit.pages.length);
 for(const row of audit.pages){expect(row.linkedPositions).toBe(textbookEntries.filter(e=>e.book==='hansol'&&e.page===row.page&&e.sourceId).length);expect(row.heldPositions).toBe(textbookEntries.filter(e=>e.book==='hansol'&&e.page===row.page&&e.reviewHold).length);expect(row.unconfirmedCandidates).toBeGreaterThanOrEqual(0);expect(row).not.toHaveProperty('stem');}
 expect(screenLinks.rows.length).toBeGreaterThan(1000);
 const sizeEntry=textbookEntries.find(e=>e.book==='hansol'&&e.page==='4-10'&&e.number===17)!;expect(sizeEntry.imageSize).toEqual(rasterDimensions('assets/hvac-hansol/questions/2024_1/06.webp'));
 const sha=(p:string)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 for(const [path,hash] of Object.entries(screenLinks.sourceHashes))expect(sha(path)).toBe(hash);
 const unique=new Set<string>();for(const r of screenLinks.rows){
  const key=`${r.page}:${r.number}`;expect(unique.has(key)).toBe(false);unique.add(key);
  const entry=textbookEntries.find(e=>e.book==='hansol'&&e.page===r.page&&e.number===r.number)!;expect(entry.sourceId).toBe(r.sourceId);expect(entry.fingerprint).toBeTruthy();
  expect(r.method).toBe('exact-stem-four-ordered-choices-printed-key');expect(r.variants.length).toBeGreaterThan(0);
  expect(r).not.toHaveProperty('stem');expect(r).not.toHaveProperty('choices');expect(r).not.toHaveProperty('bounds');
 }
 for(let part=1;part<=5;part++)expect(screenLinks.rows.some(r=>r.page.startsWith(`${part}-`))).toBe(true);
 const before=JSON.parse(execFileSync('git',['show','HEAD:data/textbook-pages.json'],{encoding:'utf8'})).entries;
 for(const old of before.filter((e:any)=>e.sourceId)){const now=textbookEntries.find(e=>e.book===old.book&&e.page===old.page&&e.number===old.number);expect(now?.sourceId).toBe(old.sourceId);}
 const mock=bookContents.hansol.find(n=>n.id==='hansol-mock')!.children!;expect(mock).toHaveLength(15);expect(mock[0].from).toBe('4-7');expect(mock[14].to).toBe('4-195');expect(mock.every(n=>n.from&&n.to&&!n.pages)).toBe(true);
 const latest=bookContents.hansol.find(n=>n.id==='hansol-latest')!.children!;expect(latest).toHaveLength(9);expect(latest.map(n=>n.from)).toEqual(['5-4','5-16','5-27','5-39','5-51','5-64','5-75','5-86','5-98']);
 expect(textbookAssetUrl('assets/sample.webp',true)).toBe('https://tk6871.github.io/cbt/assets/sample.webp');expect(textbookAssetUrl('assets/sample.webp',false)).toBe('assets/sample.webp');
});
test('본문 예제는 객관식과 분리하고 원본·업스케일·계산 합계를 확인',()=>{
 expect(examples.entries).toHaveLength(1);const e=examples.entries[0];expect(e.pages).toEqual(['88','89']);expect(e.kind).toBe('worked-example');expect(e.answer).toBe('89.125 TOE');
 expect((30000*1.055+80000*.215+45000*.895)/1000).toBeCloseTo(89.125,10);
 for(const row of Object.values(e.images)){
  expect(crypto.createHash('sha256').update(fs.readFileSync(row.asset)).digest('hex')).toBe(row.outputSha256);expect(row.outputSize).toEqual(row.sourceSize.map(n=>n*2));expect(row.tile).toBe(256);expect(row.native).toBe('arm64');
 }
 expect(textbookEntries.some(r=>r.sourceId===e.id)).toBe(false);
});
test('본문 예제 원문·풀이 접기와 다크/라이트를 실제 페이지에서 확인',async({page},info)=>{
 await page.addInitScript(()=>{localStorage.setItem('modern-cbt-qualification-industrial','hvac');localStorage.setItem('unified-cbt-dynamic-ui','false');sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');});
 await page.addLocatorHandler(page.locator('.pwa-error-notice'),async()=>{await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();});
 await page.goto('/?safe=1');if((page.viewportSize()?.width||1440)<=900)await page.getByRole('button',{name:'메뉴 열기',exact:true}).click();await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
 const root=page.locator('.textbook-pages');await switchTextbook(page,'energy');await chooseBookPage(page,'88');
 const example=root.locator('.book-worked-example');await expect(example).toHaveCount(1);await expect(example.locator('details')).not.toHaveAttribute('open');await expect(root.getByRole('button',{name:'범위를 모아 CBT 시험',exact:true})).toBeDisabled();
 await example.locator('summary').click();await expect(example.locator('details')).toContainText('89.125 TOE');const image=example.locator('details img');await image.evaluate((img:HTMLImageElement)=>img.decode());
 await page.evaluate(()=>document.documentElement.dataset.theme='dark');expect(await image.evaluate(img=>getComputedStyle(img).filter)).toContain('invert');await page.evaluate(()=>document.documentElement.dataset.theme='light');expect(await image.evaluate(img=>getComputedStyle(img).filter)).toBe('none');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await chooseBookPage(page,'89');await expect(root.locator('.book-worked-example')).toHaveCount(1);
 await switchTextbook(page,'hansol');await openBookNavigator(page,'info');
 await root.locator('.book-comparison-summary summary').click();
 await root.getByRole('searchbox',{name:'교재 대조 쪽 검색'}).fill('1-108');
 const auditRow=root.locator('.book-audit-list button');await expect(auditRow).toHaveCount(1);await expect(auditRow).toContainText('보류 1');
 await auditRow.scrollIntoViewIfNeeded();await page.screenshot({path:`/private/tmp/textbook-audit-v56-${info.project.name}.png`});await auditRow.click();
 await expect(root.locator('.book-sheet>footer>strong')).toHaveText('1-108');await expect(root.locator('.book-pending').filter({hasText:'면적A'})).toBeVisible();
});
