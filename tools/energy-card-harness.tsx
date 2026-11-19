import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import QuestionCard from '../src/react/session/QuestionCard';
import type {QuestionItem, StudyMode} from '../src/cbt/types';
import '../src/cbt/cbt.css';

export function mountEnergyCard(items: QuestionItem[]) {
  const root = createRoot(document.getElementById('review')!);
  let index = 0;
  let selected: number | undefined;
  let indicator: 'area' | 'marker' = 'area';
  let mode: StudyMode = 'exam';
  function render() {
    flushSync(() => root.render(<QuestionCard item={items[index]} selected={selected} mode={mode}
      imageAnswerMode="hotspot" hotspotIndicator={indicator} onChoose={choice => {
        selected = choice === selected ? undefined : choice;
        render();
      }}/>));
  }
  render();
  return {
    items,
    get selected() { return selected; },
    show(i: number, style: typeof indicator = 'area') {
      index = i;
      selected = undefined;
      indicator = style;
      render();
    },
    setMode(value: StudyMode) { mode = value; render(); },
    tick() { return new Promise<void>(resolve => requestAnimationFrame(() => resolve())); },
  };
}
