import {createContext} from 'react';
export interface PinnedSolution {id:string;number:number;text:string;images:string[];round:string}
export type ToolName='calculator'|'notes'|'explanation';

export const PinSolutionContext=createContext<((solution:PinnedSolution)=>void)|undefined>(undefined);
