<script setup lang="ts">
import { ref } from 'vue';
import {
  cloudSyncState,
  findSyncId,
  resetSyncPassword,
  signInForSync,
  signOutFromSync,
  signUpForSync,
  syncLearningData,
  updateSyncPassword,
} from './cloudSync';

type AuthMode = 'login' | 'signup' | 'id' | 'reset';
defineProps<{ description: string }>();

const space = window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial';
const identifierStorageKey = `cbt-sync-email-${space}`;
const rememberStorageKey = `cbt-sync-remember-${space}`;
const rememberedIdentifier = ref(localStorage.getItem(identifierStorageKey) || '');
const open = ref(false);
const mode = ref<AuthMode>('login');
const identifier = ref(rememberedIdentifier.value);
const password = ref('');
const passwordConfirm = ref('');
const recoveryCode = ref('');
const issuedRecoveryCode = ref('');
const rememberIdentifier = ref(localStorage.getItem(rememberStorageKey) !== 'false');
const changePasswordOpen = ref(false);
const busy = ref(false);
const message = ref('');

function setMode(nextMode: AuthMode): void {
  mode.value = nextMode;
  password.value = '';
  passwordConfirm.value = '';
  recoveryCode.value = '';
  issuedRecoveryCode.value = '';
  message.value = '';
}

function saveRememberedIdentifier(): void {
  localStorage.setItem(rememberStorageKey, String(rememberIdentifier.value));
  if (rememberIdentifier.value) {
    rememberedIdentifier.value = identifier.value.trim();
    localStorage.setItem(identifierStorageKey, rememberedIdentifier.value);
  } else {
    rememberedIdentifier.value = '';
    localStorage.removeItem(identifierStorageKey);
  }
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    message.value = '복구코드를 복사했습니다. 다른 사람이 볼 수 없는 곳에 보관하세요.';
  } catch {
    message.value = `복구코드: ${value}`;
  }
}

async function login(): Promise<void> {
  if (!identifier.value.trim() || !password.value) {
    message.value = '아이디와 비밀번호를 입력해 주세요.';
    return;
  }
  busy.value = true;
  message.value = '';
  const error = await signInForSync(identifier.value, password.value);
  busy.value = false;
  message.value = error || '로그인했습니다. 이 기기와 클라우드 기록을 안전하게 합칩니다.';
  if (!error) {
    saveRememberedIdentifier();
    password.value = '';
  }
}

async function signup(): Promise<void> {
  if (!identifier.value.trim() || password.value.length < 8) {
    message.value = '사용할 아이디와 8자 이상의 비밀번호를 입력해 주세요.';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    message.value = '두 비밀번호가 서로 다릅니다.';
    return;
  }
  busy.value = true;
  message.value = '';
  const result = await signUpForSync(identifier.value, password.value);
  busy.value = false;
  issuedRecoveryCode.value = result.recoveryCode || '';
  message.value = result.error || '계정을 만들고 로그인했습니다. 아래 복구코드를 꼭 저장하세요.';
  if (!result.error) {
    saveRememberedIdentifier();
    password.value = '';
    passwordConfirm.value = '';
  }
}

async function findId(): Promise<void> {
  if (!recoveryCode.value.trim()) {
    message.value = '가입할 때 받은 복구코드를 입력해 주세요.';
    return;
  }
  busy.value = true;
  message.value = '';
  const result = await findSyncId(recoveryCode.value);
  busy.value = false;
  if (result.username) identifier.value = result.username;
  message.value = result.error || `찾은 아이디는 “${result.username}”입니다.`;
}

async function resetPassword(): Promise<void> {
  if (!identifier.value.trim() || !recoveryCode.value.trim() || password.value.length < 8) {
    message.value = '아이디·복구코드·8자 이상의 새 비밀번호를 입력해 주세요.';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    message.value = '두 비밀번호가 서로 다릅니다.';
    return;
  }
  busy.value = true;
  message.value = '';
  const result = await resetSyncPassword(identifier.value, recoveryCode.value, password.value);
  busy.value = false;
  issuedRecoveryCode.value = result.recoveryCode || '';
  message.value = result.error || '비밀번호를 바꿨습니다. 아래 새 복구코드를 저장한 뒤 로그인하세요.';
  if (!result.error) {
    saveRememberedIdentifier();
    password.value = '';
    passwordConfirm.value = '';
    recoveryCode.value = '';
  }
}

