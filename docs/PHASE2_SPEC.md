# PHASE 2 SPEC — Hub AICE
*Arquitecto AICE — 28 feb 2026*
*Status: APROBADO POR SERGIO — Listo para ejecución con Claude Code*

---

## Decisiones Cerradas

| # | Tema | Decisión |
|---|------|----------|
| 1 | Email | Microsoft 365 / Eurekis tenant. Investigar Microsoft Graph API antes de SMTP relay |
| 2 | MCP | Descartado en Phase 2. REST API es suficiente |
| 3 | Batch import | Script que lee archivos locales ComPi y los convierte a eventos API |
| 4 | Logo | Sergio se encarga — pendiente |
| 5 | OG images | `@vercel/og` (Satori) — share cards dinámicas por runtime |
| 6 | Beta | Aitor + Discord/ClaWHub. Rate limits + registro controlado, sin infra especial |
| 7 | Info levels | Público > Registrado > Personal > Amigos/equipo |
| 8 | Dashboard | Genérico por runtime primero (público), luego per-user post-login |
| 9 | i18n | Inglés prioritario + español. Default: inglés |
| 10 | Diseño | Mejorar visual manteniendo dark+neón |

---

## Sprint Breakdown

### Sprint 1 — Must Have (bloqueantes para credibilidad y datos reales)
**Objetivo:** Leaderboard con datos reales, flujo de registro funcional, idioma inglés, diseño mejorado.
**Estimación:** ~7 días Claude Code · ~1.5 semanas

### Sprint 2 — Should Have (loop viral + polish)
**Objetivo:** Share cards, skill sync, i18n completo, beta.
**Estimación:** ~4 días Claude Code · ~1 semana

---

## SPRINT 1 — Features

---

### S1-F1: Copy en inglés (sin i18n framework)
**Prioridad:** MUST HAVE | **Estimación:** 0.5 días Claude Code

**Descripción:**
Reescribir todo el copy de la aplicación Next.js en inglés. No usar next-intl todavía — sustituir directamente las cadenas. El hero copy requiere rewrite creativo, no traducción literal.

**Hero copy propuesto:**
- ES: `"Mi IA me pone un 46% como jefe. ¿Y la tuya?"`
- EN: `"Your AI rates you. Do you rate it back?"` (o variante con score real: `"My AI gives me a 46% trust score. What's yours?"`)

**Archivos a modificar:**
```
apps/web/src/app/page.tsx                    — hero, stats, how-it-works, CTA
apps/web/src/app/leaderboard/page.tsx        — columnas, badges, tooltips
apps/web/src/app/register/page.tsx           — formulario de registro
apps/web/src/components/ui/                  — strings en componentes
apps/web/src/components/domain-cards.tsx     — descripciones dominios
apps/web/src/components/how-it-works.tsx     — pasos del proceso
```

**API changes:** Ninguno.
**DB migrations:** Ninguna.

**Acceptance criteria:**
- [ ] Toda la UI visible está en inglés
- [ ] El hero hook es atractivo en inglés (revisión de Sergio)
- [ ] Errores y mensajes de sistema en inglés
- [ ] No quedan cadenas sueltas en español en componentes
- [ ] Metadata de página (title, description) en inglés para SEO

---

### S1-F2: Diseño mejorado — dark+neón potenciado
**Prioridad:** MUST HAVE | **Estimación:** 1.5 días Claude Code

**Descripción:**
Mejora visual de la landing sin cambiar el stack (Tailwind + shadcn). Mantener dark+neón. Sin librerías pesadas (no Three.js, no GSAP). CSS animations + Recharts inline son suficientes.

**Cambios específicos:**

1. **Hero section:** Añadir número animado (score real de ComPi animado al cargar). Gradiente de texto en el título principal.

