<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ person: string }>();
const input = ref('');
const messages = ref<{ question: string; answer: string }[]>([]);
function send() {
  const question = input.value.trim().slice(0, 200);
  if (!question) return;
  const answer =
    /수영|해변|여름/.test(question) ? '여름이라면 바다 근처 산책이 좋죠. 선선할 때 나가고 싶어요.' :
    /공부|시험|문제|복습/.test(question) ? '한 문제만 같이 골라 볼까요? 답 번호보다 왜 그 답인지부터 말해 봐요.' :
    /카페|커피|차 마/.test(question) ? '조용한 카페면 좋아요. 오늘은 공부 얘기 말고 쉬는 날 이야기를 해 볼까요?' :
    /안녕|반가/.test(question) ? '반가워요. 오늘 캠퍼스는 어땠어요?' :
    /산책|정원|날씨/.test(question) ? '정원이 한산해지면 천천히 한 바퀴 돌기 좋아요.' :
    '그 주제는 아직 답을 준비하지 못했어요. 공부, 커피, 산책 중 하나로 얘기해 볼까요?';
  messages.value = [...messages.value.slice(-4), { question, answer }];
  input.value = '';
}
</script>

<template>
  <details class="campus-free-chat">
    <summary>자유 대화</summary>
    <small>기기 안에서 작동하는 주제별 답변 · AI 연결 및 저장 없음</small>
    <div role="log" aria-label="자유 대화 내용">
      <div v-for="(message,index) in messages" :key="index">
        <p><strong>나:</strong> {{ message.question }}</p>
        <p><strong>{{ props.person }}:</strong> {{ message.answer }}</p>
      </div>
    </div>
    <form @submit.prevent="send" @keydown.stop>
      <input v-model="input" maxlength="200" aria-label="대화 메시지" placeholder="예: 수업 끝나고 커피 마실래요?">
      <button type="submit" :disabled="!input.trim()">보내기</button>
    </form>
  </details>
</template>

<style scoped>
.campus-free-chat small{display:block;margin:.5rem 0}
.campus-free-chat [role=log]{max-height:9rem;overflow:auto}
.campus-free-chat p{margin:.2rem 0}
.campus-free-chat form{display:flex;gap:6px;margin-top:8px}
.campus-free-chat input{min-width:0;flex:1;padding:8px;border:1px solid #31595766;border-radius:6px}
</style>
