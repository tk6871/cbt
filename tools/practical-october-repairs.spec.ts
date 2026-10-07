import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const rows=JSON.parse(fs.readFileSync('data/hvac-practical-restored.json','utf8'));
const get=(id:string)=>rows.find((r:any)=>r.id===`hvac-practical-restored-${id}`);
test('문항 ID·2026 원문 보존, 스캔 내용 대응과 실제 파일 해시',()=>{
  const history=JSON.parse(fs.readFileSync('data/hvac-practical-october-repair-history.json','utf8'));
  expect(history.baselineCommit).toMatch(/^[a-f0-9]{40}$/);
  const old=JSON.parse(execFileSync('git',['show',`${history.baselineCommit}:data/hvac-practical-restored.json`],{encoding:'utf8'}));
  expect(rows.map((r:any)=>r.id)).toEqual(old.map((r:any)=>r.id));
  expect(rows.filter((r:any)=>r.year===2026)).toEqual(old.filter((r:any)=>r.year===2026));
  const {bookNumber: _bookNumber, ...unmatchedVariant} = get('2023-2-12');
  expect(unmatchedVariant).toEqual(old.find((r:any)=>r.id===get('2023-2-12').id));
  const manifest=JSON.parse(fs.readFileSync('data/hvac-practical-october-scans.json','utf8'));
  expect(manifest.sourceMapping.filter((r:any)=>r.targetId)).toHaveLength(83);
  expect(manifest.sourceMapping.filter((r:any)=>!r.targetId)).toHaveLength(1);
  expect(manifest.crops).toHaveLength(52);
  const videos=JSON.parse(fs.readFileSync('data/hvac-practical-2021-3-video-crops.json','utf8'));
  expect(videos.crops).toHaveLength(10);
  expect(videos.unresolved).toEqual([]);
  const videos2022=JSON.parse(fs.readFileSync('data/hvac-practical-2022-1-video-crops.json','utf8'));
  expect(videos2022.crops).toHaveLength(11);
  expect(new Set(videos2022.crops.map((c:any)=>c.id)).size).toBe(10);
  const followup=JSON.parse(fs.readFileSync('data/hvac-practical-2022-2023-video-crops.json','utf8'));
  expect(followup.crops).toHaveLength(28);
  expect(followup.unresolved).toEqual([]);
  const early2021=JSON.parse(fs.readFileSync('data/hvac-practical-2021-video-crops.json','utf8'));
  expect(early2021.crops).toHaveLength(22);
  expect(new Set(early2021.crops.map((c:any)=>c.id)).size).toBe(20);
  expect(early2021.unresolved).toEqual([]);
  const catalog=JSON.parse(fs.readFileSync('data/hvac-practical-public-video-sources.json','utf8'));
  expect(catalog.sources).toHaveLength(16);
  for(const source of catalog.sources){
    expect(source.availability).toBe('public');
    expect(source.channelId).toBe('UC6BBDeiEj61ZXptb7qSJQyA');
    expect(source.chapters.map((c:any)=>c.number)).toEqual(Array.from({length:12},(_,i)=>i+1));
  }
  for(const crop of [...manifest.crops,...videos.crops,...videos2022.crops,...followup.crops,...early2021.crops]){
    expect(crypto.createHash('sha256').update(fs.readFileSync(crop.output)).digest('hex')).toBe(crop.sha256);
    const id=crop.id||`hvac-practical-restored-${crop.round}-${String(crop.number).padStart(2,'0')}`;
    expect(rows.find((r:any)=>r.id===id)[crop.role==='answer'?'answerImages':'images']).toContain(crop.output);
  }
  for(const item of history.changes){
    expect(item.previous).toEqual(old.find((r:any)=>r.id===item.id));
    for(const image of [...(item.previous.images||[]),...(item.previous.answerImages||[])]) expect(fs.existsSync(image)).toBe(true);
  }
});

