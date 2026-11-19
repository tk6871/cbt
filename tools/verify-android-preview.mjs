import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {_android, expect} from '@playwright/test';

const pkg='com.tk6871.cbt.preview';
const serial=execFileSync('adb',['-d','get-serialno'],{encoding:'utf8'}).trim();
const adb=(...args)=>execFileSync('adb',['-s',serial,...args],{encoding:'utf8',timeout:20000}).trim();
const origin='https://localhost';
const samples=[
  {book:'hansol',button:/한솔 공조 교재/,page:'1-168',number:25,choice:2,x:318/671,y:158/250},
  {book:'energy',button:/에너지설비 교재/,page:'414',number:16,choice:3,x:65/445,y:212/243},
];

async function openInstalledApp(device){
  adb('shell','am','start','-W','-n',pkg+'/com.tk6871.cbt.MainActivity');
  const webview=await device.webView({pkg},{timeout:30000});
  const page=await webview.page();
  page.setDefaultTimeout(20000);
  await page.waitForFunction(()=>window.Capacitor?.isNativePlatform()&&document.documentElement.dataset.nativeApp==='true');
  assert.equal(new URL(page.url()).origin,origin);
  assert.equal(await page.locator('html').getAttribute('data-bundled-assets'),'true');
  // Block external HTTP in this WebView only, then reload from the APK.
  const external=[];
  await page.route(/^https?:\/\//,route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(new URL(route.request().url()).origin);
    return route.abort();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  return {page,external};
}

async function printedChoice(page,sample,restore=false){
  await page.goto(origin+'/?safe=1#/study/home');
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
  const library=page.locator('.textbook-library');
  const book=library.locator('.library-books').getByRole('button',{name:sample.button});
  if(await book.getAttribute('aria-pressed')!=='true')await book.click();
  await library.locator('.contents-tree').waitFor();
  await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
  const picker=library.locator('.library-page-dialog');
  await picker.getByRole('textbox').fill(sample.page);
  await picker.getByRole('textbox').press('Enter');
  const card=page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 '+sample.number+'번',exact:true})});
  const stage=card.locator(sample.book==='energy'?'.source-image-stage':'.direct-question-parts .direct-viewport').first();
  const source=await stage.locator('img').evaluate(async img=>{await img.decode();return {url:img.currentSrc,width:img.naturalWidth};});
  assert.equal(new URL(source.url).origin,origin);
  assert.ok(source.width>100);
  const choice=stage.getByRole('button',{name:'이미지에서 '+sample.choice+'번 선택',exact:true});
  if(!restore){
    const cdp=await page.context().newCDPSession(page);
    try{
      const tap=async()=>{
        await stage.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
        await expect.poll(()=>stage.evaluate((el,s)=>{
          const r=el.getBoundingClientRect();
          return document.elementFromPoint(r.x+r.width*s.x,r.y+r.height*s.y)?.closest('button')?.getAttribute('aria-label');
        },sample)).toBe('이미지에서 '+sample.choice+'번 선택');
        const bounds=await stage.boundingBox();
        assert.ok(bounds);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+sample.x*bounds.width,y:bounds.y+sample.y*bounds.height}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      };
      if(await choice.getAttribute('aria-pressed')==='true'){await tap();await expect(choice).toHaveAttribute('aria-pressed','false');}
      await tap();
    }finally{await cdp.detach();}
  }
  await expect(choice).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(s=>{
    if(s.book==='hansol')return Number(localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-'+s.page+'-'+s.number));
    const saved=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}').progress?.textbookPageAnswersV1||{};
    return Object.entries(saved).find(([id])=>id.startsWith('book-study::energy::'+s.page+'::'+s.number+'::'))?.[1];
  },sample)).toBe(sample.choice);
  console.log('PASS',restore?'restored after force-stop':'saved printed choice',sample.book,sample.page,sample.number,sample.choice);
}

async function shellModel(page){
  async function question(){
    await page.goto(origin+'/?safe=1#/study/rounds');
    const start=page.locator('#round-card-hvac-20080727').getByRole('button',{name:/^(학습모드|이어 학습)$/});
    await start.click();
    const bar=page.getByRole('navigation',{name:'Android 풀이 도구'});
    await bar.waitFor();
    const card=page.locator('#session-question-13');
    for(let count=0;count<80 && !await card.count();count++){
      const first=page.locator('[id^="session-question-"]').first();
      const id=await first.getAttribute('id');
      const direction=Number(id.split('-').at(-1))<13 ? /다음/ : /이전/;
      await bar.getByRole('button',{name:direction}).click();
      await expect(first).not.toHaveAttribute('id',id);
    }
    const open=card.getByRole('button',{name:/3D로 .*열교환기 보기/});
    if(!await open.isVisible())await card.locator('.choice-button').nth(3).click();
    return {open,card};
  }
  await page.goto(origin+'/?safe=1#/study/settings');
  await page.getByRole('button',{name:'해설·이미지',exact:true}).click();
  const enable=page.locator('[data-setting=mobileModel]').getByRole('button',{name:'눌러서 3D 보기 허용'});
  const prev=await enable.getAttribute('aria-pressed');
  if(prev!=='true')await enable.click();
  const {open,card}=await question();
  await open.click();
  const slot=card.locator('.model-slot');
  const canvas=slot.locator('canvas');
  await expect(canvas).toBeVisible();
  // Capacitor's intercepted asset loads appear in the WebView's resource timings.
  await expect.poll(()=>page.evaluate(()=>performance.getEntriesByName(
    new URL('/assets/equipment/shell-and-tube.glb',location.origin).href
  ).filter(entry=>entry.duration>=0).length)).toBeGreaterThan(0);
  const before=await canvas.screenshot();
  await slot.getByRole('button',{name:'오른쪽 회전'}).click();
  await expect.poll(async()=>before.equals(await canvas.screenshot())).toBe(false);
  await slot.getByRole('button',{name:'동체 측 입·출구 강조'}).click();
  await expect(slot.getByRole('button',{name:'동체 측 입·출구 강조'})).toHaveAttribute('aria-pressed','true');
  await slot.getByRole('button',{name:'3D 접기'}).click();
  await expect(slot.locator('canvas')).toHaveCount(0);
  {
    await page.goto(origin+'/?safe=1#/study/settings');
    await page.getByRole('button',{name:'해설·이미지',exact:true}).click();
    const off=page.locator('[data-setting=mobileModel] button').first();
    await off.click();
    await expect(off).toHaveAttribute('aria-pressed','true');
  }
  await page.goto(origin+'/?safe=1#/study/home');
  console.log('PASS bundled heat-exchanger model, rotation, part highlight, close');
}

assert.match(adb('shell','pm','path',pkg),/^package:/);
const devices=await _android.devices({omitDriverInstall:true});
try{
  const device=devices.find(d=>d.serial()===serial);
  assert.ok(device,'USB Android device unavailable');
  let app=await openInstalledApp(device);
  for(const sample of samples)await printedChoice(app.page,sample);
  assert.deepEqual(app.external,[]);
  adb('shell','am','force-stop',pkg);
  await expect.poll(()=>device.webViews().filter(v=>v.pkg()===pkg).length).toBe(0);
  app=await openInstalledApp(device);
  for(const sample of samples)await printedChoice(app.page,sample,true);
  await shellModel(app.page);
  assert.deepEqual(app.external,[]);
  console.log('PASS external HTTP requests during offline checks:',app.external.length);
}finally{await Promise.all(devices.map(device=>device.close()));}
