import lessons from '../../assets/equipment/lessons.json';
import {signal as ref} from '@preact/signals-core';
export const allowMobileModel = ref(localStorage.getItem('cbt-mobile-model') === 'on');
export function setMobileModel(value: boolean) {
  allowMobileModel.value=value;
  localStorage.setItem('cbt-mobile-model',value?'on':'off');
}
export type LessonKind = keyof typeof lessons;
export const equipmentLessons = new Map<string,LessonKind>();
for (const kind of Object.keys(lessons) as LessonKind[]) {
  for (const question of lessons[kind].questions) equipmentLessons.set(question, kind);
}
export {lessons};
