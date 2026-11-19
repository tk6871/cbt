import type {Page} from '@playwright/test';

// Routes and storage belong to this isolated browser context only.
export async function usePracticalTestAccount(page:Page) {
  const url = 'https://practice.example.invalid';
  const id = '00000000-0000-4000-8000-000000000002';
  const exp = Math.floor(Date.now()/1000) + 3600;
  const user = {id, email:'practice@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{}};
  const payload = Buffer.from(JSON.stringify({sub:id,exp})).toString('base64url');
  const session = {user,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'practice-fixture',access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.test'};
  await page.route('**/cloud-config.js*',route=>route.fulfill({
    contentType:'text/javascript',
    body:'window.CBT_CLOUD_CONFIG='+JSON.stringify({enabled:true,supabaseUrl:url,supabaseAnonKey:'test-public'})+';',
  }));
  await page.routeWebSocket(/practice\.example\.invalid/,socket=>socket.close());
  await page.route(url+'/**',route=>{
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/user') ? user : path.endsWith('/token') ? session : [];
    return route.fulfill({json});
  });
  await page.addInitScript(s=>localStorage.setItem('cbt-learning-auth-industrial',JSON.stringify(s)),session);
}
