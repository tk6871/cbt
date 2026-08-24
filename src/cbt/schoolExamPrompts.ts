export const schoolPhotoJsonPrompt = `학교 시험 CBT용 JSON 변환 작업입니다.

과목: [과목명]
시험: [2026년 1학기 중간고사]
교재: [교재명]
시험 범위: [20~45쪽]
사진 순서: 첨부한 순서대로
정답표: [함께 첨부 또는 없음]

첨부한 사진을 OCR하고 다음 규칙으로 정리해 주세요.

1. 객관식은 문제와 보기 4개를 사진 그대로 판독합니다.
2. 정답표가 확인된 문제만 answer에 1~4 숫자를 넣습니다.
3. 정답이 없거나 불확실하면 추측하지 말고 가져오기 JSON에서 제외한 뒤 별도의 '검토 필요' 목록으로 만듭니다.
4. 해설은 정답 근거를 초등학생도 이해하도록 짧고 쉽게 작성합니다.
5. 주관식은 memoryCards에 질문과 외울 답으로 넣습니다.
6. 선생님 강조 내용과 교재 쪽수가 보이면 기록합니다.
7. 수식·단위·부호·①②③④는 확대해서 다시 확인합니다.
8. 기존 자료와 합칠 수 있도록 모든 id는 서로 다르게 만듭니다.
9. JSON에는 설명이나 마크다운을 섞지 않습니다.
10. UTF-8 JSON 파일과 검토 필요 목록을 각각 다운로드할 수 있게 만들어 주세요.

JSON 최상위 구조는 반드시 다음 형식을 지킵니다.

{
  "version": 1,
  "rounds": [
    {
      "id": "school-round-고유값",
      "qualificationKey": "school-exams",
      "qualification": "학교 중간·기말고사",
      "shortQualification": "학교 시험",
      "year": 2026,
      "semester": 1,
      "examKind": "midterm",
      "textbook": "교재명",
      "session": "1학기 중간고사",
      "title": "2026년 1학기 과목명 중간고사",
      "subjects": ["과목명"],
      "kind": "school-exam",
      "questions": [
        {
          "number": 1,
          "text": "문제",
          "choices": [
            { "text": "1번 보기" },
            { "text": "2번 보기" },
            { "text": "3번 보기" },
            { "text": "4번 보기" }
          ],
          "answer": 1,
          "explanation": "쉬운 해설",
          "sourcePage": "교재 쪽수",
          "teacherHint": "선생님 강조사항",
          "source": "school-photo",
          "_subject": "과목명"
        }
      ]
    }
  ],
  "scopes": [
    {
      "id": "round와 같은 id",
      "subject": "과목명",
      "year": 2026,
      "semester": 1,
      "examKind": "midterm",
      "textbook": "교재명",
      "pages": "20~45쪽",
      "note": "강조사항"
    }
  ],
  "memoryCards": [
    {
      "id": "school-memory-고유값",
      "subject": "과목명",
      "prompt": "주관식 질문",
      "answer": "외울 정답",
      "sourcePage": "쪽수",
      "teacherHint": "강조사항",
      "important": true,
      "reviewCount": 0,
      "knownCount": 0
    }
  ]
}`;

export const generalChatPatchPrompt = `GitHub 저장소 tk6871/cbt의 수정안을 만들어 주세요.

중요 규칙:
- 먼저 AGENTS.md와 WORK_STATE.md를 읽고 준수합니다.
- 기존 기능·사용자 데이터·원본 이미지를 삭제하거나 초기화하지 않습니다.
- 실제 저장소를 수정하거나 커밋했다고 말하지 않습니다.
- 필요한 파일을 읽은 뒤 적용 가능한 unified diff만 작성합니다.
- 비밀번호, Supabase 키, 인증 토큰은 출력하지 않습니다.
- 공개 패치노트에는 관리자 기능과 비공개 내용을 넣지 않습니다.
- 작은 변경은 0.0.1, 큰 기능 변경은 0.1 단위 버전으로 판단합니다.
- 변경 후 필요한 검증 명령도 함께 알려 주세요.

요청:
[여기에 수정할 내용을 작성]

응답 순서:
1. 원인과 수정 방안
2. 변경할 파일 목록
3. 적용 가능한 unified diff
4. 검증 명령
5. 남은 위험이나 직접 확인할 항목`;
