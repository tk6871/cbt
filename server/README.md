CBT 검수 API는 Node.js에서 실행한다. 저장소 루트에서 `pnpm install`, `pnpm --filter @cbt/api build` 후 server 디렉터리에서 `node --env-file=.env dist/main.js`로 시작한다. 로컬 .env에는 .env.example에 지정된 항목을 설정한다. 검수 저장소는 Supabase migration 202611180001을 적용한 개발 프로젝트를 사용한다. 사용자의 Bearer 토큰과 공개 키로 PostgreSQL의 기존 issues.manage 권한을 적용한다. 서버 관리 키는 사용하지 않는다.

관리자 프런트의 cloud-config.js에서 reviewApiUrl을 이 서버의 /api 주소로 설정하면 제보 관리 권한을 가진 관리자가 문항별 수정안과 이력을 사용할 수 있다. 승인 기록을 문제은행에 반영하는 시점은 해설 대조·릴리스 단계다.

학습 프런트의 선택 설정 `serviceApiUrl`에 같은 서버의 `/api` 주소를 지정한다. 자료 조회는 로그인 없이 가능하다. `GET /api/catalogs`는 은행 키, `GET /api/catalogs/:key`는 원본 은행, `GET /api/catalogs/:key/questions/:round/:number`는 저장 ID 또는 회차·번호에 해당하는 원문을 돌려준다. 화면의 검수 해설·선택 영역은 기존 프런트가 이 원본에 결합한다. `GET /api/models`는 연결 문항과 출처를, `GET /api/models/:kind/file`은 파일형 모형을 제공한다. 서버에서 저장소의 data와 assets/equipment를 읽으며 별도 경로에 배치했을 때는 CBT_CONTENT_ROOT를 해당 저장소 루트로 지정한다.

학습 동기화는 `/api/learning/industrial` 및 `/api/learning/jewelry`에서 GET·PUT·DELETE를 사용한다. 서버는 Supabase Auth로 로그인 사용자를 확인한 후 사용자의 토큰으로 RLS를 적용한다. PUT은 payload와 직전 조회값 expectedUpdatedAt을 받는다. 최초 저장은 null을 보내며 다른 기기가 먼저 저장하면 409를 돌려준다. 브라우저는 최신 기록을 다시 읽어 병합한다. 개발 계정이 없어도 읽기 전용 자료와 정적 미리보기는 사용할 수 있다.

서비스 계약 검사는 저장소 루트에서 `npm --prefix server test`로 실행한다. 임시 인증·저장 응답을 사용하고 외부 Supabase에 연결하지 않는다.

## Mac 개발 Supabase 실행과 검증

저장소 의존성과 웹 미리보기 빌드를 준비한 Mac에서 Docker CLI, Colima, Supabase CLI, Python 3, Node.js와 Chrome을 사용한다. 저장소 루트에서 다음 명령을 실행한다.

```sh
zsh tools/start-local-supabase.zsh
```

