import type {CSSProperties} from 'react';

export interface ImageChoice { number: number; style: CSSProperties; className?: string }
export function PrintedChoices({choices, selected, onChoose, buttonClass}: {
  choices: ImageChoice[]; selected?: number; onChoose: (number: number) => void; buttonClass: string;
}) {
  return <>{choices.map(choice => <button key={choice.number} type="button" data-printed-number={choice.number}
    className={[buttonClass,choice.className].filter(Boolean).join(' ')} style={choice.style}
    aria-label={`이미지에서 ${choice.number}번 선택`} aria-pressed={selected === choice.number}
    onClick={() => onChoose(choice.number)}/>)}</>;
}
