import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const args = process.argv.slice(2);

function option(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const cacheDir = path.resolve(option('--cache', '/private/tmp/cbt-source-answer-cache'));
const reportPath = path.resolve(option('--report', '/private/tmp/cbt-source-answer-audit.json'));
const concurrency = Math.max(1, Math.min(6, Number(option('--concurrency', '3')) || 3));
const refresh = args.includes('--refresh');

const dataFiles = ['hvac.js', 'safety.js', 'energy.js', 'energy-engineer.js', 'maintenance.js', 'jewelry.js'];
const context = { window: {} };
for (const file of dataFiles) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'data', file), 'utf8'), context, { filename: file });
}

const catalogs = [
  context.window.CBT_DATA_HVAC,
  context.window.CBT_DATA_SAFETY,
  context.window.CBT_DATA_ENERGY,
  context.window.CBT_DATA_ENERGY_ENGINEER,
  context.window.CBT_DATA_MAINTENANCE,
  ...(context.window.CBT_DATA_JEWELRY || []),
].filter(Boolean);

const sourcePrefixes = new Map([
  ['hvac', 'nq'],
  ['safety', 'kv'],
  ['energy', 'em'],
  ['energy-engineer', 'dd'],
  ['maintenance', 'bd'],
  ['gem-appraiser', 'gf'],
  ['precious-industrial', 'cav'],
  ['precious-craftsman', 'hq'],
  ['precious-master', 'cau'],
]);

const tasks = [];
const skippedRounds = [];
for (const catalog of catalogs) {
  const prefix = sourcePrefixes.get(catalog.key);
  for (const round of catalog.rounds || []) {
    if (!prefix) {
      skippedRounds.push({ catalog: catalog.key, roundId: round.id, reason: '자동 대조용 공개 답안 URL 규칙 없음' });
      continue;
    }
    if (!round.date) {
      skippedRounds.push({
        catalog: catalog.key,
        roundId: round.id,
        reason: '복원 회차 날짜 없음/별도 원문 이미지',
      });
      continue;
    }
    tasks.push({
      catalog: catalog.key,
      round,
      prefix,
      matchMode: catalog.key === 'precious-master' ? 'text' : 'number',
      url: `https://cbtbank.kr/exam/${prefix}${round.date}`,
      cachePath: path.join(cacheDir, `${prefix}${round.date}.html`),
    });
  }
}

fs.mkdirSync(cacheDir, { recursive: true });

