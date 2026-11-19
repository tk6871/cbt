import {openMobileBrowser,mobileTestUrl,usbPort} from './mobile-study-browser.mjs';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const test = base.extend({
  page: async ({page,baseURL},use) => {
    if (!usbPort) return use(page);
    const browser = await openMobileBrowser();
    try {
      const tab = await browser.newPage({baseURL,serviceWorkers:'block'},baseURL);
      try { await use(tab.page); } finally { await tab.close(); }
    } finally { await browser.close(); }
  },
});
test.use({serviceWorkers:'block'});
test.beforeEach(async ({page}) => {
  await page.addLocatorHandler(page.locator('.pwa-error-notice'), notice =>
    notice.getByRole('button',{name:'나중에',exact:true}).click());
});

// Two pages with solid red and blue rectangles make exported pixel content verifiable.
function coloredPdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
  for (const [i, color] of ['1 0 0','0 0 1'].entries()) {
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents '+(4+2*i)+' 0 R >>');
    const paint = color+' rg 0 0 200 200 re f\n';
    objects.push('<< /Length '+paint.length+' >>\nstream\n'+paint+'endstream');
  }
  let text = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) { offsets.push(text.length); text += (i+1)+' 0 obj\n'+object+'\nendobj\n'; }
  const start = text.length;
  return Buffer.from(text+'xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF');
}

test('PDF 두 쪽 이동·선택 영역 PNG 실제 픽셀·손상 파일 복구', async ({page}) => {
  await page.goto(mobileTestUrl(page,'./?safe=1#/study/school'));
  await page.getByRole('button',{name:'사진·PDF 자르기'}).click();
  const panel = page.locator('.school-source-prep');
  const input = panel.locator('input[type=file]');
  const file = {name:'연습.pdf',mimeType:'application/pdf',buffer:coloredPdf()};
  await input.setInputFiles(file);
  await expect(panel.getByRole('status')).toContainText('1/2');
  await panel.getByRole('button',{name:'다음 쪽'}).click();
  await expect(panel.getByRole('status')).toContainText('2/2');
  const selection=panel.locator('cropper-selection');
  await selection.focus();
  const before=await selection.boundingBox();
  await selection.press('Shift+ArrowRight'); await selection.press('-');
  const moved=await selection.boundingBox();
  expect(moved!.x).toBeGreaterThan(before!.x);
  expect(moved!.width).toBeLessThan(before!.width);
  await panel.getByRole('button',{name:'영역 초기화'}).click();
  const saved = page.waitForEvent('download');
  await panel.getByRole('button',{name:'선택 영역 저장'}).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe('school-pdf-page-2.png');
  const bytes = await readFile((await download.path())!);
  const pixel = await page.evaluate(async base64 => {
    const img = new Image(); img.src='data:image/png;base64,'+base64; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width=1; canvas.height=1;
    const ctx=canvas.getContext('2d')!; ctx.drawImage(img, Math.floor(img.width/2), Math.floor(img.height/2),1,1,0,0,1,1);
    return Array.from(ctx.getImageData(0,0,1,1).data);
  },bytes.toString('base64'));
  expect(pixel).toEqual([0,0,255,255]);
  await panel.getByRole('spinbutton').fill('1'); await panel.getByRole('button',{name:'이동',exact:true}).click();
  await expect(panel.getByRole('status')).toContainText('1/2');
  await input.setInputFiles({...file,buffer:Buffer.from('invalid pdf')});
  await expect(panel.getByRole('status')).toContainText('열지 못했습니다');
  await input.setInputFiles({name:'복습.png',mimeType:'image/png',buffer:bytes});
  await expect(panel.getByRole('button',{name:'선택 영역 저장'})).toBeVisible();
  await panel.getByRole('button',{name:'닫기',exact:true}).click(); await expect(panel).toHaveCount(0);
});

async function openQuestion(page:Page, round:string, n:number) {
  await page.goto(mobileTestUrl(page,'./?safe=1#/study/rounds'));
  const start = page.locator('#round-card-'+round).getByRole('button',{name:/^(학습모드|이어 학습)$/});
  await start.evaluate(node => node.scrollIntoView({block:'center',behavior:'instant'}));
  await start.click();
  await page.getByRole('spinbutton',{name:'이동할 문제 번호'}).fill(String(n));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
}

