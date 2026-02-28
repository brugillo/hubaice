# SKILL ↔ Hub API Integration Design
*Arquitecto AICE — 28 feb 2026*
*Status: LISTO PARA IMPLEMENTACIÓN*

---

## 1. Decisiones de Arquitectura

### 1.1 ¿Dónde vive la API key?

```json
// confidence.json — campo hubSync (nuevo, en raíz)
{
  "hubSync": {
    "enabled": false,
    "runtimeId": null,
    "apiKey": null,
    "registeredAt": null,
    "lastSyncAt": null,
    "lastEventSentAt": null,
    "pendingEvents": [],
    "syncErrors": 0,
    "status": "unregistered"
  }
}
```

**Status values:** `unregistered` | `pending_email` | `active` | `error` | `suspended`

**Seguridad:**
- La API key se guarda en plaintext en `confidence.json` (archivo local del agente, no compartido)
- El skill NUNCA loguea la API key en `confidence-log.jsonl` ni en ningún output al usuario
- Si `confidence.json` se exfiltra, la API key permite solo escribir eventos de ese runtime específico
- El Hub puede revocar la key en cualquier momento (status → `suspended`)

### 1.2 ¿Cómo se registra?

**Flujo:** Manual mediante nuevo trigger `hub-register`. NO automático al instalar.

**Razón:** El usuario debe dar consentimiento explícito antes de enviar datos a un servicio externo.
La instalación del skill (ADR-035/041) ya es compleja de por sí; mezclar registro remoto aumenta fricción y riesgo.

**Trigger de registro:**
```
Usuario: "registra en el hub" | "hub-register" | "/aice hub register"
```

### 1.3 ¿Cómo se envían eventos?

**Fire-and-forget post-eval, async, no bloqueante.**

- Cada evento de scoring → intento de POST /api/events en background
- El agente responde al usuario sin esperar la confirmación del Hub
- Si falla → se guarda en `hubSync.pendingEvents` (max 100 eventos)
- Al inicio de sesión → retry de pending events (silent)
- Display: solo se informa al usuario si hay >10 pending o sync error persistente

### 1.4 Graceful degradation si el Hub está caído

```
Hub caído → guardar en pendingEvents[] → continuar operación local normal
Hub vuelve → retry batch al inicio de siguiente sesión → vaciar cola
Hub caído >7 días → notificar al usuario una vez → seguir guardando
syncErrors >50 → marcar status: "error" → notificar → no seguir acumulando
```

El skill SIEMPRE es funcional sin Hub. El Hub es un espejo, no una dependencia.

### 1.5 Sincronización del estado inicial

**Secuencia al completar registro:**

1. `POST /api/import/state` → estado actual completo de `confidence.json`
2. `POST /api/import/event` ×N → últimas 50 evaluaciones de `confidence-log.jsonl`
3. `POST /api/events` → desde aquí, eventos en tiempo real

**Por qué no al revés:** Si enviamos solo el estado y luego eventos, el Hub tiene
contexto de dónde estamos sin necesidad de reproducir toda la historia.
Los eventos históricos son opcionales pero enriquecen los gráficos 30d.

---

## 2. Flujo Completo Paso a Paso

### FASE A: Registro

