# CBT 작업 인수인계 — 학습 라운지

`tk6871/cbt`의 최신 `main`에서 시작한다. 먼저 [AGENTS.md](AGENTS.md)와 [WORK_STATE.md](WORK_STATE.md) 상단을 읽는다. 이 문서는 2026-11-16 기준이며, 다른 기기의 로컬 파일이나 이전 채팅은 필요 없다.

## 지금까지 된 것

- 학습 라운지 v6.2(웹 v642)는 이미 `main`에 들어갔다. [Pages 배포](https://github.com/tk6871/cbt/actions/runs/43785998706) 성공과 [공개 페이지](https://tk6871.github.io/cbt/)의 v642 파일 및 배경 이미지 응답을 확인했다. 라운지는 **홈 → 학습 라운지 둘러보기**, 또는 **설정 → 홈 화면 → 학습 라운지**에서 연다. 기본은 기존 홈이다.
- 기존 사이드 메뉴와 문제풀이를 유지하고, 새 라운지의 한 장짜리 배경에서 시험장·복습 데스크·자료실을 고른다. 초기에 배경을 내려받지 않으며, 라운지 선택은 기기별로 저장된다. 이전 3D 캠퍼스와는 별도다.
- 타입 검사, 웹 빌드, PWA 감사, 데스크톱·휴대폰·태블릿 모사 라운지 테스트 6건을 통과했다. 실기기와 APK 설치는 검증하지 않았다.

## 다음에 할 일: 사진 위 공간 이름을 글씨만 보이게 정리

1. [StudyLounge.vue](src/cbt/StudyLounge.vue)에서 사진 위의 **시험장·복습 데스크·자료실**에 붙은 채움색, 테두리, 배지, 점, 장식 화살표를 없앤다. 최종 화면에는 사진 위에 공간 이름 글씨만 보이게 한다. 클릭 영역은 충분히 넓은 투명 버튼으로 남기고, 키보드 포커스는 식별 가능하게 한다. 선택/호버는 글씨 밝기나 밑줄처럼 텍스트 변화로 표시한다.
2. 가독성은 그림자나 사진 전체에 깔리는 약한 그라데이션으로 확보한다. 밝은 조명 위에서 흰 글자가 날아가지 않는지 확인한다. 4K 전체 창과 절반 폭 창에서는 글씨가 각 공간에 놓이고 겹치지 않아야 한다. 휴대폰에서는 공간 이름이 작아지거나 눌리기 어려워지면 사진 아래에 **박스 없는 텍스트 행**으로 배치한다. 기존 사이드 메뉴와 문제풀이 화면은 수정하지 않는다.
3. 배경은 [현재 이미지](assets/lounge/study-lounge.png)를 기준으로 비교한다. 새 에셋은 아래 후보나 허가가 확인된 자료 중에서 **지금보다 공간 구분과 글씨 가독성이 실제로 좋아지는 경우에만** 적용한다. 출처·제작자·라이선스를 기록하고 가벼운 정적 WebP/JPEG로 저장한다. 현재 배경 원본은 보존한다. 3D 엔진·대용량 모델·HDRI 원본 추가는 범위 밖이다.

### 에셋 후보

- [Poly Haven — Cayley Interior](https://polyhaven.com/a/cayley_interior): 짙은 톤과 따뜻한 조명 참고용. [CC0 안내](https://polyhaven.com/license). 사용한다면 정적인 한 장만 내보낸다.
- [Poly Haven — Newman Lobby](https://polyhaven.com/a/newman_lobby): 학교 로비와 출입구 배치 참고용(CC0). 강한 자홍색 조명 때문에 그대로 교체하기보다 화면 가독성을 먼저 비교한다.
- [Unsplash — 현대 도서관 실내](https://unsplash.com/photos/modern-library-interior-with-floor-to-ceiling-bookshelves-TQ8ICns1tgE): 자료실 분위기 후보. [Unsplash 이용 조건](https://unsplash.com/license)을 확인한다. 지금 이미지만큼 시험장·데스크·서가 세 구역을 한 장에 보여주지 못하면 전체 배경으로는 쓰지 않는다.

후보는 조사만 했고 다운로드하거나 적용하지 않았다. [참고 UI](https://limmin3-sudo.github.io/stam-freight-control/)는 배치와 탐색 방식 참고용이며, 해당 사이트의 이미지나 코드를 그대로 가져오지 않는다.

## 확인하고 반영하기

- `npm run typecheck`, `npm run build`, `npm run test:pwa`, `npx playwright test tools/study-lounge.spec.ts`, `git diff --check`를 실행한다. 데스크톱·모바일에서 글씨 겹침, 키보드 포커스, 터치 영역, 공간별 이동, 기존 홈 복귀를 확인한다.
- 변경 내용을 [WORK_STATE.md](WORK_STATE.md)에 기록한다. 웹 빌드 결과(`modern/`, `sw.js`)도 함께 반영하며, `main`에 커밋·푸시해도 된다. 강제 푸시는 하지 않는다. 직접 푸시 권한이 없으면 `main` 대상 PR을 열고 링크를 전달한다. Pages 배포와 공개 사이트는 푸시 후 따로 확인한다. 비밀번호, 토큰, 서명 키는 공유하지 않는다.

상대방 Codex에 붙여넣을 문장:

> `tk6871/cbt`의 최신 `main`에서 `AGENTS.md`, `WORK_STATE.md`, `work.md`를 읽고, `work.md`의 ‘다음에 할 일’을 구현해줘. 기존 홈과 CBT 풀이 화면은 유지하고, 글씨 가독성이 더 좋아지는 에셋만 적용해. 문서에 적힌 검사와 빌드까지 마치고, `main`에 커밋·푸시한 뒤 커밋 링크와 Pages 배포 결과를 알려줘.
