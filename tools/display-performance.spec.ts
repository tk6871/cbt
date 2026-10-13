import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  // This suite blocks service workers deliberately; dismiss that test-only notice.
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), async () => {
    await page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click();
  });
  await page.addInitScript(() => {
    localStorage.setItem('modern-cbt-qualification-industrial', 'energy-midterm');
    localStorage.setItem('unified-cbt-answer-layout', 'hotspot');
    localStorage.setItem('unified-cbt-dynamic-ui', 'false');
    sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351', 'true');
    sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351', 'true');
  });
});
async function start(page: Page) {
  await page.goto('./?safe=1');
  if ((page.viewportSize()?.width || 1440) <= 900) await page.getByRole('button', {name:'메뉴 열기',exact:true}).click();
  await page.locator('.sidebar').getByRole('button', {name:/회차별 문제/}).click();
  const round=page.locator('#round-card-school-energy-topic-1');
  await round.scrollIntoViewIfNeeded();
  await round.getByRole('button', {name:'CBT 시험모드',exact:true}).click();
  await expect(page.locator('.source-question-image').first()).toBeVisible();
}
test('원본 보존·경량 사본 용량과 경로',()=>{
  const manifest=JSON.parse(fs.readFileSync('data/responsive-images.json','utf8'));
  for(const [path,entry] of Object.entries(manifest) as [string,any][]){
    const original=fs.statSync(path).size;
    for(const variant of entry.variants){
      expect(variant.width).toBeLessThan(entry.width);
      expect(fs.statSync(variant.src).size).toBeLessThan(original*.7);
    }
  }
  expect(Object.keys(manifest).filter(k=>k.includes('energy-textbook'))).toHaveLength(382);
});
test('반응형 원문·답안 영역·확대 원본·다크/라이트·스크롤',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const card=page.locator('.question-card').first(),image=card.locator('.source-question-image');
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await expect(image).toHaveAttribute('srcset',/assets\/responsive/);
  const original=await image.getAttribute('src');
  const buttons=card.locator('.image-answer-hotspot');
  for(let i=0;i<4;i++){
    await buttons.nth(i).click();await expect(buttons.nth(i)).toHaveClass(/selected/);
    await buttons.nth(i).click();await expect(buttons.nth(i)).not.toHaveClass(/selected/);
  }
  for(const theme of ['dark','light']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    const filter=await image.evaluate(el=>getComputedStyle(el).filter);
    expect(filter.includes('invert')).toBe(theme==='dark');
  }
  await card.locator('.source-image-zoom-hint').click();
  const zoom=page.locator('.question-image-lightbox img');
  await expect(zoom).toHaveAttribute('src',original!);
  await expect(zoom).not.toHaveAttribute('srcset');
  await page.getByRole('button',{name:'확대 이미지 닫기',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`/private/tmp/display-performance-${info.project.name}.png`});
  expect(errors).toEqual([]);
});
test('전체화면 FHD/4K에서도 문제 폭과 글자 크기 유지·OMR',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await start(page);
  let fhd=0;
  for(const width of [960,1920,3840]){
    await page.setViewportSize({width,height:1080});
    const columns=page.locator('.question-columns');
    await expect.poll(()=>columns.evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(1440);
    const size=await page.locator('.question-card').first().evaluate(el=>el.getBoundingClientRect().width);
    if(width===1920)fhd=size;
    if(width===3840)expect(Math.abs(size-fhd)).toBeLessThan(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:/OMR 열기/}).first().click();
  await expect(page.locator('.omr-sheet')).toBeVisible();
  expect(await page.locator('.question-columns').evaluate(el=>el.getBoundingClientRect().width)).toBeLessThanOrEqual(1440);
  await page.screenshot({path:'/private/tmp/display-performance-4k.png'});
});
test('경량 파일을 못 받으면 원본 재시도',async({page})=>{
  await page.route('**/assets/responsive/**',route=>route.abort());
  await start(page);
  const image=page.locator('.source-question-image').first();
  // Force the optional candidate even on a high-DPR device.
  const manifest=JSON.parse(fs.readFileSync('data/responsive-images.json','utf8'));
  const candidate=manifest[(await image.getAttribute('src'))!].variants[0].src;
  await image.evaluate((el:HTMLImageElement,candidate)=>{
    el.srcset=`${candidate} 1x`;el.removeAttribute('sizes');
  },candidate);
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0&&!el.hasAttribute('srcset'))).toBe(true);
});
test('테마 아이콘은 작은 사본·목록 모션은 보이는 카드만',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await page.setViewportSize({width:1440,height:1800});
  const brokenAssets:string[]=[];
  page.on('response',response=>{if(response.status()>=400&&response.url().includes('/assets/'))brokenAssets.push(response.url());});
  await page.addInitScript(()=>{
    localStorage.setItem('unified-cbt-dynamic-ui','true');
    localStorage.setItem('unified-cbt-visual-style','simpsons');
  });
  await page.goto('./');
  const icon=page.locator('.theme-nav-character').first();
  await expect(icon).toHaveAttribute('sizes','64px');
  await expect.poll(()=>icon.evaluate((el:HTMLImageElement)=>el.complete&&el.currentSrc.includes('/responsive/'))).toBe(true);
  await page.locator('.sidebar').getByRole('button',{name:/회차별 문제/}).click();
  await expect(page.locator('.round-card').first()).toBeVisible();
  // Motion can animate transform/opacity through JS rather than WAAPI.
  await expect.poll(()=>page.locator('.round-card').evaluateAll(elements=>elements.filter(el=>(el as HTMLElement).style.opacity!=='').length),{intervals:[50,50,100]}).toBeGreaterThan(0);
  const targets=await page.locator('.round-card').evaluateAll(elements=>elements.filter(el=>(el as HTMLElement).style.opacity!=='').map(el=>{
    const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom};
  }));
  expect(targets.length).toBeGreaterThan(0);
  expect(targets.length).toBeLessThanOrEqual(16);
  for(const r of targets){expect(r.top).toBeLessThan((page.viewportSize()!.height)+50);expect(r.bottom).toBeGreaterThan(-50);}
  await page.screenshot({path:'/private/tmp/display-performance-theme.png'});
  expect(brokenAssets).toEqual([]);
});
