import type {PinnedSolution, ToolName} from './workspaceTypes';

export interface HomeCatalog {
  key: string;
  name: string;
  icon: string;
  color: string;
  rounds: number;
  questions: number;
}

export interface StudyHomeProps {
  name: string;
  selected: string;
  groups: { label: string; items: HomeCatalog[] }[];
  loadingStats: boolean;
  answered: number;
  accuracy: number;
  wrong: number;
  resume: boolean;
  onRounds(): void;
  onBook?(): void;
  onResume(): void;
  onSelect(key: string): void;
}

export interface SubjectSelection {
  groups:{label:string;items:{key:string;name:string}[]}[];
  selected:string;name:string;onSelect:(key:string)=>void;
}

export interface MaterialSelection {active:number;actions:(()=>void)[]}

export interface PanelProps {calculator:boolean;notes:boolean;solution:PinnedSolution|null;scope:string;close:(name:ToolName)=>void}
