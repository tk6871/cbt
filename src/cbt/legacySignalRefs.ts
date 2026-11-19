// Adapter for archived Vue components that still participate in source type checks.
import {customRef, onScopeDispose} from 'vue';
import {Signal, type ReadonlySignal} from '@preact/signals-core';

export function legacyRef<T>(signal:ReadonlySignal<T>) {
  return customRef<T>((track,trigger)=>{
    const stop=signal.subscribe(trigger);
    onScopeDispose(stop);
    return {get(){track();return signal.value;},set(value){if(signal instanceof Signal)(signal as Signal<T>).value=value;}};
  });
}
