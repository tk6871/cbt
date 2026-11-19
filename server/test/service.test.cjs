const test = require('node:test');
const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {once} = require('node:events');
const {createApp} = require('../dist/main');

const userId = '00000000-0000-4000-8000-000000000001';

test('학습 API가 로그인 계정과 읽은 버전으로만 저장한다', async () => {
  let row = null;
  const requests = [];
  const upstream = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    const reply = (status, value) => {
      response.writeHead(status, {'Content-Type':'application/json'});
      response.end(JSON.stringify(value));
    };
    if (request.headers.authorization !== 'Bearer fixture' || request.headers.apikey !== 'fixture-public') return reply(401, {});
    if (url.pathname === '/auth/v1/user') return reply(200, {id:userId});
    requests.push({method:request.method, url});
    if (request.method === 'GET') return reply(200, row ? [row] : []);
    if (request.method === 'PATCH' && url.searchParams.get('updated_at') !== 'eq.'+row?.updated_at) return reply(200, []);
    if (request.method === 'POST' && row) return reply(409, {});
    let body = '';
    for await (const chunk of request) body += chunk;
    row = JSON.parse(body);
    return reply(200, [{updated_at:row.updated_at}]);
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  // Node's test runner isolates this file in its own process.
  process.env.SUPABASE_URL = 'http://127.0.0.1:'+upstream.address().port;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'fixture-public';
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const base = (await app.getUrl())+'/api';
    const path = base+'/learning/industrial';
    const headers = {Authorization:'Bearer fixture','Content-Type':'application/json'};
    const payload = {version:1, store:{attempts:{example:{selected:3}}}, exams:[]};
    const put = stamp => fetch(path, {method:'PUT',headers,body:JSON.stringify({payload,expectedUpdatedAt:stamp})});
    assert.equal((await fetch(path)).status,401);
    assert.deepEqual(await (await fetch(path,{headers})).json(),{state:null});
    const initial = await put(null);
    assert.equal(initial.status,200);
    const {updated_at} = await initial.json();
    assert.equal(row.user_id,userId);
    assert.equal(row.space,'industrial');
    assert.equal((await put(null)).status,409);
    assert.equal((await put(updated_at)).status,200);
    assert.equal((await put(updated_at)).status,409);
    for (const {url} of requests.filter(r=>r.method !== 'POST')) {
      assert.equal(url.searchParams.get('user_id'),'eq.'+userId);
      assert.equal(url.searchParams.get('space'),'eq.industrial');
    }
    assert.equal((await (await fetch(path,{headers})).json()).state.payload.store.attempts.example.selected,3);
    const catalogUrl = base+'/catalogs/energy-textbook';
    const gzipped = await fetch(catalogUrl,{headers:{'Accept-Encoding':'gzip'}});
    const plain = await fetch(catalogUrl,{headers:{'Accept-Encoding':'identity'}});
    assert.equal(gzipped.headers.get('content-encoding'),'gzip');
    assert.match(gzipped.headers.get('vary'),/Accept-Encoding/i);
    assert.equal(plain.headers.get('content-encoding'),null);
    const bank = await gzipped.json();
    assert.equal(bank.key,'energy-textbook');
    assert.deepEqual(bank,await plain.json());
    const book = await fetch(base+'/catalogs/energy-textbook/questions/school-energy-textbook-2018-2/1');
    assert.equal(book.status,200);
    assert.equal((await book.json())._originalNumber,1);
    assert.equal((await fetch(base+'/catalogs/unknown')).status,404);
    const asset = await fetch(base+'/models/shell/file');
    assert.equal(asset.headers.get('content-type'),'model/gltf-binary');
    assert.equal(Buffer.from(await asset.arrayBuffer()).toString('ascii',0,4),'glTF');
  } finally {
    await app.close();
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});
