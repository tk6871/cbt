import {useState} from 'react';
import {problemImage} from '../../cbt/problemImages';
import {StudyImageDialog} from '../StudyImageDialog';

export default function PracticalProblemImage({src,alt,maxHeight}:{src:string;alt:string;maxHeight?:number}){
 const [open,setOpen]=useState(false);
 const url=problemImage(src);
 if(!url)return null;
 return <>
   <button type="button" aria-label={alt+' 크게 보기'} onClick={()=>setOpen(true)} className="practical-image-button">
     <img src={url} alt={alt} style={maxHeight?{maxHeight,height:'auto',width:'auto',maxWidth:'100%',marginInline:'auto'}:undefined}
       loading="lazy" decoding="async" className="practical-prompt-image"/>
     <span>그림 크게 보기 ↗</span>
   </button>
   {open&&<StudyImageDialog src={url} alt={alt} onClose={()=>setOpen(false)} clickToClose/>}
 </>;
}