test('정답 표기·계수·접점 오류와 문제/정답 그림 분리',()=>{
  expect(get('2021-3-02').answer).toContain('RL은 소등, GL은 점등');
  expect(get('2021-3-03').keyPoints).toEqual(['나','노즐형 취출구']);
  expect(get('2021-3-05').images[0]).not.toBe(get('2021-3-05').answerImages[0]);
  expect(get('2021-3-11').question).not.toContain('고저압스위치');
  expect(get('2021-3-07').question).toContain('화살표');
  expect(get('2021-3-09').answer).toContain('체크밸브');
  expect(get('2021-3-12').answer).toContain('터보냉동기');
  expect(get('2022-1-09').images).toHaveLength(2);
  expect(get('2022-1-12').question).toContain('청색');
  expect(get('2022-1-12').question).not.toContain('저압측');
  expect(get('2021-1-07').question).toContain('호스');
  expect(get('2021-1-09').question).toContain('두 개를 동시에');
  expect(get('2021-1-09').explanation).not.toContain('냉매');
  expect(get('2021-1-10').images).toHaveLength(3);
  expect(get('2021-1-06').answer).toContain('(나) 엘보 4·티 4');
  expect(get('2021-2-10').answer).toContain('(나) 엘보 3·티 1');
  expect(get('2021-2-11').question).toContain('팽창밸브·증발기');
  expect(get('2022-2-08').question).toContain('팽창밸브·증발기');
  expect(get('2022-2-12').question).toContain('오른쪽 압력게이지');
  expect(get('2022-3-12').explanation).toContain('전동기');
  expect(get('2022-3-12').explanation).not.toContain('코일에 전류를 흘리면');
  expect(get('2023-1-11').images[0]).not.toBe(get('2023-1-11').answerImages[0]);
  expect(get('2023-2-04').answer).toContain('액펌프식 증발기');
  expect(get('2023-2-01').answer).toContain('MC3 b접점');
  expect(get('2024-1-01').answer).toContain('RL·GL 소등');
  expect(get('2025-1-02').answer).toContain('T a접점으로 자기유지');
  expect(get('2025-2-01').answer).toBe('① MC1 ② MC2 ③ MC3');
  expect(get('2025-2-02').answer).toContain('RY 소자 유지');
  expect(get('2025-3-05').answer).toContain('① 환기(RA), ② 외기(OA)');
  expect(get('2025-3-07').answer).toContain('64,125 W');
  expect(28500*1.5*1.5).toBe(64125);
});

