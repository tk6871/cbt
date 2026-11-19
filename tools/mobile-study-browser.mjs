import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {promisify} from 'node:util';
import {chromium, devices} from '@playwright/test';

const exec = promisify(execFile);
export const usbPort = process.env.CBT_USB_CHROME_PORT;
const testOrigins = new WeakMap();

export async function openMobileBrowser() {
  if (usbPort) {
    assert.ok(/^\d+$/.test(usbPort) && Number(usbPort) > 0 && Number(usbPort) <= 65535, 'Invalid USB forwarding port');
    // Android exposes the foreground tab after the Chrome intent has finished.
    // Each Android page therefore owns its CDP connection.
    return {newPage: openAndroidPage, close: async () => {}};
  }
  const browser = await chromium.launch({channel:'chrome'});
  return {
    async newPage(options) {
      const context = await browser.newContext({...devices['iPhone 14 Pro'], ...options});
      try { return {page: await context.newPage(), close: () => context.close()}; }
      catch (error) { await context.close(); throw error; }
    },
    close: () => browser.close(),
  };
}

export function mobileTestUrl(page, url, base) {
  const origin = testOrigins.get(page) || base;
  return origin ? new URL(url, origin).href : url;
}

async function openAndroidPage(options, base) {
  const upstream = new URL(base);
  assert.equal(upstream.hostname, '127.0.0.1');
  const device = process.env.CBT_USB_SERIAL ? ['-s',process.env.CBT_USB_SERIAL] : ['-d'];
  const adb = (...args) => exec('adb', [...device,...args], {timeout:15000});
  const {stdout} = await adb('reverse', 'tcp:0', 'tcp:'+upstream.port);
  const port = stdout.trim();
  assert.match(port, /^[1-9]\d{0,4}$/);
  const origin = 'http://127.0.0.1:'+port;
  const debug = 'http://127.0.0.1:'+usbPort;
  let browser, page, session, target;
  async function close() {
    try {
      if (session) await session.send('Storage.clearDataForOrigin', {
        origin, storageTypes:'local_storage,indexeddb,cache_storage,service_workers',
      });
    } finally {
      try {
        if (page) await page.close();
        else if (target) await fetch(debug+'/json/close/'+encodeURIComponent(target.id), {signal:AbortSignal.timeout(5000)});
      } finally {
        try { await browser?.close(); }
        finally { await adb('reverse','--remove','tcp:'+port); }
      }
    }
  }
  try {
    // Use an inert document on a separate origin to leave the measured origin cold.
    const marker = 'http://127.0.0.1:4310/robots.txt#cbt-usb-'+randomUUID();
    await adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',marker,'com.android.chrome');
    for (let i=0; i<40 && !target; i++) {
      const response = await fetch(debug+'/json/list', {signal:AbortSignal.timeout(5000)});
      target = (await response.json()).find(tab => tab.type==='page' && tab.url===marker);
      if (!target) await delay(200);
    }
    assert.ok(target, 'Android Chrome did not open the requested test tab');
    browser = await chromium.connectOverCDP(debug, {noDefaults:true});
    const context = browser.contexts()[0];
    for (let i=0; i<30 && !page; i++) {
      for (const candidate of context.pages()) {
        const probe = await context.newCDPSession(candidate);
        const {targetInfo} = await probe.send('Target.getTargetInfo');
        if (targetInfo.url === marker) { page=candidate; session=probe; break; }
        await probe.detach();
      }
      if (!page) await delay(200);
    }
    assert.ok(page, 'Chrome did not attach the requested test tab');
    assert.ok(await page.evaluate(() => /Android/i.test(navigator.userAgent) && navigator.maxTouchPoints>0));
    await page.bringToFront();
    testOrigins.set(page, origin);
    if (options.serviceWorkers === 'block') {
      await session.send('Network.setBypassServiceWorker', {bypass:true});
      await page.addInitScript(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register = () => new Promise(() => {});
      });
    }
    await page.addLocatorHandler(page.locator('.android-apk-popup'), popup =>
      popup.getByRole('button', {name:'나중에', exact:true}).click());
    return {page, close};
  } catch (error) { await close(); throw error; }
}

export async function tapMobile(page, cdp, x, y) {
  if (!usbPort) return page.touchscreen.tap(x,y);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
