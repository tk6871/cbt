import {signal} from '@preact/signals-core';
import { subscribe } from 'valtio/vanilla';
import { studyStore } from './storage';

type Key = keyof typeof studyStore;
function observeField(key: Key) {
  const revision = signal(0);
  let current = studyStore[key];
  const notify = () => { revision.value = revision.peek()+1; };
  const observeChildren = () => current && typeof current === 'object' ? subscribe(current, notify, true) : undefined;
  let unsubscribe = observeChildren();
  return {
    track() { void revision.value; },
    refresh() {
      const next = studyStore[key];
      if (Object.is(current, next)) return;
      unsubscribe?.();
      current = next;
      unsubscribe = observeChildren();
      notify();
    },
  };
}
const fields = new Map<Key, ReturnType<typeof observeField>>();
subscribe(studyStore, () => {
  for (const field of fields.values()) field.refresh();
}, true);

export const controllerStudyStore = new Proxy(studyStore, {
  get(target, property, receiver) {
    if (typeof property === 'string' && !property.startsWith('__v_')) {
      const key = property as Key;
      let field = fields.get(key);
      if (!field) { field = observeField(key); fields.set(key, field); }
      field.track();
    }
    return Reflect.get(target, property, receiver);
  },
});
