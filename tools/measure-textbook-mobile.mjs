import assert from 'node:assert/strict';
import {openMobileBrowser,mobileTestUrl,tapMobile,usbPort} from './mobile-study-browser.mjs';
import { expect } from '@playwright/test';

const base = process.env.CBT_TEST_URL || 'http://127.0.0.1:4360/';
const staticOnly = process.env.CBT_BOOK_SOURCE === 'static';
const route = process.env.CBT_BOOK_ROUTE || 'rounds';
assert.ok(['rounds','subject-home','first-visit'].includes(route), 'Unknown CBT_BOOK_ROUTE');
const firstVisit = route === 'first-visit';
const installedWorker = staticOnly && firstVisit && process.env.CBT_BOOK_PWA === '1';
const subjectHome = route === 'subject-home';
const samples = [
  {book:'hansol', page:'1-168', number:25, choice:2, x:318/671, y:158/250},
  {book:'energy', page:'414', number:16, choice:3, x:65/445, y:212/243},
];
const browser = await openMobileBrowser();
try {
  for (let run = 1; run <= 3; run++) for (const sample of samples) {
    const tab = await browser.newPage({serviceWorkers:(staticOnly && !installedWorker) || route === 'rounds' ? 'block' : 'allow'},base);
    try {
      const page=tab.page;
      const context=page.context();
      const startUrl=mobileTestUrl(page,'/',base);
      page.setDefaultTimeout(60000);
      if (staticOnly) {
        await page.route('**/cloud-config.js*', route => route.fulfill({
          contentType:'application/javascript', body:'window.CBT_CLOUD_CONFIG = {};',
        }));
      }
      if (firstVisit) await page.addInitScript(() => {
        document.addEventListener('click', event => {
          const button = event.target instanceof Element && event.target.closest('.hybrid-actions button');
          if (button && button.textContent.trim() === '교재에서 풀기') performance.mark('book-home-click');
        }, true);
      });
      if (!firstVisit) await page.addInitScript(({book,subjectHome}) => {
        localStorage.setItem('cbt-textbook-selected', book);
        if (subjectHome) localStorage.setItem('modern-cbt-qualification-industrial', book === 'energy' ? 'energy' : 'hvac');
      }, {book:sample.book,subjectHome});
      const apiFiles = [];
      const staticFiles = [];
      const hvacLayouts = [];
      const otherBookRequests = [];
      const otherBook = sample.book === 'energy' ? '(?:hvac|hansol)' : 'energy';
      const otherSource = new RegExp('/(?:data/|api/catalogs/|modern/textbook-)' + otherBook);
      const trackRequest = request => {
        if (new URL(request.url()).origin !== new URL(startUrl).origin) return;
        const path = new URL(request.url()).pathname;
        if (otherSource.test(path) || (sample.book === 'hansol' && /\/energyQuestionLayout-v\d+\.js$/.test(path))) otherBookRequests.push(path);
        if (/\/hvacQuestionLayout-v\d+\.js$/.test(path)) hvacLayouts.push(path);
      };
      context.on('request',trackRequest);
      page.once('close',()=>context.off('request',trackRequest));
      page.on('request', req => {
        const path = new URL(req.url()).pathname;
        if (path.includes('/api/catalogs/')) apiFiles.push(path.split('/').pop());
        if (path.includes('/data/') || /\/modern\/textbook-.*-sources-v\d+\.json$/.test(path)) staticFiles.push(path.split('/').pop());
      });
      const cdp = await context.newCDPSession(page);
      if (!usbPort) {
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:75,downloadThroughput:1250000,uploadThroughput:400000,connectionType:'cellular4g'});
        await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      }
      await page.addLocatorHandler(page.locator('.pwa-error-notice'), p => p.getByRole('button',{name:'나중에',exact:true}).click());
      const visit = performance.now();
      await page.goto(route === 'rounds' ? new URL('?safe=1',startUrl).href : startUrl, {waitUntil:'commit'});
      const home = page.getByRole('button',{name:firstVisit ? '교재에서 풀기' : '회차별 기출 고르기',exact:true});
      await home.click({trial:true});
      assert.equal(await page.locator('.hybrid-cover').getAttribute('data-subject'), subjectHome && sample.book === 'energy' ? 'energy' : 'hvac');
      const homeMs = Math.round(performance.now()-visit);
      if (process.env.CBT_HOME_TRACE && run === 1) {
        const resources = await page.evaluate(() => performance.getEntriesByType('resource')
          .map(r => ({file:new URL(r.name).pathname.split('/').pop(),start:Math.round(r.startTime),end:Math.round(r.responseEnd),bytes:r.encodedBodySize}))
          .sort((a,b)=>a.start-b.start));
        console.error(JSON.stringify({book:sample.book,homeMs,resources}));
      }
      if (!firstVisit) await home.click();
      const homeFiles = [...staticFiles];
      apiFiles.length = 0;
      staticFiles.length = 0;
      const start = performance.now();
      if (firstVisit) await home.click();
      else await page.getByRole('button',{name:'교재 페이지별',exact:true}).click();
      const library = page.locator('.textbook-library');
      const selectedBook = library.locator('.library-books').getByRole('button', {
        name: sample.book === 'energy' ? /에너지설비 교재/ : /한솔 공조 교재/,
      });
      const choose = await selectedBook.getAttribute('aria-pressed') !== 'true';
      const pickerMs = Math.round(performance.now()-start);
      if (firstVisit && choose) await selectedBook.click();
      await expect(selectedBook).toHaveAttribute('aria-pressed','true');
      await library.locator('.contents-tree').waitFor();
      await library.locator('.library-selection .library-open:enabled').waitFor();
      const listMs = Math.round(performance.now()-start);
      const clickToListMs = firstVisit ? await page.evaluate(() => {
        const click = performance.getEntriesByName('book-home-click').at(-1);
        if (!click) throw new Error('Missing home textbook click');
        return Math.round(performance.now()-click.startTime);
      }) : undefined;
      await library.getByRole('button',{name:'쪽번호로 바로 열기 ↗'}).click();
      const picker = library.locator('.library-page-dialog');
      await picker.getByRole('textbox').fill(sample.page);
      const opened = performance.now();
      await picker.getByRole('button',{name:'문제 풀기 →'}).click();
      const row = page.locator('.book-sheet-question').filter({has:page.getByRole('heading',{name:'교재 '+sample.number+'번',exact:true})});
      const stage = row.locator(sample.book==='energy'?'.source-image-stage':'.direct-question-parts .direct-viewport').first();
      await stage.locator('img').evaluate(img=>img.decode());
      await stage.getByRole('button',{name:'이미지에서 '+sample.choice+'번 선택'}).waitFor();
      await stage.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
      const rect = await stage.boundingBox();
      assert.ok(rect);
      await tapMobile(page,cdp,rect.x+sample.x*rect.width, rect.y+sample.y*rect.height);
      await expect(stage.locator('[aria-pressed=true]')).toHaveAttribute('aria-label','이미지에서 '+sample.choice+'번 선택');
      await page.waitForFunction(({book,page,number,choice})=>{
        if(book==='hansol') return Number(localStorage.getItem('cbt-book-direct-choice-v1::hansol-direct-'+page+'-'+number))===choice;
        const answers=JSON.parse(localStorage.getItem('unified-industrial-cbt-v1')||'{}').progress?.textbookPageAnswersV1||{};
        return Object.entries(answers).some(([id,n])=>id.startsWith('book-study::energy::'+page+'::'+number+'::')&&n===choice);
      },sample);
      const saved = performance.now();
      if (staticOnly && firstVisit) {
        assert.ok(!homeFiles.some(file => /hvac|hansol|energy/i.test(file)), 'A book was fetched before selection');
        assert.deepEqual(otherBookRequests, [], 'Unexpected source from the other book');
        assert.deepEqual(hvacLayouts, [], 'Unexpected HVAC exam geometry on the static textbook route');
        assert.equal(apiFiles.length, 0);
        assert.equal(staticFiles.length, 1, 'Expected only the selected textbook source');
        assert.match(staticFiles[0], new RegExp('^textbook-' + sample.book + '-sources-v[0-9]+[.]json$'));
      }
      if (process.env.CBT_HOME_TRACE && run === 1) {
        console.error(JSON.stringify(await page.evaluate(() => performance.getEntriesByType('resource')
          .filter(r=>/textbook|contents|book-library/i.test(r.name)).map(r=>[new URL(r.name).pathname.split('/').pop(),Math.round(r.startTime),Math.round(r.responseEnd),r.encodedBodySize]))));
      }
      console.log(JSON.stringify({environment:usbPort?'Android USB':'Mac Chrome mobile emulation',run,staticOnly,installedWorker,route,book:sample.book,homeMs,visitToSavedMs:Math.round(saved-visit),pickerMs,listMs,clickToListMs,pageToSavedMs:Math.round(saved-opened),totalMs:Math.round(saved-start),apiFiles,homeFiles,staticFiles,hvacLayouts,otherBookRequests}));
    } finally { await tab.close(); }
  }
} finally { await browser.close(); }
