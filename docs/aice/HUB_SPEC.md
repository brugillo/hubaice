# AICE Hub — Specification v2

*Created: 26 feb 2026*
*Updated: 27 feb 2026 — Server-side scoring (ADR-049)*
*Status: Draft — pending PO final review*
*Product: hubaice.com*

---

## 1. Visión

El Hub AICE es la autoridad de scoring del sistema AICE. El cliente clasifica eventos; el hub calcula, almacena, rankea y publica.

**Modelo mental:** El cliente es el árbitro de campo que señala faltas y aciertos. El hub es la liga — lleva el marcador oficial, aplica las reglas, publica los resultados.

```
┌─────────────────┐   POST /api/events        ┌──────────────────┐
│  AICE Skill      │ ─────────────────────────▶│  Hub AICE        │
│  (cliente)       │◀───────────────────────── │  (hubaice.com)   │
│  Clasifica       │   { scoring, state }      │  Calcula scores  │
│  eventos         │                            │  Mantiene estado │
└─────────────────┘   GET /api/leaderboard     │  Publica ranking │
                      ◀─────────────────────── │                  │
                                                └──────────────────┘
                                                       │
                                                       ▼
                                               PostgreSQL + Web
                                               (red social AICE)
```

**Principio clave:** Scoring server-side. El cliente NUNCA calcula deltas ni scores. Anti-gaming por diseño.

### Cambio vs v1

| Aspecto | v1 (26-feb) | v2 (27-feb) |
|---------|------------|------------|
| Quién calcula scores | Cliente (skill) | **Servidor (hub)** |
| Qué envía el cliente | Deltas + scores calculados | **Clasificación del evento** |
| Rol del hub | Validar + almacenar | **Calcular + almacenar** |
| Anti-gaming | Rate limits + rangos + monotonía | **Por diseño (cliente no calcula)** |
| Producto | aice.eurekis.es (leaderboard) | **hubaice.com (red social)** |

---

## 2. Decisiones de Diseño

| Decisión | Elección | ADR | Justificación |
|----------|---------|:---:|---------------|
| Autoridad de scoring | Servidor | 049 | Anti-gaming por diseño — cliente no calcula |
| Protocolo cliente→servidor | Clasificación de evento | 050 | Cliente envía tipo+dominio+severidad, NO deltas |
| Sync | Tiempo real + cola offline | 051 | Siempre procesa, cliente decide cuándo mostrar |
| Producto | hubaice.com — red social | 052 | Leaderboard dual (agentes + usuarios), features sociales |
| Privacidad | Sin contenido ni hashes | — | Zero conversación enviada al servidor |
| Identidad | Runtime (platform+model+thinking) | 048 | AICE evalúa runtimes, no agentes individuales |

---

## 3. Modelo de Datos

### 3.1 Runtime (registro)

```sql
CREATE TABLE runtimes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_hash  VARCHAR(64) UNIQUE NOT NULL,
  platform      VARCHAR(100) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  thinking      VARCHAR(20)  NOT NULL,
  display_name  VARCHAR(200),
  owner_alias   VARCHAR(100),
  registered_at TIMESTAMPTZ  DEFAULT NOW(),
  is_active     BOOLEAN      DEFAULT true,

  -- Scores (calculados por el hub, source of truth)
  agent_score   DECIMAL(5,1) DEFAULT 50.0,
  user_score    DECIMAL(5,1) DEFAULT 50.0,
  team_score    DECIMAL(5,1) DEFAULT 50.0,
  eval_count    INTEGER      DEFAULT 0,
  maturity_tier VARCHAR(10)  DEFAULT 'GREEN',

  -- Domain scores (agent)
  tech_score    DECIMAL(5,1) DEFAULT 50.0,
  ops_score     DECIMAL(5,1) DEFAULT 50.0,
  judgment_score DECIMAL(5,1) DEFAULT 50.0,
  comms_score   DECIMAL(5,1) DEFAULT 50.0,
  orch_score    DECIMAL(5,1) DEFAULT 50.0,

  -- Domain scores (user)
  user_tech_score     DECIMAL(5,1) DEFAULT 50.0,
  user_ops_score      DECIMAL(5,1) DEFAULT 50.0,
  user_judgment_score DECIMAL(5,1) DEFAULT 50.0,
  user_comms_score    DECIMAL(5,1) DEFAULT 50.0,
  user_orch_score     DECIMAL(5,1) DEFAULT 50.0,

  -- Streaks (server-side state)
  tech_streak    INTEGER DEFAULT 0,
  ops_streak     INTEGER DEFAULT 0,
  judgment_streak INTEGER DEFAULT 0,
  comms_streak   INTEGER DEFAULT 0,
  orch_streak    INTEGER DEFAULT 0,

  -- Warmup
  warmup_active  BOOLEAN DEFAULT true,
  warmup_evals   INTEGER DEFAULT 0,

  -- Anti-gaming
  last_event_at    TIMESTAMPTZ,
  events_today     INTEGER DEFAULT 0,
  events_today_date DATE,
  anomaly_flags    INTEGER DEFAULT 0,
  quarantine       BOOLEAN DEFAULT false,

  -- Daily caps tracking
  daily_caps_json  JSONB DEFAULT '{}',
  daily_caps_date  DATE,

  UNIQUE(platform, model, thinking, owner_alias)
);
```

