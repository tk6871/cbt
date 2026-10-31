import {test,expect} from '@playwright/test';
test.use({serviceWorkers:'block'});
for(const [folder,count] of [['energy-restored-full',1040],['energy-earlier-full',640]] as const)test(`${count}문제 선택·취소·강조 사각형 일치`,async({page})=>{
 test.setTimeout(300000);
 // This source-component harness needs Vite, even when the other specs use
 // a static production server. A DOM element named "review" is not ready.
 const origin=process.env.CBT_GEOMETRY_TEST_URL||process.env.CBT_TEST_URL||'';
 await page.goto(`${origin}/work/${folder}/answer-geometry/harness.html`);
 await page.waitForFunction(()=>Array.isArray((window as any).review?.items));
 expect(await page.evaluate(()=>(window as any).review.items.length)).toBe(count);
 for(let first=0;first<count;first+=40){
  const errors=await page.evaluate(async first=>{
   const r=(window as any).review;const errors:string[]=[];
   for(let i=first;i<Math.min(first+40,r.items.length);i++){
    await r.show(i);const image=document.querySelector('.source-question-image') as HTMLImageElement;
    await image.decode();if(!image.naturalWidth)errors.push(`${i}: image`);
    const buttons=Array.from(document.querySelectorAll('.image-answer-hotspot')) as HTMLButtonElement[];
    if(buttons.length!==4){errors.push(`${i}: ${buttons.length} buttons`);continue;}
    for(let c=0;c<4;c++){
     buttons[c].click();await r.tick();
     if(r.selected!==c+1||!buttons[c].classList.contains('selected'))errors.push(`${i}:${c}: select`);
     const area=document.querySelector('.image-answer-area-highlight') as HTMLElement;
     for(const prop of ['left','top','width','height'])if(!area||Math.abs(parseFloat(area.style.getPropertyValue(prop))-parseFloat(buttons[c].style.getPropertyValue(prop)))>0.00001)errors.push(`${i}:${c}: ${prop}`);
     buttons[c].click();await r.tick();if(r.selected!==undefined)errors.push(`${i}:${c}: cancel`);
    }
   }
   return errors;
  },first);
  expect(errors).toEqual([]);
 }
});
