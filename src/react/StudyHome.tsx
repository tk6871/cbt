import type {StudyHomeProps} from './studyModels';
import {useEffect,useRef,type CSSProperties} from 'react';
import {subjectPhoto} from './subjectPhotos';
export function StudyHome(props: StudyHomeProps) {
  const hero=useRef<HTMLElement>(null);
  useEffect(()=>{
    const media=matchMedia('(min-width: 821px) and (hover: hover) and (prefers-reduced-motion: no-preference)');
    if(!media.matches||document.documentElement.dataset.dynamicUi==='off')return;
    let disposed=false,cleanup:(()=>void)|undefined;
    void import('gsap').then(({gsap})=>{
      if(disposed||!hero.current||!media.matches)return;
      const context=gsap.context(()=>gsap.from('.hybrid-copy',{y:6,duration:.32,clearProps:'transform'}),hero.current);
      cleanup=()=>context.revert();
    });
    return ()=>{disposed=true;cleanup?.()};
  },[]);
  return <>
    <section ref={hero} className="hybrid-cover" data-subject={props.selected} style={{'--subject-photo': `url("${subjectPhoto(props.selected)}")`} as CSSProperties}><div className="hybrid-copy">
      <p>{props.name}</p><h1>나의 학습 홈</h1>
      <div className="hybrid-actions">
        {props.resume && <button type="button" onClick={props.onResume}><span className="action-label">이어서 풀기</span></button>}
        <button type="button" onClick={props.onRounds}><span className="action-label">회차별 기출 고르기</span><span className="action-arrow" aria-hidden="true">→</span></button>
        {props.onBook && <button type="button" onClick={props.onBook}><span className="action-label">교재에서 풀기</span></button>}
      </div>
    </div></section>
    <section className="qualification-section">
      <div className="section-title"><div><h2>종목 선택</h2><p>종목을 누르면 회차와 문제를 볼 수 있습니다.</p></div>
        <div className="compact-stats" aria-busy={props.loadingStats}><span>학습<strong>{props.loadingStats ? '…' : props.answered.toLocaleString()}</strong></span>
          <span>정답률<strong>{props.loadingStats ? '…' : props.accuracy + '%'}</strong></span><span>오답<strong>{props.loadingStats ? '…' : props.wrong.toLocaleString()}</strong></span></div>
      </div>
      <div className="subject-groups">{props.groups.map(group=>
        <section className="subject-group" key={group.label}><h3>{group.label}</h3>
          <div className="qualification-grid">{group.items.map(item=>{
            const active=props.selected===item.key;
            return <button type="button" key={item.key} className={['qualification-card',item.color,active?'selected':''].join(' ')}
              aria-pressed={active} onClick={()=>props.onSelect(item.key)}>
              <span className="qualification-icon" aria-hidden="true">{item.icon}</span>
              <span className="qualification-copy"><strong>{item.name}</strong>
                <small>{item.rounds}{item.key==='energy-midterm'?'주제':'회차'} · {item.questions.toLocaleString()}문제</small></span>
              <b aria-hidden="true">{active?'✓':'›'}</b></button>;
          })}</div>
        </section>)}</div>
    </section>
  </>;
}