2. **Sección "What is AICE?" → 3 columnas:**
   Rediseñar de tarjetas planas a layout 3 columnas:
   - Columna izquierda: 🤖 Agent (qué evalúa AICE del agente por dominio)
   - Columna centro: Dominios (TECH, OPS, JUDGMENT, COMMS, ORCH con emoji y descripción)
   - Columna derecha: 👤 User (qué evalúa AICE del usuario por dominio)
   - Flechas/conectores bidireccionales entre columnas
   - Footer: Agent Score ← → User Score → Team Score

3. **Domain cards:** Hover state con breakdown Agent vs User por dominio. Border glow con color por score.

4. **"How it works":** Iconos SVG propios (no solo círculos numerados), conectores visuales entre pasos, paso 2 actualizado al flujo skill-driven.

5. **Stats section:** Añadir sparklines 7d en tarjetas numéricas (Recharts `<Sparkline>`). Tendencia visual (↑↓).

6. **Leaderboard preview:** Barras de progreso coloreadas por score, badges de maturity con colores (🥒🌿🌳🦌), platform icons.

**Archivos a crear:**
```
apps/web/src/components/hero-visual.tsx          — Número animado
apps/web/src/components/aice-3column.tsx         — Nuevo diseño 3 columnas
apps/web/src/components/domain-card-v2.tsx       — Cards con hover breakdown
apps/web/src/components/how-it-works-v2.tsx      — Pasos con SVG icons
apps/web/src/components/stats-sparkline.tsx      — Stats con Recharts sparkline
```

**Archivos a modificar:**
```
apps/web/src/app/page.tsx                        — Integrar nuevos componentes
apps/web/src/app/globals.css                     — Añadir animaciones CSS
apps/web/tailwind.config.ts                      — Ajustes de colores neón si necesario
```

**API changes:** Ninguno.
**DB migrations:** Ninguna.

**Acceptance criteria:**
- [ ] Diseño dark+neón mejorado visible en / (Sergio lo valida visualmente)
- [ ] Sección AICE 3 columnas comunica bidireccionalidad en <10 segundos
- [ ] Domain cards tienen hover state con info adicional
- [ ] Stats tienen indicador de tendencia visual
- [ ] No hay regresiones en Lighthouse performance (≥80 performance score)
- [ ] Funciona en mobile (breakpoints responsive)

---

### S1-F3: Flujo de registro skill-driven (completo)
**Prioridad:** MUST HAVE | **Estimación:** 3 días Claude Code

**Descripción:**
El flujo principal de registro cambia de web-manual a skill-driven. La skill llama a la API, la API genera un link temporal, el usuario abre el link, introduce email, y recibe verificación. El email sale desde Microsoft 365 / Eurekis tenant.

**Decisión email:** Investigar primero Microsoft Graph API:
- Si `compi@eurekis.es` puede enviar via Graph API con `Mail.Send` scope → usar Graph API
- Si no (tenant restrictions) → SMTP relay con `smtp.office365.com:587` + credenciales de app
- Configurar dominio de envío: `noreply@hubaice.com` o `noreply@eurekis.es` (según DNS disponible)

#### Sub-feature 3A: Nuevos endpoints API
**Archivos a crear:**
```
apps/api/src/routes/register-intent.ts   — POST /api/register-intent
apps/api/src/routes/verify.ts            — GET /api/verify/:intentId, POST /api/verify
apps/api/src/routes/confirm.ts           — GET /api/confirm?token=<tok>
apps/api/src/routes/set-password.ts      — POST /api/set-password (opcional, fase post-confirm)
```

**Spec endpoints:**

```typescript
// POST /api/register-intent
// Auth: ninguna · Rate limit: 10/IP/hora
body: {
  platform: string,          // "openclaw", "cursor", etc.
  model: string,             // "anthropic/claude-opus-4-6"
  thinking: string,          // "high" | "medium" | "low"
  displayName?: string       // Nombre del runtime (opcional)
}
response: {
  intentId: string,          // UUID
  verifyUrl: string,         // "https://hubaice.com/verify/<intentId>"
  expiresAt: string          // ISO8601, now() + 15min
}
```

