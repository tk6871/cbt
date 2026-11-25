export function readStudyPreference<T>(key:string,fallback:T,storage:'session'|'local'='local'):T{
 try{
   const json=(storage==='session'?sessionStorage:localStorage).getItem('cbt:'+key);
   return json?JSON.parse(json) as T:fallback;
 }catch{return fallback;}
}
export function writeStudyPreference(key:string,value:unknown,storage:'session'|'local'='local'){
 try{(storage==='session'?sessionStorage:localStorage).setItem('cbt:'+key,JSON.stringify(value));}catch{/* In-memory settings still work. */}
}
