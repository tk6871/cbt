<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { Pane, Splitpanes } from 'splitpanes';
import { ChevronLeft, ExternalLink, FileDown, Save, Search } from '@lucide/vue';
import 'splitpanes/dist/splitpanes.css';

type IssueStatus = 'open' | 'reviewing' | 'resolved' | 'deferred';
type IssueRow = {
  id: number;
  space: 'industrial' | 'jewelry';
  qualification_key: string;
  qualification: string | null;
  round_id: string;
  round_title: string | null;
  round_year: number | null;
  round_session: string | null;
  question_id: string;
  question_number: number;
  display_number: number | null;
  subject: string | null;
  issue_types: string[];
  details: string;
  question_text: string | null;
  choices_snapshot: string[] | null;
  configured_answer: number | null;
  source_image: string | null;
  page_url: string | null;
  app_version: string | null;
  device_info: string | null;
  status: IssueStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const props = defineProps<{ reports: IssueRow[]; savingId: number | null }>();
const emit = defineEmits<{
  close: [];
  export: [];
  updateStatus: [report: IssueRow, status: IssueStatus];
  updateNote: [report: IssueRow, note: string | null];
}>();
const query = ref('');
const scrollElement = ref<HTMLElement | null>(null);
const selectedId = ref(props.reports[0]?.id || 0);
const filtered = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('ko-KR');
  if (!keyword) return props.reports;
  return props.reports.filter((item) => `${item.qualification || item.qualification_key} ${item.round_title || item.round_id} ${item.question_number} ${item.details} ${item.question_text || ''}`.toLocaleLowerCase('ko-KR').includes(keyword));
});
const selected = computed(() => filtered.value.find((item) => item.id === selectedId.value) || filtered.value[0] || null);
const virtualizer = useVirtualizer(computed(() => ({
  count: filtered.value.length,
  getScrollElement: () => scrollElement.value,
  estimateSize: () => 82,
  overscan: 7,
})));
const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const narrow = ref(matchMedia('(max-width: 820px)').matches);

watch(filtered, (rows) => {
  if (!rows.some((item) => item.id === selectedId.value)) selectedId.value = rows[0]?.id || 0;
});
</script>

<template>
  <section class="issue-workspace">
    <header>
      <button type="button" @click="emit('close')"><ChevronLeft :size="16" /> 기존 표</button>
      <div><strong>집중 검토</strong><small>목록 · 원문 · 처리 메모를 한 화면에서 확인</small></div>
      <button type="button" @click="emit('export')"><FileDown :size="16" /> JSON</button>
    </header>
    <Splitpanes class="issue-splitpanes" :horizontal="narrow">
      <Pane :size="24" :min-size="18">
        <aside class="issue-workspace-list">
          <label><Search :size="15" /><input v-model="query" placeholder="종목·회차·내용 검색"></label>
          <div ref="scrollElement" class="issue-virtual-scroll">
            <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
              <button
                v-for="row in virtualRows"
                :key="filtered[row.index]!.id"
                type="button"
                :class="{ active: selected?.id === filtered[row.index]!.id }"
                :style="{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${row.size}px`, transform: `translateY(${row.start}px)` }"
                @click="selectedId = filtered[row.index]!.id"
              >
                <span>#{{ filtered[row.index]!.id }} · {{ filtered[row.index]!.status }}</span>
                <strong>{{ filtered[row.index]!.qualification || filtered[row.index]!.qualification_key }} · {{ filtered[row.index]!.question_number }}번</strong>
                <small>{{ filtered[row.index]!.details || '상세 내용 없음' }}</small>
              </button>
            </div>
          </div>
        </aside>
      </Pane>
      <Pane :size="44" :min-size="28">
        <article v-if="selected" class="issue-workspace-source">
          <span>{{ selected.round_title || selected.round_id }} · {{ selected.subject || '과목 미확인' }}</span>
          <h2>{{ selected.qualification || selected.qualification_key }} {{ selected.question_number }}번</h2>
          <p>{{ selected.question_text || '이미지 원문 문제입니다.' }}</p>
          <ol v-if="selected.choices_snapshot?.length"><li v-for="(choice, index) in selected.choices_snapshot" :key="index">{{ index + 1 }}. {{ choice }}</li></ol>
          <img v-if="selected.source_image" :src="`../${selected.source_image}`" alt="제보된 문제 원문">
          <a v-if="selected.source_image" :href="`../${selected.source_image}`" target="_blank" rel="noopener"><ExternalLink :size="15" /> 원본 새 창으로 열기</a>
        </article>
      </Pane>
      <Pane :size="32" :min-size="24">
        <aside v-if="selected" class="issue-workspace-editor">
          <div><span>신고 유형</span><p><b v-for="type in selected.issue_types" :key="type">{{ type }}</b></p></div>
          <div><span>사용자 설명</span><p>{{ selected.details || '-' }}</p></div>
          <label>처리 상태<select :value="selected.status" :disabled="savingId === selected.id" @change="emit('updateStatus', selected, ($event.target as HTMLSelectElement).value as IssueStatus)"><option value="open">대기</option><option value="reviewing">확인 중</option><option value="resolved">수정 완료</option><option value="deferred">보류</option></select></label>
          <label>관리자 메모<textarea :value="selected.admin_note || ''" rows="9" placeholder="대조 결과·수정 파일·남은 작업" @blur="emit('updateNote', selected, ($event.target as HTMLTextAreaElement).value.trim() || null)" /></label>
          <small><Save :size="14" /> {{ savingId === selected.id ? '저장 중…' : '상태 변경 또는 메모 입력 후 자동 저장' }}</small>
        </aside>
      </Pane>
    </Splitpanes>
  </section>
