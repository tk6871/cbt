import { expect, test } from '@playwright/test';

for (const [space, style] of [
  ['industrial', 'default'], ['jewelry', 'default'], ['industrial', 'simpsons'], ['jewelry', 'sunjae'],
] as const) {
  for (const theme of ['light', 'dark']) {
    test(`${space} ${style} ${theme} · 두 모드 버튼 글자와 실제 가장자리`, async ({ page }) => {
      await page.addInitScript(({ space, style, theme }) => {
        localStorage.setItem('unified-cbt-theme', theme);
        localStorage.setItem('unified-' + space + '-cbt-visual-style', style);
      }, { space, style, theme });
      const path = space === 'jewelry' ? './jewelry.html' : './';
      await page.goto(path + '#/study/rounds');
      const buttons = page.locator('.round-grid .round-card').first().locator('footer .round-mode-button');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.first().locator("..")).toHaveCSS("border-top-width","0px");
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('data-visual-style', style);
      for (const button of await buttons.all()) {
        const png = await button.screenshot({ animations: 'disabled' });
        const result = await button.evaluate(async (element, base64) => {
          const css = getComputedStyle(element);
          const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
          const luminance = (color: number[]) => color.reduce((total, value, index) => {
            const v = value / 255;
            return total + [0.2126, 0.7152, 0.0722][index]! * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          }, 0);
          const img = new Image();
          img.src = 'data:image/png;base64,' + base64;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const base = rgb(css.backgroundColor);
          const ink = luminance(rgb(css.color));
          const samples = [[0.2, 0.04], [0.8, 0.96], [0.015, 0.5], [0.985, 0.5]].map(([x, y]) =>
            Array.from(ctx.getImageData(Math.floor(img.width * x!), Math.floor(img.height * y!), 1, 1).data).slice(0, 3));
          return {
            border: css.borderTopWidth, height: element.getBoundingClientRect().height,
            // The asset may shade the fill. A separately painted rim has a different color.
            maxDelta: Math.max(...samples.flatMap(sample => sample.map((v, i) => Math.abs(v - base[i]!)))),
            minContrast: Math.min(...samples.map(sample => {
              const fill = luminance(sample);
              return (Math.max(fill, ink) + 0.05) / (Math.min(fill, ink) + 0.05);
            })),
          };
        }, png.toString('base64'));
        expect(result.border).toBe('0px');
        expect(result.height).toBeGreaterThanOrEqual(44);
        expect(result.maxDelta).toBeLessThan(28);
        expect(result.minContrast).toBeGreaterThanOrEqual(4.5);
      }
      await buttons.first().focus();
      await page.keyboard.press('Tab');
      await expect(buttons.last()).toBeFocused();
      await expect(buttons.last()).toHaveCSS('outline-style', 'solid');
    });
  }
}

test('진행 중인 회차에서도 이어 학습과 CBT 시험이 같은 줄을 유지한다', async ({page}) => {
  await page.goto('./?safe=1#/study/rounds');
  const footer = page.locator('#round-card-hvac-20160306 footer');
  await footer.getByRole('button',{name:'학습모드',exact:true}).click();
  const card = page.locator('#session-question-1');
  await card.locator('.choice-button:visible,button[aria-label^="이미지에서"]:visible').first().click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-industrial-cbt-v1') || '{}').attempts?.['hvac-20160306:1']?.lastChoice)).toBe(1);
  await expect(card.getByRole('button',{name:/이 문제 초기화|초기화 되돌리기/})).toHaveCount(0);
  await page.goto('about:blank');
  await page.goto('./?safe=1#/study/rounds');
  const buttons = footer.getByRole('button');
  await expect(buttons).toHaveText(['이어 학습','CBT 시험모드','오답 1개']);
  const bounds = await buttons.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {y:r.y,width:r.width,height:r.height};}));
  expect(bounds[0]!.y).toBe(bounds[1]!.y);
  expect(Math.abs(bounds[0]!.width-bounds[1]!.width)).toBeLessThan(1);
  expect(bounds[1]!.height).toBeGreaterThanOrEqual(44);
  expect(bounds[2]!.y).toBeGreaterThan(bounds[1]!.y);
  await buttons.first().focus();
  await page.keyboard.press('Tab');
  await expect(buttons.nth(1)).toBeFocused();
  await buttons.nth(1).click();
  await expect(page.locator('#session-question-1')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('unified-cbt-learning-session-industrial') || '{}').mode)).toBe('exam');
});
