import {useCallback,useState} from 'react';
import {GlassLens} from './GlassLens';

export function GlassScene(){
  const [enabled,setEnabled]=useState(false),[failed,setFailed]=useState(false);
  const fallback=useCallback(()=>{setFailed(true);setEnabled(false)},[]);
  return <div className="glass-scene photo-stage">
    {enabled&&<GlassLens onFailure={fallback}/>}
    <strong data-lens className="glass-caption">회차별 기출</strong>
    <button type="button" className="glass-preview-toggle" disabled={failed} aria-pressed={enabled}
      onClick={()=>setEnabled(!enabled)}>{failed?'기본 유리 효과 사용 중':enabled?'3D 미리보기 닫기':'3D 굴절 미리보기'}</button>
  </div>;
}