for(const [yearNumber,session,questionNumbers] of [
  [2021,'1',[3,4,5,6,7,8,9,10,11,12]],
  [2021,'2',[3,4,5,6,7,8,9,10,11,12]],
  [2022,'2',[3,4,5,6,7,8,10,11,12]],
  [2022,'3',[3,4,5,6,7,8,9,10,12]],
  [2023,'1',[3,4,5,6,7,8,9,10,11,12]],
] as const){
  test(`${yearNumber}-${session} 추가 그림 전체 로딩·정답 숨김·넘침`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('./?safe=1');
    const later=page.getByRole('button',{name:'나중에',exact:true});if(await later.isVisible())await later.click();
    await page.getByRole('button',{name:'패치노트 보기'}).click();
    await page.getByRole('button',{name:/신기술 학습관/}).click();
    await page.getByRole('button',{name:/필답형 훈련관 열기/}).click();
    const year=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:`${yearNumber}년`,exact:true})});
    await year.getByRole('button',{name:new RegExp(`${session}회`)}).click();
    await page.getByLabel('필답형 화면 배치').selectOption('0');
    const articles=page.locator('.practical-question-grid > article');
    for(const n of questionNumbers){
      const article=articles.nth(n-1),images=article.locator('.practical-prompt-images img');
      await expect(images).toHaveCount(get(`${yearNumber}-${session}-${String(n).padStart(2,'0')}`).images.length);
      for(const image of await images.all()){
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveAttribute('src',new RegExp(`${yearNumber}-${session}-${String(n).padStart(2,'0')}-question-video-`));
        await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
      }
      await expect(article.locator('.practical-solution')).toHaveCount(0);
    }
    const last=articles.nth(questionNumbers[questionNumbers.length-1]-1);
    await last.getByRole('button',{name:'정답·채점 기준 보기'}).click();
    await expect(last.locator('.practical-solution')).toBeVisible();
    await page.screenshot({path:`/private/tmp/cbt-public-${yearNumber}-${session}-desktop.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('2022-1 누락 그림11개 표시와 문항 조건·정답 숨김',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./?safe=1');
  const later=page.getByRole('button',{name:'나중에',exact:true});if(await later.isVisible())await later.click();
  await page.getByRole('button',{name:'패치노트 보기'}).click();
  await page.getByRole('button',{name:/신기술 학습관/}).click();
  await page.getByRole('button',{name:/필답형 훈련관 열기/}).click();
  const year=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:'2022년',exact:true})});
  await year.getByRole('button',{name:/1회/}).click();
  await page.getByLabel('필답형 화면 배치').selectOption('0');
  const articles=page.locator('.practical-question-grid > article');
  let checked=0;
  for(let n=3;n<=12;n++){
    const article=articles.nth(n-1),images=article.locator('.practical-prompt-images img');
    await expect(images).toHaveCount(n===9?2:1);
    for(const image of await images.all()){
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src',new RegExp(`2022-1-${String(n).padStart(2,'0')}-question-video-`));
      await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
      checked++;
    }
    await expect(article.getByRole('button',{name:'정답·채점 기준 보기'})).toBeVisible();
    await expect(article.locator('.practical-solution')).toHaveCount(0);
  }
  expect(checked).toBe(11);
  const last=articles.nth(11);
  await expect(last).toContainText('호스의 연결 위치');
  await last.getByRole('button',{name:'정답·채점 기준 보기'}).click();
  await expect(last.locator('.practical-solution')).toContainText('저압측');
  await page.screenshot({path:'/private/tmp/cbt-public-followup-desktop.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('2021-3 보기 이미지 표시·학습 답안 보존·스캔 표와 새 해설',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./?safe=1');
  const later=page.getByRole('button',{name:'나중에',exact:true});if(await later.isVisible())await later.click();
  await page.getByRole('button',{name:'패치노트 보기'}).click();
  await page.getByRole('button',{name:/신기술 학습관/}).click();
  await page.getByRole('button',{name:/필답형 훈련관 열기/}).click();
  const year=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:'2021년',exact:true})});
  await year.getByRole('button',{name:/3회/}).click();
  await page.getByLabel('필답형 화면 배치').selectOption('0');
  const article=page.locator('.practical-question-grid > article').nth(2);
  await expect(article).toContainText('음악실');
  const image=article.locator('.practical-prompt-images img');
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('src',/2021-3-03-question-video-v550/);
  await expect.poll(()=>image.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  await article.locator('textarea').fill('나 노즐형 취출구');
  await page.screenshot({path:`/private/tmp/cbt-october-${info.project.name}.png`});
  await page.reload();
  await year.getByRole('button',{name:/3회/}).click();
  await expect(article.locator('textarea')).toHaveValue('나 노즐형 취출구');
  for(const n of [7,9,12]){
    const picture=page.locator('.practical-question-grid > article').nth(n-1).locator('.practical-prompt-images img');
    await expect(picture).toHaveCount(1);
    await picture.scrollIntoViewIfNeeded();
    await expect(picture).toHaveAttribute('src',new RegExp(`2021-3-${String(n).padStart(2,'0')}-question-video-v550`));
    await expect.poll(()=>picture.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  }
  await page.screenshot({path:'/private/tmp/cbt-public-2021-followup-desktop.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button',{name:'← 회차·자료 목록',exact:true}).click();
  const y2025=page.locator('.practical-year-group').filter({has:page.getByRole('heading',{name:'2025년',exact:true})});
  await y2025.getByRole('button',{name:/3회/}).click();
  const boiler=page.locator('[data-practical-id="hvac-practical-restored-2025-3-07"]');
  await expect(boiler).toContainText('각각 1.5');
  const table=boiler.locator('.practical-prompt-images img');
  await table.scrollIntoViewIfNeeded();
  await expect.poll(()=>table.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
  expect(errors).toEqual([]);
});
