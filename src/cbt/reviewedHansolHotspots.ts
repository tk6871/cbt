import type {AnswerHotspot} from './types';

// 2026-11-02 제보 #11: 실제 1286×334 원문의 번호와 보기 전체를 직접 확인.
// 두 열을 하나로 읽었던 OCR 좌표를 대체한다. 원본 이미지는 변경하지 않는다.
export const reviewedHansolHotspots:Record<string,AnswerHotspot[]>={
 'assets/hvac-hansol/questions/2020_1/18.webp':[
  {choice:1,x:7,y:45,width:32,height:17},
  {choice:2,x:50,y:45,width:30,height:17},
  {choice:3,x:7,y:65,width:35,height:17},
  {choice:4,x:50,y:65,width:30,height:17},
 ].map(box=>({...box,segments:[{x:box.x,y:box.y,width:box.width,height:box.height}]})),
};
