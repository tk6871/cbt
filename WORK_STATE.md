# CBT 프로젝트 작업 상태

이 문서는 Windows와 Mac 사이에서 CBT 프로젝트 작업을 안전하게 이어가기 위한 내부 인수인계 문서입니다. 중요한 코드·데이터·이미지·설정 작업을 마칠 때 실제 상태에 맞게 갱신합니다.

## 현재 스냅샷

- 마지막 갱신: 2026-08-01
- 기준 브랜치: `main`
- 이번 Mac 작업 직전 Git HEAD: `911903d6e0757f41f81aa0352bb18ef4963ffdf3`
- 이번 문서에는 공조·산업안전·에너지관리·설비보전·보석관 이미지 개선 작업과 실제 Mac 검증 결과가 포함됨
- Windows 저장소: `C:\Users\tk687\OneDrive\문서\CBT\통합_산업기사_CBT_반응형공유본`
- Mac 저장소: `/Users/sh/Documents/GitHub/cbt`
- Windows SSH 호스트 별칭: `mac-m4`
- 공개 사이트: `https://tk6871.github.io/cbt/`

> 장치를 바꾸거나 새 작업을 시작할 때는 항상 `git status -sb`와 `git log -1`을 다시 확인해야 합니다.

## 프로젝트 구성

- Vue 3 + TypeScript + Vite
- 주요 의존성: Supabase JS, Dexie, Motion
- 정적 GitHub Pages 배포 및 PWA/Service Worker 사용
- 로컬 학습 기록과 오답 데이터, 시험 결과, 관리자용 Supabase 분석 기능 포함
- 주요 검증 명령:

```bash
pnpm typecheck
pnpm build
```

## 완료된 핵심 작업

- 공조냉동·산업안전·에너지관리·설비보전·보석가공 종목을 통합 CBT에 구성했습니다.
- 학습모드와 실제 CBT형 시험모드, 반응형 배치, OMR, 사이드 메뉴, 뒤로가기, 다크/라이트 모드, 글자 크기 조정 기능을 적용했습니다.
- 회차별 문제, 연도 범위 학습, 구 4과목/현 3과목 설정, 과목별 랜덤 60문제 출제 기능을 적용했습니다.
- 계산기, 패치노트, 신기능 체험실, 합격 학습 기능, AI 질문용 프롬프트 복사, 학습 기록 내보내기/불러오기를 구성했습니다.
- Supabase 관리자 페이지에 방문·학습·시험 결과와 실시간 접속 상태를 구성했습니다. 문제별 매 클릭 대신 묶음 결과 전송을 사용하도록 조정했습니다.
- 학습모드 상단에 문제 번호를 입력하여 바로 이동하는 기능을 Vue 화면과 구버전 화면에 적용했습니다.
- 공조냉동 2021~2026 복원문제는 텍스트 변환 대신 원문 이미지 중심으로 표시합니다.
- 패치노트 v2.4.3과 Service Worker 캐시 v246까지 반영했습니다.
- 산업기사와 보석관에 공통 적용된 전체 문제 학습·전체 초기화·문제 번호 이동 안내를 양쪽 패치노트에 같은 버전으로 표시합니다.
- 신기능 체험실에서 실제 원본 GIF와 업스케일링 후 PNG를 나란히 비교할 수 있습니다.
- 화질 비교 이미지는 새 창 대신 문제 풀이 화면과 같은 크게 보기로 열고 이미지·바깥 영역·닫기 버튼으로 닫습니다.
- 마지막 Mac 작업에서 TypeScript 검사와 Vite production build가 통과했습니다.

## 공조냉동 문제·해설 교정 상태

- 공조 2025년 43번 정답을 ①로 교정했습니다.
- 공조 2026년 2회 바닥복사난방 문제는 문제지 정답에 맞게 ③ 50℃로 교정했습니다.
- 공조 2026년 2회 44번은 보기의 실제 기호가 `SPTW`임을 반영했습니다. 수도용 아연도금 강관의 KS 기호는 `SPPW` 계열이므로 정답은 ③입니다.
- 현열·잠열 공식 등 계산식 표기의 아래첨자와 수식 가독성을 개선했습니다.
- 해설은 초보자용 설명을 우선하며, 정답과 해설이 충돌하지 않도록 문제지 정답과 계산 과정을 함께 확인해야 합니다.

## 이미지 초해상도 완료 상태

