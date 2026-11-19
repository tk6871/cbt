import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, Headers, HttpException, HttpCode,
  Param, Put, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

type Save = {payload: {version: 1; store: object; exams: unknown[]}; expectedUpdatedAt: string | null};
function parseSave(value: unknown): Save {
  const s = value as Partial<Save> | null;
  if (!s?.payload || s.payload.version !== 1 || !s.payload.store || typeof s.payload.store !== 'object'
    || Array.isArray(s.payload.store) || !Array.isArray(s.payload.exams)
    || !(s.expectedUpdatedAt === null || (typeof s.expectedUpdatedAt === 'string' && s.expectedUpdatedAt.length < 50
       && Number.isFinite(Date.parse(s.expectedUpdatedAt))))) throw new BadRequestException('학습 기록 형식을 확인하세요.');
  return s as Save;
}
async function storeRequest(url: URL, headers: Record<string,string>, method = 'GET', body?: object) {
  return fetch(url, {method, headers, body: body ? JSON.stringify(body) : undefined, redirect:'error',
    signal:AbortSignal.timeout(10000)}).catch(() => {throw new ServiceUnavailableException('학습 저장소 연결을 확인하세요.');});
}
async function owner(space: string, token?: string) {
  if (!token || !/^Bearer [^\s]+$/.test(token)) throw new UnauthorizedException();
  if (space !== 'industrial' && space !== 'jewelry') throw new BadRequestException();
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new ServiceUnavailableException();
  const headers = {Authorization:token, apikey:key, 'Content-Type':'application/json', Prefer:'return=representation'};
  const auth = await storeRequest(new URL('/auth/v1/user', base), headers);
  if (!auth.ok) throw new HttpException('로그인 정보를 확인하세요.', auth.status);
  const user = await auth.json();
  if (typeof user.id !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(user.id)) throw new UnauthorizedException();
  const table = new URL('/rest/v1/user_learning_states', base);
  table.searchParams.set('user_id','eq.'+user.id);
  table.searchParams.set('space','eq.'+space);
  return {headers, table, id:user.id as string};
}
@Controller('learning')
export class LearningController {
  @Get(':space') @Header('Cache-Control','no-store')
  async read(@Param('space') space: string, @Headers('authorization') token?: string) {
    const {headers, table} = await owner(space, token);
    table.searchParams.set('select','payload,updated_at');
    const result = await storeRequest(table, headers);
    if (!result.ok) throw new HttpException('학습 기록을 읽지 못했습니다.', result.status);
    const rows = await result.json();
    return {state:rows[0] ?? null};
  }
  @Put(':space') @Header('Cache-Control','no-store')
  async save(@Param('space') space: string, @Headers('authorization') token: string, @Body() body: unknown) {
    const {headers, table, id} = await owner(space, token);
    const {payload, expectedUpdatedAt} = parseSave(body);
    const update = expectedUpdatedAt !== null;
    if (update) table.searchParams.set('updated_at','eq.'+expectedUpdatedAt);
    else table.search = '';
    table.searchParams.set('select','updated_at');
    const updated_at = new Date(Math.max(Date.now(), update ? Date.parse(expectedUpdatedAt)+1 : 0)).toISOString();
    const result = await storeRequest(table, headers, update ? 'PATCH' : 'POST', {user_id:id,space,payload,updated_at});
    if (result.status === 409) throw new ConflictException();
    if (!result.ok) throw new HttpException('학습 기록을 저장하지 못했습니다.', result.status);
    const rows = await result.json();
    if (!rows.length) throw new ConflictException();
    return rows[0];
  }
  @Delete(':space') @HttpCode(204)
  async clear(@Param('space') space: string, @Headers('authorization') token: string) {
    const {headers, table} = await owner(space, token);
    const result = await storeRequest(table, headers, 'DELETE');
    if (!result.ok) throw new HttpException('학습 기록을 지우지 못했습니다.',result.status);
  }
}