[개발 CBT 설정](http://127.0.0.1:4360/?safe=1#/study/settings)에서 개발 계정으로 로그인한다. 처음 실행할 때 전용 Colima 가상 머신과 Supabase 컨테이너를 준비하므로 시간이 걸릴 수 있다. 웹과 NestJS를 새로 시작한 경우 해당 터미널을 열어 둔다. 계정, 로컬 키와 검증 결과는 체크아웃 옆의 개인 디렉터리 `../cbt-supabase-dev/`에 보관한다. 기존 데이터 볼륨에 이후 추가된 마이그레이션을 적용할 때는 개발 디렉터리에서 `supabase migration up --local`을 사용한다.

별도 터미널에서 다음 명령으로 독립된 Chrome 두 개의 실제 로그인, 회차 답안 왕복, 비공개 Storage 파일의 원본 일치를 검사한다. 첫 실행은 전용 테스트 계정을 만들고 해당 계정에 개발 파일 접근 권한을 부여한다. 반복 실행은 같은 계정의 두 문항에 이전과 다른 선택을 저장하고 검증용 GLB를 한 개 추가한다.

```sh
node tools/verify-local-supabase.mjs
```

계정 정보는 개발 디렉터리의 `qa-account.json`, 마지막 검증 결과는 `verified.json`에서 확인할 수 있다. 기본 서버 주소는 이 Mac에서만 접근할 수 있다. 실행 스크립트는 준비된 미리보기 디렉터리를 Vite preview로 제공한다. 모바일 세션이 동시에 접속할 때도 HTTP 연결을 재사용하고 압축 가능한 응답을 전송한다.

개발 미리보기는 같은 출처의 `/api`를 로컬 NestJS로 전달한다. React 소스를 편집 중인 개발 서버까지 같은 방식으로 확인하려면 해당 포트를 지정한다. 예를 들어 기본 Vite 서버에서는 `CBT_DEV_WEB_PORT=5173 node tools/verify-local-supabase.mjs`를 실행한다. 개발 계정 설정은 [루트 개발 안내](../README.md)에 있다.

### Android 휴대폰과 Mac에서 답안 왕복 확인

USB 디버깅을 허용한 휴대폰에서 Chrome을 열어 둔다. Mac에서 정적 미리보기(4310)와 개발 환경(4360·4361·54321)이 실행 중이면 저장소 루트에서 다음 명령으로 연결된 휴대폰 검증을 시작한다.

```sh
python3 tools/measure-android-study.py --verify
```

휴대폰 Chrome에서 매번 새 로컬 주소와 탭을 열어 공조·에너지 첫 답 저장을 각 3회 측정하고, Mac과 휴대폰에서 개발 계정의 답안 선택·취소와 비공개 파일을 대조한다. 이어 3D 해설을 열고 닫는 20회 동안 배터리 온도·Android 열 상태·Chrome 주 프로세스의 PSS를 기본 30초 간격으로 기록한다. 렌더러의 JavaScript 힙과 WebGL 해제는 별도 브라우저 보고서에 기록한다. 단말 속도 측정에는 인위적인 CPU·네트워크 감속을 적용하지 않는다. USB로 Mac의 로컬 서버를 사용하는 조건이다.

측정 JSON에서 `finished`는 작업 종료를, `metricsComplete`는 모든 표본의 측정값 수집 여부를 나타낸다. 빠진 항목은 `missingMetrics`에 기록한다.

각 실행의 결과 폴더는 시작할 때 출력한다. 연결이 끊기면 이미 얻은 센서값은 남고, 해당 항목을 제공하지 않는 기기는 값이 `null`로 기록된다. 휴대폰 잠금을 직접 해제한 상태에서 실행한다. 검사 중에는 USB 충전 상태에서 화면을 켜 두고 끝나면 이전 설정으로 복원한다. 한 단계만 반복할 때는 `--verify --stage first-answer`, `--verify --stage sync`, `--verify --stage 3d` 중 하나를 사용한다. 수동 풀이 중 센서만 수집하려면 `python3 tools/measure-android-study.py --seconds 600`을 실행한다. [Android 메모리 진단](https://developer.android.com/tools/dumpsys) · [Chrome USB 디버깅](https://developer.chrome.com/docs/devtools/remote-debugging/)

USB 디버깅을 허용한 휴대폰 한 대를 연결하고 `adb devices -l`에서 상태가 `device`인지 확인한다. 개발 서버가 실행 중일 때 다음 명령으로 휴대폰 Chrome에서 Mac의 로컬 서비스를 열 수 있다.

```sh
adb reverse tcp:4360 tcp:4360
adb reverse tcp:4361 tcp:4361
adb reverse tcp:54321 tcp:54321
```

두 기기에서 [개발 학습 홈](http://127.0.0.1:4360/)에 같은 개발 계정으로 로그인한다. 공조 1-168쪽 25번에서 ②를 눌러 저장하고 상대 기기에서 동기화 후 같은 문항을 다시 연다. 이번에는 상대 기기에서 에너지 414쪽 16번 ③을 눌러 첫 기기에서 확인한다. 각 문항의 기존 답이 같다면 다른 인쇄 번호를 선택해 새로 저장한 값이 전파되는지 구별한다.

정적 첫 방문 속도는 별도로 `adb reverse tcp:4310 tcp:4310`을 실행한 뒤 [정적 미리보기](http://127.0.0.1:4310/)에서 잰다. 책마다 새 시크릿 세션으로 시작하고 측정 사이에 시크릿 탭을 모두 닫는다. 기종·Chrome 버전과 첫 홈 조작 가능 시점, 목차 표시, 인쇄 번호를 누른 뒤 저장되는 시점을 함께 기록한다. 사용 후에는 설정한 포트마다 `adb reverse --remove tcp:포트번호`로 해제한다.

미리보기를 실행한 상태에서 다음 명령으로 모바일 첫 진입을 다시 검사한다. 첫 명령은 동시 첫 방문, 연결 실패·지연 후 복구, 오프라인 재접속을 검사한다. 두 번째는 Chrome에서 CPU와 네트워크를 제한하고 홈·교재·계산기·시험 페이지의 소요 시간을 세 번 측정한다.

```sh
CBT_TEST_URL=http://127.0.0.1:4360 npx playwright test tools/mobile-startup.spec.ts --project=iphone-14-pro
node tools/measure-mobile-cbt.mjs
```

### 오프라인 Android 미리보기 APK

저장소 루트에서 Node 빌드 도구, JDK 21, Android SDK로 실행한다. `JAVA_HOME`과 `ANDROID_HOME`으로 설치 위치를 지정할 수 있다.

```sh
npm run android:preview
adb -d install -r dist/industrial-cbt-v702-preview.apk
node tools/verify-android-preview.mjs
```

빌드 버전이 바뀌면 APK 이름의 숫자도 바뀐다. 미리보기 패키지는 `com.tk6871.cbt.preview`이고 클라우드 연결은 꺼져 있다. 테스트는 USB 디버깅을 허용한 휴대폰 한 대에서 미리보기 앱의 인쇄 답을 터치하고 강제 종료 후 다시 열어 답을 확인한다. 3D 해설은 외부 HTTP 요청을 차단한 상태에서 검사한다.

### 개발 관리자 회원 후속 관리 검증

개발 환경을 시작한 뒤 저장소 루트에서 `node tools/verify-local-member-followups.mjs`를 실행한다. 이 검사는 로컬 Supabase에 임시 계정을 만들고, 회원 관리 담당과 조회 담당의 독립 브라우저에서 메모·후속 표시·충돌 복원을 대조한 뒤 계정을 정리한다. 관리자 미리보기의 `회원 관리 → 회원 후속 관리`에서 같은 화면을 볼 수 있다. 이 기능에 필요한 DB 마이그레이션은 `supabase/migrations/202611190001_member_followups.sql`이다.

회원 목록 페이지 경계까지 검사하려면 같은 명령에 `--large-directory`를 붙인다. 로컬 Colima의 개발 DB에 동일한 가입 시각의 임시 회원 1,001명과 후속 표시 205건을 만들고 검사 뒤 정리한다. 이 버전은 `202611190002_member_directory_pages.sql`과 같은 버전의 `sync-account` Edge Function을 함께 사용한다.

담당자와 처리 이력은 `202611190003_member_followup_history.sql`에서 추가한다. 같은 검증 명령이 편집 담당자 두 명과 조회 전용 관리자로 담당자 인계, 메모 변경 전후, 처리 완료, 권한 회수, 이력 페이지 조회까지 확인한다. 기존 메모는 유지되며 변경 이력은 마이그레이션 적용 시점 이후부터 쌓인다.

관리자 홈의 후속 목록과 사이트 내 배정 알림에는 `202611190004_followup_desk.sql`이 필요하다. 같은 검증 명령이 두 관리자 브라우저에서 배정 알림 수신, 회원 기록 바로 열기, 읽음 상태 격리와 다음 로그인 시 복원까지 확인한다.

운영 요약의 ‘내가 맡기’에는 `202611190005_claim_member_followup.sql`이 필요하다. 같은 검사에서 편집 담당자 두 명이 같은 건을 동시에 맡을 때 실제 배정 결과와 담당자 표시, 배정 이력·알림 개수, 조회 전용 권한을 대조한다.

## 운영 NestJS와 관리자 배정 확인

저장소 루트의 Render Blueprint는 무료 웹 서비스 한 개를 정의한다. Docker 빌드 컨텍스트는 저장소 루트이며 서버는 호스트가 지정한 PORT에서 실행된다. 상태 확인 경로는 `/api/health`다. 서비스에는 운영 Supabase의 브라우저 공개 키와 CBT 사이트의 Origin을 설정한다. 처음 배포한 뒤 실제 서비스 주소에서 상태, 문제은행, 모형 및 인증이 필요한 기록 경로를 확인하고 공개 사이트 설정의 `serviceApiUrl`과 `reviewApiUrl`에 HTTPS 주소와 `/api`를 지정한다.

관리자 배정 검증은 `node tools/verify-admin-assignment-release.mjs development`로 연습할 수 있다. 운영 DB와 sync-account를 적용한 뒤 `development` 대신 `production`을 지정하면 공개 사이트에 임시 아이디 3개를 생성해 두 관리자 브라우저 간 배정·알림·읽음 상태를 대조하고 정리한다. 로그인된 CLI 대신 Supabase 플러그인으로 테스트 권한을 지정하고 정리하려면 `--external-sql`을 추가하고 표시된 SQL을 같은 대상 프로젝트에 적용한다.
