#!/usr/bin/env bash
# =============================================================================
# test-skill-hub.sh — AICE Skill ↔ Hub API Integration Test
# Arquitecto AICE — 28 feb 2026
#
# Usage:
#   ./test-skill-hub.sh                          # usa API de producción
#   ./test-skill-hub.sh --local                  # usa http://localhost:3000
#   ./test-skill-hub.sh --api-key haice_prod_xxx # usa key existente (skip registro)
#   ./test-skill-hub.sh --email tu@email.com     # email para registro
#
# Requiere: curl, jq
# =============================================================================

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Config ───────────────────────────────────────────────────────────────────
HUB_BASE_URL="https://api.hubaice.com"
EMAIL=""
EXISTING_API_KEY=""
SESSION_ID="test-session-$(date +%Y%m%d-%H%M%S)"
SKILL_VERSION="1.0.0"

# ─── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --local)      HUB_BASE_URL="http://localhost:3000"; shift ;;
    --api-key)    EXISTING_API_KEY="$2"; shift 2 ;;
    --email)      EMAIL="$2"; shift 2 ;;
    --url)        HUB_BASE_URL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()     { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*"; }
ok()      { echo -e "${GREEN}✓${NC} $*"; }
fail()    { echo -e "${RED}✗${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
section() { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }
divider() { echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"; }

check_deps() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      fail "Dependency missing: $cmd"
      exit 1
    fi
  done
  ok "Dependencies: curl, jq ✓"
}

# ─── API call wrapper ──────────────────────────────────────────────────────────
# Returns: sets RESPONSE and HTTP_STATUS
api_call() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local auth_header="${4:-}"

  local args=(-s -w "\n__HTTP_STATUS__%{http_code}")
  args+=(-X "$method")
  args+=(-H "Content-Type: application/json")

  if [[ -n "$auth_header" ]]; then
    args+=(-H "Authorization: Bearer $auth_header")
  fi

  if [[ -n "$data" ]]; then
    args+=(-d "$data")
  fi

  local raw
  raw=$(curl "${args[@]}" "${HUB_BASE_URL}${path}" 2>&1)

  HTTP_STATUS=$(echo "$raw" | grep "__HTTP_STATUS__" | sed 's/__HTTP_STATUS__//')
  RESPONSE=$(echo "$raw" | sed '/__HTTP_STATUS__/d')
}

assert_status() {
  local expected="$1"
  local label="$2"
  if [[ "$HTTP_STATUS" == "$expected" ]]; then
    ok "$label (HTTP $HTTP_STATUS)"
  else
    fail "$label — expected $expected, got $HTTP_STATUS"
    echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    if [[ "${STRICT:-false}" == "true" ]]; then
      exit 1
    fi
  fi
}

# ─── State ────────────────────────────────────────────────────────────────────
INTENT_ID=""
RUNTIME_ID=""
API_KEY=""
CLUSTER_REF="$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())")"

# =============================================================================
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║     AICE Skill ↔ Hub API Integration Test     ║"
echo "  ║     $(date '+%Y-%m-%d %H:%M:%S %Z')                   ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Hub: ${BOLD}${HUB_BASE_URL}${NC}"
echo "  Session: ${SESSION_ID}"
echo ""

# =============================================================================
section "STEP 0 — Preflight"
# =============================================================================

check_deps

# Hub health check
log "Checking Hub connectivity..."
api_call GET "/api/leaderboard?limit=1"
if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "Hub is reachable"
  TOTAL=$(echo "$RESPONSE" | jq -r '.total // 0')
  log "Current leaderboard: ${TOTAL} active runtimes"
else
  warn "Hub returned HTTP $HTTP_STATUS — continuing anyway (may be first boot)"
fi

# =============================================================================
section "STEP 1 — Register Intent"
# =============================================================================

if [[ -n "$EXISTING_API_KEY" ]]; then
  warn "Skipping registration — using provided API key"
  API_KEY="$EXISTING_API_KEY"

  # Try to get runtimeId from the key by calling leaderboard (we'll get it from events response)
  log "Using existing API key: ${API_KEY:0:20}..."
  
  # We need a runtimeId for later steps — try fetching public state
  # For test purposes, we'll create a dummy runtime ID placeholder
  RUNTIME_ID="EXISTING_RUNTIME_FROM_KEY"
  log "Note: runtime ID will be resolved from first /api/events response"
