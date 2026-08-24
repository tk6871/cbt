-- Supabase가 새 public 테이블에 RLS를 자동 적용할 때 사용하는 이벤트 트리거 함수입니다.
-- 이벤트 트리거 자체는 계속 작동하지만 REST RPC로 직접 부를 수 없게 실행 권한을 막습니다.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