```typescript
// GET /api/verify/:intentId
// Valida que el intent existe y no ha expirado
response: {
  platform: string,
  model: string,
  thinking: string,
  displayName?: string,
  expiresAt: string
} | 404 | 410 (expired/claimed)
```

```typescript
// POST /api/verify
// Crea runtime pending, envía email de verificación
body: {
  intentId: string,
  email: string,
  displayName?: string
}
response: {
  message: "Verification email sent",
  runtimeId: string          // Ya creado pero pending
}
```

```typescript
// GET /api/confirm?token=<tok>
// Activa runtime, retorna API key UNA VEZ
// Redirect a /confirmed?apiKey=<key>&runtimeId=<id>
```

#### Sub-feature 3B: DB Migrations

```sql
-- Tabla para intents temporales (no necesita runtime row)
CREATE TABLE registration_intents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     VARCHAR(100) NOT NULL,
  model        VARCHAR(100) NOT NULL,
  thinking     VARCHAR(20)  NOT NULL,
  display_name VARCHAR(200),
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  claimed      BOOLEAN      DEFAULT false,
  claimed_at   TIMESTAMPTZ
);
CREATE INDEX idx_intents_expires ON registration_intents(expires_at);

-- Añadir a tabla runtimes:
ALTER TABLE runtimes ADD COLUMN email                      VARCHAR(255);
ALTER TABLE runtimes ADD COLUMN email_verified             BOOLEAN DEFAULT false;
ALTER TABLE runtimes ADD COLUMN email_verification_token   VARCHAR(128);
ALTER TABLE runtimes ADD COLUMN email_token_expires        TIMESTAMPTZ;
ALTER TABLE runtimes ADD COLUMN status                     VARCHAR(20) DEFAULT 'active';
  -- Valores: 'pending_email' | 'active' | 'quarantine' | 'suspended'
ALTER TABLE runtimes ADD COLUMN intent_id                  UUID REFERENCES registration_intents(id);

-- Tabla usuarios (para dashboard futuro, relación con runtimes)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);
ALTER TABLE runtimes ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_runtimes_email  ON runtimes(email);
CREATE INDEX idx_runtimes_status ON runtimes(status);
CREATE INDEX idx_runtimes_user   ON runtimes(user_id);
```

#### Sub-feature 3C: UI en web

**Archivos a crear:**
```
apps/web/src/app/verify/[intentId]/page.tsx    — Muestra datos pre-rellenados + form email
apps/web/src/app/confirmed/page.tsx            — Muestra API key UNA VEZ + instrucciones
apps/web/src/app/register/page.tsx             — Mantener como fallback manual, añadir nota sobre flujo skill-driven
```

**Flow web:**
1. `/verify/<intentId>` → Muestra: platform, model, thinking (readonly) + form: email, displayName
2. Submit → POST /api/verify → "Check your email"
3. Email link → GET /api/confirm?token → Redirect `/confirmed?apiKey=...&runtimeId=...`
4. `/confirmed` → Mostrar API key en textarea con botón Copy (solo se muestra AQUÍ, una vez)
   - Instrucciones para configurar skill
   - Opción "Set password" para dashboard futuro

#### Sub-feature 3D: Email integration (Microsoft Graph API)

**Archivos a crear:**
```
apps/api/src/services/email.ts                 — Abstracción de email con 2 implementaciones
apps/api/src/services/email-graph.ts           — Microsoft Graph API implementation
apps/api/src/services/email-smtp.ts            — SMTP relay fallback
apps/api/src/templates/verify-email.ts         — Template HTML del email de verificación
```

**Investigación previa requerida (antes de implementar):**
```bash
# Verificar si el tenant permite Graph API Mail.Send
# desde una app registrada en Azure AD
# Endpoint: https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token
# Scope: https://graph.microsoft.com/Mail.Send
# App registration en portal.azure.com con compi@eurekis.es
```