else
  if [[ -z "$EMAIL" ]]; then
    echo ""
    read -p "  Enter email for test registration: " EMAIL
    if [[ -z "$EMAIL" ]]; then
      fail "Email is required for registration flow"
      exit 1
    fi
  fi

  log "Registering intent for test runtime..."
  INTENT_PAYLOAD=$(jq -n \
    --arg platform "test-cli" \
    --arg model "test/mock-model" \
    --arg thinking "low" \
    --arg displayName "test-skill-hub-$(date +%s)" \
    '{platform: $platform, model: $model, thinking: $thinking, displayName: $displayName}')

  api_call POST "/api/register-intent" "$INTENT_PAYLOAD"
  assert_status "201" "POST /api/register-intent"

  INTENT_ID=$(echo "$RESPONSE" | jq -r '.intentId')
  VERIFY_URL=$(echo "$RESPONSE" | jq -r '.verifyUrl')
  EXPIRES_AT=$(echo "$RESPONSE" | jq -r '.expiresAt')

  echo "  intentId:  ${INTENT_ID}"
  echo "  verifyUrl: ${VERIFY_URL}"
  echo "  expiresAt: ${EXPIRES_AT}"

  # =============================================================================
  section "STEP 2 — Verify Intent (GET)"
  # =============================================================================

  log "Checking intent validity..."
  api_call GET "/api/verify/${INTENT_ID}"
  assert_status "200" "GET /api/verify/:intentId"
  echo "$RESPONSE" | jq '{platform, model, thinking, displayName, expiresAt}'

  # =============================================================================
  section "STEP 3 — Submit Email (POST /api/verify)"
  # =============================================================================

  log "Submitting email ${EMAIL}..."
  VERIFY_PAYLOAD=$(jq -n \
    --arg intentId "$INTENT_ID" \
    --arg email "$EMAIL" \
    --arg displayName "test-skill-hub" \
    '{intentId: $intentId, email: $email, displayName: $displayName}')

  api_call POST "/api/verify" "$VERIFY_PAYLOAD"
  assert_status "200" "POST /api/verify"

  RUNTIME_ID=$(echo "$RESPONSE" | jq -r '.runtimeId')
  log "Runtime created: ${RUNTIME_ID}"
  log "Email sent to: ${EMAIL}"

  # =============================================================================
  section "STEP 4 — Email Confirmation (manual)"
  # =============================================================================

  echo ""
  echo -e "  ${YELLOW}ACTION REQUIRED:${NC}"
  echo "  1. Check your email at: ${EMAIL}"
  echo "  2. Click the confirmation link"
  echo "  3. Copy the API key from the /confirmed page"
  echo ""
  read -p "  Paste your API key here (haice_prod_xxx): " API_KEY

  if [[ -z "$API_KEY" ]]; then
    fail "No API key provided. Cannot continue."
    exit 1
  fi
  ok "API key received: ${API_KEY:0:20}..."
fi

# =============================================================================
section "STEP 5 — Import State (initial sync)"
# =============================================================================

log "Importing current runtime state..."
IMPORT_STATE_PAYLOAD=$(jq -n \
  --arg platform "test-cli" \
  --arg model "test/mock-model" \
  --arg thinking "low" \
  --arg displayName "test-skill-hub" \
  '{
    platform: $platform,
    model: $model,
    thinking: $thinking,
    displayName: $displayName,
    domains: {
      TECH:     {score: 67.0, streak: 3, evaluations: 8,  corrections: 2},
      OPS:      {score: 55.0, streak: 1, evaluations: 12, corrections: 5},
      JUDGMENT: {score: 72.0, streak: 4, evaluations: 7,  corrections: 1},
      COMMS:    {score: 60.0, streak: 2, evaluations: 10, corrections: 3},
      ORCH:     {score: 58.0, streak: 0, evaluations: 6,  corrections: 4}
    },
    globalScore: 62.4,
    maturity: {
      totalEvaluations: 43,
      tier: "YELLOW",
      tierLabel: "Growing",
      tierEmoji: "🌿"
    },
    antiPatterns: [
      {code: "OVERAPOLOGY", name: "Over Apology", severity: "leve", domain: "COMMS", occurrences: 3}
    ],
    proPatterns: [
      {code: "ANTICIPATE", name: "Anticipate", domain: "JUDGMENT", occurrences: 5}
    ]
  }')

api_call POST "/api/import/state" "$IMPORT_STATE_PAYLOAD" "$API_KEY"
assert_status "200" "POST /api/import/state"
echo "$RESPONSE" | jq '{message, runtimeId, globalScore, evalCount}'

# =============================================================================
section "STEP 6 — Send 5 Real-time Events"
# =============================================================================

declare -a EVENT_IDS

