import {expect,test,type Page} from '@playwright/test';
test.use({serviceWorkers:'block'});
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial')||'{}'));

test('에너지 실제 회차를 문항 수로 전환하고 제외·과목 선택의 실시간 개수와 같은 범위를 연다',async({page})=>{
  await page.goto('./?safe=1#/study/school-energy');
  const total=page.locator('[data-final-filter-count]'), cards=page.locator('.final-range');
  await expect(total).toContainText('전체 1,280문제');
  await expect(cards).toHaveCount(16);
  await expect(cards.first().locator('h3')).toHaveText('2019년 4회');
  await expect(cards.last().locator('h3')).toHaveText('2025년 3회');
  const toggle=page.getByRole('button',{name:/회차 설정/});
  await toggle.click();
  const dialog=page.getByRole('dialog',{name:'회차 설정'});
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(cards).toHaveCount(16);
  await toggle.click();
  await dialog.getByRole('button',{name:'40문제씩',exact:true}).click();
  await expect(cards).toHaveCount(32);
  const first=cards.first();
  await expect(first.locator('[data-range-count]')).toHaveAttribute('data-range-count','40');
  await first.getByRole('button',{name:/풀이 과목/}).click();
  await page.getByRole('dialog',{name:'풀이 과목'}).getByRole('button',{name:/2과목/}).click();
  await expect(first.locator('[data-range-count]')).toHaveAttribute('data-range-count','20');
  await page.getByLabel('계산문제 제외',{exact:true}).check();
  await expect(total).toContainText('제외');
  const count=Number(await first.locator('[data-range-count]').getAttribute('data-range-count'));
  expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(20);
  await first.getByRole('button',{name:'학습모드',exact:true}).click();
  await expect(page.locator('#session-question-1 .subject-divider')).toContainText('2과목');
  await expect.poll(async()=>(await saved(page)).itemIds?.length).toBe(count);
  await page.goBack();
  await expect(first.getByRole('button',{name:/풀이 과목.*2과목/})).toBeVisible();
  await expect(page.getByLabel('계산문제 제외',{exact:true})).toBeChecked();
  await expect(first.locator('[data-range-count]')).toHaveAttribute('data-range-count',String(count));
});

test('교재 정정본을 숫자키로 풀며 기존 CBT 비교 이미지는 노출하지 않는다',async({page})=>{
  await page.goto('./?safe=1#/study/school-cooling');
  const cards=page.locator('.final-range');
  await expect(cards).toHaveCount(8);
  await expect(cards.first().locator('.final-source-rounds')).toContainText('핵심 모의고사 3회차');
  await expect(cards.last().locator('.final-source-rounds')).toContainText('2025년 1회 ~ 2025년 3회');
  const all=page.locator('.final-tool').filter({has:page.locator('summary').filter({hasText:'전체 문제 ·'})});
  await all.locator('summary').click();
  await all.getByRole('button',{name:'학습모드',exact:true}).click();
  await expect.poll(async()=>(await saved(page)).itemIds?.length).toBe(480);
  const ids:string[]=(await saved(page)).itemIds;
  const number=ids.findIndex(id=>id.includes('::4-152::26::'))+1;
  expect(number).toBeGreaterThan(0);
  const input=page.getByRole('spinbutton',{name:'이동할 문제 번호'});
  await input.fill(String(number));
  await page.locator('.session-jump-form').getByRole('button',{name:'이동',exact:true}).click();
  const card=page.locator('#session-question-'+number);
  await expect(card).toContainText('65.14');
  await expect(card).not.toContainText('수정 전 CBT 원본 비교');
  await card.locator('.question-text').first().click();
  await expect(card).toHaveClass(/keyboard-active/);
  await expect(card).toHaveCSS('outline-style','none');
  await page.keyboard.press('4');
  await expect.poll(async()=>(await saved(page)).answers?.[ids[number-1]]).toBe(4);
  await expect(card).toContainText('22');
});

