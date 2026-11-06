import {chromium, devices} from '@playwright/test';

// Repeatable lab measurement, not an Android/iOS hardware benchmark.
const base = new URL(process.env.CBT_TEST_URL || 'http://127.0.0.1:4248/');
const browser = await chromium.launch({channel:'chrome'});
const samples = {};
try {
  for(let run=0;run<3;run++){
    const {defaultBrowserType,...phone}=devices['iPhone 14 Pro'];
    const context=await browser.newContext({...phone,serviceWorkers:'block'});
    try{
      await context.addInitScript(()=>{
        localStorage.setItem('modern-cbt-qualification-industrial','hvac');
        localStorage.setItem('cbt-textbook-selected','hansol');
        sessionStorage.setItem('unified-cbt-ios-pwa-popup-seen-v351','true');
        sessionStorage.setItem('unified-cbt-android-apk-popup-seen-v351','true');
      });
      const page=await context.newPage();
      page.setDefaultTimeout(20000);
      const cdp=await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:75,downloadThroughput:1_250_000,uploadThroughput:400_000,connectionType:'cellular4g'});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.addLocatorHandler(page.locator('.pwa-error-notice'),()=>page.locator('.pwa-error-notice').getByRole('button',{name:'나중에',exact:true}).click());
      const main=page.locator('.app-frame');
      const sidebar=page.locator('.sidebar');
      const menu=()=>page.getByRole('button',{name:'메뉴 열기',exact:true}).click();
      const round=()=>sidebar.getByRole('button',{name:/회차별 문제/}).click();
      await page.goto(new URL('?safe=1',base).href,{waitUntil:'domcontentloaded'});
      await main.waitFor();
      const requests=[];
      page.on('requestfinished',r=>{if(r.resourceType()==='script'||r.resourceType()==='image')requests.push(new URL(r.url()).pathname.split('/').at(-1));});
      async function measure(name,action,ready){
        const start=performance.now(),index=requests.length;
        await action();
        await ready();
        (samples[name]??=[]).push({ms:Math.round(performance.now()-start),files:[...new Set(requests.slice(index))]});
      }
      await menu();await round();
      await measure('bookLibrary',()=>page.getByRole('button',{name:'교재 페이지별',exact:true}).click(),async()=>{
        await page.locator('.textbook-library .library-open:enabled').first().waitFor();
        await page.locator('.textbook-library .contents-tree').waitFor();
      });
      await page.getByRole('button',{name:'쪽번호로 바로 열기 ↗',exact:true}).click();
      const dialog=page.locator('.library-page-dialog');
      await dialog.getByRole('textbox',{name:'쪽번호',exact:true}).fill('4-9');
      const visibleImage=async()=>{
        const img=page.locator('.book-sheet .source-question-image,.book-sheet .direct-question-parts img').first();
        await img.waitFor();
        await img.evaluate(el=>el.decode());
      };
      await measure('bookPage',()=>dialog.getByRole('button',{name:'문제 풀기 →',exact:true}).click(),visibleImage);
      await measure('nextBookPage',()=>page.getByRole('button',{name:'다음 쪽 →',exact:true}).click(),async()=>{
        await page.locator('.book-sheet footer strong').getByRole('button',{name:'4-10쪽 · 쪽번호 선택'}).waitFor();
        await visibleImage();
      });
      await page.getByRole('button',{name:'교재 목록으로 돌아가기',exact:true}).click();
      await menu();
      await sidebar.getByRole('button',{name:/계산문제만 풀기/}).click();
      await measure('formulaTool',()=>page.getByRole('button',{name:'수식 계산 실험',exact:true}).click(),()=>page.locator('.formula-workbench-result .answer').waitFor());
      await menu();await round();
      await page.getByRole('combobox',{name:'현재 화면의 자격증 종목',exact:true}).dispatchEvent('change');
      await page.locator('#round-card-hvac-20261').getByRole('button',{name:'CBT 시험모드',exact:true}).click();
      const firstCard=page.locator('.session-shell .question-card').first();
      await firstCard.waitFor();
      const firstId=await firstCard.getAttribute('id');
      const next=page.locator('.pager-next:visible,.compact-next:visible').first();
      await measure('nextCbtPage',()=>next.click(),async()=>{
        if(!firstId)throw new Error('Expected a stable question card id');
        await page.locator(`.session-shell [id="${firstId}"]`).waitFor({state:'hidden'});
        await firstCard.waitFor();
      });
    } finally {await context.close();}
  }
} finally {await browser.close();}
for(const [name,rows] of Object.entries(samples)){
  const times=rows.map(r=>r.ms).sort((a,b)=>a-b);
  console.log(JSON.stringify({name,medianMs:times[1],times,files:[...new Set(rows.flatMap(r=>r.files))]}));
}
