export interface AnswerOption {
  number: number;
  marker: string;
  selected: boolean;
  className: string;
  label?: string;
  html?: string;
  images: string[];
  imageClass: string;
  result?: string;
}
export function AnswerChoices({options,choose}:{options:AnswerOption[];choose:(n:number)=>void}) {
  return <>{options.map(o=><button type="button" key={o.number} className={'choice-button '+o.className}
    aria-label={o.label} aria-pressed={o.selected} onClick={()=>choose(o.number)}>
    <span className="choice-number">{o.marker}</span>
    {o.html!==undefined&&<span className="choice-copy">
      <span dangerouslySetInnerHTML={{__html:o.html}}/>
      {o.images.map((src,i)=><img key={i} src={src} className={o.imageClass} alt="보기 그림" loading="lazy" decoding="async"/>)}
    </span>}
    {o.result&&<b>{o.result}</b>}
  </button>)}</>;
}
