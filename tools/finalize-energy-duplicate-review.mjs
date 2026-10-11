import fs from 'node:fs';
import crypto from 'node:crypto';
import {applyVerdicts, digest, verdictPath} from './energy-duplicate-verdicts.mjs';

// Authored content review, NOT an automatic similarity threshold. Index mapping is
// pinned to all 76 stable pair IDs; the saved overlay itself uses stable IDs.
const reportPath = 'docs/energy-duplicate-review-2026-10-11.json';
const report = JSON.parse(fs.readFileSync(reportPath,'utf8'));
if (digest(report.pairs.map(p=>p.id)) !== '4fedfe0ee440c86378f6cc7906a38b1c796ca17d74d3078e6dbc2fbcc6466b17') throw Error('Pair order changed; do not apply index-based review');
const results = [
  ['same','열역학 제1법칙=에너지 보존. 질문 취지와 네 보기의 의미가 같고 보기 순서만 바뀌어 등록 정답④→②입니다.'],
  ['same','가역 단열·등온 팽창의 내부에너지 감소 비교. 조건·네 보기·등록 정답④가 같은 반복입니다.'],
  ['variant','점화 전 체류가스 배출을 묻고 등록 정답은 둘 다③입니다. ④ 오답의 점화 전파/신속한 점화 표현이 달라 보수적으로 변형으로 구분합니다. 사용자 메모의 ④는 등록 정답 번호가 아닙니다.'],
  ['same','제1법칙의 설명을 묻는 질문과 네 보기 내용이 같고 순서만 바뀝니다. 에너지 보존 설명이 등록 정답②→①입니다.'],
  ['same','보염장치의 목적이 아닌 것: 연소가스 체류시간을 짧게 한다. 질문의 부정 표현만 다르고 네 보기 의미는 같으며③·④ 순서가 바뀌어 정답④→③입니다. 화질은2025년2회28번 쪽이 더 읽기 쉽지만 실제 이미지 교체는 하지 않았습니다.'],
  ['same','계의 에너지 보존을 묻는 같은 질문·네 보기입니다. 보기 순서 차이로 등록 정답①→④입니다.'],
  ['same','계의 에너지 보존을 묻는 같은 질문·네 보기입니다. 보기 순서 차이로 등록 정답①→②입니다.'],
  ['same','건식이 아닌 집진장치=벤투리 스크러버. 네 보기의 의미가 같고③·④ 순서가 바뀌어 등록 정답③→④입니다. 원문 두 장에서 확인했습니다.'],
  ['same','나사맞춤부·엘보로 신축을 흡수하는 스위블 이음. 질문·네 보기 의미·정답③가 같고 영어 병기만 생략됐습니다.'],
  ['different','가스배관 표시항목을 묻지만 실내 조건과 보기 내용이 다릅니다. 등록 정답 내용도 제조일자와 최고사용온도로 달라 중복에서 제외합니다.'],
  ['variant','수압시험 방법이라는 같은 유형이지만 보기의 유지시간30분/10분, 초과압력10%/6%가 다르고 등록 정답도④/③입니다. 수치 조건을 보존해야 합니다.'],
  ['variant','진공환수식이 가장 빠르다는 정답 개념은 같습니다. 단관·복관 중력환수와 중력·강제환수 등 오답의 범위가 달라 완전 반복은 아닙니다.'],
  ['variant','가장 빠른 환수 방식의 정답 개념은 진공환수식으로 같습니다. 자연환수/강제환수 등 다른 보기 구성이 달라 구분합니다.'],
  ['variant','진공환수식이 정답인 같은 질문이나 자연·중력환수와 단관·복관 중력환수의 보기 구성이 다릅니다.'],
  ['variant','상당증발량 공식의 등록 정답②는 같습니다. 원문 분수에서 오답 분모가226과539로 달라 네 보기가 같은 반복은 아닙니다.'],
  ['different','한쪽은 건식 전체에서 아닌 것(벤투리 스크러버), 다른 쪽은 원심력식이 아닌 것(백 필터)을 묻습니다. 집진장치 분류 범위가 다르므로 다른 문제입니다.'],
  ['variant','진공환수식을 찾는 유형은 같지만 뒤 문항은 진공펌프·설치 위치 설명이 추가됩니다. 질문 조건이 확장되어 별도 변형입니다.'],
  ['different','가장 빠른 환수 방식을 고르는 문제와 환수 방식이 아닌 것을 고르는 문제입니다. 질문 목표와 정답이 다릅니다.'],
  ['different','순환이 가장 빠른 방식과 환수 방법에 속하지 않는 것을 각각 묻습니다. 같은 환수 주제여도 다른 문제입니다.'],
  ['different','가장 빠른 환수 방식과 환수 방법이 아닌 것을 구분하는 질문으로, 같은 문제로 합칠 수 없습니다.'],
  ['variant','제1법칙=에너지 보존이라는 정답 개념은 같지만 다른 법칙을 설명하는 오답들이 달라 네 보기 전체가 같지는 않습니다.'],
  ['variant','진공환수식이 정답이지만 한쪽에는 펌프와 설치 위치 설명이 추가되고 자연환수/강제환수 등 오답도 다릅니다.'],
  ['variant','진공환수식이라는 개념은 같으나 펌프·위치 설명과 단관·복관 중력환수 등의 보기 구성이 달라 변형입니다.'],
  ['variant','상당증발량 계산형. 실제 증발량2000/3500, 증기 엔탈피600/640, 급수30/20 등 수치가 바뀌어 정답 계산값이 다릅니다.'],
  ['same','건식이 아닌 것=벤투리 스크러버. 사이크론/사이클론·멀티크론/멀티클론의 표기 차이와 보기 순서만 다릅니다. 정답③→①입니다.'],
  ['variant','슬러지 조정제가 아닌 것을 묻는 같은 유형입니다. 공통 보기 탄닌·리그닌·전분 외에 수산화나트륨/탄산칼슘이 달라 정답 내용도 다릅니다.'],
  ['variant','인터록 종류가 아닌 것이라는 같은 질문이지만 고수위/고온도, 프리퍼지/압력초과 등 보기 내용이 바뀌어 별도 문제로 보존합니다.'],
  ['variant','기체연료의 잘못된 특징을 고르는 유형은 같지만 체적당 발열량·재·저장 등 보기와 틀린 설명이 다릅니다.'],
  ['variant','액체연료의 단점/장점을 구분하는 같은 유형이나 화재 위험/완전연소 등 틀린 보기 내용이 달라 변형입니다.'],
  ['same','건식이 아닌 집진장치의 네 보기 의미가 같고 표기·보기 순서만 다릅니다. 벤투리 스크러버가 등록 정답①→④입니다.'],
  ['variant','이상기체 등온과정의 내부에너지 변화0은 같습니다. 열량·일의 오답에서 절댓값 유무가 달라 수학적 의미를 지우고 반복으로 합치지 않습니다.'],
  ['variant','인터록이 아닌 종류를 묻지만 미분동작/온오프동작으로 정답 내용이 달라 별도 변형입니다.'],
  ['different','액체연료와 기체연료의 특징을 각각 묻습니다. 연료 종류 자체가 달라 다른 문제입니다.'],
  ['different','기체연료와 액체연료의 특징을 구분하는 별개의 질문입니다. 같은 단어가 있어도 합치지 않습니다.'],
  ['variant','기체연료는 저장이 쉽다는 틀린 설명을 고르는 개념은 같습니다. 저장 외 세 보기의 내용·표현이 달라 반복 확정에서 제외합니다.'],
  ['same','이론연소온도=저위발열량/(연소가스량×비열). 원문 분수의 분자·분모 네 조합을 대조했으며 기호 표기와 보기②·③ 순서만 다릅니다. 등록 정답은 둘 다①입니다.'],
  ['variant','인터록이 아닌 것을 묻는 유형이나 미분동작/고수위 차단 등 정답 내용과 다른 보기가 달라 변형입니다.'],
  ['variant','최고 집진효율을 비교하고 전기식이 등록 정답인 유형은 같습니다. 중력식/여과식 등 비교 대상이 달라 네 보기가 같지는 않습니다.'],
  ['variant','디스크 트랩을 묻는 공통 개념입니다. 짧은 분류 질문과 수격·과열증기·유지보수 특징 설명, 오답 트랩 종류가 다릅니다.'],
  ['variant','슬러지 조정제=전분은 같지만 다른 세 약품 보기가 달라 완전 동일 문제는 아닙니다.'],
  ['variant','인터록이 아닌 것을 묻지만 미분동작/온도초과로 고르는 보기 내용이 다릅니다.'],
  ['variant','집진효율 비교 유형이지만 여과식/전기식 포함 여부가 다릅니다. 비교할 보기 집합이 달라 등록 정답 내용을 그대로 복사할 수 없습니다.'],
  ['variant','제1법칙=에너지 보존의 정답 개념은 같지만 나머지 세 법칙 설명이 다른 선택지이므로 변형입니다.'],
  ['variant','유류 역화의 원인이 아닌 것을 고르지만 원문의②가 과대한 예열/예열부족으로 반대입니다. 다른 원인 보기들도 다릅니다. 완전 반복에서 제외하며 등록 정답②의 타당성은 별도 출처 확인 대상으로 남깁니다.'],
  ['variant','pH·알칼리도 조정제가 아닌 탄닌이 공통 정답입니다. 화학식/한글 명칭 외에 인산염과 인산나트륨의 범위, 급수/관수 표현이 달라 보수적으로 변형입니다.'],
  ['variant','제1법칙의 에너지 보존 개념은 같지만 다른 세 보기의 법칙 설명이 다릅니다.'],
  ['variant','정답은 에너지 보존으로 같고 보기 순서도 바뀝니다. 오답의 법칙 설명 자체가 달라 반복이 아닌 변형입니다.'],
  ['variant','제1법칙의 올바른 설명은 같지만 다른 세 선택지가 바뀌어 네 보기 전체는 다릅니다.'],
  ['same','엘보·나사 회전으로 신축을 흡수하는 스위블 이음. 질문의 핵심 조건·네 보기 의미가 같으며 루프형 이음/신축곡관은 대응하는 명칭입니다. 보기 순서가 바뀌어 등록 정답④→③입니다.'],
  ['variant','인터록이 아닌 고온도/온도초과 개념은 유사하지만 저수위/불착화 등 다른 보기 구성이 달라 변형입니다.'],
  ['variant','인터록이 아닌 것을 찾지만 온오프동작/온도초과로 답안 내용이 달라 별도 변형입니다.'],
  ['variant','일정 압력 팽창 계산형. 체적 변화는 같아도2kgf/cm²·25kcal와200kPa·25kJ로 압력·에너지 단위가 달라 같은 계산값으로 처리하면 안 됩니다.'],
  ['variant','인터록이 아닌 것을 찾지만 온오프동작/고수위 등 정답 내용과 다른 보기가 다릅니다.'],
  ['variant','가성취화의 수면 위 발생 설명을 고르는 공통 개념이나 응력이 분산한다는 표현과 나머지 보기 내용이 달라 변형입니다.'],
  ['variant','기체연료의 저장이 쉽다는 틀린 설명을 고릅니다. 운송·열효율 등 나머지 보기 내용이 달라 완전 반복은 아닙니다.'],
  ['different','최고사용압력0.5MPa는 같지만 압력용기와 증기보일러라는 대상이 다릅니다. 등록값0.75/0.95MPa를 서로 복사·통일하지 않습니다.'],
  ['variant','열역학식 디스크 트랩을 고르는 유형은 같습니다. 온도조절식/버킷 등 다른 트랩 보기가 바뀌어 변형입니다.'],
  ['variant','Q=ΔU+PΔV를 쓰는 공통 계산형이나 압력200/300kPa, 체적0.4→0.6/0.5→0.7m³, 내부에너지 증가량80/50kJ가 다릅니다.'],
  ['variant','인터록이 아닌 것을 고르지만 고수위/온도초과로 정답 내용과 보기 구성이 달라 변형입니다.'],
  ['variant','집진효율 질문은 유사해도 여과식과 전기식 등 비교 대상이 바뀌어 등록 정답 내용이 다릅니다. 조건·보기 집합을 보존합니다.'],
  ['variant','온도150℃·체적0.248→0.496·비열비1.4의 단열팽창은 같지만 정적비열0.172kcal/0.72kJ와 정답-17.7kcal/-74kJ로 단위·반올림이 다릅니다.'],
  ['variant','디스크 트랩의 공통 원리입니다. 기능 설명의 길이와 다른 트랩 종류 보기가 달라 별도 변형으로 둡니다.'],
  ['variant','일정 압력200kPa 팽창이지만 시작 체적0.4/0.5m³와 내부에너지 증가량80/25kJ가 달라 계산 답도 다릅니다.'],
  ['variant','인터록이 아닌 종류를 묻지만 미분동작/고온도로 답과 다른 보기가 달라 변형입니다.'],
  ['variant','일정 압력 팽창형이나 압력2kgf/cm²/300kPa 및 내부에너지 증가량25kcal/50kJ가 다릅니다. 단위를 삭제해 같은 문제로 합치지 않습니다.'],
  ['same','엘보·나사맞춤 회전으로 신축을 흡수하는 스위블 이음. 조건과 네 보기의 의미가 같고 영어 병기·명칭과 순서만 달라 정답③→④입니다.'],
  ['variant','일정 압력 팽창형이나 압력300/200kPa, 내부에너지 증가량50/25kJ가 다르므로 정답 계산값이 다릅니다.'],
  ['variant','인터록이 아닌 것을 고르지만 온오프동작/고온도로 등록 정답 내용과 다른 보기가 달라 변형입니다.'],
  ['variant','기체연료의 저장 편리성에 대한 틀린 설명이라는 공통 개념입니다. 취급·설비·발열량 등 다른 세 보기가 달라 구분합니다.'],
  ['variant','기체연료는 저장이 쉽다는 틀린 설명을 찾지만 다른 세 보기의 장점 내용이 달라 별도 변형입니다.'],
  ['variant','일정 압력 팽창 계산이나200kPa·내부에너지 증가량80kJ와2kgf/cm²·25kcal로 단위·수치가 달라 같은 답을 쓸 수 없습니다.'],
  ['variant','이상기체 내부에너지는 온도의 함수라는 공통 원리를 묻습니다. 질문 형식과 다른 물리량·수식 보기가 달라 변형입니다.'],
  ['variant','기폭법으로 제거하지 않는 산소가 공통 정답입니다. 황화수소/망간 등 다른 보기 물질이 달라 네 보기가 같은 반복은 아닙니다.'],
  ['variant','기체연료의 저장 편리성이라는 같은 틀린 설명을 고릅니다. 운송·연소조절 등 나머지 세 보기가 달라 변형입니다.'],
  ['variant','기체연료 저장의 어려움을 묻는 개념은 같지만 그 밖의 발열량·설비·취급 보기 내용이 다릅니다.'],
  ['variant','롱 레트랙터(장발형)와 고온가스 통로의 대응은 같습니다. 하나는 장치의 사용 장소, 다른 하나는 장소 설명으로 장치 이름을 묻는 역방향 질문입니다.'],
];
if (results.length !== 76) throw Error('Expected 76 authored verdicts');
const supplied = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2],'utf8')) : null;
const existing = fs.existsSync(verdictPath) ? JSON.parse(fs.readFileSync(verdictPath,'utf8')) : null;
if (supplied && (supplied.schemaVersion!==1 || supplied.scope!=='energy-midterm-only')) throw Error('Invalid user export');
const importedReviews = supplied?.reviews || existing?.importedReviews;
if (!importedReviews || importedReviews.length!==10) throw Error('Supply the user review export (10 decisions)');
for (const r of importedReviews) if (!report.pairs.some(p=>p.id===r.id) || !['same','variant','different','unsure'].includes(r.decision) || typeof r.note!=='string') throw Error('Invalid imported decision');
const indices = new Set(report.pairs.flatMap(p=>[p.a,p.b]));
const assets = [...new Set([...indices].flatMap(i=>{const r=report.rows[i];return [r.sourceImage,...r.images,...r.choices.flatMap(c=>c.images)].filter(Boolean);} ))];
if (assets.length!==36) throw Error('Unexpected reviewed image inventory');
const verdicts = {schemaVersion:1,scope:'energy-midterm-only',date:'2026-10-12',
  rowsDigest:digest(report.rows), pairSetDigest:digest(report.pairs.map(p=>p.id).sort()),
  assetDigests:Object.fromEntries(assets.map(path=>[path,crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')])),
  importedExportDate:supplied?.date || existing?.importedExportDate, importedReviews,
  method:'76후보의 본문·조건·전체4보기·등록 정답 내용을 비교하고 원문 이미지36장을 직접 확인했습니다. 후보 밖 전 정답 사실 검증은 아닙니다.',
  reviews:report.pairs.map((p,i)=>({id:p.id,decision:results[i][0],reason:results[i][1],
    evidence:[report.rows[p.a].sourceImage?'원문 이미지':'저장 본문·보기',report.rows[p.b].sourceImage?'원문 이미지':'저장 본문·보기'],
    ...(i===43?{warnings:['출처 확인 필요: 원문②가 과대예열/예열부족으로 반대 · 정답 변경 보류']}:{}),
  }))};
fs.writeFileSync(verdictPath,JSON.stringify(verdicts,null,2)+'\n');
applyVerdicts(report,verdicts);
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reviewed:report.reviewedPairs,states:report.states,groups:report.repeatGroups,questions:report.repeatQuestions,warnings:report.warningPairs,imported:report.importedReviewCount},null,2));
