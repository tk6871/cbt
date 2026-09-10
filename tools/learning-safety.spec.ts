import { test, expect, type Page } from '@playwright/test';
import { practicalQuantities, comparePracticalQuantities } from '../src/cbt/practicalQuantities';
import { criterionMatchesDraft, practicalCriteria } from '../src/cbt/hvacPracticalTraining';
import { explanationSource } from '../src/cbt/explanationSource';
import type { Question } from '../src/cbt/types';
import type { PracticalPrompt } from '../src/cbt/hvacPracticalTypes';

test('SI 환산은 차원·부호·복합 단위를 보존한다', () => {
  for (const [answer, draft] of [['1 kW', '1000 W'], ['1 MPa', '1000 kPa'], ['1 m³/min', '60 m³/h'], ['1000 mm', '1 m'], ['1 kJ/kg', '1000 J/kg'], ['1,000 W', '1e3 W'], ['1 m²', '10000 cm²']]) {
    expect(comparePracticalQuantities(answer, draft)[0]?.match, `${answer} ↔ ${draft}`).toBeTruthy();
  }
  for (const [answer, draft] of [['1 kW', '1 W'], ['1 W', '1 J'], ['1 MPa', '1 mPa'], ['10 m', '10 m/s'], ['10 °C', '-10 °C'], ['0 °C', '273.15 K'], ['10 kJ', '10 kJ/kg']]) {
    expect(comparePracticalQuantities(answer, draft)[0]?.match, `${answer} ≠ ${draft}`).toBeFalsy();
  }
  expect(practicalQuantities('1/2 kg')).toEqual([]);
  expect(criterionMatchesDraft({ id:'a', kind:'unit', label:'1 kW' }, '1000 W')).toBe(true);
  expect(criterionMatchesDraft({ id:'a', kind:'unit', label:'냉동 능력은 10 kW이다' }, '냉동 능력은 20 kW이다')).toBe(false);
  expect(practicalCriteria({id:'a',answer:'압력 101.325 kPa. 길이 2.5 m.'} as PracticalPrompt).map(x => x.label)).toEqual(['압력 101.325 kPa','길이 2.5 m']);
});

test('해설 작성 출처를 문제 출처와 혼동하지 않는다', () => {
  const q = (patch: Partial<Question>) => ({ explanation:'설명',source:'comcbt.com',...patch } as Question);
  expect(explanationSource(q({explanationType:'ai-reference'})).label).toBe('AI 보강 해설');
  expect(explanationSource(q({explanationProvenance:'manual'})).label).toBe('학습용 작성 해설');
  expect(explanationSource(q({explanation:'압축한다 [해설작성자 : 테스트]'})).label).toBe('COMCBT 이용자 해설');
  expect(explanationSource(q({})).label).toContain('확인 필요');
  expect(explanationSource(q({explanation:''})).label).toBe('해설 미등록');
});

