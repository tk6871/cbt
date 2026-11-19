#!/bin/zsh
# Mac development stack. All network services stay on the loopback interface.
set -eu
umask 077
repo=${0:A:h:h}
dev=${repo:h}/cbt-supabase-dev
mkdir -p "$dev"
chmod 700 "$dev"
print -r -- '*' > "$dev/.gitignore"
export DOCKER_HOST="unix://${HOME}/.colima/cbt-dev/docker.sock"

if ! docker info >/dev/null 2>&1; then
  colima start cbt-dev --vm-type vz --runtime docker --cpus 3 --memory 5 --disk 18 --activate=false --mount "$dev:w"
fi
if ! docker network inspect cbt-dev-loopback >/dev/null 2>&1; then
  docker network create --driver bridge -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 cbt-dev-loopback >/dev/null
fi
binding=$(docker network inspect cbt-dev-loopback --format '{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}')
[[ "$binding" = 127.0.0.1 ]] || { print -u2 '개발 네트워크의 루프백 설정을 확인하세요.'; exit 1; }

if [[ ! -f "$dev/supabase/config.toml" ]]; then
  supabase init --workdir "$dev" >/dev/null
  python3 - "$dev" "$repo" <<'PY'
from pathlib import Path
import re, sys
dev, repo = map(Path, sys.argv[1:])
config = dev/'supabase/config.toml'
text = config.read_text()
for section in ['studio','local_smtp','analytics','storage.vector','db.seed','experimental.pgdelta','realtime']:
    text = re.sub(r'(?m)(^\['+re.escape(section)+r'\][^\[]*?^enabled = )true', r'\g<1>false', text)
config.write_text(text.replace('http://127.0.0.1:3000','http://127.0.0.1:4360')+'\n'+(repo/'supabase/config.toml').read_text())
PY
fi
grep -Eq '^project_id = "cbt-supabase-dev"$' "$dev/supabase/config.toml"
mkdir -p "$dev/supabase/migrations" "$dev/supabase/functions"
cp "$repo/supabase/schema.sql" "$dev/supabase/migrations/20260101000000_cbt_schema.sql"
cp "$repo/supabase/question-issue-reports.sql" "$dev/supabase/migrations/20260102000000_cbt_question_issues.sql"
cp "$repo"/supabase/migrations/*.sql "$dev/supabase/migrations/"
cp -R "$repo/supabase/functions/" "$dev/supabase/functions/"
if ! supabase start --workdir "$dev" --network-id cbt-dev-loopback > "$dev/service.log" 2>&1; then
  print -u2 "시작 상태는 개발 디렉터리의 service.log에서 확인하세요."; exit 1
fi
supabase migration up --local --workdir "$dev"
supabase status --workdir "$dev" -o json > "$dev/runtime.next" 2>"$dev/status.log"
python3 - "$dev" "$repo" <<'PY'
from pathlib import Path
import json,sys
dev, repo = map(Path,sys.argv[1:])
next_file = dev/'runtime.next'
keys = json.loads(next_file.read_text())
assert keys['API_URL']=='http://127.0.0.1:54321'
preview = dev/'preview'; preview.mkdir(exist_ok=True)
for name in ['index.html','jewelry.html','recovery.html','next.html','admin.html','calculator.html','calculator.css','calculator.js','sw.js','assets','data','modern','vendor','manifest.webmanifest','jewelry.webmanifest']:
    link = preview/name
    if not link.is_symlink(): link.symlink_to(repo/name)
cfg = dict(enabled=True,supabaseUrl=keys['API_URL'],supabaseAnonKey=keys['ANON_KEY'],serviceApiUrl='/api',reviewApiUrl='/api')
(preview/'cloud-config.js').write_text('window.CBT_CLOUD_CONFIG = '+json.dumps(cfg)+';\n')
(dev/'api.env').write_text('SUPABASE_URL='+keys['API_URL']+'\nSUPABASE_PUBLISHABLE_KEY='+keys['PUBLISHABLE_KEY']+'\nCBT_ORIGINS=http://127.0.0.1:4360\nHOST=127.0.0.1\nPORT=4361\n')
next_file.replace(dev/'runtime.json')
PY

cd "$repo"
children=()
trap 'for pid in "${children[@]}"; do kill "$pid" 2>/dev/null || true; done' EXIT
if ! curl -fsS http://127.0.0.1:4361/api/health >/dev/null 2>&1; then
  npm --prefix server run build
  node --env-file="$dev/api.env" server/dist/main.js > "$dev/api.log" 2>&1 &
  children+=($!)
fi
if ! curl -fsS http://127.0.0.1:4360/index.html >/dev/null 2>&1; then
  "$repo/node_modules/.bin/vite" preview "$repo" --config "$repo/tools/local-preview.config.mjs" --outDir "$dev/preview" > "$dev/web.log" 2>&1 &
  children+=($!)
fi
for attempt in {1..50}; do
  if curl -fsS http://127.0.0.1:4361/api/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:4360/cloud-config.js >/dev/null 2>&1; then
    print '개발 CBT http://127.0.0.1:4360/'
    if (( ${#children} )); then wait; fi
    exit 0
  fi
  sleep 0.2
done
print -u2 '개발 미리보기 시작 실패. api.log와 web.log를 확인하세요.'
exit 1
