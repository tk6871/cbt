// Execute the actual application functions against local fixtures. No real writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source = readFileSync('src/admin/App.vue', 'utf8');
const ast = ts.createSourceFile('admin.ts', source.split('<script setup lang="ts">')[1].split('</script>')[0], ts.ScriptTarget.Latest, true);
const names = ['accountRequest', 'loadSyncAccounts', 'updateIssueReport', 'saveIssueNote', 'retryIssue'];
const code = ast.statements.filter(s => ts.isFunctionDeclaration(s) && names.includes(s.name?.text)).map(s => s.getText(ast)).join('\n');
const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const ref = value => ({value});
const row = id => ({id,status:'open',admin_note:null,resolved_at:null});
function harness(respond = async (id, patch) => ({data:{id,...patch}})) {
  const c = {
    config:{supabaseUrl:'https://example.invalid',supabaseAnonKey:'public-fixture'},
    session:ref({user:{id:'fixture'},access_token:'old'}), authEpoch:0, issueRevision:0,
    client:ref(null), canManageIssues:ref(true), issueReports:ref([row(1),row(2)]),
    issueSaving:ref({}), issueDrafts:ref({}), issueMessages:ref({}), issueFailed:ref({}), issueQueues:new Map(),
    operationAborts:new Set(), window:{setTimeout,clearTimeout}, AbortController,
    accountRequestId:0,accountLoading:ref(false),accountError:ref(''),syncAccounts:ref([]),
    fetch:async (_url, init) => { assert.equal(init.headers.Authorization,'Bearer fresh'); return {ok:true,json:async()=>({accounts:[]})}; },
  };
  c.client.value = {
    auth:{getSession:async()=>({data:{session:{user:{id:'fixture'},access_token:'fresh'}}})},
    from:()=>{
      let patch, id;
      const q={update:v=>{patch=v;return q;},eq:(_k,v)=>{id=v;return q;},select:()=>q,abortSignal:()=>q,single:()=>respond(id,patch)};
      return q;
    },
  };
  runInNewContext(compiled,c);
  return c;
}
const good=harness();
await good.accountRequest({action:'admin-list'});
assert.equal(good.session.value.access_token,'fresh');
good.accountError.value='saved';
await good.loadSyncAccounts(true);
assert.equal(good.accountError.value,'saved');
good.issueDrafts.value[1]='memo';
await good.updateIssueReport(good.issueReports.value[0],{admin_note:'memo'});
assert.equal(good.issueReports.value[0].admin_note,'memo');
assert.equal(good.issueDrafts.value[1],undefined);
assert.equal(good.issueSaving.value[1],false);

for (const responder of [async()=>({data:null}),async()=>({error:{message:'denied'}}),async()=>{throw Error('offline');}]) {
  const c=harness(responder); c.issueDrafts.value[1]='keep';
  await c.updateIssueReport(c.issueReports.value[0],{admin_note:'keep'});
  assert.equal(c.issueReports.value[0].admin_note,null);
  assert.equal(c.issueDrafts.value[1],'keep');
  assert.equal(c.issueSaving.value[1],false);
  assert.equal(c.issueFailed.value[1].admin_note,'keep');
}
const pending=[];
const queue=harness((id,patch)=>new Promise(resolve=>pending.push({id,patch,resolve})));
queue.issueDrafts.value[1]='first';
const first=queue.updateIssueReport(queue.issueReports.value[0],{admin_note:'first'});
const second=queue.updateIssueReport(queue.issueReports.value[0],{status:'reviewing'});
const other=queue.updateIssueReport(queue.issueReports.value[1],{status:'deferred'});
await Promise.resolve();
assert.equal(pending.length,2,'Same report waits; different report saves independently');
queue.issueDrafts.value[1]='still typing';
pending[0].resolve({data:{id:1,...pending[0].patch}});
pending[1].resolve({data:{id:2,...pending[1].patch}});
await first; await other; await Promise.resolve();
assert.equal(queue.issueSaving.value[1],true);
assert.equal(queue.issueSaving.value[2],false);
assert.equal(queue.issueDrafts.value[1],'still typing');
pending[2].resolve({data:{id:1,...pending[2].patch}});
await second;
assert.equal(queue.issueReports.value[0].status,'reviewing');
assert.equal(queue.issueReports.value[0].admin_note,'first');

let finish;
const stale=harness(()=>new Promise(resolve=>{finish=resolve;}));
const saving=stale.updateIssueReport(stale.issueReports.value[0],{admin_note:'late'});
await Promise.resolve(); stale.authEpoch++;
finish({data:{id:1,admin_note:'late'}}); await saving;
assert.equal(stale.issueReports.value[0].admin_note,null);
const requests=[];
const accounts=harness();
accounts.fetch=async()=>new Promise(resolve=>requests.push(resolve));
const a=accounts.loadSyncAccounts(); await new Promise(setImmediate);
const b=accounts.loadSyncAccounts(); await new Promise(setImmediate);
requests[1]({ok:true,json:async()=>({accounts:[{userId:'new'}]})}); await b;
requests[0]({ok:true,json:async()=>({accounts:[{userId:'old'}]})}); await a;
assert.equal(accounts.syncAccounts.value[0].userId,'new');
console.log('PASS: fresh token, retained messages, confirmed rows, zero-row/error/throw recovery, draft retention, serialized saves, concurrent rows, logout and stale list protection. Local fixtures only.');
