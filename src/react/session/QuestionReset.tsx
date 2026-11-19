import {useState} from 'react';

export function QuestionReset({choice, setChoice}: {choice?: number; setChoice: (choice: number) => void}) {
  const [previous, setPrevious] = useState(0);
  if (!choice && !previous) return null;
  return <button type="button" className="question-reset" onClick={() => {
    if (choice) {
      setPrevious(choice);
      setChoice(0);
    } else {
      setChoice(previous);
      setPrevious(0);
    }
  }}>{choice ? '이 문제 초기화' : '초기화 되돌리기'}</button>;
}
