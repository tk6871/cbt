# v5.8.1 — 필기 영향이 있는 부분만 교체

- 전자책 뷰어 눈 버튼으로 빨간 체크·검은 필기만 숨겨지고 인쇄 원문은 남는 것을 확인했습니다. 정상 열람332화면을 비교용으로 저장했습니다.
- 사용자 정정에 따라 전체397쪽 재처리는 중단했습니다. 필기 영향이 있는 원문14쪽·문제/풀이26장만 기존 Real-ESRGAN4배→2배bicubic·tile256·losslessWebP로 개선·교체했습니다. 영향 없는383쪽·이전 개선474장은 그대로입니다. 불필요한 새 캡처/출력은 비공개work로 옮겨 보존했고 배포하지 않습니다.
- 이전 원본/개선본·일반은행6+교재은행1·정답·좌표·다크/라이트·선택기록 유지. 교체한 쪽 확대본 실패 시 필기 없는 원해상도로 대체합니다. 색 삭제/인페인팅/책파일 추출/설치·다운로드 없음.
- 실제 성공: typecheck, text-publication, native-publication, unit-tests, build, pwa, changelog-identity, clean-image-browser-tests. 실물기기/Safari/실계정동기화/APK/실배포 미검사. Android설정629/5.8.1만 변경했습니다.
- 풀이 경계127곳·정답 검증·전체 개별 대조·커밋/Push/배포는 별도 미완료입니다. Git 플러그인403을 다른 경로로 우회하지 않았습니다. 전자책 뷰어 진도84% 복귀는 미확인이며 보기 복원 실제 상태는 reader-restoration.json을 확인합니다.

로그: work/hansol-ink-hidden/result.json·각 검사.log.
