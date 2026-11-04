import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
const folder='work/private-notes/image-quality-sample';
test.use({serviceWorkers:'block'});
test('기존 이미지12문제 비교·선택/풀이·다크·확대·별도 기록',async({page})=>{
 const data=JSON.parse(fs.readFileSync(`${folder}/sample-data.json`,'utf8'));
 expect(data.entries).toHaveLength(12);expect(new Set(data.entries.map((e:any)=>e.id)).size).toBe(12);
 expect(data.pages).toHaveLength(11);
 for(const kind of ['original','improved'])expect(data.totals[kind]).toBe(data.pages.reduce((s:number,p:any)=>s+fs.statSync(p[kind].asset).size,0));
 expect(data.entries[2].questionParts[0].rect).toEqual([671,557,671,262]);
 expect(data.entries[10].questionParts[0].rect).toEqual([0,1193,671,258]);
 expect(data.entries[11].id).toBe('sample-book-2-213-112');
 await page.goto(`/${folder}/index.html`);
 await expect(page.locator('.sample')).toHaveCount(12);
 await expect(page.locator('#totals')).toContainText('73.2%');
 for(const card of await page.locator('.sample').all()){
  await card.scrollIntoViewIfNeeded();
  const images=card.locator('.panel img');await expect(images).toHaveCount(2);
  await images.evaluateAll(async imgs=>{await Promise.all(imgs.map(async im=>{const el=im as HTMLImageElement;el.loading='eager';await el.decode();}));});
  const w=await card.locator('.stage').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
  expect(w[0]).toBeCloseTo(w[1],1);
 }
 const first=page.locator('#sample-1');await first.scrollIntoViewIfNeeded();
 await first.getByRole('button',{name:'②',exact:true}).click();
 await first.locator('summary').click();await expect(first.locator('.solution img')).toHaveCount(4);
 await first.locator('.solution img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async im=>{const el=im as HTMLImageElement;el.loading='eager';await el.decode();}));});
 await page.getByRole('button',{name:'다크모드',exact:true}).click();
 expect(await first.locator('img').first().evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 await page.getByRole('button',{name:'원해상도로 풀기',exact:true}).click();
 await expect(first.locator(':scope>.panels .panel')).toHaveCount(1);
 await expect(first.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(first.locator('details')).toHaveAttribute('open','');
 await page.locator('#zoom').fill('150');
 await expect(page.locator('#zoom-label')).toHaveText('150%');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await first.getByRole('button',{name:'원해상도로 충분',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cbt-image-quality-sample-v1')||'{}'));
 expect(saved[data.entries[0].id]).toEqual({choice:2,vote:'original'});
 expect(await page.evaluate(()=>localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-1-25-16'))).toBeNull();
 await page.locator('#zoom').fill('100');await page.getByRole('button',{name:'나란히 비교',exact:true}).click();
 await first.screenshot({path:'/private/tmp/image-quality-sample-01.png'});
 await page.getByRole('button',{name:'라이트모드',exact:true}).click();
 await page.locator('#sample-11').screenshot({path:'/private/tmp/image-quality-sample-11.png'});
 await page.locator('#sample-3').screenshot({path:'/private/tmp/image-quality-sample-03.png'});
 await page.locator('#sample-12').screenshot({path:'/private/tmp/image-quality-sample-12.png'});
 await page.reload();await expect(first.getByRole('button',{name:'②',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(first.getByRole('button',{name:'원해상도로 충분',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('업스케일 유지 압축12문제: 동일 픽셀·3후보·원문 보존·풀이와 기록',async({page})=>{
 const dir='work/private-notes/image-compression-sample';
 const data=JSON.parse(fs.readFileSync(`${dir}/sample-data.json`,'utf8'));
 expect(data.compression).toBe(true);expect(data.entries).toHaveLength(12);expect(data.pages).toHaveLength(11);
 expect(data.variants.map((v:any)=>v.key)).toEqual(['improved','webp95','webp90','jpeg95']);
 for(const variant of data.variants){
  expect(data.totals[variant.key]).toBe(data.pages.reduce((sum:number,p:any)=>sum+fs.statSync(p[variant.key].asset).size,0));
  for(const p of data.pages){
   expect(p[variant.key].pixels).toEqual(p.improved.pixels);
   expect(crypto.createHash('sha256').update(fs.readFileSync(p[variant.key].asset)).digest('hex')).toBe(p[variant.key].sha256);
  }
 }
 const guards=JSON.parse(fs.readFileSync('tools/hansol-direct-boundary-review.json','utf8')).preservedFiles;
 for(const [path,sha] of Object.entries(guards))expect(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')).toBe(sha);
 await page.goto(`/${dir}/index.html`);
 await expect(page.locator('.sample')).toHaveCount(12);
 await expect(page.locator('#left-kind')).toHaveValue('improved');await expect(page.locator('#right-kind')).toHaveValue('webp95');
 const first=page.locator('#sample-1');
 await first.getByRole('button',{name:'③',exact:true}).click();await first.locator('summary').click();
 // Element screenshots should not contain the sticky viewport toolbar in
 // the middle of a tall problem. This changes only the test's capture style.
 await page.locator('header').evaluate(el=>el.style.position='static');
 for(const kind of ['webp95','webp90','jpeg95']){
  await page.locator('#right-kind').selectOption(kind);
  await expect(first.locator('details')).toHaveAttribute('open','');
  await expect(first.getByRole('button',{name:'③',exact:true})).toHaveAttribute('aria-pressed','true');
  for(const card of await page.locator('.sample').all()){
   await card.scrollIntoViewIfNeeded();
   const imgs=card.locator(':scope>.panels img');await expect(imgs).toHaveCount(2);
   const sizes=await imgs.evaluateAll(async elements=>Promise.all(elements.map(async el=>{const im=el as HTMLImageElement;im.loading='eager';await im.decode();return [im.naturalWidth,im.naturalHeight,im.getBoundingClientRect().width];})));
   expect(sizes[0]).toEqual(sizes[1]);
  }
  await page.locator('#sample-12').screenshot({path:`/private/tmp/compressed-${kind}-drawing.png`});
 }
 await page.locator('#right-kind').selectOption('webp95');
 await page.locator('#sample-10 summary').click();
 await page.locator('#sample-10').screenshot({path:'/private/tmp/compressed-webp95-formula-light.png'});
 await page.getByRole('button',{name:'다크모드',exact:true}).click();
 await page.locator('#zoom').fill('150');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('#zoom').fill('100');
 await page.locator('#sample-12 summary').click();
 await page.locator('#sample-12').screenshot({path:'/private/tmp/compressed-webp95-drawing-dark.png'});
 expect(await page.locator('#sample-12 img').first().evaluate(el=>getComputedStyle(el).filter)).toContain('invert');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'오른쪽 선택본으로 풀기',exact:true}).click();
 await expect(first.locator(':scope>.panels .panel')).toHaveCount(1);
 await first.getByRole('button',{name:'압축 WebP · 품질 95면 충분',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cbt-image-compression-sample-v1')||'{}'));
 expect(saved[data.entries[0].id]).toEqual({choice:3,vote:'webp95'});
 expect(await page.evaluate(()=>localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-1-25-16'))).toBeNull();
 await page.reload();await expect(first.getByRole('button',{name:'③',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(first.getByRole('button',{name:'압축 WebP · 품질 95면 충분',exact:true})).toHaveAttribute('aria-pressed','true');
});
