import fs from 'node:fs';
import {parse} from 'vue/compiler-sfc';
const file='src/cbt/App.vue',source=fs.readFileSync(file,'utf8'),{descriptor}=parse(source),edits=[];
function hasPrompt(node){return node.props?.some(p=>p.type===7&&p.name==='if'&&p.exp?.content.includes('showIosPwaPrompt'));}
function walk(node){
 if(hasPrompt(node)||(node.tag==='Transition'&&node.children?.some(hasPrompt))){edits.push([node.loc.start.offset,node.loc.end.offset]);return;}
 for(const child of node.children||[])walk(child);
}
walk(descriptor.template.ast);
let next=source;for(const [start,end] of edits.sort((a,b)=>b[0]-a[0]))next=next.slice(0,start)+next.slice(end);
fs.writeFileSync(file,next);
const css='src/cbt/cbt.css';
const before=fs.readFileSync(css,'utf8');
const after=before.split('\n').map(line=>{
 if(!line.includes('.ios-pwa-'))return line;
 const rule=line.match(/^(\s*)([^{}]+)\{(.*)\}\s*$/);if(!rule)return line;
 const selectors=rule[2].split(',').filter(s=>!s.includes('.ios-pwa-'));
 return selectors.length?`${rule[1]}${selectors.join(',')} {${rule[3]}}`:'';
}).join('\n');
fs.writeFileSync(css,after);console.log({retiredUiBlocks:edits.length});
