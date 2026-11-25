// Printed tables of contents, not the IDs of CBT questions matched to the page.
export const coolingAppendixGroups=[
  {prefix:'4-',limit:196,starts:[7,20,33,46,58,71,84,96,109,122,134,147,160,172,184]},
  {prefix:'5-',limit:109,starts:[4,16,27,39,51,64,75,86,98]},
] as const;

export const coolingAppendixRounds=coolingAppendixGroups.map(({prefix,limit,starts},group)=>
  starts.map((start,index)=>{
    const year=2023+Math.floor(index/3),round=index%3+1;
    return {id:group?`hansol-latest-${year}-${round}`:`hansol-mock-${index+1}`,
      year:group?year:0,round:group?round:index+1,
      title:group?`${year}년 ${round}회`:`제${index+1}회 핵심 모의고사`,
      from:prefix+start,to:prefix+((starts[index+1]||limit)-1),prefix};
  }));

export function coolingAppendixRound(page:string){
  const [group,number]=page.split('-').map(Number);
  const meta=coolingAppendixGroups[group-4];
  if(!meta||number>=meta.limit)return undefined;
  for(let index=meta.starts.length-1;index>=0;index--)
    if(meta.starts[index]<=number)return coolingAppendixRounds[group-4][index];
}
