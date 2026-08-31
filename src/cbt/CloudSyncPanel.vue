<script setup lang="ts">
import { ref } from 'vue';
import {
  cloudSyncState,
  requestSyncLoginLink,
  requestSyncPasswordReset,
  signInForSync,
  signOutFromSync,
  signUpForSync,
  syncLearningData,
  updateSyncPassword,
} from './cloudSync';

type AuthMode = 'login' | 'signup' | 'id' | 'reset';

defineProps<{ description: string }>();

const space = window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial';
const emailStorageKey = `cbt-sync-email-${space}`;
const rememberStorageKey = `cbt-sync-remember-${space}`;
const rememberedEmail = ref(localStorage.getItem(emailStorageKey) || '');
const open = ref(false);
const mode = ref<AuthMode>('login');
const email = ref(rememberedEmail.value);
const password = ref('');
const passwordConfirm = ref('');
const newPassword = ref('');
const rememberEmail = ref(localStorage.getItem(rememberStorageKey) !== 'false');
const busy = ref(false);
const message = ref('');

function setMode(nextMode: AuthMode): void {
  mode.value = nextMode;
  password.value = '';
  passwordConfirm.value = '';
  message.value = '';
}

function saveRememberedEmail(): void {
  localStorage.setItem(rememberStorageKey, String(rememberEmail.value));
  if (rememberEmail.value) {
    rememberedEmail.value = email.value.trim().toLowerCase();
    localStorage.setItem(emailStorageKey, rememberedEmail.value);
  } else {
    rememberedEmail.value = '';
    localStorage.removeItem(emailStorageKey);
  }
}

async function login(): Promise<void> {
  if (!email.value.trim() || !password.value) {
    message.value = '아이디(이메일)와 비밀번호를 입력해 주세요.';
    return;
  }
  busy.value = true;
  message.value = '';
  const error = await signInForSync(email.value, password.value);
  busy.value = false;
  message.value = error || '로그인했습니다. 이 기기와 클라우드 기록을 안전하게 합칩니다.';
  if (!error) {
    saveRememberedEmail();
    password.value = '';
  }
}

async function signup(): Promise<void> {
  if (!email.value.trim() || password.value.length < 8) {
    message.value = '사용할 이메일과 8자 이상의 비밀번호를 입력해 주세요.';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    message.value = '두 비밀번호가 서로 다릅니다.';
    return;
  }
  busy.value = true;
  message.value = '';
  const result = await signUpForSync(email.value, password.value);
  busy.value = false;
  message.value = result || '계정을 만들고 로그인했습니다. 기록 동기화를 시작합니다.';
  if (!result || result.startsWith('확인 메일을 보냈습니다.')) {
    saveRememberedEmail();
    password.value = '';
    passwordConfirm.value = '';
  }
}

async function findId(): Promise<void> {
  busy.value = true;
  message.value = '';
  const error = await requestSyncLoginLink(email.value);
  busy.value = false;
  message.value = error || '가입된 이메일이면 로그인 확인 메일이 도착합니다. 메일이 없다면 다른 이메일을 확인해 보세요.';
}

async function resetPassword(): Promise<void> {
  busy.value = true;
  message.value = '';
  const error = await requestSyncPasswordReset(email.value);
  busy.value = false;
  message.value = error || '가입된 이메일이면 비밀번호 재설정 메일이 도착합니다.';
}

async function saveNewPassword(): Promise<void> {
  busy.value = true;
  message.value = '';
  const error = await updateSyncPassword(newPassword.value);
  busy.value = false;
  message.value = error || '새 비밀번호로 변경했습니다. 자동 로그인이 유지됩니다.';
  if (!error) newPassword.value = '';
}

