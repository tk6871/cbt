import 'reflect-metadata';
import compression from 'compression';
import {
  BadRequestException, Body, Controller, Get, Headers, HttpException, Injectable,
  Module, Param, Post, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import {ContentController} from './content';
import {LearningController} from './learning';
import type {NestExpressApplication} from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';

type Submission = { expectedVersion:number; status:'draft'|'approved'; explanation:string };
function readSubmission(input:unknown):Submission {
  if (!input || typeof input!=='object') throw new BadRequestException();
  const s=input as Partial<Submission>;
  if(typeof s.expectedVersion!=='number'||!Number.isSafeInteger(s.expectedVersion)||s.expectedVersion<0||s.expectedVersion>=2147483647||
    !['draft','approved'].includes(s.status??'')||typeof s.explanation!=='string'||
    !s.explanation.trim()||s.explanation.length>20000) throw new BadRequestException('해설 또는 버전을 확인하세요.');
  return s as Submission;
}
@Injectable()
class ReviewStore {
  async request(id:string,authorization:string|undefined,submission?:Submission) {
    if(!authorization||!/^Bearer [^\s]+$/.test(authorization)) throw new UnauthorizedException();
    if(!/^[a-zA-Z0-9:_-]{1,180}$/.test(id)) throw new BadRequestException('잘못된 문제 ID입니다.');
    const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY;
    if(!base||!key)throw new ServiceUnavailableException('검수 저장소를 연결하세요.');
    const endpoint=new URL('/rest/v1/explanation_revisions',base);
    endpoint.searchParams.set('select','question_id,version,status,explanation,created_at');
    if(!submission){
      endpoint.searchParams.set('question_id','eq.'+id);
      endpoint.searchParams.set('order','version.desc');
      endpoint.searchParams.set('limit','50');
    }
    const response=await fetch(endpoint,{
      method:submission?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json',Prefer:'return=representation'},
      body:submission?JSON.stringify({question_id:id,version:submission.expectedVersion+1,status:submission.status,explanation:submission.explanation.trim()}):undefined,
    }).catch(()=>{throw new ServiceUnavailableException('저장소 연결을 확인하세요.')});
    if(!response.ok) throw new HttpException(response.status===409?'다른 수정본이 먼저 저장되었습니다. 다시 조회하세요.':'검수 기록을 처리할 수 없습니다.',response.status);
    return response.json();
  }
}
@Controller()
class Api {
  constructor(private readonly store: ReviewStore){}
  @Get('health') health(){return {status:'ok'}}
  @Get('reviews/:id') list(@Param('id') id:string,@Headers('authorization') token?:string){return this.store.request(id,token)}
  @Post('reviews/:id') append(@Param('id') id:string,@Headers('authorization') token:string,@Body() input:unknown){
    return this.store.request(id,token,readSubmission(input));
  }
}
@Module({controllers:[Api,ContentController,LearningController],providers:[ReviewStore]})
class ApiModule {}
export async function createApp(){
  const app=await NestFactory.create<NestExpressApplication>(ApiModule);
  app.use('/api/catalogs', compression());
  app.useBodyParser('json',{limit:'32mb'});
  app.setGlobalPrefix('api');
  const origins=(process.env.CBT_ORIGINS||'http://127.0.0.1:4310').split(',').map(x=>x.trim());
  app.enableCors({origin:origins,methods:['GET','POST','PUT','DELETE'],allowedHeaders:['Authorization','Content-Type']});
  return app;
}
if (require.main === module) {
  void createApp().then(app => app.listen(Number(process.env.PORT || 4311), process.env.HOST || '127.0.0.1'));
}
