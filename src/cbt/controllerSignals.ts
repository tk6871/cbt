import {computed, effect, signal, Signal, untracked, type ReadonlySignal} from '@preact/signals-core';
import {deepSignal} from 'deepsignal/core';

export {computed, signal as ref, signal as shallowRef};
export function reactive<T extends object>(value:T): T { return deepSignal(value) as T; }

// Only cells whose contents are edited in place need deep observation.
export function mutableRef<T>(initial:T) {
  const wrap = (value:T) => value && typeof value === 'object' ? reactive(value) : value;
  const cell = signal(wrap(initial));
  return writableComputed({get: () => cell.value, set: value => { cell.value = wrap(value); }});
}

export function writableComputed<T>({get,set}:{get:()=>T;set:(value:T)=>void}) {
  const cell = computed(get);
  return new Proxy(cell, {set(target,key,value) {
    if (key !== 'value') return Reflect.set(target,key,value);
    set(value);
    return true;
  }}) as Signal<T>;
}

type Values<T> = {[K in keyof T]: T[K] extends ReadonlySignal<infer V> ? V : T[K]};
export function proxyRefs<T extends object>(model:T):Values<T> {
  return new Proxy(model, {
    get(target,key) {
      const member = Reflect.get(target,key);
      return member instanceof Signal ? member.value : member;
    },
    set(target,key,value) {
      const member = Reflect.get(target,key);
      if (!(member instanceof Signal)) return Reflect.set(target,key,value);
      member.value = value;
      return true;
    },
  }) as Values<T>;
}

export function nextTick<T=void>(callback?:()=>T):Promise<T | void> {
  return new Promise<void>(resolve => requestAnimationFrame(()=>resolve())).then(callback);
}

type Source<T> = ReadonlySignal<T> | (()=>T);
type WatchCallback<T> = (value:T, previous:T | undefined, cleanup:(stop:()=>void)=>void)=>void;
interface WatchOptions { immediate?:boolean; deep?:boolean }
export function createObservers() {
  const registrations:Array<()=>()=>void> = [];
  let stops:Array<()=>void> = [];
  function observe<T>(source: Source<T>, callback:WatchCallback<T>, options?:WatchOptions): void;
  function observe<T extends readonly unknown[]>(sources:readonly [...{[K in keyof T]: Source<T[K]>}], callback:WatchCallback<T>, options?:WatchOptions):void;
  function observe(source:unknown, callback:WatchCallback<any>, options:WatchOptions={}) {
    const multiple = Array.isArray(source);
    const read = (input:Source<unknown>) => typeof input==='function' ? input() : input.value;
    registrations.push(()=>{
      let previous:unknown[], cleanup:(()=>void)|undefined, first=true, queued=false, active=true;
      const readValues=()=>multiple ? source.map(read) : [read(source as Source<unknown>)];
      const deliver=(values:unknown[])=>{
        const old=previous;
        previous=values;
        cleanup?.();
        cleanup=undefined;
        callback(multiple?values:values[0],multiple?old:old?.[0],fn=>{cleanup=fn;});
      };
      const stop=effect(()=>{
        const values=readValues();
        if(first){
          first=false;
          if(options.immediate) untracked(()=>deliver(values));
          else previous=values;
        } else if(!queued){
          queued=true;
          queueMicrotask(()=>{
            queued=false;
            if(!active)return;
            const next=readValues();
            if(next.some((value,i)=>!Object.is(value,previous[i]))) deliver(next);
          });
        }
      });
      return ()=>{active=false;stop();cleanup?.();};
    });
  }
  return {observe,start(){stops=registrations.map(setup=>setup());},stop(){stops.forEach(stop=>stop());stops=[];}};
}
