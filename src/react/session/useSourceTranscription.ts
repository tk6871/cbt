import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {explanationDisplay} from '../../cbt/explanationDisplay';
import {subscribeImageTranscription, imageSourceKey, imageTranscriptionSnapshot, requestImageTranscription} from '../../cbt/imageTranscription';

const readDisplay=()=>explanationDisplay.value;
const subscribeDisplay=(notify:()=>void)=>explanationDisplay.subscribe(notify);
export const useExplanationDisplay=()=>useSyncExternalStore(subscribeDisplay,readDisplay);

export function useSourceTranscription(source?:string | null) {
  const key=imageSourceKey(source);
  const mode=useExplanationDisplay();
  const read=useCallback(()=>imageTranscriptionSnapshot(key,mode),[key,mode]);
  const subscribe=useCallback((notify:()=>void)=>subscribeImageTranscription(key,notify),[key]);
  const result=useSyncExternalStore(subscribe,read);
  useEffect(()=>requestImageTranscription(key,mode),[key,mode]);
  return {mode,entry:result==='pending'?undefined:result,pending:result==='pending'};
}