**Template email verificación:**
- Asunto: "Verify your AICE runtime"
- Remitente: `AICE Hub <noreply@hubaice.com>` (o `@eurekis.es` según DNS)
- Body: plataforma, modelo, thinking detectados + botón "Verify Email" prominente + link de texto
- Link: `https://hubaice.com/api/confirm?token=<token>` (24h TTL)
- Footer: "If you didn't request this, ignore this email."

**Acceptance criteria S1-F3:**
- [ ] `POST /api/register-intent` devuelve verifyUrl válida en <200ms
- [ ] Intent expira a los 15min y devuelve 410 tras expiración
- [ ] Intent no puede reclamarse dos veces (idempotente)
- [ ] Email de verificación llega en <2min desde POST /api/verify
- [ ] Link de verificación funciona exactamente una vez
- [ ] API key se muestra en `/confirmed` solo una vez
- [ ] Runtime en DB pasa por estados: `pending_email` → `active`
- [ ] Rate limiting: 10 intents/IP/hora, 3 registros/email/día
- [ ] Flujo manual `/register` sigue funcionando como fallback

---

### S1-F4: Página pública `/runtime/:id`
**Prioridad:** MUST HAVE | **Estimación:** 1.5 días Claude Code

**Descripción:**
Página pública accesible sin auth. Muestra el dashboard de un runtime concreto: scores actuales, radar chart 5 dominios, gráfica evolución 30d, top 3 anti-patrones, top 3 pro-patrones, maturity tier.

Esta es la página destino cuando alguien comparte su runtime en redes sociales.

**Nuevo endpoint API:**
```typescript
// GET /api/runtime/:runtimeId/public
// Auth: ninguna · Cacheable 60s
response: {
  runtimeId: string,
  displayName: string,
  platform: string,
  model: string,
  thinking: string,
  globalScore: number,          // -100 a 100
  domains: {
    TECH: { score: number, evaluations: number, streak: number },
    OPS:  { ... },
    JUDGMENT: { ... },
    COMMS: { ... },
    ORCH: { ... }
  },
  maturity: {
    tier: "GREEN" | "YELLOW" | "RED",
    tierLabel: string,
    tierEmoji: string,
    totalEvaluations: number
  },
  history30d: Array<{
    date: string,               // YYYY-MM-DD
    globalScore: number,
    domainScores: Record<string, number>
  }>,
  antiPatterns: Array<{
    code: string,
    name: string,
    occurrences: number,
    severity: string
  }>,
  proPatterns: Array<{
    code: string,
    name: string,
    occurrences: number
  }>,
  lastActivity: string          // ISO8601
}
```

**Archivos a crear:**
```
apps/web/src/app/runtime/[id]/page.tsx          — Página pública runtime
apps/web/src/components/radar-chart.tsx          — Recharts RadarChart 5 dominios
apps/web/src/components/score-history-chart.tsx  — Recharts LineChart evolución 30d
apps/web/src/components/domain-score-bar.tsx     — Barra de progreso por dominio
apps/web/src/components/maturity-badge.tsx       — Badge tier con emoji y color
apps/api/src/routes/runtime-public.ts            — GET /api/runtime/:id/public
```

**Acceptance criteria:**
- [ ] Página carga en <2s (LCP) con datos reales de ComPi
- [ ] Radar chart muestra los 5 dominios correctamente escalados (-100 a 100)
- [ ] Gráfica 30d muestra evolución real (no flat line si hay datos)
- [ ] Si runtimeId no existe → 404 con mensaje claro
- [ ] Página es indexable (SSR o SSG con revalidate 60s)
- [ ] Mobile-responsive
- [ ] Incluye OG tags para preview en redes (ver S2-F1)

---

### S1-F5: Batch import historial ComPi
**Prioridad:** MUST HAVE | **Estimación:** 0.5 días Claude Code

**Descripción:**
Script de migración que lee los archivos locales de ComPi y los importa al Hub production via API. Ver `scripts/batch-import.ts` (generado en paralelo).

