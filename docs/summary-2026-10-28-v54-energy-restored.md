# v5.4 에너지관리산업기사 교재 복원문제 추가

## 사용자 요청과 적용 범위

- 기사2022년 추가자료는 산업기사 목록에서 제외. 원본 파일·이미지·기존 기록 보존.
- 이전에 미뤄둔 산업기사2021~2025년13회차 전체1,040문제를 일반 회차별 학습/CBT에 추가.
- 기존 산업기사33회차2,640문제 및 중간고사179/교재191문제 파일은 변경하지 않음. 총46회차3,680문제.
- 공개5.4, 서비스워커617, Android 빌드 설정617·5.4. APK 자체는 빌드하지 않음.

## 데이터와 이미지

- 제공 교재 PDF431~633쪽에 있는13회차를 원문 이미지로 분리했다. 지문과 보기를 OCR 텍스트로 다시 쓰지 않았다.
- 인쇄 정답표13개1,040칸을 이미지로 읽고 OCR 결과와 대조했다. 불일치4칸(2021-2의4/16번,2022-1의2번,2024-2의7번)은 인쇄표 기준이다.
- 문제1,040장/원문 해설1,037장, 총2,077장. 별도 해설이 없는2022-2-80·2022-4-65·2022-4-66은 보충 설명 표시.
- Mac arm64 Real-ESRGAN x4plus-anime·타일256·4배→2배 bicubic.237장은 원본/출력 SHA가 일치하는 기존 자산을 재사용했다. 새1,840개 WebP349,475,718바이트, 가장 큰 파일941,524바이트. 원본 PDF와 작업 캐시는 비공개 work에 유지하며 Git에 포함하지 않았다.
- 답안1,040세트·4,160보기. 인식이 약한73후보를 시각 확인하고 번호/분수/도식/두 줄 보기/열 경계/희미한 번호의 좌표를 보강했다. OCR 네 번호가 독립 인식된830문제의 번호 포함 검사 후보0. 모든 학술 내용과 모든 픽셀을 사람이 전수 확인했다는 의미는 아니다.
- crop/banner 인식으로 문제와 해설을 나누고, 검수 중 확인한 옆 열 번호 혼입은 별도 crop 후 재업스케일했다. 원본은 보존했다.

## 주요 변경 파일

- `data/energy-restored.js`, `data/energy-restored-import-audit.json`, `assets/energy-restored/`
- `src/cbt/catalog.ts`, `src/cbt/explanationSource.ts`, `src/cbt/App.vue`, `src/cbt/types.ts`
- `data/catalog-bootstrap.js`, `data/catalog-index.js`, 빌드/감사 도구
- `tools/stage-energy-restored-full.py`: 교재 SHA 확인·정답표·문제/해설 crop
- `tools/upscale-energy-textbook.py`: 별도 작업 폴더·재사용·검증된 재개 처리
- `tools/review-energy-restored-full.py`, `tools/energy-restored-geometry-review.json`: 사적 검수/좌표
- `tools/build-energy-restored-full.mjs`: 자산 SHA/2배 크기/arm64·타일256·은행 불변 검증 후 공개 자료 생성
- README/CHANGELOG/신기술 학습관/WORK_STATE와 이 요약

## 실제 실행 검증

- `vue-tsc --noEmit`, `vite build`, `sync-pwa-service-worker.mjs`, `test-pwa-build.mjs`, `audit-changelog-identity.mjs`, `git diff --check`: 통과.
- `energy-restored-full.spec.ts`, `energy-restored-geometry.spec.ts`: PC/휴대폰 크기/태블릿 크기12개 통과. 새 회차 학습 선택·취소·정답 해설·다크/라이트·저장 복원, CBT 선택·취소·제출 전 정답 비노출,1,040문제4,160보기의 선택·취소와 hover/선택 강조 영역 일치를 검사했다. 부동소수점 CSS 직렬화 오차는0.00001% 이내로 비교한다.
- 세 크기의 최종 학습 화면 캡처 육안 확인. 실제 iPhone/Safari/Android·실서버 동기화·배포·APK 설치 검사는 하지 않았다.
- 전체 문제 감사44,270문제: 구조 오류0·이미지 누락0·중복 정답 충돌0. 해설/정답 확인 후보19개는 별도 참고 후보이며 새 오류0을 뜻하는 학술 보증은 아니다.
- 전체 해설 품질 감사: 기존 공조 추가해설 연결 불일치6건으로 실패. 에너지 추가분 오류0. 기존 공조 원문 파일은 수정하지 않았다. 기존 큰 청크/Zod 경고는 남는다.

## 재개·다음 장치

- 로컬 커밋 완료. 실제 Push는 터미널 GitHub 인증 부재로 실패했다. GitHub Desktop에서 Push origin이 필요하며 배포 확인은 미실행이다.
- 다음 장치에서는 Push 후 Pull하고 동시에 같은 파일을 편집하지 않는다.
- 재생성에는 원본 교재·비공개 work 캐시와 Mac의 기존 Swift/Vision, bundled Python(Pillow/numpy), Poppler, arm64 Real-ESRGAN이 필요하다. 새 설치·다운로드는 하지 않았다. GPU/Vision은 샌드박스 밖 실행이 필요했다.
- 문제 풀기: 회차별 문제 → 에너지관리산업기사 →2021~2025 회차 → 학습모드/CBT. 이미지 선택은 설정의 답안 선택 방식에서 켠다.
