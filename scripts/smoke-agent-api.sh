#!/usr/bin/env bash
# Smoke test for /api/v1/agent/projects.
# Usage: AGENT_API_KEY=<key> CRM_URL=<base-url> bash scripts/smoke-agent-api.sh
#
# Exits 0 if all checks pass, 1 on any failure.

set -euo pipefail

URL="${CRM_URL:-http://localhost:3000}/api/v1/agent/projects"
KEY="${AGENT_API_KEY:?AGENT_API_KEY env var required}"

echo "=== Test 1: missing Authorization header → expect 401 ==="
status=$(curl -sS -o /dev/null -w "%{http_code}" "$URL")
[ "$status" = "401" ] || { echo "FAIL: expected 401, got $status"; exit 1; }
echo "  ✓ 401 returned"

echo "=== Test 2: invalid bearer token → expect 401 ==="
status=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer wrong-key-${RANDOM}" "$URL")
[ "$status" = "401" ] || { echo "FAIL: expected 401, got $status"; exit 1; }
echo "  ✓ 401 returned"

echo "=== Test 3: valid bearer token → expect 200 + JSON body ==="
body=$(curl -sS -H "Authorization: Bearer $KEY" "$URL")
echo "$body" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert 'projects' in d, 'missing projects field'
assert 'fetchedAt' in d, 'missing fetchedAt field'
assert isinstance(d['projects'], list), 'projects not a list'
print(f'  ✓ {len(d[\"projects\"])} projects returned')
for p in d['projects']:
  for required in ('agentSlug','displayName','status','github','vercel','client'):
    assert required in p, f'project missing {required}'
  assert p['client']['name'], 'client.name empty'
  assert p['client']['phone'], 'client.phone empty'
print('  ✓ all projects have required fields')
"

echo
echo "=== ALL SMOKE TESTS PASSED ==="
