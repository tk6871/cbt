import {expect,type Page} from '@playwright/test';

export async function openBookNavigator(page:Page,tab?:'pages'|'info'|'contents'){
 const dialog=page.locator('#textbook-navigator');
 await expect(dialog).toBeAttached();
 if(!await dialog.evaluate((el:HTMLDialogElement)=>el.open))await page.getByRole('button',{name:/☷ 목차·쪽 선택/}).click();
 await expect(dialog).toBeVisible();
 if(tab)await dialog.getByRole('button',{name:tab==='pages'?'쪽번호 이동':tab==='info'?'연결 현황·안내':'교재 목차',exact:true}).click();
 return dialog;
}
export async function closeBookNavigator(page:Page){
 const dialog=page.locator('#textbook-navigator');
 await expect(dialog).toBeAttached();
 if(await dialog.evaluate((el:HTMLDialogElement)=>el.open))await dialog.getByRole('button',{name:'목차·쪽 선택 닫기',exact:true}).click();
}
export async function chooseBookPage(page:Page,from:string,to=''){
 const dialog=await openBookNavigator(page,'pages');
 await dialog.locator('.page-picker input').first().fill(from);
 await dialog.locator('.page-picker input').nth(1).fill(to);
 await dialog.getByRole('button',{name:'이 쪽 열기 →',exact:true}).click();
 await expect(dialog).not.toBeVisible();
}
export async function switchTextbook(page:Page,book:'energy'|'hansol'){
 const dialog=await openBookNavigator(page);
 await dialog.getByRole('button',{name:book==='energy'?'에너지설비 교재':'한솔 공조 교재',exact:true}).click();
 await closeBookNavigator(page);
}
