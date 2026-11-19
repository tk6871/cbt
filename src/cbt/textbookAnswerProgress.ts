type Progress = Record<string, unknown>;
const answersKey = 'textbookPageAnswersV1';
const timesKey = 'textbookAnswerTimesV1';
export const legacyDirectPrefix = 'cbt-book-direct-choice-v1::';

function numbers(value: unknown): Record<string, number> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, number> : {};
}

export function textbookAnswersIn(progress: Progress): Record<string, number> {
  return numbers(progress[answersKey]);
}

export function saveTextbookAnswer(progress: Progress, id: string, choice: number) {
  const answers = {...textbookAnswersIn(progress)};
  const times = numbers(progress[timesKey]);
  if (choice) answers[id] = choice;
  else delete answers[id];
  progress[answersKey] = answers;
  // Keep the last update even when the learner clears the answer.
  progress[timesKey] = {...times, [id]: Math.max(Date.now(), (times[id] || 0) + 1)};
}

export function importLegacyDirectAnswers(progress: Progress, storage: Pick<Storage, 'length' | 'key' | 'getItem'>) {
  const answers = textbookAnswersIn(progress);
  const times = numbers(progress[timesKey]);
  const imported: Record<string, number> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(legacyDirectPrefix + 'hansol-direct-')) continue;
    const id = key.slice(legacyDirectPrefix.length);
    const choice = Number(storage.getItem(key));
    if (!(id in answers) && !(id in times) && [1, 2, 3, 4].includes(choice)) imported[id] = choice;
  }
  if (Object.keys(imported).length) progress[answersKey] = {...answers, ...imported};
}

export function mergeTextbookAnswers(merged: Progress, local: Progress, remote: Progress) {
  if (!(answersKey in merged) && !(timesKey in merged)) return;
  const left = textbookAnswersIn(local), right = textbookAnswersIn(remote);
  const localTimes = numbers(local[timesKey]), remoteTimes = numbers(remote[timesKey]);
  const answers: Record<string, number> = {}, times: Record<string, number> = {};
  for (const id of new Set([...Object.keys(left), ...Object.keys(right), ...Object.keys(localTimes), ...Object.keys(remoteTimes)])) {
    const localTime = localTimes[id] || 0, remoteTime = remoteTimes[id] || 0;
    // Untimed legacy copies fill missing entries. On a timestamp tie the server copy wins.
    const useRemote = (id in right || id in remoteTimes) && remoteTime >= localTime;
    const choice = useRemote ? right[id] : left[id];
    if (choice) answers[id] = choice;
    if (localTime || remoteTime) times[id] = Math.max(localTime, remoteTime);
  }
  merged[answersKey] = answers;
  if (Object.keys(times).length) merged[timesKey] = times;
}