async function logout(): Promise<void> {
  await signOutFromSync();
  open.value = false;
  password.value = '';
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

    <form v-if="cloudSyncState.passwordRecovery" class="cloud-sync-form cloud-sync-recovery" @submit.prevent="saveNewPassword">
      <div class="cloud-sync-form-title"><b>새 비밀번호 설정</b><small>메일의 재설정 링크가 확인되었습니다.</small></div>
      <label><span>새 비밀번호</span><input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label>
      <p v-if="message" aria-live="polite">{{ message }}</p>
      <div><button type="submit" :disabled="busy">{{ busy ? '변경 중…' : '새 비밀번호 저장' }}</button></div>
    </form>

    <template v-else-if="cloudSyncState.email">
      <div class="cloud-sync-account">
        <div><strong>{{ cloudSyncState.email }}</strong><small>{{ cloudSyncState.message || '기기 간 기록 동기화가 연결되었습니다.' }}</small></div>
        <i :class="`is-${cloudSyncState.status}`">{{ cloudSyncState.status === 'syncing' ? '동기화 중' : cloudSyncState.status === 'error' ? '확인 필요' : '연결됨' }}</i>
      </div>
      <div class="cloud-sync-actions"><button type="button" :disabled="cloudSyncState.status === 'syncing'" @click="syncLearningData">지금 동기화</button><button type="button" class="secondary" @click="logout">로그아웃</button></div>
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
          <div class="cloud-sync-form-title"><b>동기화 로그인</b><small>아이디는 회원가입에 사용한 이메일입니다.</small></div>
          <label><span>아이디(이메일)</span><input v-model.trim="email" type="email" autocomplete="username" required placeholder="name@example.com"></label>
          <label><span>비밀번호</span><input v-model="password" type="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상"></label>
          <label class="cloud-sync-remember"><input v-model="rememberEmail" type="checkbox"><span>아이디 기억</span><small>로그인 세션도 이 기기에 안전하게 유지됩니다.</small></label>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '확인 중…' : '로그인' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else-if="mode === 'signup'" class="cloud-sync-form" @submit.prevent="signup">
          <div class="cloud-sync-form-title"><b>무료 동기화 계정 만들기</b><small>오답·점수·진도·즐겨찾기와 이어 풀기 위치를 저장합니다.</small></div>
          <label><span>아이디로 사용할 이메일</span><input v-model.trim="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
          <label><span>비밀번호</span><input v-model="password" type="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label>
          <label><span>비밀번호 확인</span><input v-model="passwordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="한 번 더 입력"></label>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '만드는 중…' : '회원가입' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else-if="mode === 'id'" class="cloud-sync-form" @submit.prevent="findId">
          <div class="cloud-sync-form-title"><b>아이디 찾기</b><small>동기화 아이디는 별도 닉네임이 아니라 가입 이메일입니다.</small></div>
          <div v-if="rememberedEmail" class="cloud-sync-remembered-id"><span>이 기기에 기억된 아이디</span><button type="button" @click="email = rememberedEmail">{{ rememberedEmail }}</button></div>
          <label><span>가입했을 가능성이 있는 이메일</span><input v-model.trim="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
          <p class="cloud-sync-help">계정 존재 여부는 다른 사람에게 노출하지 않습니다. 가입된 이메일인 경우에만 확인 메일이 도착합니다.</p>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '보내는 중…' : '로그인 확인 메일 받기' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>

        <form v-else class="cloud-sync-form" @submit.prevent="resetPassword">
          <div class="cloud-sync-form-title"><b>비밀번호 찾기</b><small>가입 이메일로 안전한 재설정 링크를 보냅니다.</small></div>
          <label><span>아이디(이메일)</span><input v-model.trim="email" type="email" autocomplete="email" required placeholder="name@example.com"></label>
          <p class="cloud-sync-help">메일 링크를 연 뒤 새 비밀번호를 저장하면 기존 학습 기록은 그대로 유지됩니다.</p>
          <p v-if="message" aria-live="polite">{{ message }}</p>
          <div><button type="submit" :disabled="busy">{{ busy ? '보내는 중…' : '재설정 메일 받기' }}</button><button type="button" class="text-button" @click="open = false; message = ''">닫기</button></div>
        </form>
      </div>
    </template>
  </div>
</template>