```
[Usuario] "registra en el hub" (o /aice hub register)
    │
    ▼
[Skill] Verifica: hubSync.status == "unregistered"?
    │   Si no → informar estado actual
    │
    ▼
[Skill] Pide email al usuario:
    "¿Con qué email quieres registrar este runtime en AICE Hub?
     (runtime: {platform}/{model}/{thinking})"
    │
    ▼
[Skill] POST /api/register-intent
    Body: {
      platform: confidence.runtime.platform,   // "openclaw"
      model: confidence.runtime.model,          // "anthropic/claude-opus-4-6"
      thinking: confidence.runtime.thinking,    // "high"
      displayName: "{agentId} on {platform}"   // "compi on openclaw"
    }
    Response: { intentId, verifyUrl, expiresAt }
    │
    ▼
[Skill] Guarda intentId en hubSync.pendingIntentId
[Skill] Muestra al usuario:
    "🌐 Para completar el registro:
     1. Abre: {verifyUrl}
     2. Introduce tu email: {email ya pedido anteriormente o pedir aquí}
     3. Confirma el email que recibirás
     Tienes 15 minutos. (o yo lo hago si me das el email ahora)"
    │
    ▼ (opción B — el skill hace el POST /api/verify automáticamente si tiene el email)

[Skill] POST /api/verify
    Body: {
      intentId: hubSync.pendingIntentId,
      email: {email del usuario},
      displayName: "{agentId} on {platform}"
    }
    Response: { message: "Verification email sent", runtimeId }
    │
    ▼
[Skill] Guarda runtimeId en hubSync.runtimeId
         hubSync.status = "pending_email"
[Skill] "📧 Email enviado a {email}. Haz clic en el enlace para activar."
    │
    ▼ (usuario hace clic en email → Hub activa runtime → redirige a /confirmed?apiKey=...)
    │
    ▼
[Usuario] Pega la API key (mostrada una vez en /confirmed) o la da al agente

[Skill] Recibe API key → 
    hubSync.apiKey = apiKey (NUNCA mostrar en logs)
    hubSync.status = "active"
    hubSync.registeredAt = now()
    Guardar en confidence.json
    │
    ▼
[Skill] Sincronización inicial:
    1. POST /api/import/state con confidence.json completo
    2. POST /api/import/event ×50 (últimas 50 de confidence-log.jsonl)
    3. "✅ Runtime registrado y sincronizado. Desde ahora, los eventos
       se envían al Hub automáticamente."
```

### FASE B: Envío de Eventos (Runtime Normal)

```
[Trigger] scoring event (auto-score, task-complete, puntúa, etc.)
    │
    ▼
[Skill] Calcula delta, actualiza confidence.json
[Skill] Genera evento Hub (ver §4 — Formato de Eventos)
    │
    ▼
[Condición] hubSync.status == "active" && hubSync.apiKey != null?
    │
    ├── SÍ → POST /api/events (async, fire-and-forget)
    │           Authorization: Bearer {apiKey}
    │           Body: evento Hub
    │           ─ OK 200 → actualizar hubSync.lastEventSentAt
    │           ─ Error → push a hubSync.pendingEvents
    │
    └── NO → skip (sin Hub o status != active)
```

### FASE C: Retry al Inicio de Sesión

```
[Inicio sesión] Leer confidence.json
    │
    ▼
[Condición] hubSync.status == "active" && hubSync.pendingEvents.length > 0?
    │
    ▼
[Skill] Por cada evento en pendingEvents (max 20 por sesión para no bloquear):
    POST /api/events
    ─ OK → remover de pendingEvents
    ─ Error → mantener en pendingEvents, incrementar syncErrors
    │
    ▼
[Si syncErrors > 50] → hubSync.status = "error"
    Notificar al usuario una vez en esa sesión
```

### FASE D: Sincronización de Estado (Periódica)

```
Cada 7 días (al sellar el día si lastSyncAt > 7 días):
POST /api/import/state con el estado actual completo
→ El Hub reconcilia si hay drift
→ Actualizar hubSync.lastSyncAt
```

---

## 3. Cambios en confidence.json Schema

### Nuevo campo `hubSync` (en raíz, después de `updatedAt`):

```json
{
  "hubSync": {
    "enabled": true,
    "status": "active",
    "runtimeId": "uuid-del-runtime-en-hub",
    "apiKey": "haice_prod_xxxx",
    "registeredAt": "2026-02-28T18:00:00.000Z",
    "lastSyncAt": "2026-02-28T18:00:00.000Z",
    "lastEventSentAt": "2026-02-28T18:45:00.000Z",
    "pendingIntentId": null,
    "pendingEvents": [],
    "syncErrors": 0,
    "hubBaseUrl": "https://api.hubaice.com",
    "skillVersion": "1.0.0"
  }
}
```