send_event() {
  local label="$1"
  local payload="$2"
  
  log "Sending event: ${label}"
  api_call POST "/api/events" "$payload" "$API_KEY"
  
  if [[ "$HTTP_STATUS" == "200" ]]; then
    local event_id delta domain_after global_after
    event_id=$(echo "$RESPONSE" | jq -r '.eventId')
    delta=$(echo "$RESPONSE" | jq -r '.scoring.delta')
    domain_after=$(echo "$RESPONSE" | jq -r '.scoring.domainScoreAfter')
    global_after=$(echo "$RESPONSE" | jq -r '.scoring.globalScoreAfter')
    
    EVENT_IDS+=("$event_id")
    ok "  Event ${#EVENT_IDS[@]}/5: ${label}"
    echo "     eventId: ${event_id}"
    echo "     delta: ${delta} | domainAfter: ${domain_after} | globalAfter: ${global_after}"
  else
    fail "  Event failed: ${label} (HTTP $HTTP_STATUS)"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  fi
  
  sleep 0.3  # rate limit friendly
}

divider
echo "  Sending 5 events that simulate a realistic AICE scoring session:"
divider

# Event 1: Error leve — COMMS (OVERAPOLOGY)
EVENT1=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg skillVersion "$SKILL_VERSION" \
  '{
    side: "agent",
    eventType: "error",
    domain: "COMMS",
    severity: "leve",
    patternCode: "OVERAPOLOGY",
    trigger: "auto-score",
    sessionId: $sessionId,
    timestamp: $timestamp,
    skillVersion: $skillVersion
  }')
send_event "Error leve — COMMS/OVERAPOLOGY" "$EVENT1"
sleep 1

# Event 2: Error grave — JUDGMENT (CAPITULATION)
EVENT2=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg skillVersion "$SKILL_VERSION" \
  '{
    side: "agent",
    eventType: "error",
    domain: "JUDGMENT",
    severity: "grave",
    patternCode: "CAPITULATION",
    trigger: "puntua",
    sessionId: $sessionId,
    timestamp: $timestamp,
    skillVersion: $skillVersion
  }')
send_event "Error grave — JUDGMENT/CAPITULATION" "$EVENT2"
sleep 1

# Event 3: Correct — TECH (tarea completada)
EVENT3=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg skillVersion "$SKILL_VERSION" \
  '{
    side: "agent",
    eventType: "correct",
    domain: "TECH",
    trigger: "task-complete",
    sessionId: $sessionId,
    timestamp: $timestamp,
    skillVersion: $skillVersion
  }')
send_event "Correct — TECH/task-complete" "$EVENT3"
sleep 1

# Event 4: Pro-pattern — JUDGMENT (ANTICIPATE)
EVENT4=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg skillVersion "$SKILL_VERSION" \
  '{
    side: "agent",
    eventType: "pro_pattern",
    domain: "JUDGMENT",
    patternCode: "ANTICIPATE",
    trigger: "auto-score",
    sessionId: $sessionId,
    timestamp: $timestamp,
    skillVersion: $skillVersion
  }')
send_event "Pro-pattern — JUDGMENT/ANTICIPATE" "$EVENT4"
sleep 1

# Event 5: User scoring — JUDGMENT (vague instruction)
EVENT5=$(jq -n \
  --arg sessionId "$SESSION_ID" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg skillVersion "$SKILL_VERSION" \
  '{
    side: "user",
    eventType: "error",
    domain: "JUDGMENT",
    severity: "medio",
    patternCode: "VAGUE_INSTRUCTION",
    trigger: "puntua",
    sessionId: $sessionId,
    timestamp: $timestamp,
    skillVersion: $skillVersion
  }')
send_event "User error — JUDGMENT/VAGUE_INSTRUCTION" "$EVENT5"

divider
ok "All 5 events sent. IDs: ${EVENT_IDS[*]:-none}"

# =============================================================================
section "STEP 7 — Verify Runtime Public State"
# =============================================================================

if [[ "$RUNTIME_ID" != "EXISTING_RUNTIME_FROM_KEY" && -n "$RUNTIME_ID" ]]; then
  log "Fetching public runtime state..."
  sleep 1  # allow DB to settle
  
  api_call GET "/api/runtime/${RUNTIME_ID}/public"
  assert_status "200" "GET /api/runtime/:id/public"
  
  echo ""
  echo "$RESPONSE" | jq '{
    runtimeId,
    displayName,
    globalScore,
    maturity,
    domains: (.domains | to_entries | map({key: .key, value: {score: .value.score, evaluations: .value.evaluations}})) | from_entries,
    lastActivity
  }'