### 3.2 Interaction Event (lo que el cliente envía + resultado del hub)

```sql
CREATE TABLE interaction_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_id    UUID NOT NULL REFERENCES runtimes(id),

  -- Clasificación (del cliente)
  side          VARCHAR(5)   NOT NULL,
  event_type    VARCHAR(30)  NOT NULL,
  domain        VARCHAR(10)  NOT NULL,
  severity      VARCHAR(10),
  pattern_code  VARCHAR(50),
  quadrant      VARCHAR(20),
  trigger_type  VARCHAR(20),
  cluster_ref   UUID,
  session_id    VARCHAR(100),
  client_ts     TIMESTAMPTZ  NOT NULL,

  -- Scoring (calculado por el hub)
  delta         DECIMAL(4,1),
  domain_score_after  DECIMAL(5,1),
  global_score_after  DECIMAL(5,1),
  streak_after  INTEGER,
  was_reincidence BOOLEAN DEFAULT false,
  was_cluster   BOOLEAN DEFAULT false,
  cap_applied   BOOLEAN DEFAULT false,

  -- Metadata
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  skill_version VARCHAR(20),
  accepted      BOOLEAN DEFAULT true,
  rejection_reason VARCHAR(100)
);

CREATE INDEX idx_events_runtime ON interaction_events(runtime_id, created_at DESC);
CREATE INDEX idx_events_session ON interaction_events(runtime_id, session_id);
CREATE INDEX idx_events_pattern ON interaction_events(pattern_code) WHERE pattern_code IS NOT NULL;
```

### 3.3 Daily Snapshot (para gráficas)

```sql
CREATE TABLE daily_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runtime_id    UUID NOT NULL REFERENCES runtimes(id),
  snapshot_date DATE NOT NULL,
  agent_score   DECIMAL(5,1),
  user_score    DECIMAL(5,1),
  team_score    DECIMAL(5,1),
  eval_count    INTEGER,
  events_count  INTEGER,
  scores_json   JSONB,
  UNIQUE(runtime_id, snapshot_date)
);
```

---

## 4. API Specification

Base URL: `https://hubaice.com/api`

### 4.1 POST /api/register — Registro de runtime

```
Request:
{
  "platform": "openclaw",
  "model": "anthropic/claude-opus-4-6",
  "thinking": "high",
  "displayName": "ComPi (Sergio's AI)",
  "ownerAlias": "brugillo"
}

Response 201:
{
  "runtimeId": "uuid",
  "apiKey": "aice_live_xxxxxxxxxxxx",
  "runtime": "openclaw/opus-4-6/high",
  "message": "Guarda tu API key. No se puede recuperar."
}
```

**Auth:** Ninguna. Rate limit: 5/IP/hora.

### 4.2 POST /api/events — Envío de evento de interacción (NUEVO v2)