for(const [name,platform,mac] of [['Mac','MacIntel',true],['Windows','Win32',false]] as const){
  test(name+' 이미지 확대는 페이지 탐색과 분리되고 엄지 휠은 확대 그림만 이동한다',async({page},info)=>{
    test.skip(info.project.name!=='desktop');
    await page.addInitScript(platform=>{
      Object.defineProperty(navigator,'platform',{get:()=>platform});
      Object.defineProperty(navigator,'userAgentData',{get:()=>({platform})});
      Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
    },platform);
    await page.goto('./?safe=1#/study/school-energy');
    await page.locator('.final-range').first().getByRole('button',{name:'학습모드',exact:true}).click();
    const card=page.locator('#session-question-1');
    await card.locator('.source-image-zoom-hint').click();
    const viewer=page.locator('.study-image-dialog[open]');
    const stage=viewer.locator('.study-image-viewport');
    const scale=viewer.getByLabel('그림 확대 비율');
    const focusX=await stage.evaluate(el=>{
      const x=el.clientWidth/4;
      const r=el.getBoundingClientRect();
      el.dispatchEvent(new WheelEvent('wheel',{deltaY:-40,deltaMode:0,ctrlKey:true,cancelable:true,bubbles:true,clientX:r.left+el.clientLeft+x,clientY:r.top+el.clientHeight/2}));
      return x;
    });
    if(mac){
      await expect(stage).not.toHaveAttribute('data-zoom','100');
      expect(await stage.evaluate((el,x)=>(el.scrollLeft+x)/el.scrollWidth,focusX)).toBeCloseTo(.25,1);
    }else await expect(stage).toHaveAttribute('data-zoom','100');
    await scale.selectOption('200');
    const left=await stage.evaluate(el=>el.scrollLeft);
    await stage.hover();
    await page.mouse.wheel(90,0);
    await expect.poll(()=>stage.evaluate(el=>el.scrollLeft)).toBeGreaterThan(left);
    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect(card).toBeVisible();
    const stroke=async(deltas:number[],y:number,momentum=false)=>{
      await card.evaluate((el,{deltas,y,momentum})=>{
        for(const x of deltas){
          const e=new WheelEvent('wheel',{bubbles:true,deltaX:x,deltaY:y,cancelable:true});
          Object.defineProperty(e,'momentum',{value:momentum});
          el.dispatchEvent(e);
        }
      },{deltas,y,momentum});
    };
    await stroke([8,17,26,24],0);
    await expect(card).toHaveClass(/keyboard-active/);
    const toggle=page.getByRole('button',{name:'풀이 메뉴 열기'});
    await toggle.click();
    const option=page.getByRole('checkbox',{name:'트랙패드로 문항 넘기기'});
    if(mac)await option.check();
    else await expect(option).toHaveCount(0);
    await page.locator('.session-drawer').getByRole('button',{name:'닫기',exact:true}).click();
    expect(await page.locator('html').evaluate(el=>getComputedStyle(el).overscrollBehaviorX)).toBe(mac?'contain':'auto');
    await stroke([95],0);
    await stroke([2,2,2,2],24);
    await stroke([36,28,22,16],0,true);
    await expect(card).toHaveClass(/keyboard-active/);
    await expect.poll(async()=>{
      await stroke([8,17,26,24],0);
      return page.locator('#session-question-2').evaluate(el=>el.classList.contains('keyboard-active'));
    },{intervals:[200]}).toBe(mac);
    if(mac)await expect(page.locator('#session-question-2')).toHaveClass(/keyboard-active/);
    else await expect(card).toHaveClass(/keyboard-active/);
  });
}

test('맥 교재 원문 위의 순수 가로 스와이프는 쪽을 한 번만 넘긴다',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'platform',{get:()=>'MacIntel'});
    Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:'macOS'})});
    Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
  });
  await page.goto('./?safe=1');
  await page.getByRole('button',{name:'교재에서 풀기',exact:true}).click();
  const library=page.locator('.textbook-library');
  await library.locator('.library-books button').filter({hasText:'에너지설비 교재'}).click();
  await library.getByRole('button',{name:'쪽번호로 바로 열기'}).click();
  const dialog=page.locator('dialog.library-page-dialog[open]');
  await dialog.locator('input').fill('414');
  await dialog.getByRole('button',{name:'문제 풀기'}).click();
  const toolbar=page.locator('.reader-navigator-trigger');
  await expect(toolbar).toContainText('414쪽');
  const source=page.locator('.book-sheet .source-question-image').first();
  const stroke=async(momentum:boolean)=>source.evaluate((el,momentum)=>{
    for(const x of [4,9,15,21,26,19,11,6]){
      const e=new WheelEvent('wheel',{bubbles:true,deltaX:x,deltaY:0,cancelable:true});
      Object.defineProperty(e,'momentum',{value:momentum});
      el.dispatchEvent(e);
    }
  },momentum);
  await stroke(false);
  await expect(toolbar).toContainText('415쪽');
  await stroke(true);
  await expect(toolbar).toContainText('415쪽');
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).overscrollBehaviorX)).toBe('contain');
});

