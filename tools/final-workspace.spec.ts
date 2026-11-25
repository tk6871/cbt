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
    await stage.dispatchEvent('wheel',{deltaY:-40,deltaMode:0,ctrlKey:true,cancelable:true});
    if(mac)await expect(stage).not.toHaveAttribute('data-zoom','100');
    else await expect(stage).toHaveAttribute('data-zoom','100');
    await scale.selectOption('200');
    const left=await stage.evaluate(el=>el.scrollLeft);
    await stage.hover();
    await page.mouse.wheel(90,0);
    await expect.poll(()=>stage.evaluate(el=>el.scrollLeft)).toBeGreaterThan(left);
    await page.goBack();
    await expect(viewer).toHaveCount(0);
    await expect(card).toBeVisible();
    const swipe=async(x:number,y:number)=>{
      for(let i=0;i<4;i++)await card.dispatchEvent('wheel',{deltaX:x,deltaY:y,deltaMode:0,cancelable:true});
    };
    await swipe(28,2);
    await expect(card).toHaveClass(/keyboard-active/);
    await page.evaluate(()=>localStorage.setItem('cbt:mac-question-swipe','true'));
    await swipe(28,0);
    await expect(card).toHaveClass(/keyboard-active/);
    await swipe(28,2);
    if(mac)await expect(page.locator('#session-question-2')).toHaveClass(/keyboard-active/);
    else await expect(card).toHaveClass(/keyboard-active/);
  });
}
