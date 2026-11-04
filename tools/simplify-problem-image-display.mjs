// Mechanical removal of the provisional optional-source directive.
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'vue/compiler-sfc';
let files=0,removed=0,links=0;
function walkFile(file){
 const source=fs.readFileSync(file,'utf8'),{descriptor}=parse(source),edits=[];
 function walk(node){
  for(const prop of node.props||[]){
   if(prop.type!==7)continue;
   if(prop.name==='problem-image'){edits.push({start:prop.loc.start.offset,end:prop.loc.end.offset,text:''});removed++;}
   if(node.tag==='a'&&prop.name==='bind'&&prop.arg?.content==='href'&&prop.exp&&!prop.exp.content.includes('$problemImage')){
    const loc=prop.exp.loc;edits.push({start:loc.start.offset,end:loc.end.offset,text:`$problemImage(${source.slice(loc.start.offset,loc.end.offset)})`});links++;
   }
  }
  for(const child of node.children||[])walk(child);
 }
 if(descriptor.template?.ast)walk(descriptor.template.ast);
 if(!edits.length)return;
 let next=source;for(const e of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,e.start)+e.text+next.slice(e.end);
 fs.writeFileSync(file,next);files++;
}
function directory(folder){for(const d of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,d.name);if(d.isDirectory())directory(p);else if(p.endsWith('.vue'))walkFile(p);}}
directory('src/cbt');console.log({files,removed,links});