test('Safari 방식의 핀치와 회전은 확대 그림에서만 적용된다',async({page},info)=>{
  test.skip(info.project.name!=='desktop');
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'userAgentData',{get:()=>({platform:'macOS'})});
    Object.defineProperty(navigator,'maxTouchPoints',{get:()=>0});
    Object.defineProperty(window,'GestureEvent',{value:class extends Event{}});
  });
  await page.goto('./?safe=1#/study/school-energy');
  await page.locator('.final-range').first().getByRole('button',{name:'학습모드',exact:true}).click();
  await page.locator('#session-question-1 .source-image-zoom-hint').click();
  const stage=page.locator('.study-image-dialog[open] .study-image-viewport');
  await stage.evaluate(el=>{
    const r=el.getBoundingClientRect();
    for(const [type,scale,rotation] of [['gesturestart',1,0],['gesturechange',1.5,87],['gestureend',1.5,87]] as const){
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.assign(event,{clientX:r.left+r.width/2,clientY:r.top+r.height/2,scale,rotation});
      el.dispatchEvent(event);
    }
  });
  await expect(stage).toHaveAttribute('data-zoom','150');
  await expect(stage).toHaveAttribute('data-rotation','90');
  await expect(page.locator('#session-question-1')).toBeVisible();
});

test('해설이 자동으로 접혀도 보고 있던 다음 문제의 화면 위치를 유지한다',async({page})=>{
  await page.clock.install();
  await page.goto('./?safe=1#/study/school-energy');
  await page.locator('.final-range').first().getByRole('button',{name:'학습모드',exact:true}).click();
  await page.addStyleTag({content:'html { overflow-anchor: none; scroll-behavior: auto !important; }'});
  const first=page.locator('#session-question-1');
  const below=first.locator('..').locator('.question-card').nth(1);
  await first.getByRole('button',{name:'이미지에서 2번 선택',exact:true}).click();
  const explanation=first.locator('.explanation-box');
  await expect(explanation).toBeVisible();
  await below.evaluate(el=>{
    window.scrollBy({top:el.getBoundingClientRect().top-160,behavior:'instant'});
  });
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.allSettled([...document.querySelectorAll<HTMLImageElement>('.question-columns img')].map(img=>{img.loading='eager';return img.decode();}));
  });
  await page.clock.runFor(18_000);
  await expect(explanation).toBeVisible();
  const measure=await below.evaluate(el=>({top:el.getBoundingClientRect().top,y:window.scrollY}));
  expect(measure.top).toBeGreaterThanOrEqual(0);
  await page.clock.runFor(2_500);
  await expect(explanation).toHaveCount(0);
  await expect(first.locator('.inline-explanation-slot')).not.toHaveAttribute('data-explanation-space-held','true');
  await expect(first.getByRole('button',{name:/해설 다시 보기/})).toBeVisible({timeout:1500});
  const later=await below.evaluate(el=>({top:el.getBoundingClientRect().top,y:window.scrollY}));
  expect(Math.abs(later.top-measure.top)).toBeLessThanOrEqual(2);
  expect(later.y).toBeLessThan(measure.y);
});

test('한 문제 보기는 페이지 끝에서도 해설이 닫힐 때 위치를 지키고 위로 이동하면 공간을 비운다',async({page})=>{
  await page.clock.install();
  await page.goto('./?safe=1#/study/school-energy');
  await page.locator('.final-range').first().getByRole('button',{name:'학습모드',exact:true}).click();
  const first=page.locator('#session-question-1');
  await first.getByRole('button',{name:'1번 한 문제로 크게 보기',exact:true}).click();
  await expect(page.locator('.question-columns .question-card')).toHaveCount(1);
  await first.getByRole('button',{name:'이미지에서 2번 선택',exact:true}).click();
  const box=first.locator('.explanation-box'),slot=first.locator('.inline-explanation-slot');
  await expect(box).toBeVisible();
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.allSettled([...document.querySelectorAll<HTMLImageElement>('.question-columns img')].map(img=>{img.loading='eager';return img.decode();}));
  });
  await page.clock.runFor(18_000);
  const read=()=>first.evaluate(el=>({
    y:window.scrollY,limit:document.scrollingElement!.scrollHeight-document.scrollingElement!.clientHeight,
    questionTop:el.getBoundingClientRect().top,
  }));
  await page.evaluate(()=>window.scrollTo({top:document.scrollingElement!.scrollHeight,behavior:'instant'}));
  const before=await read();
  expect(before.y).toBeGreaterThan(0);
  expect(before.y).toBe(before.limit);
  await page.clock.runFor(2_500);
  await expect(box).toHaveCount(0);
  await expect(slot).toHaveAttribute('data-explanation-space-held','true');
  await expect(first.getByRole('button',{name:/해설 다시 보기/})).toBeAttached();
  const after=await read();
  expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.questionTop-before.questionTop)).toBeLessThanOrEqual(2);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.clock.runFor(50);
  await expect(slot).not.toHaveAttribute('data-explanation-space-held','true');
  expect((await read()).limit).toBeLessThan(before.limit);
  expect((await read()).y).toBe(0);
});
