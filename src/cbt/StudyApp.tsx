import {PinSolutionContext} from '../react/workspaceTypes';
import {useControllerView} from '../react/useControllerView';
import {createStudyController,type StudyController} from './studyController';
import {renderStudy} from './StudyView';
import type {Catalog} from './types';

function renderController(controller:StudyController){
 return <PinSolutionContext.Provider value={controller.pinSolution}>{renderStudy(controller.model)}</PinSolutionContext.Provider>;
}
export function StudyApp({initialCatalogs}:{initialCatalogs:Catalog[]}){
 return useControllerView(()=>createStudyController(initialCatalogs),renderController);
}
