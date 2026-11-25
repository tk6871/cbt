import type {BookPracticeFilters} from '../cbt/textbookPracticeFilters';

export function BookPracticeFilterControls({value,onChange}:{value:BookPracticeFilters;onChange:(v:BookPracticeFilters)=>void}){
 return <div className="final-inline" role="group" aria-label="문제 제외 옵션">
   <label><input type="checkbox" checked={value.duplicates} onChange={e=>onChange({...value,duplicates:e.target.checked,similar:e.target.checked&&value.similar})}/> 중복 제외</label>
   <label><input type="checkbox" checked={value.similar} onChange={e=>onChange({...value,similar:e.target.checked,duplicates:e.target.checked||value.duplicates})}/> 비슷한 문제도 제외</label>
   <label><input type="checkbox" checked={value.calculations} onChange={e=>onChange({...value,calculations:e.target.checked})}/> 계산문제 제외</label>
 </div>;
}