**Archivos a crear:**
```
scripts/batch-import.ts         — Script principal (ver /tmp/hubaice/scripts/batch-import.ts)
scripts/README-batch-import.md  — Instrucciones de uso
```

**Acceptance criteria:**
- [ ] Script ejecuta sin errores con los 3 archivos fuente
- [ ] Interacciones de `interaction-log.jsonl` se convierten a eventos API correctos
- [ ] Evaluaciones de `confidence-log.jsonl` se importan como historial de scoring
- [ ] Estado actual de `confidence.json` se refleja en el runtime post-import
- [ ] Script es idempotente (no duplica si se ejecuta dos veces)
- [ ] Log de importación muestra: total procesados, importados OK, errores
- [ ] El leaderboard muestra datos reales de ComPi tras ejecutar el script

---

## SPRINT 2 — Features

---

### S2-F1: Share cards dinámicas con `@vercel/og`
**Prioridad:** SHOULD HAVE | **Estimación:** 1 día Claude Code

**Descripción:**
OG images generadas on-demand con Satori. Una imagen por runtime con: nombre, score global, radar visual simplificado, plataforma, maturity badge. Se sirven desde un edge function de Next.js.

**Archivos a crear:**
```
apps/web/src/app/api/og/route.tsx              — Edge function OG image
apps/web/src/app/runtime/[id]/share/page.tsx   — Página de share con preview
```

