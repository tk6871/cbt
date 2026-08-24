import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/hvac.js'), 'utf8'), context, { filename: 'data/hvac.js' });

const catalog = context.window.CBT_DATA_HVAC;
const comcbtRoot = path.join(root, 'assets/hvac/assets/comcbt');
const answerImageFiles = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/m\d+b[1-4]\.(?:png|gif|jpe?g|webp)$/i.test(entry.name)) answerImageFiles.push(fullPath);
  }
}

walk(comcbtRoot);

const availableAnswerImages = new Map();
for (const file of answerImageFiles) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const match = relative.match(/comcbt\/(\d{8})\/images\/[^/]*?m(\d+)b([1-4])\.(png|gif|jpe?g|webp)$/i);
  if (!match) continue;
  const [, date, question, choice, extension] = match;
  const key = `${date}:${Number(question)}:${Number(choice)}`;
  const existing = availableAnswerImages.get(key) || [];
  existing.push({ path: relative, extension: extension.toLowerCase() });
  availableAnswerImages.set(key, existing);
}

function choiceHasImage(choice) {
  return Boolean(choice?.images?.length || /<img\b/i.test(choice?.html || ''));
}

function clean(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/gi, ' ').replace(/\s+/g, ' ').trim();
}

function preferredImage(candidates) {
  return candidates.find((candidate) => candidate.extension === 'png')
    || candidates.find((candidate) => candidate.extension === 'webp')
    || candidates[0];
}

const missingAnswerImageLinks = [];
const missingExplanations = [];
const unreadableSourceQuestions = [];
const genericExplanationCandidates = [];
const visualChoiceCandidates = [];
const allQuestions = [];
const reviewedDiagramReferenceChoices = new Set([
  'hvac-20060305/28',
  'hvac-20070304/21',
  'hvac-20080511/76',
  'hvac-20080727/34',
]);
let questionCount = 0;

for (const round of catalog.rounds || []) {
  const date = String(round.date || round.sortKey || '').replace(/\D/g, '').slice(0, 8);
  for (const question of round.questions || []) {
    questionCount += 1;
    const location = `${round.id}/${question.number}`;
    allQuestions.push({ round, question, location });
    if (!clean(question.explanation || question.explanationHtml)) missingExplanations.push({ location });
    const text = clean(question.text || question.html);
    const choiceText = (question.choices || []).map((choice) => clean(choice.text || choice.html));
    const unreadableChoices = (question.choices || []).filter((choice, index) => {
      const value = choiceText[index];
      return !choiceHasImage(choice)
        && (!value || new RegExp(`^(?:[①②③④]|${index + 1}(?:번)?)$`).test(value));
    });
    if (/원문\s*인식\s*확인\s*필요/i.test(text)
      || unreadableChoices.length >= 3) {
      unreadableSourceQuestions.push({ location, text, choices: choiceText, sourceImage: question.sourceImage || null });
    }
    if (Number(round.year) <= 2020
      && /그림|선도|도시기호|기호|부착위치|설치위치|회로|배선도|관계도|신호\s*흐름/i.test(text)
      && unreadableChoices.length >= 3) {
      visualChoiceCandidates.push({ location, text, choices: choiceText, sourceImages: question.images || [] });
    }
    const explanation = clean(question.explanation || question.explanationHtml);
    if (/문제(?:의|와)?\s*(?:본문|보기|조건).{0,30}(?:확인|보라|읽)/i.test(explanation)
      && explanation.length < 180) {
      genericExplanationCandidates.push({ location, explanation });
    }
    (question.choices || []).forEach((choice, index) => {
      const key = `${date}:${Number(question.number)}:${index + 1}`;
      const available = availableAnswerImages.get(key) || [];
      if (available.length && !choiceHasImage(choice)) {
        missingAnswerImageLinks.push({
          location,
          choice: index + 1,
          currentText: clean(choice.text || choice.html),
          suggestedImage: preferredImage(available)?.path,
          alternatives: available.map((candidate) => candidate.path),
        });
      }
    });
  }
}

function signature(value) {
  return clean(value)
    .replace(/^\d+\s*[.)번,:]?\s*/, '')
    .replace(/\([^)]*단[^)]*\)/g, '')
    .replace(/[^0-9a-z가-힣]+/gi, '')
    .toLowerCase();
}

for (const candidate of visualChoiceCandidates) {
  const current = allQuestions.find((row) => row.location === candidate.location);
  if (!current) continue;
  const target = signature(current.question.text || current.question.html);
  candidate.duplicateSources = allQuestions
    .filter((row) => row.location !== candidate.location && signature(row.question.text || row.question.html) === target)
    .filter((row) => row.question.choices?.some(choiceHasImage))
    .map((row) => ({
      location: row.location,
      choices: row.question.choices.map((choice) => ({ text: clean(choice.text || choice.html), images: choice.images || [] })),
    }));
  candidate.reviewedAsDiagramReference = reviewedDiagramReferenceChoices.has(candidate.location);
}

const unresolvedVisualChoiceCandidates = visualChoiceCandidates
  .filter((candidate) => !candidate.reviewedAsDiagramReference);

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    questions: questionCount,
    answerImageAssets: answerImageFiles.length,
    answerImageAssetKeys: availableAnswerImages.size,
    missingAnswerImageLinks: missingAnswerImageLinks.length,
    missingExplanations: missingExplanations.length,
    unreadableSourceQuestions: unreadableSourceQuestions.length,
    genericExplanationCandidates: genericExplanationCandidates.length,
    reviewedDiagramReferenceChoices: visualChoiceCandidates.length - unresolvedVisualChoiceCandidates.length,
    unresolvedVisualChoiceCandidates: unresolvedVisualChoiceCandidates.length,
  },
  missingAnswerImageLinks,
  missingExplanations,
  unreadableSourceQuestions,
  genericExplanationCandidates,
  visualChoiceCandidates,
  unresolvedVisualChoiceCandidates,
};

const reportIndex = process.argv.indexOf('--report');
if (reportIndex >= 0 && process.argv[reportIndex + 1]) {
  const reportPath = path.resolve(root, process.argv[reportIndex + 1]);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`검증 보고서: ${path.relative(root, reportPath)}`);
}

console.log(JSON.stringify(report.totals, null, 2));
if (missingAnswerImageLinks.length || missingExplanations.length || unresolvedVisualChoiceCandidates.length) {
  process.exitCode = 1;
}
