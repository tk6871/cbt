// Mechanical AST-guided display-only integration. Source banks are not edited.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'vue/compiler-sfc';
let files=0,images=0,html=0;
function visit(file){
 const source=fs.readFileSync(file,'utf8'),{descriptor}=parse(source),edits=[];
 function walk(node){
  for(const prop of node.props||[]){
   if(prop.type!==7||!prop.exp)continue;
   const image=node.tag==='img'&&prop.name==='bind'&&prop.arg?.content==='src';
   const markup=prop.name==='html';
   if(!image&&!markup)continue;
   if(prop.exp.content.includes('$problemImage'))continue;
   const original=source.slice(prop.exp.loc.start.offset,prop.exp.loc.end.offset);
   edits.push({start:prop.exp.loc.start.offset,end:prop.exp.loc.end.offset,text:`${image?'$problemImage':'$problemImageHtml'}(${original})`});
   if(image)images++;else html++;
  }
  for(const child of node.children||[])walk(child);
 }
 if(descriptor.template?.ast)walk(descriptor.template.ast);
 if(!edits.length)return;
 let next=source;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+e.text+next.slice(e.end);
 fs.writeFileSync(file,next);files++;
}
function directory(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,item.name);if(item.isDirectory())directory(p);else if(p.endsWith('.vue'))visit(p);}}
directory('src/cbt');console.log({files,images,html});