**Spec OG image (1200×630):**
- Background: dark (#0a0a0a) con gradiente neón sutil
- Izquierda: Logo AICE (SVG inline), nombre del runtime, plataforma+modelo
- Centro: Score global en número grande con color por score
- Derecha: 5 barras de dominio en miniatura
- Footer: "hubaice.com" + maturity badge

**URL del OG:**
```
/api/og?runtimeId=<id>&v=<cachebuster>
```

**OG tags en `/runtime/[id]/page.tsx`:**
```html
<meta property="og:image" content="https://hubaice.com/api/og?runtimeId=<id>" />
<meta property="og:title" content="<displayName> AICE Score: <score>%" />
<meta property="twitter:card" content="summary_large_image" />
```

**Acceptance criteria:**
- [ ] OG image se genera en <1s (edge function)
- [ ] La imagen muestra datos reales del runtime
- [ ] Preview correcto al compartir en Twitter/X, WhatsApp, Discord
- [ ] URL con runtimeId inválido retorna imagen genérica de hubaice.com, no 500

---

### S2-F2: MVP Skill Sync — POST /api/events desde ComPi
**Prioridad:** SHOULD HAVE | **Estimación:** 1 día Claude Code

**Descripción:**
Hacer que la skill AICE de ComPi envíe eventos al Hub production de forma continua. MVP mínimo: solo POST /api/events al evaluar. No sync bidireccional completo.

**Modificaciones a la skill:**
```
/home/compi/.openclaw/workspace/skills/aice/SKILL.md        — Documentar config hubUrl
/home/compi/.openclaw/workspace/skills/aice/confidence.ts   — Añadir postToHub() tras cada eval
/home/compi/.openclaw/workspace/skills/aice/confidence.json — Añadir campo "hubSync": true
```

**Formato evento a enviar:**
```typescript
POST https://hubaice.com/api/events
Authorization: Bearer <apiKey>
{
  type: "evaluation",
  side: "agent",                    // "agent" | "user"
  result: "error" | "correct" | "bonus" | "pro",
  domain: "TECH" | "OPS" | "JUDGMENT" | "COMMS" | "ORCH",
  severity?: "leve" | "medio" | "grave" | "critico",
  category?: string,
  delta: number,
  scoreBefore: number,
  scoreAfter: number,
  note?: string,
  timestamp: string                 // ISO8601
}
```

**Acceptance criteria:**
- [ ] Tras cada evaluación en la skill, se hace POST /api/events al hub
- [ ] Errores de red no rompen la evaluación local (fire-and-forget con retry 1x)
- [ ] El hub actualiza el score del runtime correctamente
- [ ] El leaderboard refleja los cambios en <60s

---

### S2-F3: i18n — next-intl con inglés + español
**Prioridad:** SHOULD HAVE | **Estimación:** 1.5 días Claude Code

**Descripción:**
Implementar next-intl para routing bilingüe. `/` (inglés, default) y `/es/` (español). Extraer todas las cadenas a archivos de mensajes.

**Archivos a crear:**
```
apps/web/src/messages/en.json              — Todas las cadenas en inglés
apps/web/src/messages/es.json              — Traducciones español
apps/web/src/i18n/routing.ts               — Config next-intl locales
apps/web/src/i18n/request.ts               — Server-side i18n config
apps/web/src/middleware.ts                 — Routing middleware (locale detection)
```

**Archivos a modificar:**
```
apps/web/next.config.ts                    — Plugin next-intl
apps/web/src/app/[locale]/layout.tsx       — Layout con locale param
apps/web/src/app/[locale]/page.tsx         — Home con useTranslations
(todos los archivos de page.tsx se mueven a [locale]/)
```

**Acceptance criteria:**
- [ ] `/` sirve contenido en inglés
- [ ] `/es/` sirve contenido en español
- [ ] Accept-Language header detecta idioma si no hay prefijo en URL
- [ ] No hay cadenas hardcodeadas en inglés fuera de los archivos de mensajes
- [ ] SEO: `<link rel="alternate" hreflang="en|es" />`
- [ ] Fallback a inglés para cualquier cadena no traducida al español

---

### S2-F4: Beta — Rate limits y registro controlado
**Prioridad:** SHOULD HAVE | **Estimación:** 0.5 días Claude Code

**Descripción:**
Preparar el hub para los primeros beta users (Aitor + Discord/ClaWHub). No se necesita infra especial. Solo:
1. Rate limits más estrictos en producción
2. Lista de emails invitados (o invite codes)
3. Registro controlado: solo emails de la lista o con invite code pueden registrarse

**Archivos a crear:**
```
apps/api/src/middleware/rate-limit.ts      — Rate limiter configurable por ruta
apps/api/src/routes/invite.ts             — Validación de invite code en registro
apps/api/src/config/beta-list.ts          — Lista de emails beta (o fetch desde DB)
```

**DB migration:**
```sql
CREATE TABLE invite_codes (
  code         VARCHAR(32) PRIMARY KEY,
  email        VARCHAR(255),       -- null = open (cualquiera puede usar)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  used_at      TIMESTAMPTZ,
  used_by      UUID REFERENCES runtimes(id)
);
```

**Rate limits en producción:**
```
POST /api/register-intent   → 10/IP/hora
POST /api/verify            → 5/IP/hora · 3/email/día
POST /api/events            → 100/apiKey/minuto
GET  /api/leaderboard       → 60/IP/minuto
GET  /api/runtime/:id       → 120/IP/minuto
```

**Acceptance criteria:**
- [ ] Solo emails en beta-list (o con invite code) pueden completar el registro
- [ ] Rate limits activos en producción sin afectar a ComPi (apiKey ya registrada)
- [ ] Invite codes generables via script de admin (no requiere UI)
- [ ] Log de intentos de registro rechazados

---

## Dependencias entre Features

```
S1-F1 (inglés)       ──independiente──
S1-F2 (diseño)       ──independiente──  [depende de: S1-F1 para textos]
S1-F3 (registro)     ──independiente──  [3A→3B→3C→3D en orden]
S1-F4 (/runtime/:id) ──dep: S1-F5──     [necesita datos reales para validar]
S1-F5 (batch import) ──dep: S1-F3 runtime exists── [necesita runtimeId de ComPi]

S2-F1 (OG images)    ──dep: S1-F4──    [necesita la página /runtime/:id]
S2-F2 (skill sync)   ──dep: S1-F5──    [batch import establece el runtime en hub]
S2-F3 (i18n)         ──dep: S1-F1──    [rewrite inglés primero, luego extraer a mensajes]
S2-F4 (beta)         ──dep: S1-F3──    [flujo registro debe funcionar primero]
```

**Orden de ejecución recomendado:**
1. S1-F5 (batch import) → datos reales inmediatos
2. S1-F1 (inglés) → bloqueante de todo lo demás
3. S1-F3 (registro) → crítico para nuevos usuarios
4. S1-F2 (diseño) → en paralelo con S1-F3 si hay dos sesiones
5. S1-F4 (/runtime/:id) → usando datos de S1-F5
6. S2-F1 (OG) → sobre S1-F4
7. S2-F2 (skill sync) → sobre S1-F5
8. S2-F4 (beta) → sobre S1-F3
9. S2-F3 (i18n) → al final, menos urgente

---

## Notas de Implementación para Claude Code

### Email — investigación previa S1-F3D
Antes de implementar, ejecutar:
```bash
# Verificar si Graph API está disponible
curl -X POST https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token \
  -d "client_id=<app-id>&client_secret=<secret>&scope=https://graph.microsoft.com/Mail.Send&grant_type=client_credentials"

# Si 200 → usar Graph API
# Si 400/403 → usar SMTP relay smtp.office365.com:587
```

Las credenciales se configuran como variables de entorno en Azure Container Apps:
```
EMAIL_PROVIDER=graph|smtp
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
EMAIL_FROM=noreply@hubaice.com (o @eurekis.es)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=compi@eurekis.es
SMTP_PASS=<app-password>
```

### Batch import — ejecutar manualmente tras S1-F3
```bash
# 1. Crear runtime de ComPi en hub (si no existe)
curl -X POST https://hubaice.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"platform":"openclaw","model":"anthropic/claude-opus-4-6","thinking":"high","displayName":"ComPi"}'

# 2. Ejecutar script de import
API_KEY=<key-from-registro> \
HUB_URL=https://hubaice.com \
npx tsx scripts/batch-import.ts \
  --interaction-log /home/compi/.openclaw/workspace/skills/aice/interaction-log.jsonl \
  --confidence /home/compi/.openclaw/workspace/skills/aice/confidence.json \
  --confidence-log /home/compi/.openclaw/workspace/skills/aice/confidence-log.jsonl
```

### Stack constraints
- **NO** añadir nuevas dependencias de runtime sin justificación (el bundle de Next.js ya es suficientemente grande)
- **SÍ** usar Recharts (ya instalado) para todos los charts
- **SÍ** usar `@vercel/og` para OG images (edge-compatible)
- **NO** Puppeteer/Playwright para screenshots (incompatible con Azure Container Apps serverless)
- **SÍ** migrations via `drizzle-kit push` o el sistema de migraciones actual

---

## Estimación Total Phase 2

| Sprint | Feature | Días CC |
|--------|---------|---------|
| S1 | F1: Copy inglés | 0.5 |
| S1 | F2: Diseño mejorado | 1.5 |
| S1 | F3: Flujo registro skill-driven | 3.0 |
| S1 | F4: Página /runtime/:id | 1.5 |
| S1 | F5: Batch import ComPi | 0.5 |
| S2 | F1: OG images (Satori) | 1.0 |
| S2 | F2: MVP skill sync | 1.0 |
| S2 | F3: i18n next-intl | 1.5 |
| S2 | F4: Beta (rate limits + invite) | 0.5 |
| **TOTAL** | | **~11 días Claude Code** |

**A ritmo de 2-3 sesiones/día Claude Code:**
- Sprint 1: ~1.5 semanas
- Sprint 2: ~1 semana
- **Phase 2 completa: ~2.5 semanas**

---

*Spec generada por Arquitecto AICE — 28 feb 2026*
*Decisiones de Sergio incorporadas. Listo para Claude Code.*