async function saveNewPassword(): Promise<void> {
  if (password.value !== passwordConfirm.value) {
    message.value = '두 비밀번호가 서로 다릅니다.';
    return;
  }
  busy.value = true;
  message.value = '';
  const error = await updateSyncPassword(password.value);
  busy.value = false;
  message.value = error || '새 비밀번호로 변경했습니다. 자동 로그인이 유지됩니다.';
  if (!error) {
    password.value = '';
    passwordConfirm.value = '';
    changePasswordOpen.value = false;
  }
}

async function logout(): Promise<void> {
  await signOutFromSync();
  open.value = false;
  changePasswordOpen.value = false;
  password.value = '';
  passwordConfirm.value = '';
  message.value = '';
}

function syncTimeLabel(): string {
  if (!cloudSyncState.lastSyncedAt) return '아직 동기화하지 않음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(cloudSyncState.lastSyncedAt));
}
</script>

<template>
  <div class="setting-group cloud-sync-setting">
    <div class="cloud-sync-heading">
      <div><span>기기 간 학습 기록 동기화</span><p class="setting-description">{{ description }}</p></div>
      <small>최근 동기화<br><b>{{ syncTimeLabel() }}</b></small>
    </div>

    <template v-if="cloudSyncState.email">
      <div class="cloud-sync-account">
        <div><strong>{{ cloudSyncState.email }}</strong><small>{{ cloudSyncState.message || '기기 간 기록 동기화가 연결되었습니다.' }}</small></div>
        <i :class="`is-${cloudSyncState.status}`">{{ cloudSyncState.status === 'syncing' ? '동기화 중' : cloudSyncState.status === 'error' ? '확인 필요' : '연결됨' }}</i>
      </div>
      <p v-if="cloudSyncState.mustChangePassword" class="cloud-sync-help">관리자가 발급한 임시 비밀번호로 로그인했습니다. 지금 새 비밀번호로 바꿔 주세요.</p>
      <form v-if="changePasswordOpen || cloudSyncState.mustChangePassword" class="cloud-sync-form cloud-sync-recovery" @submit.prevent="saveNewPassword">
        <div class="cloud-sync-form-title"><b>새 비밀번호 설정</b><small>학습 기록은 그대로 유지됩니다.</small></div>
        <label><span>새 비밀번호</span><input v-model="password" type="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label>
        <label><span>새 비밀번호 확인</span><input v-model="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="한 번 더 입력"></label>
        <p v-if="message" aria-live="polite">{{ message }}</p>
        <div><button type="submit" :disabled="busy">{{ busy ? '변경 중…' : '새 비밀번호 저장' }}</button><button v-if="!cloudSyncState.mustChangePassword" type="button" class="text-button" @click="changePasswordOpen = false">닫기</button></div>
      </form>
      <div v-else class="cloud-sync-actions"><button type="button" :disabled="cloudSyncState.status === 'syncing'" @click="syncLearningData">지금 동기화</button><button type="button" class="secondary" @click="changePasswordOpen = true; message = ''">비밀번호 변경</button><button type="button" class="secondary" @click="logout">로그아웃</button></div>
    </template>

    <template v-else>
      <button v-if="!open" type="button" class="cloud-sync-open" @click="open = true; setMode('login')">로그인·회원가입</button>
      <div v-else class="cloud-sync-auth-shell">
        <nav aria-label="동기화 계정 메뉴">
          <button type="button" :class="{ active: mode === 'login' }" @click="setMode('login')">로그인</button>
          <button type="button" :class="{ active: mode === 'signup' }" @click="setMode('signup')">회원가입</button>
          <button type="button" :class="{ active: mode === 'id' }" @click="setMode('id')">아이디 찾기</button>
          <button type="button" :class="{ active: mode === 'reset' }" @click="setMode('reset')">비밀번호 찾기</button>
        </nav>

        <form v-if="mode === 'login'" class="cloud-sync-form" @submit.prevent="login">
          <div class="cloud-sync-form-title"><b>동기화 로그인</b><small>메일 없이 만든 아이디로 로그인합니다.</small></div>
          <label><span>아이디</span><input v-model.trim="identifier" type="text" autocomplete="username" required placeholder="4~24자"></label>
          <label><span>비밀번호</span><input v-model="password" type="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상"></label>
          <label class="cloud-sync-remember"><input v-model="rememberIdentifier" type="checkbox"><span>아이디 기억</span><small>로그인 세션도 이 기기에 안전하게 유지됩니다.</small></label>
          <p class="cloud-sync-help">기존 이메일 계정은 아이디 칸에 이메일을 그대로 입력해 로그인할 수 있습니다.</p>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '확인 중…' : '로그인' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else-if="mode === 'signup'" class="cloud-sync-form" @submit.prevent="signup">
          <div class="cloud-sync-form-title"><b>무료 동기화 계정 만들기</b><small>이메일 없이 아이디와 비밀번호만 사용합니다.</small></div>
          <label><span>아이디</span><input v-model.trim="identifier" type="text" autocomplete="username" minlength="4" maxlength="24" required placeholder="한글·영문·숫자 4~24자"></label>
          <label><span>비밀번호</span><input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="8자 이상"></label>
          <label><span>비밀번호 확인</span><input v-model="passwordConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="한 번 더 입력"></label>
          <div v-if="issuedRecoveryCode" class="cloud-sync-recovery-code"><span>내 복구코드</span><strong>{{ issuedRecoveryCode }}</strong><button type="button" @click="copyText(issuedRecoveryCode)">복사</button><small>비밀번호와 아이디를 찾을 때 필요합니다. 이 화면을 닫으면 다시 표시할 수 없습니다.</small></div>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button v-if="!issuedRecoveryCode" type="submit" :disabled="busy">{{ busy ? '만드는 중…' : '회원가입' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else-if="mode === 'id'" class="cloud-sync-form" @submit.prevent="findId">
          <div class="cloud-sync-form-title"><b>아이디 찾기</b><small>가입할 때 받은 복구코드로 바로 확인합니다.</small></div>
          <div v-if="rememberedIdentifier" class="cloud-sync-remembered-id"><span>이 기기에 기억된 아이디</span><button type="button" @click="identifier = rememberedIdentifier">{{ rememberedIdentifier }}</button></div>
          <label><span>복구코드</span><input v-model.trim="recoveryCode" type="text" autocomplete="off" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>
          <p class="cloud-sync-help">복구코드까지 잊었다면 관리자에게 임시 비밀번호 발급을 요청하세요.</p>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '확인 중…' : '아이디 확인' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else class="cloud-sync-form" @submit.prevent="resetPassword">
          <div class="cloud-sync-form-title"><b>비밀번호 바꾸기</b><small>복구코드가 맞으면 메일 없이 바로 변경합니다.</small></div>
          <label><span>아이디</span><input v-model.trim="identifier" type="text" autocomplete="username" required placeholder="가입한 아이디"></label>
          <label><span>복구코드</span><input v-model.trim="recoveryCode" type="text" autocomplete="off" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>
          <label><span>새 비밀번호</span><input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="8자 이상"></label>
          <label><span>새 비밀번호 확인</span><input v-model="passwordConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="72" required placeholder="한 번 더 입력"></label>
          <div v-if="issuedRecoveryCode" class="cloud-sync-recovery-code"><span>새 복구코드</span><strong>{{ issuedRecoveryCode }}</strong><button type="button" @click="copyText(issuedRecoveryCode)">복사</button><small>이전 복구코드는 더 이상 사용할 수 없습니다.</small></div>
          <p class="cloud-sync-help">복구코드도 없다면 관리자에게 임시 비밀번호를 요청한 뒤 로그인해서 변경할 수 있습니다.</p>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button v-if="!issuedRecoveryCode" type="submit" :disabled="busy">{{ busy ? '변경 중…' : '비밀번호 변경' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>
      </div>
    </template>
  </div>
</template>