### 공조냉동 2021~2026 복원문제

- 원문 문제 이미지 1,020개 처리 완료
- Real-ESRGAN 4배 모델 처리 후 2배 크기로 축소하는 방식 사용
- 적용 모델: `realesrgan-x4plus-anime`
- Git 이전 기록의 원본에서 Mac M4 Pro 256px 타일 기준으로 다시 처리
- 원본 이미지는 Git 기록과 별도 작업 폴더에 보존

### 공조냉동 2002~2020 계산식·도표

- GIF 이미지 1,348개를 2배 PNG 결과로 처리하고 데이터 참조 변경
- Mac M4 Pro 256px 타일 기준으로 원본 GIF에서 다시 처리
- 원본 GIF 보존
- 공조 데이터의 고유 이미지 참조 2,444개, 누락 0으로 확인

### 에너지관리

- 2002~2020년 수식·도표·보기 GIF 이미지 225개를 2배 PNG로 처리하고 데이터 참조 변경
- 2022년 복원문제 JPG 이미지 100개를 2배 JPG로 처리
- 원본 GIF 225개 보존
- 에너지관리 데이터의 고유 이미지 참조 325개, 누락 0으로 확인
- 적용 모델: `realesrgan-x4plus-anime`
- 처리 파이프라인: `4x Real-ESRGAN → 2x bicubic 축소`
- Mac M4 Pro에서는 256px 타일을 사용

### 산업안전

- 수식·도표·보기 GIF 이미지 481개를 2배 PNG로 처리하고 데이터 참조 변경
- 원본 GIF 481개 보존
- 산업안전 데이터의 고유 이미지 참조 481개, 누락 0으로 확인
- 적용 모델: `realesrgan-x4plus-anime`
- 처리 파이프라인: `4x Real-ESRGAN → 2x bicubic 축소`
- Mac M4 Pro에서 256px 타일 사용

### 설비보전

- 수식·도표·보기 GIF 이미지 820개를 2배 PNG로 처리하고 데이터 참조 변경
- 원본 GIF 820개 보존
- 설비보전 데이터의 고유 이미지 참조 820개, 누락 0으로 확인
- 적용 모델: `realesrgan-x4plus-anime`
- 처리 파이프라인: `4x Real-ESRGAN → 2x bicubic 축소`
- Mac M4 Pro에서 256px 타일 사용

### 보석관

- 수식·도표 GIF 이미지 56개를 2배 PNG로 처리하고 데이터 참조 변경
- 원본 GIF 56개 보존
- 보석관 데이터의 고유 이미지 참조 56개, 누락 0으로 확인
- 적용 모델: `realesrgan-x4plus-anime`
- 처리 파이프라인: `4x Real-ESRGAN → 2x bicubic 축소`
- Mac M4 Pro에서 256px 타일 사용

### Windows 처리 도구

- `tools/upscale-hvac-restored.ps1`
- `tools/apply-upscaled-hvac-restored.ps1`
- `tools/upscale-hvac-comcbt-images.ps1`
- `tools/apply-upscaled-hvac-comcbt-images.ps1`
- Windows 실행 파일:
  `tools/realesrgan/realesrgan-ncnn-vulkan-20220424-windows/realesrgan-ncnn-vulkan.exe`
- 처리 파이프라인: `4x Real-ESRGAN → 2x bicubic 축소`

### Mac 처리 도구

- `tools/upscale-energy-images-macos.py`
- `tools/upscale-cbt-images-macos.py`
- `tools/requirements-upscale-macos.txt`
- 공식 macOS 실행 파일은 universal binary이며 `arm64`와 `x86_64`를 모두 포함
- Mac 실행 파일 위치:
  `tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan`
- `tools/realesrgan/`, `work/energy-*`, `work/image-upscale-macos/`는 Git에 포함하지 않음
- M4 Pro GPU는 NCNN/MoltenVK 경로로 사용하며 Apple Neural Engine을 직접 사용하지 않음

## 마지막 Mac 검증 결과