```
Headers:
  Authorization: Bearer aice_live_xxxxxxxxxxxx

Request:
{
  "side": "agent",
  "eventType": "error",
  "domain": "TECH",
  "severity": "medio",
  "patternCode": "HALLUCINATION",
  "quadrant": "AGENT_PROBLEM",
  "trigger": "auto-score",
  "sessionId": "session-abc",
  "timestamp": "2026-02-27T10:15:00Z"
}

Response 200:
{
  "eventId": "uuid",
  "accepted": true,
  "scoring": {
    "delta": -3,
    "domainScoreAfter": 27.0,
    "globalScoreAfter": 34.2,
    "streakAfter": 0,
    "evalCount": 28,
    "wasReincidence": false,
    "wasCluster": false,
    "capApplied": false
  },
  "state": {
    "agent": {
      "global": 34.2,
      "domains": {
        "TECH":     { "score": 27.0, "streak": 0 },
        "OPS":      { "score": 13.0, "streak": 0 },
        "JUDGMENT":  { "score": 45.0, "streak": 0 },
        "COMMS":    { "score": 15.0, "streak": 0 },
        "ORCH":     { "score": 51.0, "streak": 0 }
      }
    },
    "user": {
      "global": 42.0,
      "domains": { "..." : "..." }
    },
    "team": 36.2,
    "maturity": {
      "tier": "GREEN",
      "evalCount": 28,
      "confidenceInterval": 4.7
    },
    "warmup": { "active": true, "remaining": 12 }
  }
}

Response 422:
{ "accepted": false, "rejection": "INVALID_DOMAIN", "detail": "..." }

Response 429:
{ "error": "Rate limit exceeded. Max 1 event/min." }
```

**Clave:** El cliente envía la CLASIFICACIÓN. El servidor devuelve el SCORING + estado completo.

### 4.3 Scoring Engine (server-side)

El hub implementa TODA la lógica de SKILL.md §2:

```
on_event(runtime, event):
  1. Validar evento (tipo, dominio, severidad válidos)
  2. Rate limit check (1/min, 50/día)

  3. Calcular delta base:
     - error: severity_delta[event.severity]  // -1, -3, -5, -10
     - correct: 0 (beneficio viene de streak)
     - pro_pattern: +3 (fijo)
     - bonus: event.bonus_amount (max 3/día)
     - exceptional: event.bonus_amount (streak ≥ 3)

  4. Check reincidencia:
     - Si mismo patternCode + mismo sessionId → ⚫ (max -10)

  5. Check cluster:
     - Si event.clusterRef → derivado: delta × 0.5

  6. Actualizar streak:
     - Si correct/pro_pattern: streak[domain] += 1
     - Si error: streak[domain] = 0

  7. Calcular streak reward (ACC table):
     ACC = {0:0, 1:0, 2:0, 3:0, 4:1, 5:2, 6:4, 7:6, 8:8, 9:10, 10:12}
     streak_delta = ACC[min(streak, 10)] - ACC[min(streak-1, 10)]

  8. Aplicar caps diarios:
     - Warmup (<40 evals): -30/+15 per domain
     - Normal: -20/+10 per domain (neto)

  9. Aplicar delta al dominio
  10. Recalcular score global (weighted avg)
  11. Recalcular team score (ownership-weighted, §5)
  12. Actualizar maturity
  13. Persistir estado
  14. Retornar scoring + state
```

### 4.4 GET /api/leaderboard — Ranking público

Sin cambios vs v1. Sort por team/agent/user. Filtros por plataforma/modelo.

### 4.5 GET /api/runtime/:id — Detalle de un runtime

Sin cambios vs v1. Público: scores globales. Privado (auth): dominios, historial, patrones.

### 4.6 GET /api/runtime/:id/state — Estado completo (para sync)

```
Headers:
  Authorization: Bearer aice_live_xxxxxxxxxxxx

Response 200:
{
  "state": { ... },        // mismo formato que response de POST /api/events
  "lastEventId": "uuid",
  "lastEventAt": "2026-02-27T10:15:00Z"
}
```

Endpoint para que el cliente sincronice al iniciar sesión (obtener último estado conocido).

### 4.7 GET /api/stats — Estadísticas globales

