import inkHidden from '../../data/hansol-book-ink-hidden.json' with {type:'json'};

export type BookInkHiddenAsset={oldAsset:string;oldSha256:string;asset:string;outputSha256:string;outputSize:number[];sourceAsset:string;sourceSha256:string;sourceSize:number[];kind:string};
const assets=new Map((inkHidden.assets as BookInkHiddenAsset[]).map(row=>[row.oldAsset,row]));
export function validBookInkHiddenAsset(row:BookInkHiddenAsset,path:string,size?:number[]):boolean {
 if(row.oldAsset!==path||!/^assets\/hvac-hansol-book\/ink-hidden\/(?:upscaled-pages|questions|explanations)\/[1-5]-\d+(?:-\d+)?\.webp$/.test(row.asset)
  ||!/^assets\/hvac-hansol-book\//.test(row.oldAsset)
  ||!/^assets\/hvac-hansol-book\/ink-hidden\/pages\/[1-5]-\d+\.png$/.test(row.sourceAsset)&&!/^work\/hansol-ink-hidden\/original\/[1-5]-\d+-\d+-(?:question|explanation)\.png$/.test(row.sourceAsset)
  ||! /^[a-f0-9]{64}$/.test(row.oldSha256)||! /^[a-f0-9]{64}$/.test(row.sourceSha256)||! /^[a-f0-9]{64}$/.test(row.outputSha256)
  ||row.outputSize.length!==2||row.sourceSize.length!==2||!row.outputSize.every((n,i)=>n===row.sourceSize[i]*2)
  ||size&&(size.length!==2||size.some((n,i)=>n!==row.sourceSize[i])))return false;
 return true;
}
export function resolveBookInkHidden(path:string,size?:number[]):BookInkHiddenAsset|undefined {
 const row=assets.get(path);
 return row&&validBookInkHiddenAsset(row,path,size)?row:undefined;
}
export const bookInkHiddenAssets=inkHidden.assets as BookInkHiddenAsset[];
