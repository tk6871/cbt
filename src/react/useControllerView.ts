import {useLayoutEffect, useState, type ReactNode} from 'react';
import {useSignals} from '@preact/signals-react/runtime';

export function useControllerView<T extends {start(): void; stop(): void}>(create: () => T, render: (controller:T) => ReactNode) {
  const [controller] = useState(create);
  useLayoutEffect(() => {controller.start(); return () => controller.stop();}, [controller]);
  const tracked = useSignals(1);
  try { return render(controller); }
  finally { tracked.f(); }
}
