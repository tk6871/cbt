import packed from '../../data/problem-image-index.json' with {type:'json'};

// Required app chunk: resolve preserved bank URLs before images are rendered.
const packedDirs=new Map(packed.map(([dir,names,hashes])=>[dir!,[names!,hashes!] as const]));
const unpackedDirs=new Map<string,Map<string,string>>();
function mappedImage(key:string):string|undefined {
 const slash=key.lastIndexOf('/'), dir=key.slice(0,slash), name=key.slice(slash+1);
 let files=unpackedDirs.get(dir);
 if(!files){
  const group=packedDirs.get(dir);if(!group)return;
  const [names,hashes]=group;
  files=new Map(names.split('\n').map((n,i)=>[n,hashes.slice(i*32,i*32+32)]));
  unpackedDirs.set(dir,files);
 }
 const hash=files.get(name);
 return hash?`assets/problem-webp90/${hash}.webp`:undefined;
}
const memo=new Map<string,string>();
const published='https://tk6871.github.io/cbt/';
export function problemImage(source:string|undefined|null):string|undefined {
 if(typeof source!=='string')return undefined;
 if(!source.includes('assets/')||/assets\/(?:theme|icons|fonts|responsive)\//.test(source))return source;
 const cached=memo.get(source);if(cached!==undefined)return cached;
 const match=source.match(/^(.*?)(assets\/[^?#]+)([?#].*)?$/);
 if(!match)return source;
 const [,prefix,path,suffix='']=match;
 if(/^https?:/i.test(prefix!)){
  try{const u=new URL(source);if(u.origin!==globalThis.location?.origin&&!source.startsWith(published+'assets/'))return source;}catch{return source;}
 }else if(!/^(?:\.\/|\/[^?#]*\/|\/)?$/.test(prefix!))return source;
 let key:string;try{key=decodeURIComponent(path!);}catch{return source;}
 const target=mappedImage(key);
 const native=typeof document!=='undefined'&&document.documentElement.dataset.nativeApp==='true';
 const bundled=key.startsWith('assets/hvac/formula-samples/');
 const result=target?(native&&!bundled&&!/^https?:/i.test(prefix!)?published:prefix)+target+suffix:source;
 memo.set(source,result);return result;
}
/** Change only img/src, never question text, formulas or stored fingerprints. */
export function problemImageHtml(html:string|undefined|null):string {
 if(!html)return '';
 if(!/<img\b/i.test(html))return html;
 return html.replace(/(<img\b[^>]*?\s+src\s*=\s*)(?:(["'])(.*?)\2|([^\s"'=<>`]+))/gi,
  (_all,start,quote,quoted,plain)=>`${start}${quote||'"'}${problemImage(quote?quoted:plain)}${quote||'"'}`);
}
declare module 'vue' {
 interface ComponentCustomProperties {
  $problemImage:typeof problemImage;
  $problemImageHtml:typeof problemImageHtml;
 }
}