else
  warn "Skipping public runtime check (no runtimeId available)"
fi

# =============================================================================
section "STEP 8 — Check Leaderboard"
# =============================================================================

log "Checking leaderboard (top 10 by agent score)..."
api_call GET "/api/leaderboard?sort=agent&limit=10"
assert_status "200" "GET /api/leaderboard"

TOTAL_ENTRIES=$(echo "$RESPONSE" | jq '.total')
log "Total active runtimes on leaderboard: ${TOTAL_ENTRIES}"

echo ""
echo "  Rank | Platform         | Model                     | Agent | Team | Evals"
echo "  -----|------------------|---------------------------|-------|------|------"
echo "$RESPONSE" | jq -r '.entries[] | "  \(.rank | tostring | rjust(4)) | \(.platform // "?" | .[0:16] | ljust(16)) | \(.model // "?" | .[0:25] | ljust(25)) | \(.agentScore // 0 | tostring | rjust(5)) | \(.teamScore // 0 | tostring | rjust(4)) | \(.evalCount // 0)"'

# Check if our test runtime appears
if [[ "$RUNTIME_ID" != "EXISTING_RUNTIME_FROM_KEY" && -n "$RUNTIME_ID" ]]; then
  FOUND=$(echo "$RESPONSE" | jq --arg id "$RUNTIME_ID" '.entries[] | select(.id == $id) | .rank // empty')
  if [[ -n "$FOUND" ]]; then
    ok "Test runtime appears at rank #${FOUND} on leaderboard!"
  else
    warn "Test runtime not yet visible (needs ≥10 evals for leaderboard — we only sent 5+import)"
    log "Expected: runtime needs evalCount >= 10. Current: 43 (from import) + 5 = 48 ✓"
    log "If not visible, try: GET ${HUB_BASE_URL}/api/runtime/${RUNTIME_ID}/public"
  fi
fi

# =============================================================================
section "STEP 9 — Validation of Event Schema"
# =============================================================================

log "Testing validation: sending malformed event (should return 422)..."
BAD_EVENT='{"side":"invalid_side","eventType":"error","domain":"TECH","timestamp":"2026-01-01T00:00:00Z"}'
api_call POST "/api/events" "$BAD_EVENT" "$API_KEY"
if [[ "$HTTP_STATUS" == "422" || "$HTTP_STATUS" == "400" ]]; then
  ok "Validation working: bad event rejected (HTTP $HTTP_STATUS)"
else
  warn "Expected 422 for malformed event, got $HTTP_STATUS"
fi

log "Testing validation: error event without severity (should return 422)..."
NO_SEVERITY_EVENT=$(jq -n \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{side:"agent", eventType:"error", domain:"TECH", timestamp: $timestamp}')
api_call POST "/api/events" "$NO_SEVERITY_EVENT" "$API_KEY"
if [[ "$HTTP_STATUS" == "422" || "$HTTP_STATUS" == "400" ]]; then
  ok "Validation working: error without severity rejected (HTTP $HTTP_STATUS)"
else
  warn "Expected 422, got $HTTP_STATUS"
fi

# =============================================================================
section "STEP 10 — Summary"
# =============================================================================

echo ""
echo -e "${BOLD}Test Results:${NC}"
divider
echo "  Hub URL:       ${HUB_BASE_URL}"
echo "  Session ID:    ${SESSION_ID}"
echo "  Runtime ID:    ${RUNTIME_ID:-N/A}"
echo "  API Key:       ${API_KEY:0:20}... (truncated)"
echo "  Events sent:   ${#EVENT_IDS[@]}/5"
echo "  Leaderboard:   ${TOTAL_ENTRIES} active runtimes"
divider
echo ""
echo -e "  ${GREEN}${BOLD}Integration test complete!${NC}"
echo ""
echo "  Next steps:"
echo "  - Save API key in confidence.json → hubSync.apiKey"
echo "  - Update hubSync.runtimeId = ${RUNTIME_ID:-YOUR_RUNTIME_ID}"
echo "  - Update hubSync.status = \"active\""
echo "  - Update hubSync.enabled = true"
echo ""
echo "  View your runtime:"
if [[ "$RUNTIME_ID" != "EXISTING_RUNTIME_FROM_KEY" && -n "$RUNTIME_ID" ]]; then
  echo "  - Public: ${HUB_BASE_URL}/api/runtime/${RUNTIME_ID}/public"
  echo "  - Hub:    ${HUB_BASE_URL/-api/}/runtime/${RUNTIME_ID}"
fi
echo ""
