import {writeFileSync} from 'node:fs';
import {readQuestionBanks} from './read-question-banks.mjs';

const banks = Array.from(readQuestionBanks(process.cwd()), bank => ({
  key: bank.key,
  name: bank.name,
  rounds: bank.rounds.map(round => ({id:round.id, title:round.title || round.id, questions:round.questions.length})),
}));
writeFileSync('data/admin-bank-index.json', JSON.stringify(banks)+'\n');
