import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import { h, render, type AppContext, type Component, type Slots } from 'vue';

import OptionalFeatureBoundary from '../components/OptionalFeatureBoundary.vue';

export const VueAppContext = createContext<AppContext | null>(null);

// Share the app's image resolver and injected learning tools with specialty widgets.
export function VueChild({
  component,
  bindings,
  slots,
  boundary,
}: {
  component: Component;
  bindings: Record<string, unknown>;
  slots?: Slots;
  boundary?: { label: string; compact?: boolean };
}) {
  const host = useRef<HTMLDivElement>(null);
  const context = useContext(VueAppContext);
  useLayoutEffect(() => {
    const node = boundary
      ? h(OptionalFeatureBoundary, boundary, { default: () => h(component, bindings, slots) })
      : h(component, bindings, slots);
    node.appContext = context;
    if (host.current) render(node, host.current);
  });
  useLayoutEffect(() => {
    const element = host.current;
    return () => {
      if (element) render(null, element);
    };
  }, []);
  return <div ref={host} style={{ display: 'contents' }} />;
}