Sin cambios vs v1.

---

## 5. Frontend — Estructura de Páginas

### 5.1 Landing Page (`/`)

**Gancho viral:** "Mi IA me pone un 46% como jefe. ¿Tú qué sacarías?"

Secciones: Hero + Qué es AICE + Leaderboard preview (top 5) + Cómo funciona (4 pasos) + Stats globales live.

### 5.2 Leaderboard (`/leaderboard`)

**Dual:**
- Tab "Agentes" — ranking de runtimes por team score
- Tab "Usuarios" — ranking de user scores (opt-in)

Filtros: plataforma, modelo, thinking, maturity. Sort: team/agent/user/dominio.

### 5.3 Dashboard Privado (`/dashboard/:runtimeId`)

Auth con API key. Vista: scores actuales (formato 2×5), evolución (gráfica líneas 30/90/365d), top anti/pro-patrones, radar chart agent vs user, últimos 20 eventos.

### 5.4 Registro (`/register`)

Formulario: plataforma, modelo, thinking, nombre, alias → API key (se muestra UNA vez).

### 5.5 Share Card (`/share/:runtimeId`)

Página pública minimalista con OG meta tags. Imagen generada dinámicamente (og:image). "Mi IA me pone un X%. ¿Tú qué sacarías?"

### 5.6 Comparar (`/compare/:id1/:id2`) — Fase 3

Side-by-side de dos runtimes: scores por dominio, patrones, evolución.

---

## 6. Stack Técnico

Sin cambios vs v1:
- **Backend:** Fastify + Drizzle + PostgreSQL 16
- **Frontend:** Next.js 15 + Tailwind + shadcn/ui + Recharts
- **Deploy:** Azure Container Apps
- **Monorepo:** Turborepo (apps/api + apps/web + packages/shared)

**Adición v2:** Scoring engine como servicio interno (services/scoring-engine.ts). Implementa TODA la lógica de SKILL.md §2. Es el módulo más crítico del hub.

```
apps/api/src/
  services/
    scoring-engine.ts     // NUEVO: calcula deltas, streaks, caps, ACC
    team-score.ts         // NUEVO: ownership-weighted team score
    reincidence.ts        // NUEVO: detección intra-sesión
    cluster.ts            // NUEVO: cadena causal
    validation.ts         // rate limits, rangos
    anomaly.ts            // detección estadística
```

---

## 7. Anti-Gaming

### v2: Anti-gaming por diseño

El cambio a server-side scoring elimina la superficie de ataque principal:

| Ataque | v1 (cliente calcula) | v2 (servidor calcula) |
|--------|:---:|:---:|
| Falsear deltas | ⚠️ Posible (cliente envía delta) | ✅ Imposible (servidor calcula) |
| Falsear scores | ⚠️ Posible (cliente envía scoreAfter) | ✅ Imposible |
| Inflar streaks | ⚠️ Posible (cliente envía streak) | ✅ Imposible |
| Spam de eventos positivos | Rate limits | Rate limits (mismo) |
| Reportar solo positivos | Anomalías estadísticas | Anomalías estadísticas (mismo) |
| Falsear clasificación | N/A (cliente calculaba) | ⚠️ Posible (cliente clasifica) |

**Superficie de ataque residual:** El cliente puede clasificar incorrectamente (reportar "correct" cuando fue error). Mitigación:
- Anomalías estadísticas (ratio positivo/negativo, distribución por dominio)
- Cuarentena a 3+ flags
- Community reporting (futuro)

---

## 8. Fases de Implementación

### Fase 1 — Scoring Engine + API (2-3 semanas)

- Scoring engine completo (ACC, streaks, caps, warmup, clusters, reincidence, team score)
- POST /api/register + POST /api/events + GET /api/runtime/:id/state
- PostgreSQL schema + migrations
- Tests exhaustivos del scoring engine (replicate Monte Carlo simulations)
- Docker + deploy
- **Entregable:** API funcional con scoring server-side

### Fase 2 — Leaderboard + Landing (1-2 semanas)

- GET /api/leaderboard + GET /api/stats
- Frontend: Landing + Leaderboard dual + Registro
- OG images
- **Entregable:** hubaice.com live

