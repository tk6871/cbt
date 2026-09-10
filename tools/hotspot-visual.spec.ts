import { test, expect } from '@playwright/test';
for (const [round, number] of [['hvac-20232',29],['hvac-20233',47],['hvac-20231',60]] as const) {
  test(`복원 ${round} ${number}번 hover/선택 영역 동일`, async ({ page }, info) => {
    await page.addInitScript(() => {
      localStorage.setItem('unified-cbt-answer-layout','hotspot');
      localStorage.setItem('unified-cbt-hotspot-indicator','area');
    });
    await page.goto('./?safe=1');
    await expect(page.getByRole('heading',{name:'준비할 종목을 선택하세요'})).toBeVisible();
    const later=page.getByRole('button',{name:'나중에',exact:true});
    if(await later.isVisible()) await later.click();
    await page.locator('.sidebar nav button').filter({hasText:'회차별 문제'}).evaluate((el: HTMLButtonElement)=>el.click());
    const start=page.locator(`#round-card-${round}`).getByRole('button',{name:'학습모드',exact:true});
    await start.scrollIntoViewIfNeeded();
    await start.click();
    await page.getByLabel('이동할 문제 번호').fill(String(number));
    await page.locator('.session-jump-form button').click();
    const card=page.locator('.question-card').filter({has:page.locator(`img.source-question-image[src$="/${number}.jpg"]`)});
    await expect(card).toHaveCount(1);
    const image=card.locator('img.source-question-image');
    await expect.poll(()=>image.evaluate((el: HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
    for(let choice=1;choice<=4;choice++) {
      const hit=card.getByRole('button',{name:`이미지에서 ${choice}번 선택`,exact:true});
      await hit.scrollIntoViewIfNeeded();
      await hit.hover();
      const style=await hit.getAttribute('style');
      await hit.click();
      const selected=card.locator('.image-answer-area-highlight');
      await expect(selected).toHaveCount(1);
      expect(await selected.getAttribute('style')).toBe(style);
      await card.screenshot({path:`/private/tmp/cbt-hotspot-${info.project.name}-${round}-${number}-${choice}.png`});
    }
  });
}
