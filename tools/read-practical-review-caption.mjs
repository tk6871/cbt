import fs from 'node:fs';
const [round,start,end]=process.argv.slice(2);
const text=fs.readFileSync(`/private/tmp/cbt-practical-review-captions/${round}.ko.vtt`,'utf8');
const seen=new Set();
for(const block of text.split(/\n\s*\n/)) {
  const lines=block.split('\n'), timing=lines.find(l=>l.includes('-->'));
  if(!timing)continue;
  const time=timing.split(' --> ')[0], [h,m,s]=time.split(':').map(Number), second=h*3600+m*60+s;
  if(second<Number(start)||second>Number(end))continue;
  const phrase=lines.slice(lines.indexOf(timing)+1).map(l=>l.replace(/<[^>]*>/g,'').trim()).filter(Boolean).join(' ');
  if(!seen.has(phrase)){seen.add(phrase);console.log(time,phrase);}
}