const owner = '00000000-0000-4000-8000-000000000001';
const basePayload = (draft: string, updatedAt = 10) => ({ version:1, capturedAt:updatedAt, store:{ attempts:{},wrong:{},bookmarks:[],history:[],notes:{},progress:{ hvacPracticalV2:{ p1:{ draft,updatedAt } } } }, exams:[] });
const evaluate = <T>(page: Page, fn: (h: any) => T) => page.evaluate(`(${fn.toString()})(window.syncTest)`) as Promise<Awaited<T>>;
async function harness(page: Page) {
  await page.addInitScript(({owner}) => {
    (window as any).CBT_CLOUD_CONFIG = {enabled:true,supabaseUrl:'https://sync-test.supabase.co',supabaseAnonKey:'test-anon-key'};
    const token = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600}))}.test-signature`;
    localStorage.setItem('cbt-learning-auth-industrial', JSON.stringify({ access_token:token, refresh_token:'test-only',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:owner,email:'test@example.invalid',user_metadata:{}} }));
  }, {owner});
  await page.route('**/sync-test.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><script src="./work/sync-test-harness.js"></script></body></html>'}));
  await page.goto('./sync-test.html');
  await page.waitForFunction(() => Boolean((window as any).syncTest));
}

test('동시 저장 충돌은 다시 읽고, 업로드 도중 작성한 답과 복구 사본을 지킨다', async ({page}) => {
  let remote = basePayload('서버의 이전 답', 10);
  let stamp = '2026-09-01T00:00:00.000Z';
  let writes = 0;
  await page.route('https://sync-test.supabase.co/rest/v1/user_learning_states**', async route => {
    const request = route.request();
    const headers = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,PATCH,POST,OPTIONS'};
    if (request.method() === 'OPTIONS') return route.fulfill({headers,status:200});
    if (request.method() === 'GET') return route.fulfill({headers,json:{payload:remote,updated_at:stamp}});
    expect(new URL(request.url()).searchParams.get('updated_at')).toBe(`eq.${stamp}`);
    const row = request.postDataJSON(); writes += 1;
    if (writes === 1) { stamp = '2026-09-01T00:00:01.000Z'; return route.fulfill({headers,json:[]}); }
    if (writes === 2) await evaluate(page, h => { h.studyStore.progress.hvacPracticalV2.p1 = {draft:'업로드 도중 새 답',updatedAt:Date.now()}; });
    remote = row.payload; stamp = row.updated_at;
    return route.fulfill({headers,json:[{updated_at:stamp}]});
  });
  await harness(page);
  await evaluate(page, async h => { h.studyStore.progress.hvacPracticalV2 = {p1:{draft:'이 기기 답',updatedAt:20}}; await h.cloud.initializeCloudSync(); });
  await expect.poll(() => remote.store.progress.hvacPracticalV2.p1.draft).toBe('업로드 도중 새 답');
  expect(writes).toBeGreaterThanOrEqual(3);
  expect(await evaluate(page, h => h.studyStore.progress.hvacPracticalV2.p1.draft)).toBe('업로드 도중 새 답');
  expect(await evaluate(page, async h => (await h.cloud.getLearningRecoveryCopies()).length)).toBeGreaterThan(0);
  expect(await evaluate(page, async h => (await h.recovery.listSyncRecoveries('industrial:another-user')).length)).toBe(0);
  await expect.poll(() => evaluate(page, h => h.cloud.cloudSyncState.status)).toBe('synced');
  expect(await evaluate(page, h => h.cloud.cloudSyncState.message)).not.toContain('모든 기기');
});

test('서버 저장 실패 시 로컬 답 유지, 선택 복구는 다른 문제를 건드리지 않는다', async ({page}) => {
  await page.route('https://sync-test.supabase.co/rest/v1/user_learning_states**', route => route.fulfill({status:503,json:{message:'test unavailable'}}));
  await harness(page);
  await evaluate(page, async h => { h.studyStore.progress.hvacPracticalV2 = {p1:{draft:'남겨야 할 답',updatedAt:20},p2:{draft:'다른 문제 답',updatedAt:30}}; await h.cloud.initializeCloudSync(); });
  await expect.poll(() => evaluate(page, h => h.cloud.cloudSyncState.status)).toBe('error');
  expect(await evaluate(page, h => h.studyStore.progress.hvacPracticalV2.p1.draft)).toBe('남겨야 할 답');
  await evaluate(page, h => h.recovery.restoreLearningCopy(h.studyStore, {kind:'practical',key:'p1',label:'테스트',local:{draft:'복구한 답',updatedAt:1},remote:{draft:'서버답',updatedAt:2}}, 'local'));
  expect(await evaluate(page, h => h.studyStore.progress.hvacPracticalV2.p2.draft)).toBe('다른 문제 답');
  expect(await evaluate(page, h => h.studyStore.progress.hvacPracticalV2.p1.draft)).toBe('복구한 답');
});
