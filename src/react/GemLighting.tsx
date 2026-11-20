import {useState} from 'react';

const lights=['주광','측면광','역광'];
export function GemLighting() {
  const [light,setLight]=useState(0);
  return <details className="gem-lighting"><summary>보석 컷과 조명</summary>
    <div className="gem-study" data-light={light} role="img" aria-label={lights[light]+'에서 본 보석 컷 모식도'}><div className="gem-facet"><i/><b/><em/></div></div>
    <div role="group" aria-label="보석 조명">{lights.map((v,i)=><button type="button" key={v} aria-pressed={light===i} onClick={()=>setLight(i)}>{v}</button>)}</div>
  </details>;
}