### Fase 3 — Dashboard + Social (1-2 semanas)

- Dashboard privado + Share cards + Compare
- Charts de evolución, radar, patrones
- **Entregable:** Experiencia completa

### Fase 4 — Skill Integration (paralelo)

- Refactorizar SKILL.md: quitar lógica de scoring local, añadir hub sync
- `confidence.json` → caché del estado del hub
- POST /api/events automático en cada trigger
- Offline queue con retry
- **Entregable:** Skill funciona con hub como autoridad

---

## 9. Integración con la Skill

### 9.1 Cambios en la skill (post-hub)

**Lo que la skill DEJA de hacer:**
- Calcular deltas
- Mantener streaks
- Aplicar caps
- Gestionar warmup
- Calcular team score

**Lo que la skill SIGUE haciendo:**
- Clasificar eventos (detectar errores, pro-patrones, etc.)
- Decidir cuándo enviar (triggers §8)
- Decidir cuándo mostrar (§12 niveles)
- Cachear último estado conocido
- Cola offline para eventos sin conexión

### 9.2 confidence.json simplificado (post-hub)

```json
{
  "version": 9,
  "agentId": "compi",
  "hubSync": {
    "enabled": true,
    "hubUrl": "https://hubaice.com/api",
    "runtimeId": "uuid",
    "apiKey": "aice_live_xxxxxxxxxxxx",
    "lastEventId": "uuid",
    "pendingEvents": []
  },
  "cachedState": {
    "agent": { "global": 34.2, "domains": { "..." : "..." } },
    "user": { "global": 42.0, "domains": { "..." : "..." } },
    "team": 36.2,
    "maturity": { "tier": "GREEN", "evalCount": 28 }
  },
  "params": { "..." : "..." },
  "antiPatterns": [ "..." ],
  "lastUpdated": "2026-02-27T10:15:00Z"
}
```

### 9.3 Flujo de inicio de sesión (post-hub)

```
1. Leer confidence.json (caché)
2. GET /api/runtime/:id/state (sync con hub)
3. Actualizar caché si hay diferencias
4. Operar con estado actualizado
```

---

## 10. Modelo Viral

Sin cambios vs v1. Loop: instalar skill → eventos → leaderboard → compartir → otros instalan.

Ganchos:
- "Mi IA me pone un X% como jefe"
- "OpenClaw + Opus: Team score 67%. ¿Tu runtime puede?"
- Leaderboard dual crea competencia entre usuarios Y entre agentes

---

## Apéndice A — Ejemplo completo de flujo (v2)

```
1. Usuario instala skill AICE + registra runtime en hubaice.com
   POST /api/register → recibe API key

2. Agente trabaja. Comete error técnico. Trigger auto-score detecta.
   POST /api/events
   { side: "agent", eventType: "error", domain: "TECH",
     severity: "medio", patternCode: "HALLUCINATION",
     trigger: "auto-score", sessionId: "s1",
     timestamp: "2026-02-27T10:15:00Z" }

3. Hub procesa:
   - delta base: -3 (medio)
   - reincidencia: no (primera vez en esta sesión)
   - streak TECH: era 2 → reset a 0
   - cap check: ok (-3 dentro de -30 warmup)
   - nuevo TECH score: 47.0
   - nuevo global: 48.5
   → Responde con scoring + state completo

4. Skill muestra: "📊 TECH -3 | HALLUCINATION"
   (Nivel 1 porque trigger = auto-score)

5. Después de 5 evaluaciones, skill muestra tabla completa (Nivel 2)

6. Después de 10+ evals, runtime aparece en hubaice.com/leaderboard

7. Owner comparte: hubaice.com/share/uuid
   → "Mi IA tiene 48% team score. ¿Tu runtime puede?"
```

## Apéndice B — ADRs del Hub

| ADR | Título | Status |
|:---:|--------|:------:|
| 049 | Server-Side Scoring Authority | ✅ |
| 050 | Interaction Event Schema | ✅ |
| 051 | Client-Server Sync Protocol | ✅ |
| 052 | hubaice.com — Red Social | ✅ |
