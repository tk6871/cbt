import { useState } from 'react';
import { problemImage } from '../cbt/problemImages';
import './question-library-preview.css';
export default function QuestionLibraryPreview({
  text,
  image,
  imageTheme,
}: {
  text: string;
  image?: string | null;
  imageTheme?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!image) return <p>{text || '문제를 열어 지문을 확인하세요.'}</p>;
  return (
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
          className={'restored-image-' + (imageTheme || 'auto')}
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
  );
}
