import {createContext} from 'react';
import type {InjectionKey} from 'vue';
export interface PinnedSolution {id:string;number:number;text:string;images:string[];round:string}
export const pinSolutionKey: InjectionKey<(solution:PinnedSolution)=>void> = Symbol('pin-solution');
export type ToolName='calculator'|'notes'|'explanation';

export const PinSolutionContext=createContext<((solution:PinnedSolution)=>void)|undefined>(undefined);
