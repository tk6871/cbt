import type {Catalog} from './types';

export function publicApiBase() {
  return window.CBT_CLOUD_CONFIG?.serviceApiUrl?.replace(/\/+$/, '');
}

export async function loadApiBank(file: string): Promise<Catalog | undefined> {
  const base = publicApiBase();
  if (!base) return;
  try {
    const {queryBank} = await import('./queryBank');
    return await queryBank(base,file,()=>readApiBank(base,file));
  } catch { return; }
}

async function readApiBank(base:string,file:string): Promise<Catalog> {
  const controller = new AbortController();
  let timer = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(base+'/catalogs/'+encodeURIComponent(file), {signal:controller.signal});
    if (!response.ok) throw Error('문제은행을 불러오지 못했습니다.');
    // The API has answered. Give large banks time to finish on a mobile connection.
    window.clearTimeout(timer);
    timer = window.setTimeout(() => controller.abort(), 30000);
    const bank: Catalog = await response.json();
    if (bank.key === file && Array.isArray(bank.rounds)) return bank;
    throw Error('문제은행 형식이 올바르지 않습니다.');
  } finally { window.clearTimeout(timer); }
}

async function learningResponse(space:string, token:string, method:'GET'|'PUT'|'DELETE', body?:object) {
  const response = await fetch(publicApiBase()+'/learning/'+space, {method, cache:'no-store', redirect:'error',
    signal:AbortSignal.timeout(20000), headers:{Authorization:'Bearer '+token, 'Content-Type':'application/json'},
    body:body ? JSON.stringify(body) : undefined});
  if (!response.ok && !(method === 'PUT' && response.status === 409)) {
    throw Error('학습 서버 요청에 실패했습니다 ('+response.status+').');
  }
  return response;
}

export async function readLearning(space:string, token:string):Promise<{payload:unknown;updated_at:string} | null> {
  const result = await (await learningResponse(space,token,'GET')).json();
  if (result?.state === null) return null;
  if (!result?.state?.payload || typeof result.state.updated_at !== 'string' || !Number.isFinite(Date.parse(result.state.updated_at))) {
    throw Error('학습 서버의 기록 형식을 확인하세요.');
  }
  return result.state;
}

export async function writeLearning(space:string,token:string,payload:object,expectedUpdatedAt:string | null):Promise<boolean> {
  const response = await learningResponse(space,token,'PUT',{payload,expectedUpdatedAt});
  if (response.status === 409) return false;
  if (typeof (await response.json())?.updated_at !== 'string') throw Error('서버의 저장 확인을 받지 못했습니다.');
  return true;
}

export async function deleteLearning(space:string,token:string) {
  await learningResponse(space,token,'DELETE');
}