type DrawProbe = Window & {cbtStudyDraws:number; cbtStudyContexts:WeakMap<object,WebGL2RenderingContext>};

async function renderedContext(canvas:Locator) {
  const hadDraw = () => canvas.evaluate(el => (window as DrawProbe).cbtStudyContexts.has(el));
  await expect.poll(hadDraw).toBe(true);
  return canvas.evaluateHandle(el => (window as DrawProbe).cbtStudyContexts.get(el)!);
}

for (const example of [
  {kind:'shell',round:'hvac-20080727',number:13,answer:4,label:'원통다관식 열교환기',action:'동체 측 입·출구 강조'},
  {kind:'plate',round:'hvac-20130310',number:15,answer:2,label:'판형 열교환기',action:'전열판 묶음 강조'},
  {kind:'piston',round:'hvac-20030316',number:25,answer:3,label:'왕복동 압축기 행정',action:''}
]) test('문항 해설에서만 3D 불러오기 · '+example.label,async({page},info)=>{
  const repeatModel = info.project.name === 'iphone-14-pro' && example.kind === 'shell';
  const endurance = process.env.CBT_STUDY_ENDURANCE === '1' && repeatModel;
  if (example.kind === 'piston') {
    await page.addInitScript(() => {
      const use = WebGL2RenderingContext.prototype.useProgram;
      WebGL2RenderingContext.prototype.useProgram = function(program) {
        use.call(this,program);
        if (!program || !(this.canvas instanceof HTMLCanvasElement)) return;
        const shaders = this.getAttachedShaders(program) || [];
        if (shaders.some(shader=>this.getShaderSource(shader)?.includes('sweptFraction'))) {
          this.canvas.dataset.strokeScaleLinked = String(this.getProgramParameter(program,this.LINK_STATUS));
        }
      };
    });
  }
  if (endurance) {
    test.setTimeout(15 * 60_000);
    page.setDefaultTimeout(15_000);
  }
  if (repeatModel) {
    await page.addInitScript(() => {
      // Count real WebGL draw calls without scheduling any frames.
      const instrumented = window as DrawProbe;
      instrumented.cbtStudyContexts = new WeakMap();
      instrumented.cbtStudyDraws = 0;
      for (const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'] as const) {
        const original = WebGL2RenderingContext.prototype[method];
        Object.defineProperty(WebGL2RenderingContext.prototype, method, {configurable:true,writable:true,
          value:function(this:WebGL2RenderingContext,...args:number[]) {
            instrumented.cbtStudyDraws++;
            instrumented.cbtStudyContexts.set(this.canvas,this);
            return Reflect.apply(original,this,args);
          },
        });
      }
    });
  }
  const fetched:string[]=[];
  page.on('request',req=>{if(/\/models\/[^/]+\/file|\/equipment\/[^/]+\.glb|\/(PistonLesson|EquipmentLesson)-v/.test(req.url())) fetched.push(req.url());});
  await openQuestion(page,example.round,example.number);
  const question=page.locator('.question-card').filter({has:page.getByText(
    example.kind==='shell'?/원통다관식 열교환기에 관한/:example.kind==='plate'?/판형 열교환기의 종류/:/압축기 실린더 직경110/)});
  const button=question.getByRole('button',{name:'3D로 '+example.label+' 보기'});
  await question.locator('.choice-button').nth(example.answer-1).click();
  await expect(button).toBeVisible();
  expect(fetched).toHaveLength(0);
  if (info.project.name !== 'desktop') {
    await expect(button).toBeDisabled();
    await page.goto(mobileTestUrl(page,'./?safe=1#/study/settings'));
 await page.getByRole('button',{name:'해설·이미지',exact:true}).click();
    await page.locator('[data-setting=mobileModel]').getByRole('button',{name:'눌러서 3D 보기 허용'}).click();
    await openQuestion(page,example.round,example.number);
    if (!await button.isVisible()) await question.locator('.choice-button').nth(example.answer-1).click();
  }
  await button.click();
  const slot=question.locator('.model-slot');
  await expect(slot.locator('canvas')).toBeVisible({timeout:20000});
  if(example.kind==='piston') {
    const slider = slot.getByRole('slider');
    await slider.focus(); await slider.press('End');
    await expect(slot).toContainText('하사점입니다');
    await expect(slot.locator('canvas')).toHaveAttribute('data-stroke-scale-linked','true');
    await expect(slot).toContainText('25%');
    await slider.press('Home');
    await expect(slot).toContainText('상사점입니다');
  } else {
    const verifyPixels=info.project.name==='desktop' && example.kind==='shell';
    const canvas=slot.locator('canvas');
    const before=verifyPixels ? await canvas.screenshot() : undefined;
    await slot.getByRole('button',{name:'오른쪽 회전'}).focus();
    await slot.getByRole('button',{name:'오른쪽 회전'}).press('Enter');
    if(before)await expect.poll(async()=>before.equals(await canvas.screenshot())).toBe(false);
    const rotated=verifyPixels ? await canvas.screenshot() : undefined;
    await slot.getByRole('button',{name:example.action}).click();
    await expect(slot.getByRole('button',{name:example.action})).toHaveAttribute('aria-pressed','true');
    if(rotated)await expect.poll(async()=>rotated.equals(await canvas.screenshot())).toBe(false);
  }
  if (info.project.name==='desktop') {
    await slot.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await slot.screenshot({path:info.outputPath(example.kind+'.png')});
  }
  await slot.getByRole('button',{name:'3D 접기'}).click();
  await expect(slot.locator('canvas')).toHaveCount(0);
  if (endurance) {
    const cdp = await page.context().newCDPSession(page);
    const started = Date.now();
    const samples = [];
    const draws = () => page.evaluate(() => (window as Window & {cbtStudyDraws:number}).cbtStudyDraws);
    const sample = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      const heap = await cdp.send('Runtime.getHeapUsage');
      const dom = await cdp.send('Memory.getDOMCounters');
      return {elapsedSeconds:Math.round((Date.now()-started)/1000),jsHeapBytes:heap.usedSize,...dom};
    };
    const baseline = await sample();
    const filename = info.outputPath('mobile-study-endurance.json');
    const id = example.round + ':' + example.number;
    const savedChoice = () => page.evaluate(id =>
      JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').answers?.[id],id);
    for (let cycle = 0; cycle < 20; cycle++) {
      const choice = cycle % 2 + 1;
      await question.locator('.choice-button').nth(choice-1).click();
      await expect.poll(savedChoice).toBe(choice);
      await question.locator('.choice-button').nth(example.answer-1).click();
      await expect.poll(savedChoice).toBe(example.answer);
      const before = await draws();
      await button.click();
      const canvas = slot.locator('canvas');
      await expect(canvas).toBeVisible();
      const gl = await renderedContext(canvas);
      let idleDraws;
      try {
        await expect.poll(draws).toBeGreaterThan(before);
        await slot.getByRole('button',{name:'오른쪽 회전'}).click();
        await delay(1500);
        const idleStart = await draws();
        await delay(15_000);
        idleDraws = await draws() - idleStart;
        expect(idleDraws,'idle model draw calls').toBe(0);
        await slot.getByRole('button',{name:'3D 접기'}).click();
        await expect(canvas).toHaveCount(0);
        await expect.poll(()=>gl.evaluate(context=>context?.isContextLost())).toBe(true);
      } finally { await gl.dispose(); }
      await delay(13_500);
      await expect.poll(savedChoice).toBe(example.answer);
      samples.push({cycle:cycle+1,firstChoice:choice,storedChoice:example.answer,idleDraws,contextReleased:true,...await sample()});
      await writeFile(filename,JSON.stringify({environment:usbPort?'Android USB':'Mac Chrome mobile emulation',baseline,samples},null,2));
    }
    await page.reload();
    await expect.poll(savedChoice).toBe(example.answer);
    await cdp.detach();
  } else if (repeatModel) {
    for (let cycle=0; cycle<10; cycle++) {
      await button.click();
      const canvas=slot.locator('canvas');
      await expect(canvas).toBeVisible();
      const gl=await renderedContext(canvas);
      try {
        await expect.poll(()=>gl.evaluate(context=>context?.isContextLost())).toBe(false);
        await slot.getByRole('button',{name:'3D 접기'}).click();
        await expect(canvas).toHaveCount(0);
        await expect.poll(()=>gl.evaluate(context=>context?.isContextLost())).toBe(true);
      } finally { await gl.dispose(); }
    }
  }
});