**Campos:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | bool | Si el Hub sync está activo |
| `status` | enum | `unregistered\|pending_email\|active\|error\|suspended` |
| `runtimeId` | string\|null | UUID del runtime en el Hub |
| `apiKey` | string\|null | Bearer token para API. NUNCA loguear |
| `registeredAt` | ISO date\|null | Cuándo se completó el registro |
| `lastSyncAt` | ISO date\|null | Último state sync completo |
| `lastEventSentAt` | ISO date\|null | Último evento enviado con éxito |
| `pendingIntentId` | string\|null | Intent en curso (durante registro) |
| `pendingEvents` | Event[]\|[] | Cola de eventos pendientes de envío |
| `syncErrors` | int | Contador de errores consecutivos |
| `hubBaseUrl` | string | URL base de la API |
| `skillVersion` | string | Versión del skill que generó el evento |

**pendingEvents item:**
```json
{
  "id": "local-uuid",
  "payload": { /* evento completo, ver §4 */ },
  "failedAt": "ISO-date",
  "attempts": 2
}
```

---

## 4. Formato Exacto de Eventos

Los eventos se envían a `POST /api/events` con:
```
Authorization: Bearer {hubSync.apiKey}
Content-Type: application/json
```

### Schema del evento (según `eventSchema` en events.ts):

```typescript
{
  side: "agent" | "user",
  eventType: "error" | "correct" | "pro_pattern" | "bonus" | "exceptional",
  domain: "TECH" | "OPS" | "JUDGMENT" | "COMMS" | "ORCH",
  severity?: "leve" | "medio" | "grave" | "critico",  // Solo en error
  patternCode?: string,       // max 50 chars. Ej: "SECRETARY", "CLEAN_FIX"
  quadrant?: string,          // max 20. Ej: "PROBLEM", "GOOD"
  trigger?: string,           // max 20. Ej: "auto-score", "puntua", "task-complete"
  sessionId?: string,         // ID de sesión actual (para reincidencia detection)
  clusterRef?: string,        // UUID si es parte de un cluster causal
  timestamp: string,          // ISO 8601 datetime
  skillVersion?: string       // max 20. Ej: "1.0.0"
  bonusAmount?: number        // 1-10, solo en eventType "bonus"
}
```

### Ejemplos por tipo:

**Error leve (OPS):**
```json
{
  "side": "agent",
  "eventType": "error",
  "domain": "OPS",
  "severity": "leve",
  "patternCode": "OVERAPOLOGY",
  "trigger": "auto-score",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T18:45:00.000Z",
  "skillVersion": "1.0.0"
}
```

**Error grave con reincidencia (JUDGMENT):**
```json
{
  "side": "agent",
  "eventType": "error",
  "domain": "JUDGMENT",
  "severity": "grave",
  "patternCode": "CAPITULATION",
  "trigger": "puntua",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T19:00:00.000Z",
  "skillVersion": "1.0.0"
}
```

**Acierto correcto (TECH):**
```json
{
  "side": "agent",
  "eventType": "correct",
  "domain": "TECH",
  "trigger": "task-complete",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T19:15:00.000Z",
  "skillVersion": "1.0.0"
}
```

**Pro-patrón:**
```json
{
  "side": "agent",
  "eventType": "pro_pattern",
  "domain": "JUDGMENT",
  "patternCode": "ANTICIPATE",
  "trigger": "auto-score",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T19:20:00.000Z",
  "skillVersion": "1.0.0"
}
```

**Bonus:**
```json
{
  "side": "agent",
  "eventType": "bonus",
  "domain": "TECH",
  "patternCode": "DEEP_RESEARCH",
  "bonusAmount": 5,
  "trigger": "puntua",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T19:25:00.000Z",
  "skillVersion": "1.0.0"
}
```

**Scoring de usuario (user side):**
```json
{
  "side": "user",
  "eventType": "error",
  "domain": "JUDGMENT",
  "severity": "medio",
  "patternCode": "VAGUE_INSTRUCTION",
  "trigger": "puntua",
  "sessionId": "session-20260228-001",
  "timestamp": "2026-02-28T19:30:00.000Z",
  "skillVersion": "1.0.0"
}
```

### Mapping desde confidence-log.jsonl al formato Hub:

