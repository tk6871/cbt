import type { Page } from '@playwright/test';
/** These regression suites exercise the preserved 179-item legacy bank. Real
 * merged-catalog behavior is covered separately in energy-textbook.spec.ts. */
export async function legacyEnergyFixture(page: Page): Promise<void> {
  await page.route('**/data/energy-textbook.js?*', route=>route.fulfill({contentType:'text/javascript',body:'window.CBT_DATA_ENERGY_TEXTBOOK={key:"energy-textbook",name:"legacy regression fixture",rounds:[]};'}));
  await page.addInitScript(()=>localStorage.setItem('cbt-energy-midterm-source-v1','combined'));
}