async function fetchSource(task) {
  if (!refresh && fs.existsSync(task.cachePath)) return fs.readFileSync(task.cachePath, 'utf8');
  const response = await fetch(task.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; CBTSourceAnswerAudit/1.0; local educational verification)',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes('question-num=') || !html.includes('class="correct"')) {
    throw new Error('문제·정답 표식을 찾지 못함');
  }
  fs.writeFileSync(task.cachePath, html);
  return html;
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizedQuestionText(value) {
  return plainText(value)
    .normalize('NFKC')
    .replace(/[\s.,·:：?'"“”‘’()（）\[\]{}\-]/g, '')
    .toLowerCase();
}

function parseSourceQuestions(html) {
  const questions = [];
  const pattern = /question-num=["'](\d+)["'][\s\S]*?<p[^>]*class=["'][^"']*exam-title[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["'][^"']*exam-number[^"']*["'][^>]*>[\s\S]*?<\/span>\s*\.\s*([\s\S]*?)<\/p>[\s\S]*?<ol[^>]*\bcorrect=["']([1-4])["']/gi;
  for (const match of html.matchAll(pattern)) {
    questions.push({
      number: Number(match[1]),
      text: plainText(match[2]),
      normalizedText: normalizedQuestionText(match[2]),
      answer: Number(match[3]),
    });
  }
  return questions;
}

const comparedRounds = [];
const failures = [];
const answerMismatches = [];
const missingSourceQuestions = [];
const missingLocalQuestions = [];
let nextTask = 0;

async function worker() {
  while (nextTask < tasks.length) {
    const task = tasks[nextTask++];
    try {
      const html = await fetchSource(task);
      const sourceQuestions = parseSourceQuestions(html);
      const localQuestions = new Map((task.round.questions || []).map((question) => [question.number, question]));
      let comparedQuestions = 0;
      if (task.matchMode === 'text') {
        const sourceByText = new Map(sourceQuestions.map((question) => [question.normalizedText, question]));
        for (const [number, question] of localQuestions) {
          const sourceQuestion = sourceByText.get(normalizedQuestionText(question.text || question.html || ''));
          if (!sourceQuestion) {
            missingSourceQuestions.push({
              catalog: task.catalog,
              roundId: task.round.id,
              number,
              localAnswer: question.answer,
              source: task.url,
            });
            continue;
          }
          comparedQuestions += 1;
          if (question.answer !== sourceQuestion.answer) {
            answerMismatches.push({
              catalog: task.catalog,
              roundId: task.round.id,
              number,
              sourceNumber: sourceQuestion.number,
              localAnswer: question.answer,
              sourceAnswer: sourceQuestion.answer,
              question: question.text || question.html || '',
              choices: (question.choices || []).map((choice) => choice.text || choice.html || ''),
              explanation: question.explanation || question.explanationHtml || '',
              source: task.url,
            });
          }
        }
      } else {
        const sourceAnswers = new Map(sourceQuestions.map((question) => [question.number, question.answer]));
        for (const [number, sourceAnswer] of sourceAnswers) {
          const question = localQuestions.get(number);
          if (!question) {
            missingLocalQuestions.push({ catalog: task.catalog, roundId: task.round.id, number, sourceAnswer, source: task.url });
            continue;
          }
          comparedQuestions += 1;
          if (question.answer !== sourceAnswer) {
            answerMismatches.push({
              catalog: task.catalog,
              roundId: task.round.id,
              number,
              localAnswer: question.answer,
              sourceAnswer,
              question: question.text || question.html || '',
              choices: (question.choices || []).map((choice) => choice.text || choice.html || ''),
              explanation: question.explanation || question.explanationHtml || '',
              source: task.url,
            });
          }
        }
        for (const [number, question] of localQuestions) {
          if (!sourceAnswers.has(number)) {
            missingSourceQuestions.push({
              catalog: task.catalog,
              roundId: task.round.id,
              number,
              localAnswer: question.answer,
              source: task.url,
            });
          }
        }
      }
      comparedRounds.push({
        catalog: task.catalog,
        roundId: task.round.id,
        source: task.url,
        localQuestions: localQuestions.size,
        sourceQuestions: sourceQuestions.length,
        comparedQuestions,
      });
    } catch (error) {
      failures.push({ catalog: task.catalog, roundId: task.round.id, source: task.url, error: error.message });
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const report = {
  generatedAt: new Date().toISOString(),
  scope: 'CBT문제은행 공개 회차 페이지의 문제별 정답 표식과 저장소 등록 정답 자동 대조',
  totals: {
    targetRounds: tasks.length,
    comparedRounds: comparedRounds.length,
    comparedQuestions: comparedRounds.reduce((sum, row) => sum + row.comparedQuestions, 0),
    answerMismatches: answerMismatches.length,
    missingSourceQuestions: missingSourceQuestions.length,
    missingLocalQuestions: missingLocalQuestions.length,
    failedRounds: failures.length,
    skippedRounds: skippedRounds.length,
  },
  comparedRounds: comparedRounds.sort((a, b) => a.roundId.localeCompare(b.roundId)),
  answerMismatches,
  missingSourceQuestions,
  missingLocalQuestions,
  failures,
  skippedRounds,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 2));
console.log(`검증 보고서: ${reportPath}`);

if (failures.length || missingSourceQuestions.length || missingLocalQuestions.length) process.exitCode = 1;