```javascript
// Mapeo de campos locales → Hub
const mapLocalToHub = (localEvent) => ({
  side: localEvent.evaluator === "user" ? "user" : "agent",
  eventType: mapResult(localEvent.result),  // ver abajo
  domain: localEvent.domain,
  severity: mapSeverity(localEvent.result),
  patternCode: localEvent.category || null,
  trigger: localEvent.trigger || "auto-score",
  sessionId: localEvent.sessionId || null,
  timestamp: localEvent.timestamp,
  skillVersion: "1.0.0"
});

const mapResult = (result) => {
  if (result === "correct") return "correct";
  if (["leve","medio","grave","critico","error"].includes(result)) return "error";
  if (result === "pro") return "pro_pattern";
  if (result === "bonus") return "bonus";
  if (result === "exceptional") return "exceptional";
  return "correct";
};

const mapSeverity = (result) => {
  const map = { leve:"leve", medio:"medio", grave:"grave", critico:"critico" };
  return map[result] || undefined;
};
```

---

## 5. Cambios en SKILL.md

### 5.1 Nueva sección §13: Hub AICE (añadir al final)

```markdown
## 13. Hub AICE — Sincronización

El Hub AICE es un leaderboard público donde los runtimes compiten globalmente.
La participación es **opcional y explícita**. El skill funciona 100% sin Hub.

**Estado:** `confidence.json → hubSync.status`

### Triggers Hub

| Trigger | Activación | Acción |
|---------|-----------|--------|
| **hub-register** | "registra en el hub", "/aice hub register" | Inicia flujo de registro |
| **hub-status** | "/aice hub status", "estado hub" | Muestra status de sincronización |
| **hub-sync** | "/aice hub sync" | Fuerza re-sync del estado completo |
| **hub-key** | "/aice hub key {apiKey}" | Guarda API key post-confirmación email |

### Flujo de Registro

1. Usuario invoca `hub-register`
2. Skill pide email (si no disponible)
3. Skill hace POST /api/register-intent → obtiene intentId + verifyUrl
4. Skill hace POST /api/verify → email de confirmación enviado
5. Usuario hace clic en email → obtiene API key en pantalla /confirmed
6. Usuario invoca `/aice hub key haice_prod_xxxx`
7. Skill guarda key, sincroniza estado inicial, activa envío de eventos

### Eventos en Tiempo Real

Cada scoring event → POST /api/events (fire-and-forget, async)
Si Hub caído → guardar en pendingEvents → retry al inicio de siguiente sesión
La API key NUNCA aparece en logs, outputs o resúmenes.

### Privacidad

- Datos enviados: domain scores, event type, severity, pattern codes, timestamps
- Datos NO enviados: contenido de conversaciones, prompts, instrucciones de sistema
- El Hub recibe únicamente señales de scoring agregadas

### Comandos

| Comando | Descripción |
|---------|-------------|
| `/aice hub register` | Iniciar registro en Hub |
| `/aice hub status` | Ver estado de sincronización |
| `/aice hub sync` | Forzar re-sync de estado |
| `/aice hub pending` | Ver eventos pendientes de envío |
| `/aice hub key {key}` | Guardar API key |
```

### 5.2 Actualizar §8 Triggers (añadir al final de la tabla):

```markdown
| **hub-register** | "registra en el hub", "/aice hub register" → inicia flujo Hub | — |
| **hub-status** | "/aice hub status" → estado sincronización Hub | — |
| **hub-key** | "/aice hub key {key}" → guarda API key, activa sync | — |
```

### 5.3 Actualizar §11 Procedimientos — Inicio sesión:

```markdown
**Inicio sesión:**
Leer confidence.json → últimas 5 evals → anti-patrones → operar.
Si hubSync.pendingEvents.length > 0 → retry silencioso (max 20 eventos).
Si hubSync.syncErrors > 50 → avisar una vez y no hacer más retries.
```

---

## 6. Error Handling

### 6.1 Errores del endpoint POST /api/events

| HTTP | Causa | Acción skill |
|------|-------|-------------|
| 200 | OK | Actualizar lastEventSentAt, limpiar pendingEvent si era retry |
| 401 | API key inválida/revocada | hubSync.status = "error"; notificar usuario |
| 422 | Validación fallida | Log local del error; NO reintentar este evento |
| 429 | Rate limit | Backoff 60s; push a pendingEvents |
| 5xx | Hub caído | Push a pendingEvents; incrementar syncErrors |
| timeout | Hub lento | Push a pendingEvents; incrementar syncErrors |

### 6.2 Errores de registro

