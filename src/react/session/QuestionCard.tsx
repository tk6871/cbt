import {useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {PinSolutionContext} from '../workspaceTypes';
import {equipmentLessons} from '../modelPreference';
import {problemImage as choiceImage, problemImageHtml as choiceHtml} from '../../cbt/problemImages';
import {hotspotStyle, unifiedAnswerHotspots} from '../../cbt/answerHotspotGeometry';
import {isImagePrimary} from '../../cbt/catalog';
import {explanationSource} from '../../cbt/explanationSource';
import {calculationGuideFor, commonCalculationNumberOrigins, isCalculationItem} from '../../cbt/calculationGuide';
import {submitQuestionIssue, type QuestionIssueType} from '../../cbt/cloudSync';
import type {QuestionItem, StudyMode} from '../../cbt/types';
import {escapeTranscription} from '../../cbt/imageTranscription';
import {useSourceTranscription} from './useSourceTranscription';
import {renderQuestionCardView} from './QuestionCardView';

export interface QuestionCardFields {
  item: QuestionItem;
  selected?: number;
  mode: StudyMode;
  subjectStart?: boolean;
  subjectNumber?: number;
  displayNumber?: number;
  bookmarked?: boolean;
  kept?: boolean;
  calculationMode?: boolean;
  imageAnswerMode?: 'buttons' | 'hotspot';
  answerLayout?: 'classic' | 'inline' | 'hotspot';
  hotspotIndicator?: 'marker' | 'area';
  restoredImageTheme?: 'auto' | 'original';
  solveLayout?: 'standard' | 'comcbt' | 'combat';
  active?: boolean;
  experimentalFeatures?: boolean;
  confidence?: 'sure' | 'unsure' | 'guess';
  mistakeReason?: 'concept' | 'formula' | 'unit' | 'careless';
  studyNote?: string;
  presentation?: 'book';
}
export interface QuestionCardProps extends QuestionCardFields {
  id?:string;
  onChoose?: (choice: number) => void;
  onToggleBookmark?: () => void;
  onToggleKeep?: () => void;
  onAskAi?: () => void;
  onActivate?: () => void;
  onSetConfidence?: (value: 'sure' | 'unsure' | 'guess') => void;
  onSetMistakeReason?: (value: 'concept' | 'formula' | 'unit' | 'careless') => void;
  onUpdateStudyNote?: (note: string) => void;
}

const circles = ['①', '②', '③', '④'];
const issueTypeOptions: Array<{ value: QuestionIssueType; label: string }> = [
  { value: 'missing-image', label: '그림 없음' },
  { value: 'wrong-image', label: '그림 오류·잘림' },
  { value: 'answer-hotspot', label: '답안 클릭 영역' },
  { value: 'answer', label: '정답 오류' },
  { value: 'explanation', label: '해설 오류·부족' },
  { value: 'text-ocr', label: '글자·수식 오류' },
  { value: 'layout', label: '화면 배치 문제' },
  { value: 'other', label: '기타' },
];
function readableText(value = ''): string {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&(gt|lt|amp|quot|apos|#39|#\d+|#x[\da-f]+);/gi, (entity, code:string) => {
      const named:Record<string,string>={gt:'>',lt:'<',amp:'&',quot:'"',apos:"'"};
      if(named[code.toLowerCase()])return named[code.toLowerCase()];
      const n=code.toLowerCase().startsWith('#x')?parseInt(code.slice(2),16):Number(code.slice(1));
      return Number.isInteger(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function leadingQuestionNumberPattern(number: number): RegExp {
  return new RegExp(`^(?:\\s|&nbsp;)*${number}\\s*(?:[.)：:]|번(?:\\s*[.)：:]?)?)(?:\\s|&nbsp;)*`);
}

function leadingChoiceMarkerPattern(index: number): RegExp {
  const number = index + 1;
  return new RegExp(`^(?:\\s|&nbsp;)*(?:${circles[index]}|${number}\\s*(?:[.)：:]|번(?:\\s*[.)：:]?)?))(?:\\s|&nbsp;)*`);
}

function hasReadableChoice(choice: QuestionItem['question']['choices'][number], index: number): boolean {
  if (choice.images?.length) return true;
  const text = (choice.text || choice.html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Boolean(text) && !new RegExp(`^(?:[①②③④]|${index + 1}(?:번)?)$`).test(text);
}

const emptyHotspots: NonNullable<QuestionItem['question']['answerHotspots']> = [];

// A different question gets its own draft, countdown, speech and image overrides.
export default function QuestionCard(props:QuestionCardProps) {
  return <QuestionCardBody key={props.item.id} {...props}/>;
}

function QuestionCardBody(props:QuestionCardProps) {
  return renderQuestionCardView(useQuestionCard(props));
}

function useQuestionCard(props:QuestionCardProps) {
  const {entry:sourceTranscription, pending:transcriptionPending}=useSourceTranscription(props.item.question.sourceImage);
  const pinSolution=useContext(PinSolutionContext);
  const sourceImageRef=useRef<HTMLImageElement>(null);
  const choiceLayoutProbeRef=useRef<HTMLDivElement>(null);
  const explanationAutoCloseTimer=useRef<number | undefined>(undefined);
  const speech=useRef<SpeechSynthesisUtterance | null>(null);
  const [sourceImageOverride, setSourceImageOverride] = useState(false);
  const [forceVerticalTextChoices, setForceVerticalTextChoices] = useState(false);
  const [answerHighlightStyles, setAnswerHighlightStyles] = useState<Record<number, Record<string,string>>>({});
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explanationDismissed, setExplanationDismissed] = useState(false);
  const [beginnerCalculationOpen, setBeginnerCalculationOpen] = useState(false);
  const [explanationAutoCloseSeconds, setExplanationAutoCloseSeconds] = useState(0);
  const [speechSpeaking, setSpeechSpeaking] = useState(false);
  const [issueReportOpen, setIssueReportOpen] = useState(false);
  const [issueReportTypes, setIssueReportTypes] = useState<QuestionIssueType[]>([]);
  const [issueReportDetails, setIssueReportDetails] = useState('');
  const [issueReportSending, setIssueReportSending] = useState(false);
  const [issueReportError, setIssueReportError] = useState('');
  const [issueReportSubmitted, setIssueReportSubmitted] = useState(false);
  const speechAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const transcribedQuestion = !sourceImageOverride?sourceTranscription?.question:undefined;
  const primaryImage = isImagePrimary(props.item)&&!transcribedQuestion;
  const hansolQuestion = props.item.round.qualificationKey === 'hvac-hansol';
  const fieldReportQuestion = props.item.round.kind === 'field-report-practice';
  const restoredQuestion = !fieldReportQuestion && props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021;
  const restoredImageClass = `restored-image-${props.restoredImageTheme || 'auto'}`;
  const correctSelected = props.selected === props.item.question.answer;
  const calculationGuide = useMemo(() => calculationGuideFor(props.item), [props.item]);
  const calculationProblem = useMemo(() => isCalculationItem(props.item), [props.item]);
  const beginnerCalculationAvailable = (props.calculationMode || calculationProblem)
    && calculationGuide.reliable !== false;
  const calculationNumberOrigins = useMemo(() => {
    const guideOrigins = calculationGuide.numberOrigins || [];
    const guideText = guideOrigins.join(' ');
    const commonOrigins = commonCalculationNumberOrigins(props.item).filter((origin) => {
      const keyNumber = origin.match(/(?:\d[\d,.]*|√3)/)?.[0];
      return !keyNumber || !guideText.includes(keyNumber);
    });
    return [...new Set([...guideOrigins, ...commonOrigins])];
  }, [props.item, calculationGuide]);
  const verifiedHotspots = useMemo(() => {
    const {round, id, question} = props.item;
    const bookImage = hansolQuestion || round.kind === 'textbook-pages'
      || id.startsWith('energy-industrial-restored-');
    return primaryImage && (bookImage || props.imageAnswerMode === 'hotspot' || props.presentation === 'book')
      ? question.answerHotspots || emptyHotspots : emptyHotspots;
  }, [props.item, primaryImage, hansolQuestion, props.imageAnswerMode, props.presentation]);
  const unifiedHotspots = useMemo(() => unifiedAnswerHotspots(verifiedHotspots), [verifiedHotspots]);
  const selectedAreaHighlightStyles = useMemo(() => {
    if (!props.selected) return [];
    const hotspot = unifiedHotspots.find((item) => item.choice === props.selected);
    if (hotspot?.segments?.length) return [hotspotStyle(hotspot)];
    const fallback = answerHighlightStyles[props.selected];
    return fallback ? [fallback] : [];
  }, [props.selected, unifiedHotspots, answerHighlightStyles]);
  const selectedMarkerStyle = useMemo(() => {
    const highlight = selectedAreaHighlightStyles[0];
    return highlight ? { left: highlight.left, top: highlight.top } : undefined;
  }, [selectedAreaHighlightStyles]);
  const selectedAnswerState = ({
    correct: props.mode === 'learn' && props.selected === props.item.question.answer,
    wrong: props.mode === 'learn' && props.selected !== props.item.question.answer,
  });
  const displayedQuestionMarkup = useMemo(() => {
    if(transcribedQuestion)return escapeTranscription(transcribedQuestion.stem);
    const source = props.item.question.html || props.item.question.text || '';
    return String(source).replace(leadingQuestionNumberPattern(props.item.question.number), '');
  }, [props.item, transcribedQuestion]);
  const embeddedChoiceMarkers = props.item.question.choices.length === 4
    && props.item.question.choices.every((choice, index) => leadingChoiceMarkerPattern(index)
      .test(String(choice.html || choice.text || '')));
  const displayedChoices = useMemo(() => props.item.question.choices.map((choice, index) => {
    if(transcribedQuestion)return escapeTranscription(transcribedQuestion.choices[index]||'');
    const source = String(choice.html || choice.text || `${index + 1}번`);
    return embeddedChoiceMarkers ? source.replace(leadingChoiceMarkerPattern(index), '') : source;
  }), [props.item, transcribedQuestion, embeddedChoiceMarkers]);
  const canReadQuestion = speechAvailable
    && readableText(displayedQuestionMarkup).length >= 4
    && displayedChoices.some((choice) => readableText(choice).length >= 1);

  const showQuestionIdentity = primaryImage
    && Boolean(props.displayNumber)
    && props.displayNumber !== props.item.question.number;

  const explanationOrigin = explanationSource(props.item.question);
  const explanationRaw = String(
    props.item.question.explanationHtml || props.item.question.explanation || '',
  );
  const primaryExplanationText = readableText(explanationRaw
    .split(/\n\n\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설|정답·해설 대조 완료)\]\n/)[0]);
  const legacyAdditionalExplanation = useMemo(() => {
    const source = explanationRaw;
    const matched = source.split(/\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설)\]/)[1];
    if (matched) return readableText(matched
      .split(/\[정답·해설 대조 완료\]/)[0]
      .replace(/\[해설작성자[^\]]*\]/g, ' '));
    return '';
  }, [explanationRaw]);
  const additionalExplanationSections = useMemo(() => {
    const sections = [...(props.item.question.additionalExplanations || [])]
      .map((entry) => ({ ...entry, text: readableText(entry.text) }))
      .filter((entry) => entry.text);
    if (legacyAdditionalExplanation && !sections.some((entry) => entry.text === legacyAdditionalExplanation)) {
      sections.push({ label: '추가 해설', source: '동일 문제 원문', text: legacyAdditionalExplanation });
    }
    return sections;
  }, [props.item, legacyAdditionalExplanation]);
  const hasReadableChoices = props.item.question.choices.some(hasReadableChoice);
  const compactVisualChoices = !restoredQuestion
    && props.item.question.choices.length === 4
    && props.item.question.choices.some((choice) => choice.images?.length);
  const compactTextChoices = useMemo(() => {
    if (primaryImage || props.item.question.choices.some((choice) => choice.images?.length)) return false;
    const lengths = displayedChoices.map((choice) => choice
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length);
    return lengths.length === 4
      && Math.max(...lengths) <= 34
      && lengths.reduce((sum, length) => sum + length, 0) <= 96;
  }, [props.item, primaryImage, displayedChoices]);
  const twoColumnTextChoices = compactTextChoices && !forceVerticalTextChoices;
  const compactSolveLayout = props.solveLayout === 'comcbt';
  const inlineCompactExplanation = props.solveLayout === 'comcbt';
  const combatDenseChoices = (() => {
    if (props.solveLayout !== 'combat'
      || primaryImage
      || props.item.question.choices.some((choice) => choice.images?.length)) return false;
    const lengths = props.item.question.choices.map((choice) => (choice.text || choice.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length);
    return lengths.length === 4 && Math.max(...lengths) <= 52 && lengths.reduce((sum, length) => sum + length, 0) <= 160;
  })();
  const combatUltraShortChoices = combatDenseChoices && props.item.question.choices.every((choice) =>
    (choice.text || choice.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length <= 10);

  function choiceClass(index: number): Record<string, boolean> {
    const number = index + 1;
    return {
      selected: props.selected === number,
      correct: props.mode === 'learn' && props.selected === number && number === props.item.question.answer,
      wrong: props.mode === 'learn' && props.selected === number && number !== props.item.question.answer,
    };
  }

  const imageOptions = unifiedHotspots.map(hit => ({
    number: hit.choice,
    style: hotspotStyle(hit),
    className: Object.entries(choiceClass(hit.choice-1)).filter(([,on])=>on).map(([name])=>name).join(' '),
  }));

  const reactChoices = props.item.question.choices.map((choice, index) => {
    const number = index + 1;
    const showContent = !primaryImage || (props.answerLayout === 'inline' && hasReadableChoice(choice,index));
    return {
      number, marker: String(circles[index] || number), selected: props.selected === number,
      className: Object.entries(choiceClass(index)).filter(([,active]) => active).map(([name]) => name).join(' '),
      label: primaryImage ? `${number}번 ${choice.text || '답안'} 선택` : undefined,
      html: showContent ? choiceHtml(displayedChoices[index]) : undefined,
      images: (choice.images || []).map(choiceImage).filter((src): src is string => Boolean(src)),
      imageClass: restoredImageClass,
      result: props.mode === 'learn' && props.selected === number ? (correctSelected ? '정답' : '다시 확인') : undefined,
    };
  });

  const modelLesson = equipmentLessons.get(props.item.sourceQuestionId ?? props.item.id);
  function toggleIssueType(type:QuestionIssueType) {
    setIssueReportTypes(current=>current.includes(type)?current.filter(value=>value!==type):[...current,type]);
    setIssueReportError('');
  }
  async function sendIssueReport(): Promise<void> {
    setIssueReportError('');
    if (!issueReportTypes.length || issueReportDetails.trim().length < 3) {
      setIssueReportError('문제 유형을 고르고 무엇이 이상한지 3자 이상 적어 주세요.');
      return;
    }
    setIssueReportSending(true);
    const question = props.item.question;
    const error = await submitQuestionIssue({
      space: window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial',
      qualification_key: props.item.round.qualificationKey || 'unknown',
      qualification: props.item.round.qualification,
      round_id: props.item.round.id,
      round_title: props.item.round.title,
      round_year: props.item.round.year,
      round_session: props.item.round.session,
      question_id: props.item.id,
      question_number: question.number,
      display_number: props.displayNumber,
      subject: props.item.subject,
      issue_types: issueReportTypes,
      details: issueReportDetails,
      question_text: readableText(question.html || question.text || ''),
      choices_snapshot: question.choices.map((choice) => readableText(choice.html || choice.text || '')),
      configured_answer: question.answer,
      source_image: question.sourceImage || undefined,
      page_url: window.location.href,
      app_version: window.CBT_CHANGELOG?.currentVersion,
      device_info: `${navigator.platform || 'unknown'} · ${navigator.userAgent.slice(0, 300)}`,
    });
    setIssueReportSending(false);
    if (error) {
      setIssueReportError(error);
      return;
    }
    setIssueReportSubmitted(true);
    setIssueReportOpen(false);
  }

  function keepExplanation() {
    stopExplanationAutoClose();
    pinSolution?.({ id:props.item.id, number:props.item.question.number,round:props.item.round.title,
      text:[primaryExplanationText,...additionalExplanationSections.map(entry=>entry.text)].filter(Boolean).join('\n\n'),
      images:(props.item.question.explanationImages||[]).map(choiceImage).filter((src):src is string=>Boolean(src)) });
    closeInlineExplanation();
    closeCompactExplanation();
  }
  function closeInlineExplanation(): void {
    stopExplanationAutoClose();
    setExplanationDismissed(true);
  }

  function closeCompactExplanation(): void {
    stopExplanationAutoClose();
    setExplanationOpen(false);
  }

  function reopenExplanation(): void {
    stopExplanationAutoClose();
    setExplanationDismissed(false);
    setExplanationOpen(true);
  }

  function stopExplanationAutoClose() {
    window.clearInterval(explanationAutoCloseTimer.current);
    explanationAutoCloseTimer.current=undefined;
    setExplanationAutoCloseSeconds(0);
  }

  const previousSelection=useRef({selected:props.selected, layout:props.solveLayout, mode:props.mode});
  useEffect(()=>{
    const old=previousSelection.current;
    previousSelection.current={selected:props.selected,layout:props.solveLayout,mode:props.mode};
    if(old.selected===props.selected && old.layout===props.solveLayout && old.mode===props.mode)return;
    setBeginnerCalculationOpen(false);
    setExplanationDismissed(false);
    setExplanationOpen(false);
    if(props.mode!=='learn'||!correctSelected){setExplanationAutoCloseSeconds(0);return;}
    let seconds=20;
    setExplanationAutoCloseSeconds(seconds);
    explanationAutoCloseTimer.current=window.setInterval(()=>{
      seconds-=1;
      setExplanationAutoCloseSeconds(seconds);
      if(seconds===0){stopExplanationAutoClose();setExplanationDismissed(true);}
    },1000);
    return ()=>window.clearInterval(explanationAutoCloseTimer.current);
  },[props.selected,props.solveLayout,props.mode,correctSelected]);

  function toggleQuestionSpeech(): void {
    if (!canReadQuestion) return;
    if (speechSpeaking) {
      window.speechSynthesis.cancel();
      setSpeechSpeaking(false);
      return;
    }
    const choiceText = displayedChoices.map((choice, index) =>
      `${index + 1}번. ${readableText(choice)}`).join('. ');
    const utterance = new SpeechSynthesisUtterance(`${readableText(displayedQuestionMarkup)}. ${choiceText}`);
    utterance.lang = 'ko-KR';
    utterance.rate = .92;
    speech.current = utterance;
    utterance.onend = () => { if(speech.current===utterance){speech.current=null;setSpeechSpeaking(false);} };
    utterance.onerror = utterance.onend;
    setSpeechSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
  useEffect(()=>()=>{if(speech.current){speech.current.onend=null;speech.current.onerror=null;window.speechSynthesis.cancel();}},[]);
  useLayoutEffect(()=>{
    const probe=choiceLayoutProbeRef.current;
    if(!probe || !compactTextChoices){setForceVerticalTextChoices(false);return;}
    let active=true, frame=0;
    function measure(){
      if(!active)return;
      const wraps=[...probe!.querySelectorAll<HTMLElement>('.choice-copy > span')].some(copy=>{
        const lineHeight=Number.parseFloat(getComputedStyle(copy.parentElement||copy).lineHeight)||18;
        return copy.getBoundingClientRect().height>lineHeight*1.45 || copy.getClientRects().length>1;
      });
      setForceVerticalTextChoices(wraps);
    }
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);});
    observer.observe(probe);
    measure();
    void document.fonts?.ready.then(measure);
    return ()=>{active=false;observer.disconnect();cancelAnimationFrame(frame);};
  },[compactTextChoices,props.solveLayout,displayedChoices,primaryImage,transcriptionPending,props.imageAnswerMode]);

  function calculateAnswerHighlights(image: HTMLImageElement): void {
    const fallbackHotspots = verifiedHotspots.filter((hotspot) => !hotspot.segments?.length);
    if (!image.naturalWidth || !image.naturalHeight || !fallbackHotspots.length) {
      setAnswerHighlightStyles({});
      return;
    }

    const scale = Math.min(1, 1000 / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    try {
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const result: Record<number, Record<string, string>> = {};

      for (const hotspot of fallbackHotspots) {
        const cellLeft = Math.max(0, Math.floor(width * hotspot.x / 100));
        const cellTop = Math.max(0, Math.floor(height * hotspot.y / 100));
        const cellRight = Math.min(width, Math.ceil(width * (hotspot.x + hotspot.width) / 100));
        const cellBottom = Math.min(height, Math.ceil(height * (hotspot.y + hotspot.height) / 100));
        const inset = Math.max(2, Math.round(2 * scale));
        const columnInk = new Uint16Array(Math.max(0, cellRight - cellLeft));
        const rowInk = new Uint16Array(Math.max(0, cellBottom - cellTop));

        for (let y = cellTop + inset; y < cellBottom - inset; y += 1) {
          for (let x = cellLeft + inset; x < cellRight - inset; x += 1) {
            const offset = (y * width + x) * 4;
            if (pixels[offset + 3] < 80) continue;
            const luminance = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
            if (luminance < 188) {
              columnInk[x - cellLeft] += 1;
              rowInk[y - cellTop] += 1;
            }
          }
        }

        const inkColumns = [...columnInk.keys()].filter((index) => columnInk[index] >= 2);
        const inkRows = [...rowInk.keys()].filter((index) => rowInk[index] >= 2);
        if (!inkColumns.length || !inkRows.length) continue;

        const padding = Math.max(5, Math.round(7 * scale));
        const left = Math.max(cellLeft, cellLeft + inkColumns[0] - padding);
        const top = Math.max(cellTop, cellTop + inkRows[0] - padding);
        const right = Math.min(cellRight, cellLeft + inkColumns[inkColumns.length - 1] + padding + 1);
        const bottom = Math.min(cellBottom, cellTop + inkRows[inkRows.length - 1] + padding + 1);
        result[hotspot.choice] = {
          left: `${left / width * 100}%`,
          top: `${top / height * 100}%`,
          width: `${Math.max(1, right - left) / width * 100}%`,
          height: `${Math.max(1, bottom - top) / height * 100}%`,
        };
      }
      setAnswerHighlightStyles(result);
    } catch {
      setAnswerHighlightStyles({});
    }
  }

  useLayoutEffect(()=>{
    const image=sourceImageRef.current;
    if(image?.complete)calculateAnswerHighlights(image);
    else setAnswerHighlightStyles({});
  },[verifiedHotspots]);

  return {
    ...props,
    additionalExplanationSections, beginnerCalculationAvailable, beginnerCalculationOpen,
    calculateAnswerHighlights, calculationGuide, calculationNumberOrigins,
    canReadQuestion, circles, closeCompactExplanation,
    closeInlineExplanation, combatDenseChoices, combatUltraShortChoices,
    compactSolveLayout, compactTextChoices, compactVisualChoices,
    correctSelected, displayedChoices, displayedQuestionMarkup,
    explanationAutoCloseSeconds, explanationDismissed, explanationOpen,
    explanationOrigin, fieldReportQuestion, hansolQuestion,
    hasReadableChoices, imageOptions, imageZoomOpen,
    inlineCompactExplanation, issueReportDetails, issueReportError,
    issueReportOpen, issueReportSending, issueReportSubmitted,
    issueReportTypes, issueTypeOptions, keepExplanation,
    modelLesson, pinSolution, primaryExplanationText,
    primaryImage, reactChoices, reopenExplanation,
    restoredImageClass, restoredQuestion, selectedAnswerState,
    selectedAreaHighlightStyles, selectedMarkerStyle, sendIssueReport,
    showQuestionIdentity, sourceImageOverride, sourceTranscription,
    speechSpeaking, stopExplanationAutoClose, toggleIssueType,
    toggleQuestionSpeech, transcribedQuestion, transcriptionPending,
    twoColumnTextChoices, unifiedHotspots, verifiedHotspots,
    sourceImageRef, choiceLayoutProbeRef, setIssueReportOpen,
    setIssueReportDetails, setSourceImageOverride, setImageZoomOpen,
    setBeginnerCalculationOpen,
  };
}
export type QuestionCardViewModel=ReturnType<typeof useQuestionCard>;
