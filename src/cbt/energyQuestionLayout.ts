import energyMidtermHotspots from '../../data/energy-midterm-hotspots.json' with { type: 'json' };
import energyTextbookHotspots from '../../data/energy-textbook-hotspots.json' with { type: 'json' };
import type { AnswerHotspot, Question, Round, QuestionItem } from './types';
import reviewedEnergyChoices from '../../data/energy-reviewed-printed-options.json' with { type: 'json' };
import {energyTextbookComcbtSource,energyExplanation} from './energyTextbookExplanation';
import energyBookSearch from '../../data/energy-textbook-search.json' with {type:'json'};

const energyImageHotspots = { ...energyMidtermHotspots, ...energyTextbookHotspots } as Record<string, AnswerHotspot[]>;

const reviewedEnergyByImage: Record<string, AnswerHotspot[]> = reviewedEnergyChoices;
export function withReviewedEnergyChoices(question: Question): Question {
  const choices = reviewedEnergyByImage[question.sourceImage || ''];
  return choices ? { ...question, answerHotspots: choices } : question;
}

export function prepareEnergyQuestions(round: Round, sourceQuestions: Map<string, Question>, midterm: boolean): Question[] {
  return round.questions.map(question => {
    const id = midterm
      ? `${question._originRoundId || round.id}:${question._originalNumber || question.number}`
      : `${round.id}:${question.number}`;
    const sourceId = energyTextbookComcbtSource(id);
    const source = sourceId ? sourceQuestions.get(sourceId) : undefined;
    if (!midterm) return energyExplanation(withReviewedEnergyChoices(question), id, source);
    return {
      ...energyExplanation(question, id, source),
      answerHotspots: energyImageHotspots[question.sourceImage || ''] || question.answerHotspots,
    };
  });
}

export function prepareEnergyBookItem(question: Question, id: string, items: Map<string, QuestionItem>): Question {
  const sourceId = energyTextbookComcbtSource(id);
  const result=energyExplanation(withReviewedEnergyChoices(question), id, sourceId ? items.get(sourceId)?.question : undefined);
  return {...result,bookFilterText:(energyBookSearch.texts as Record<string,string>)[id]};
}