- `git diff --check` 통과
- `node --check sw.js` 통과
- `node --check data/changelog-vue.js` 통과
- `node --check data/energy.js` 통과
- `npm run typecheck` 통과
- `npm run build` 통과
- 로컬 산업기사·보석관 화면에서 v2.4.2 패치노트, 누락됐던 보석관 v2.3.8·v2.3.9 기록과 원본·업스케일링 비교 이미지 로딩을 확인
- 로컬 화면 브라우저 콘솔 오류 0건 확인
- v2.4.3 로컬 화면에서 비교 이미지 클릭 전후 탭 수가 그대로 유지되고, 원본·개선본 크게 보기와 이미지·닫기 버튼으로 닫는 동작을 확인
- 공조 복원문제 1,020개와 수식·도표 1,348개를 Mac 256px 타일 기준으로 다시 처리하고 치수 검증 통과
- 산업안전 481개와 설비보전 820개를 Mac 256px 타일 기준으로 처리하고 치수 검증 통과
- 공조 2,444개, 에너지관리 325개, 산업안전 481개, 설비보전 820개 이미지 참조 누락 0
- 공조·산업안전·설비보전 GPU 처리 3,669개에 실제 약 10분 소요
- 보석관 56개를 Mac 256px 타일 기준으로 처리하고 치수 검증 통과
- 보석관 이미지 참조 56개, 누락 0
- 에너지관리 적용 이미지 325개 치수 검증 통과
- 에너지관리 이미지 참조 325개, 누락 0
- PiperSR NPU, Real-ESRGAN 일반 모델, TTA, 타일 크기 64·256·512px를 표본 비교
- 사용자가 Real-ESRGAN 방식으로 진행하기로 선택

## 다음 우선 작업

현재 조사된 공조·산업안전·에너지관리·설비보전·보석관 이미지 개선 후보는 모두 처리했습니다.

## Mac Real-ESRGAN 검증 결과

- Windows용 `.exe`는 Mac에서 사용하지 않습니다.
- 공식 macOS NCNN 배포본의 아키텍처와 M4 호환성을 확인했습니다.
- 사용한 공식 배포본:
  `https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip`
- SHA-256:
  `e0ad05580abfeb25f8d8fb55aaf7bedf552c375b5b4d9bd3c8d59764d2cc333a`
- `file`과 `lipo -info`로 arm64+x86_64 universal binary임을 확인했습니다.
- M4 Pro GPU에서 arm64 네이티브 실행과 Metal 지원을 확인했습니다.
- 표본 비교 후 기존 공조와 같은 Real-ESRGAN 모델·축소 방식을 유지했습니다.
- 256px 타일은 표본 큰 페이지에서 64px보다 빠르게 처리됐고 512px보다도 효율적이었습니다.

## 작업 시 반드시 유지할 사항

- 복원문제의 원문 이미지 표시와 `CBT 복원문제 · 원문 이미지` 표기를 유지합니다.
- 이미지 크게 보기에서는 창 크기에 맞춰 전체 이미지가 잘리지 않아야 합니다.
- PC와 모바일의 답안 버튼 크기와 문제 카드 가독성을 각각 유지합니다.
- 학습 기록 초기화, 이어 학습, Service Worker 업데이트가 서로 충돌하지 않는지 관련 변경 후 확인합니다.
- 문제 정답과 해설이 충돌하면 문제지 원본, 계산 과정, 보기 내용을 먼저 대조합니다.
- 공개 패치노트에는 관리자 방문 기록과 비공개 분석 기능의 세부 내용을 넣지 않습니다.
- 압축 파일을 만들지 않습니다.
- 기존 원본 이미지와 사용자 변경사항을 임의로 삭제하거나 초기화하지 않습니다.

## 장치 전환 절차

### Windows에서 Mac으로

1. `git status -sb`로 변경사항을 확인합니다.
2. `WORK_STATE.md`를 실제 작업 결과에 맞게 갱신합니다.
3. 필요한 검증을 실행하고 결과를 기록합니다.
4. 코드와 상태 문서를 함께 커밋하고 GitHub에 Push합니다.
5. Mac에서 Pull한 뒤 `AGENTS.md`와 `WORK_STATE.md`를 먼저 읽습니다.

### Mac에서 Windows로

동일한 절차를 반대로 수행합니다. 두 장치에서 같은 파일을 동시에 수정하지 않습니다.

## 보안

- Supabase service role key, 인증 토큰, 비밀번호, SSH 개인키는 저장소에 넣지 않습니다.
- 브라우저용 publishable/anon key와 서버 전용 비밀키를 혼동하지 않습니다.
- 개인 IP 주소와 장치 인증정보는 이 문서에 기록하지 않습니다.
