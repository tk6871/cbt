import { hvacAnswerHotspots } from './generatedHvacHotspots';
import { hvacAnswerSegments } from './generatedHvacAnswerSegments';
import { reviewedHvacAnswerSegments } from './reviewedHvacAnswerSegments';
import { reviewedHvacHotspots } from './reviewedHvacHotspots';
import type { Question } from './types';

export function prepareHvacQuestion(question: Question): Question {
  const sourceImage = question.sourceImage || '';
  const hotspots = sourceImage
    ? reviewedHvacHotspots[sourceImage] || hvacAnswerHotspots[sourceImage] || question.answerHotspots
    : question.answerHotspots;
  const segments = sourceImage
    ? { ...hvacAnswerSegments[sourceImage], ...reviewedHvacAnswerSegments[sourceImage] }
    : undefined;
  return {
    ...question,
    answerHotspots: hotspots?.map((hotspot) => ({
      ...hotspot,
      segments: segments?.[hotspot.choice],
    })),
  };
}