</template>

<style scoped>
.issue-workspace{height:min(720px,calc(100vh - 220px));min-height:520px;border:1px solid #d7e1ec;border-radius:14px;background:#fff;overflow:hidden}.issue-workspace>header{height:58px;padding:0 13px;border-bottom:1px solid #dfe6ee;display:flex;align-items:center;justify-content:space-between;gap:10px}.issue-workspace>header div{min-width:0;text-align:center}.issue-workspace>header strong,.issue-workspace>header small{display:block}.issue-workspace>header strong{font-size:.72rem}.issue-workspace>header small{margin-top:2px;color:#8190a2;font-size:.5rem}.issue-workspace>header button{min-height:34px;padding:0 9px;border:1px solid #d4dfeb;border-radius:8px;color:#1769d2;background:#f7faff;display:flex;align-items:center;gap:5px;font-size:.55rem;font-weight:850}.issue-splitpanes{height:calc(100% - 58px)}:deep(.splitpanes__splitter){position:relative;background:#edf1f6}:deep(.splitpanes--vertical>.splitpanes__splitter){width:5px}:deep(.splitpanes--horizontal>.splitpanes__splitter){height:5px}.issue-workspace-list,.issue-workspace-source,.issue-workspace-editor{height:100%;min-width:0;padding:12px;overflow:auto}.issue-workspace-list label{height:36px;padding:0 9px;border:1px solid #d7e1ec;border-radius:8px;background:#f8fafc;display:flex;align-items:center;gap:6px}.issue-workspace-list input{min-width:0;width:100%;border:0;outline:0;background:transparent;font-size:.58rem}.issue-virtual-scroll{height:calc(100% - 44px);margin-top:8px;overflow:auto}.issue-virtual-scroll button{padding:9px;border-bottom:1px solid #e6ebf1;color:#263b54;background:#fff;text-align:left;overflow:hidden}.issue-virtual-scroll button.active{border-left:4px solid #1769d2;background:#edf5ff}.issue-virtual-scroll span,.issue-virtual-scroll strong,.issue-virtual-scroll small{display:block}.issue-virtual-scroll span{color:#71839a;font-size:.48rem}.issue-virtual-scroll strong{margin-top:4px;font-size:.59rem}.issue-virtual-scroll small{margin-top:4px;color:#718095;font-size:.5rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.issue-workspace-source>span{color:#1769d2;font-size:.54rem;font-weight:850}.issue-workspace-source h2{margin:6px 0 12px;font-size:1rem}.issue-workspace-source p,.issue-workspace-source li{font-size:.64rem;line-height:1.72;white-space:pre-wrap}.issue-workspace-source ol{padding-left:20px}.issue-workspace-source img{max-height:430px;margin-top:12px;border:1px solid #dfe6ee;border-radius:9px;background:#fff;object-fit:contain}.issue-workspace-source a{width:max-content;margin-top:9px;color:#1769d2;display:flex;align-items:center;gap:5px;font-size:.56rem;font-weight:850}.issue-workspace-editor{background:#f8fafc;display:grid;align-content:start;gap:13px}.issue-workspace-editor span,.issue-workspace-editor label{color:#5f7188;font-size:.55rem;font-weight:850}.issue-workspace-editor p{margin:6px 0 0;color:#263b54;font-size:.59rem;line-height:1.6}.issue-workspace-editor p b{display:inline-block;margin:0 4px 4px 0;padding:4px 6px;border-radius:999px;color:#9b561d;background:#fff0dd;font-size:.48rem}.issue-workspace-editor select,.issue-workspace-editor textarea{width:100%;margin-top:6px;padding:8px;border:1px solid #d4dfeb;border-radius:8px;color:#243b55;background:#fff;font-size:.58rem}.issue-workspace-editor textarea{resize:vertical}.issue-workspace-editor>small{color:#73849a;display:flex;align-items:center;gap:5px;font-size:.5rem}@media(max-width:820px){.issue-workspace{height:calc(100vh - 110px);min-height:620px}.issue-workspace>header small{display:none}.issue-splitpanes :deep(.splitpanes__pane){min-height:170px}.issue-workspace-list,.issue-workspace-source,.issue-workspace-editor{padding:10px}}
</style>
