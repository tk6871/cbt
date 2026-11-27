import { useState } from 'react';
import { assetReading, hasPrintedInline, printedQuestion, replacePrintedInline } from '../cbt/printedStudy';
import { problemImage, problemImageHtml } from '../cbt/problemImages';
import type { QuestionItem } from '../cbt/types';
import { usePrintedStudy } from './session/usePrintedStudy';
import { useSourceTranscription } from './session/useSourceTranscription';
import './session/transcription-figure.css';
import './question-library-preview.css';

export default function QuestionLibraryPreview({
  item,
  text,
  imageTheme,
}: {
  item: QuestionItem;
  text: string;
  imageTheme?: string;
}) {
  usePrintedStudy();
  const { question } = item;
  const print = printedQuestion(item);
  const { mode, entry } = useSourceTranscription(print ? undefined : question.sourceImage);
  const visible = mode !== 'image' || print?.deferredOriginal ? print : undefined;
  const figures = visible
    ? visible.figures ?? (visible.visual && visible.image ? [visible.image] : [])
    : question.images || [];
  const hasPartReading = mode !== 'image' && (hasPrintedInline(question.html) || figures.some(src => {
    const reading = assetReading(src);
    return reading?.html || reading?.diagram;
  }));
  const hasReading = Boolean(visible || entry?.question || hasPartReading);
  const stemHtml = visible?.stemHtml ?? (!entry?.question && hasPartReading && question.html
    ? replacePrintedInline(question.html) : undefined);
  const sourceLabel = visible?.sourceLabel || (visible?.partial ? '원문 부분 판독' : undefined)
    || (entry?.status === 'provisional' ? 'OCR 초안' : undefined);
  const image = print?.image || question.sourceImage;
  const imageClass = 'restored-image-' + (imageTheme || 'auto');
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <>
      {hasReading ? (
        <div className="printed-study">
          {sourceLabel && <small>{sourceLabel}</small>}
          {stemHtml !== undefined
            ? <div dangerouslySetInnerHTML={{ __html: problemImageHtml(stemHtml) }} />
            : <p>{entry?.question?.stem || text}</p>}
          {figures.map((src, index) => {
            const html = mode !== 'image' && assetReading(src)?.html;
            return html
              ? <div key={index} dangerouslySetInnerHTML={{ __html: problemImageHtml(html) }} />
              : <img key={index} src={problemImage(src)} className={imageClass} alt="문제 참고 그림" loading="lazy" decoding="async" />;
          })}
        </div>
      ) : !image && <p>{text || '문제를 열어 지문을 확인하세요.'}</p>}
      {image && (
        <details
          className="library-image-preview"
          onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
          <summary>
            문제 원문 미리보기 <small>이미지 지문</small>
          </summary>
          {expanded && failed !== image && (
            <img
              src={problemImage(image)}
              className={imageClass}
              alt="문제 원문 미리보기"
              decoding="async"
              onError={() => setFailed(image)}
            />
          )}
          {failed === image && (
            <p role="status">
              그림을 불러오지 못했습니다.{' '}
              <button type="button" onClick={() => setFailed(null)}>
                다시 불러오기
              </button>
            </p>
          )}
          <small>답안 선택·확대는 문제를 열어 이용하세요.</small>
        </details>
      )}
    </>
  );
}