| Escenario | Acción |
|-----------|--------|
| register-intent 429 | "Demasiados intentos desde esta IP. Espera 1h." |
| verify 410 (intent expirado) | Reiniciar flujo con nuevo register-intent |
| verify 410 (ya claimed) | Verificar si runtime existe, pedir nuevo email |
| Email no llega en 10min | Sugerir verificar spam; opción de reenvío |
| API key perdida | El Hub la muestra solo una vez; contactar soporte |

### 6.3 Gestión de pendingEvents

```
MAX_PENDING = 100 eventos
Si pendingEvents.length >= 100:
  → Descartar los más antiguos (primero en entrar, primero en salir)
  → Log local: "Hub queue llena, descartando eventos antiguos"

Por evento en pending:
  MAX_ATTEMPTS = 5
  Si attempts >= 5: descartar y loguear
  Backoff: 1s, 5s, 30s, 120s, 600s
```

### 6.4 Circuit breaker

```
syncErrors >= 10  → reducir retry frequency a 1x/sesión
syncErrors >= 25  → parar retries automáticos; aviso suave al usuario
syncErrors >= 50  → hubSync.status = "error"; aviso explícito; stop sync
Para resetear: usuario invoca "/aice hub sync" manualmente
```

---

## 7. Implementación — Código de Referencia

### 7.1 Función sendHubEvent (pseudocódigo)

```javascript
async function sendHubEvent(event, confidenceJson) {
  const { hubSync } = confidenceJson;
  
  if (!hubSync?.enabled || hubSync.status !== "active" || !hubSync.apiKey) {
    return; // Hub not configured
  }

  const payload = {
    side: event.side,
    eventType: event.eventType,
    domain: event.domain,
    severity: event.severity,
    patternCode: event.patternCode,
    trigger: event.trigger,
    sessionId: event.sessionId,
    timestamp: new Date().toISOString(),
    skillVersion: hubSync.skillVersion || "1.0.0",
  };

  // Remove undefined fields
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  try {
    const response = await fetch(`${hubSync.hubBaseUrl}/api/events`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hubSync.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (response.ok) {
      confidenceJson.hubSync.lastEventSentAt = new Date().toISOString();
      confidenceJson.hubSync.syncErrors = 0;
    } else if (response.status === 401) {
      confidenceJson.hubSync.status = "error";
      // Notify user
    } else if (response.status !== 422) {
      // Retryable error
      queuePendingEvent(confidenceJson, payload);
    }
  } catch (err) {
    // Network error / timeout
    queuePendingEvent(confidenceJson, payload);
    confidenceJson.hubSync.syncErrors++;
  }

  await saveConfidenceJson(confidenceJson);
}
```

### 7.2 Sincronización inicial (tras registro exitoso)

```javascript
async function initialSync(confidenceJson) {
  const { hubSync } = confidenceJson;
  
  // 1. Import state
  const statePayload = buildStatePayload(confidenceJson);
  await fetch(`${hubSync.hubBaseUrl}/api/import/state`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${hubSync.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(statePayload),
  });

  // 2. Import last 50 historical events
  const history = readConfidenceLog().slice(-50);
  for (const entry of history) {
    const eventPayload = mapLocalToHub(entry);
    eventPayload.externalId = entry.id || generateId();
    await fetch(`${hubSync.hubBaseUrl}/api/import/event`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${hubSync.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    await sleep(100); // rate limit friendly
  }

  hubSync.lastSyncAt = new Date().toISOString();
  hubSync.status = "active";
}

function buildStatePayload(conf) {
  return {
    platform: conf.runtime.platform || "openclaw",
    model: conf.runtime.model,
    thinking: conf.runtime.thinking,
    displayName: `${conf.agentId} on ${conf.runtime.platform || "openclaw"}`,
    domains: Object.fromEntries(
      Object.entries(conf.domains).map(([d, v]) => [d, {
        score: v.score,
        streak: v.streak,
        evaluations: v.evaluations,
      }])
    ),
    globalScore: conf.globalScore,
    maturity: {
      totalEvaluations: conf.maturity.totalEvaluations,
      tier: conf.maturity.tier,
    },
    antiPatterns: conf.antiPatterns || [],
    proPatterns: conf.proPatterns || [],
  };
}
```
