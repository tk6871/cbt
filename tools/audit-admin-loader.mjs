// Exercise the actual loader with in-memory responses, never production accounts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/admin/App.vue','utf8');
const start = source.indexOf('async function loadData(');
const end = source.indexOf('\nfunction ', start);
assert.ok(start > 0 && end > start);
const code = ts.transpileModule(source.slice(start,end), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const ref = value => ({value});
function harness(responder) {
  const query = table => {
    const q = { select:()=>q, order:()=>q, limit:()=>q, gte:()=>q, abortSignal:signal=>responder(table,signal) };
    return q;
  };
  const context = {
    client:ref({from:query}), session:ref({user:{id:'test-only'}}),
    dataLoading:ref(false), document:{hidden:false,activeElement:null},
    issueSavingId:ref(null), dataRequestId:0, dataAbort:null,
    window:{setTimeout,clearTimeout}, AbortController, dataError:ref(''),
    days:ref(30), canViewAnalytics:ref(true), canManageIssues:ref(true),
    lastLoadedAt:ref(null), loadedDays:ref(30), visitors:ref([]), visits:ref([]), results:ref([]), issueReports:ref([]),
    nextTick:async()=>{}, animate:()=>{}, stagger:()=>0,
  };
  runInNewContext(code, context);
  return context;
}
const good = harness(async table => ({data:[{id:table}]}));
await good.loadData();
assert.equal(good.results.value[0].id,'exam_results');
assert.ok(good.lastLoadedAt.value);
assert.equal(good.dataLoading.value,false);

const failure = harness(async table => table==='exam_results' ? {error:{message:'test failure'}} : {data:[]});
failure.results.value=[{id:'previous'}]; failure.lastLoadedAt.value='previous-success';
await failure.loadData();
assert.equal(failure.results.value[0].id,'previous');
assert.equal(failure.lastLoadedAt.value,'previous-success');
assert.match(failure.dataError.value,/학습 결과 조회에 실패/);
assert.equal(failure.dataLoading.value,false);

const rejection = harness(async () => {throw new Error('offline');});
await rejection.loadData();
assert.match(rejection.dataError.value,/아직 조회된 자료가 없습니다/);
assert.equal(rejection.dataLoading.value,false);

let calls=0;
const busy = harness(async () => {calls++; return {data:[]};});
busy.document.activeElement={matches:()=>true};
await busy.loadData({silent:true});
assert.equal(calls,0,'Do not refresh while a note is being edited');

const pending=[];
const stale = harness(() => new Promise(resolve=>pending.push(resolve)));
const first = stale.loadData();
const second = stale.loadData();
for (const resolve of pending.slice(4)) resolve({data:[{id:'new'}]});
await second;
for (const resolve of pending.slice(0,4)) resolve({data:[{id:'old'}]});
await first;
assert.equal(stale.results.value[0].id,'new','Late older request must not overwrite the newest snapshot');
assert.equal(stale.dataLoading.value,false);
console.log('PASS: actual admin loader success, partial failure retention, network rejection, editing guard, out-of-order request protection (local fixtures only)');
