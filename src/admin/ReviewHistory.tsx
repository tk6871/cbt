import type {ReviewAccess} from './adminModels';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Revision = {
  question_id: string;
  version: number;
  status: 'draft' | 'approved';
  explanation: string;
  created_at: string;
};
type Edit = { expectedVersion: number; status: Revision['status']; explanation: string };

async function revisions(access: ReviewAccess, id: string, signal?: AbortSignal, edit?: Edit): Promise<Revision[]> {
  const jwt = await access.token();
  if (!jwt) throw Error('관리자 로그인을 확인하세요.');
  const response = await fetch(access.url.replace(/\/$/, '') + '/reviews/' + encodeURIComponent(id), {
    method: edit ? 'POST' : 'GET',
    signal,
    redirect: 'error',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: edit && JSON.stringify(edit),
  });
  if (!response.ok) {
    throw Error(response.status === 409 ? '다른 수정본이 저장됐습니다. 수정안을 복사한 뒤 다시 조회하세요.' : '조회 권한과 서버 연결을 확인하세요.');
  }
  return response.json();
}

function Editor(access: ReviewAccess) {
  const [id, setId] = useState('');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const key = id.trim();
  const client = useQueryClient();
  const historyKey = ['review-history', access.url, key];
  const history = useQuery({
    queryKey: historyKey,
    queryFn: ({ signal }) => revisions(access, key, signal),
    enabled: false,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (edit: Edit) => revisions(access, key, undefined, edit),
    onSuccess: rows => {
      client.setQueryData<Revision[]>(historyKey, previous => [...rows, ...(previous ?? [])]);
      setMessage('검수 이력을 저장했습니다.');
    },
    onError: error => setMessage(error.message),
  });
  const busy = history.isFetching || save.isPending;
  async function load() {
    setMessage('');
    const result = await history.refetch();
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setLoaded(true);
    setDraft(result.data?.[0]?.explanation ?? '');
    setMessage(result.data?.length ? '기존 수정안을 불러왔습니다.' : '첫 수정안을 작성할 수 있습니다.');
  }
  function submit(status: Revision['status']) {
    setMessage('');
    save.mutate({ expectedVersion: history.data?.[0]?.version ?? 0, status, explanation: draft });
  }
  return <details className="review-history"><summary>문항별 해설 검수 이력</summary>
    <label>문항 ID<input value={id} disabled={busy} placeholder="hvac-20160306:52" onChange={event => {
      setId(event.target.value); setDraft(''); setLoaded(false); setMessage('');
    }}/></label>
    <button type="button" disabled={busy || !/^[a-zA-Z0-9:_-]{1,180}$/.test(key)} onClick={load}>이력 조회</button>
    {loaded && <>
      <label>해설 수정안<textarea value={draft} maxLength={20000} disabled={busy} onChange={event => setDraft(event.target.value)}/></label>
      <button type="button" disabled={busy || !draft.trim()} onClick={() => submit('draft')}>초안 저장</button>
      <button type="button" disabled={busy || !draft.trim()} onClick={() => submit('approved')}>검토 승인</button>
      {history.data?.map(row => <details key={row.version}><summary>{row.version}차 · {row.status === 'approved' ? '승인' : '초안'} · {new Date(row.created_at).toLocaleString('ko-KR')}</summary><p>{row.explanation}</p></details>)}
    </>}
    <p role="status">{message}</p>
  </details>;
}

export function ReviewHistory(access: ReviewAccess) {
  const [client] = useState(() => new QueryClient());
  useEffect(() => () => client.clear(), [client]);
  return <QueryClientProvider client={client}><Editor {...access}/></QueryClientProvider>;
}
