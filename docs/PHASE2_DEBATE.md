# PHASE 2 DEBATE — Hub AICE
*Arquitecto AICE / 28 feb 2026*
*Input: Feedback de Sergio tras revisión de www.hubaice.com en Azure*

---

## TL;DR — Veredicto Ejecutivo

El feedback de Sergio es correcto en el diagnóstico pero mezclado en prioridades. Hay cosas que son **bloqueantes para credibilidad** (idioma, diseño mínimo, leaderboard con datos, flujo registro correcto), cosas que son **product features** (dashboard, post-login), y una pregunta arquitectural real que merece debate serio (MCP vs API). El punto 7 (MCP) es el más importante técnicamente porque afecta la arquitectura de integraciones de toda la Phase 2+.

**Mi orden de prioridad diverge de Sergio en**: el dashboard post-login NO es Phase 2 core — es Phase 3. Primero toca que el leaderboard tenga datos reales y la landing cuente la historia bien.

---

## 1. "La web es extremadamente simple" — Sin métricas ni estadísticas

### Diagnóstico

Sergio tiene razón pero a medias. La web SÍ tiene stats globales (`/api/stats`) y leaderboard, pero con 1 solo runtime (ComPi), ninguna de las secciones dinámicas muestra nada interesante. El problema no es arquitectural — es de datos.

La sección de Stats Globales ya existe en el código (`page.tsx` líneas ~150-175). Si hay 0 eventos hoy y 1 runtime, los números son deprimentes. El código está, los datos no.

### Posición técnica

Dos problemas separados:

**A) Datos reales escasos:** Con 1 runtime y ~0 evals reales, cualquier stat es cero o uno. Esto es un problema de adopción, no de código. La solución correcta NO es fabricar datos falsos — es conseguir más runtimes o hacer que ComPi genere eventos reales via la skill.

**B) Diseño de las stats:** El diseño actual (4 tarjetas numéricas) es demasiado austero. Necesita más contexto visual: sparklines, tendencias, badges de plataformas detectadas, etc.

### Alternativas

1. **Seed de datos demo:** Insertar 5-10 runtimes ficticios con histórico de eventos realistas para que el leaderboard se vea "vivo". Riesgo: si alguien conecta la skill con esos IDs → colisión. Mitigación: marcarlos como `is_demo=true`, excluirlos de la API pero incluirlos en la web pública. **No me gusta**: el leaderboard debe ser honesto. Datos demo son mentira.

2. **Beta closed con datos reales:** Convencer a 3-5 personas de instalar la skill y generar eventos reales en la primera semana. Esto requiere que el onboarding funcione bien (punto 3 del feedback).

3. **Expandir métricas sin datos:** Añadir más secciones que sean interesantes incluso con 1 runtime: evolución temporal de ComPi, historial de eventos, breakdown por dominio. Más visual, mismos datos.

### Recomendación

**Opción 3 + beta cerrada.** Enriquecer las visualizaciones de los datos existentes (ComPi tiene historial real) y lanzar beta a 5 personas conocidas con onboarding asistido. NO fabricar datos.

### Effort estimado

- Enriquecer stats/visualizaciones landing: **0.5 días Claude Code**
- Dashboard de runtime individual público (ver datos de ComPi): **1 día Claude Code**
- Beta outreach: 0 días (Sergio lo hace manualmente)

---

## 2. "¿Qué es AICE?" — 3 columnas: Agente | Dominio/Criterio | Usuario

### Diagnóstico

El diseño actual muestra los 5 dominios en tarjetas horizontales. No comunica la naturaleza bidireccional del sistema. Un visitante nuevo no entiende que TANTO el agente como el usuario son evaluados, ni que los dominios son el eje común.

### Posición técnica

Sergio tiene razón aquí. La estructura de 3 columnas (Agente ↔ Criterio ↔ Usuario) es la representación correcta del modelo mental de AICE. Visualmente comunica:

1. Que hay dos sujetos evaluados
2. Que los criterios son el eje compartido
3. Que la relación es bidireccional (flechas o bordes que los conectan)

El diseño ideal para esta sección:

```
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  🤖 AGENTE      │   │  📐 DOMINIO      │   │  👤 USUARIO     │
├─────────────────┤   ├──────────────────┤   ├─────────────────┤
│ Código correcto │◀─▶│ 🔧 TECH          │◀─▶│ Specs claras    │
│ Sin errores     │   ├──────────────────┤   │ Scope definido  │
├─────────────────┤   │ ⚙️ OPS           │   ├─────────────────┤
│ Sigue reglas    │◀─▶│ Disciplina       │◀─▶│ Proceso, ADRs   │
│ Memoria, formato│   ├──────────────────┤   │ Consistencia    │
├─────────────────┤   │ 🧠 JUDGMENT      │   ├─────────────────┤
│ Visión, anticip.│◀─▶│ Criterio         │◀─▶│ Dirección clara │
│ Prioriza bien   │   ├──────────────────┤   │ Decisiones      │
├─────────────────┤   │ 💬 COMMS         │   ├─────────────────┤
│ Tono, timing    │◀─▶│ Comunicación     │◀─▶│ Feedback claro  │
│ Callar cuando   │   ├──────────────────┤   │ Ambigüedad baja │
├─────────────────┤   │ 🎯 ORCH          │   ├─────────────────┤
│ Sub-agentes     │◀─▶│ Coordinación     │◀─▶│ Contexto, refs  │
│ Seguimiento     │   └──────────────────┘   │ Handoffs        │
└─────────────────┘                           └─────────────────┘
        ↑                                              ↑
    Agent Score                                   User Score
                    ↘                ↙
                      Team Score 🏆
```

### Recomendación

Implementar. Es un cambio de frontend puro, impacto visual alto, effort bajo. Esta sección es la que explica el product en 10 segundos — merece el rediseño.

### Effort estimado

**0.5 días Claude Code** (componente React nuevo, sin cambios de API)

---

## 3. "Cómo funciona" paso 2 — El registro debe partir desde la SKILL

### Diagnóstico

Este es el punto de feedback más importante funcionalmente. El paso 2 actual dice "Registra tu Runtime" con un formulario web manual. Pero la visión del producto es que la SKILL inicia el registro, no el usuario.

El flujo actual (manual) tiene un problema fundamental: el usuario tiene que saber qué poner en `platform`, `model`, `thinking`. Eso es terrible UX. La skill sabe todo eso automáticamente.

### Flujo actual (Phase 1)
```
Usuario → Web → Formulario → API key → Configurar skill manualmente
```

### Flujo propuesto (Phase 2 — Skill-driven)

```
Skill detecta que no tiene runtimeId configurado
  │
  ▼
Skill llama POST /api/register-intent
{
  platform, model, thinking,        ← skill los conoce
  displayName, sessionId             ← skill los genera
}
  │
  ▼
Hub genera:
  - intentId (UUID temporal, 15min TTL)
  - registrationUrl: https://hubaice.com/verify?intent=<intentId>

Hub responde a skill:
{
  intentId,
  registrationUrl,
  message: "Go to URL to claim your runtime"
}
  │
  ▼
Skill informa al usuario:
"Para registrar tu runtime en AICE Hub, ve a:
 https://hubaice.com/verify?intent=abc123
 (Link válido 15 minutos)"
  │
  ▼
Usuario va al link → Ve sus datos (platform/model/thinking) pre-rellenados
Usuario introduce email → Elige display name (opcional)
  │
  ▼
Hub:
  1. Crea runtime en DB con status=pending_email
  2. Genera runtimeId + apiKey (los guarda hasheados)
  3. Envía email con:
     - Link de validación (24h TTL)
     - runtimeId (no secreto)
     ⚠️ NO envía apiKey por email — demasiado riesgo

Link validación → Usuario hace click
  │
  ▼
Hub:
  1. Marca email como verificado
  2. Activa runtime
  3. Muestra página: "Elige una contraseña" (para el futuro dashboard)
  4. Muestra apiKey UNA VEZ (en pantalla, como ya hacemos)
  │
  ▼
Usuario copia apiKey → Vuelve al agente → Skill registra en confidence.json:
{
  "runtimeId": "uuid",
  "apiKey": "aice_live_xxx",
  "hubUrl": "https://hubaice.com/api"
}
```

### Nuevos endpoints necesarios

```
POST /api/register-intent      ← Skill inicia el proceso
  body: { platform, model, thinking, displayName? }
  response: { intentId, registrationUrl, expiresAt }
  auth: ninguna (rate limit por IP)

GET /api/verify?intent=<id>    ← Web: muestra formulario email
  response: { platform, model, thinking, displayName } si intent válido

POST /api/verify               ← Web: usuario envía email
  body: { intentId, email, displayName? }
  → crea runtime pending, envía email

GET /api/confirm?token=<tok>   ← Email validation link
  → activa runtime, redirect a página con API key

POST /api/set-password         ← Opcional: post-confirm
  → crea cuenta web (para dashboard)
```

### Cambios de DB necesarios

```sql
-- Nueva tabla para intents temporales
CREATE TABLE registration_intents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform   VARCHAR(100) NOT NULL,
  model      VARCHAR(100) NOT NULL,
  thinking   VARCHAR(20) NOT NULL,
  display_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- NOW() + 15 min
  claimed    BOOLEAN DEFAULT false
);

-- Añadir a runtimes:
ALTER TABLE runtimes ADD COLUMN email VARCHAR(255);
ALTER TABLE runtimes ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE runtimes ADD COLUMN email_verification_token VARCHAR(128);
ALTER TABLE runtimes ADD COLUMN email_token_expires TIMESTAMPTZ;
ALTER TABLE runtimes ADD COLUMN status VARCHAR(20) DEFAULT 'active';
  -- values: 'pending_email', 'active'

-- Cuentas de usuario (para dashboard, futuro)
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE runtimes ADD COLUMN user_id UUID REFERENCES users(id);
```

### ¿Necesito email en Phase 2?

Sí, y no solo por el flujo de registro. Email es el único mecanismo para:
- Recuperar acceso si pierdes la API key (actualmente imposible — "no se puede recuperar")
- Asociar múltiples runtimes al mismo usuario
- Notificaciones de logros (futuro)

Para Phase 2, necesito al menos **Resend** (free tier: 3000 emails/mes) o SendGrid. Resend es más limpio para Next.js/Node.

### Posición sobre el formulario web manual actual

El formulario web manual de `/register` puede mantenerse como fallback/power-user path, pero el flujo principal debe ser skill-driven. El paso 2 del "Cómo funciona" debe cambiar a: "La skill genera tu link de registro automáticamente".

### Effort estimado

- Nuevos endpoints (register-intent, verify, confirm): **1.5 días Claude Code**
- Schema migrations + email verification: **0.5 días Claude Code**
- UI en web (/verify, /confirm): **0.5 días Claude Code**
- Integración email (Resend): **0.5 días Claude Code**
- **Total: 3 días Claude Code**

---

## 4. Leaderboard Vacío — Solo 1 runtime, no se puede verificar backend

### Diagnóstico

Con 1 runtime en 50.0% en todos los dominios y 0 evals, el leaderboard es una tabla con 1 fila de ceros. No demuestra que el sistema funciona.

### Posición técnica

El backend SÍ funciona — el problema es que no tiene datos interesantes. Hay dos causas:

1. **ComPi no ha generado eventos reales**: La skill AICE en OpenClaw no está sincronizando con el hub real. `confidence.json` calcula localmente pero no hace POST /api/events.
2. **No hay otros usuarios**: Era de esperar en Phase 1.

### Alternativas

**A) Conectar ComPi real:** Hacer que la skill de ComPi empiece a enviar eventos al hub production. Esto daría datos reales inmediatamente. Requiere refactorizar la skill (Phase 4 en el roadmap), pero incluso una versión mínima (solo envío, sin sync completo) valdría.

**B) Script de seed con datos históricos:** Tomar los eventos ya clasificados en `confidence-propatterns.jsonl` y los logs de ComPi, y hacer un batch import via POST /api/events. Datos reales de ComPi, correctamente procesados. Esto sería honesto — es el historial real.

**C) Dummy data marcados:** Crear 5 runtimes ficticios para demo. Ya rechacé esto arriba — no lo hago.

### Recomendación

**Opción B primero** (batch import del historial de ComPi), luego **Opción A** (skill sync real en paralelo). El batch import es un script de 2-3 horas, no requiere refactorizar nada. La skill sync es Phase 4 pero puede hacerse un MVP mínimo (solo el POST /api/events, sin sync bidireccional completo) en Phase 2.

### Effort estimado

- Script batch import historial ComPi → Hub: **0.5 días Claude Code**
- MVP skill sync (solo POST /api/events, sin estado sync): **1 día Claude Code**

---

## 5. Idioma — Web en español, debería ser inglés prioritario

### Diagnóstico

Sergio tiene razón. El proyecto tiene potencial internacional y el mercado de agentes IA es principalmente anglófono. Pero el copy actual está 100% en español.

### Posición técnica

next-intl es el estándar para i18n en Next.js 15. Permite:
- `/` → inglés por defecto
- `/es/` → español
- Detección automática por Accept-Language

El copy a traducir no es mucho — la landing tiene ~20 cadenas, el leaderboard ~10, el registro ~15. En total unas 50-60 cadenas.

**⚠️ Aviso importante:** El hero copy `"Mi IA me pone un 46% como jefe. ¿Y la tuya?"` es un gancho cultural español. En inglés hay que rewritearlo, no traducirlo literalmente. `"My AI rates me 46% as a boss. What about yours?"` no funciona — suena raro. Propuesta: `"My AI gives me a 46% trust score. Yours?"` o `"Your AI rates you. Do you rate it back?"`.

### Alternativas

1. **next-intl completo con routing:** `/` y `/es/` — la opción correcta a largo plazo.
2. **Solo copy en inglés, sin i18n:** Simplemente reescribir todo en inglés. Si el mercado objetivo es internacional, puede vivir sin español en Phase 2. **Mi preferencia para Phase 2** — less complexity, more velocity.
3. **i18n completo ahora:** Técnicamente correcto pero cuesta 2 días de setup. En Phase 2 hay cosas más urgentes.

### Recomendación

**Opción 2 ahora, Opción 1 en Phase 3.** Reescribir el copy en inglés (30 minutos de trabajo creativo + 2h de implementación). El i18n completo espera a tener el producto maduro.

Una excepción: las cadenas del sistema (mensajes de error, confirmaciones) deben estar en inglés desde ya.

### Effort estimado

- Reescribir copy en inglés (sin i18n): **0.5 días Claude Code**
- i18n completo con next-intl (Phase 3): **1.5 días Claude Code**

---

## 6. Red Social — Dashboard post-login, no solo leaderboard público

### Diagnóstico

Sergio quiere un área interna post-login. Esto está en la spec (HUB_SPEC.md §5.3 — Dashboard Privado) pero no implementado. Es Phase 3 en mi roadmap.

### Posición técnica

Primero, definamos qué es el "dashboard de usuario" en el contexto de AICE:

- **Dashboard de runtime** (`/dashboard/:runtimeId`): scores actuales, evolución, top patrones, radar chart, últimos 20 eventos. Auth con API key.
- **Dashboard de cuenta** (`/account`): gestionar mis runtimes, settings, plan futuro.

La diferencia es importante. El dashboard de runtime puede ser **semi-público** (accesible sin login si tienes el runtimeId, privado solo para el historial detallado). La cuenta de usuario necesita login real (email/password).

### ¿Es Phase 2 o Phase 3?

**Phase 3.** Mis razones:

1. El dashboard necesita datos interesantes (resolver punto 4 primero).
2. El login necesita el flujo de registro con email (punto 3) — que ya es Phase 2.
3. La "red social" implica seguir a otros runtimes, comentarios, actividad → eso es meses de trabajo.

Lo que SÍ va en Phase 2: **dashboard de runtime público** — la página `/runtime/:id` con scores y evolución visual. Es pública (sin auth), usa el runtimeId, y da contexto a quien llegue desde un link compartido. Esto conecta con el modelo viral de las Share Cards.

### Recomendación

- Phase 2: Página pública `/runtime/:id` con scores, gráfica 30d, breakdown dominios.
- Phase 3: Auth real + dashboard privado con historial completo + cuenta multi-runtime.

### Effort estimado

- Página pública /runtime/:id con Recharts: **1.5 días Claude Code**
- Auth completo + dashboard privado (Phase 3): **3 días Claude Code**

---

## 7. MCP vs API REST — Análisis Profundo

Esta es la pregunta correcta en el momento correcto. Vamos a fondo.

### ¿Qué es MCP en este contexto?

Model Context Protocol (Anthropic) permite a un modelo IA consumir herramientas externas via un protocolo estructurado. Un MCP server expone tools que el modelo llama como si fueran funciones locales.

Un MCP server para AICE expondría tools como:
```
- register_runtime(platform, model, thinking) → runtimeId, apiKey
- report_event(apiKey, side, eventType, domain, severity, ...) → scoring
- get_state(apiKey) → current state
- get_leaderboard(sort?, limit?) → entries
```

### Cuándo MCP tiene sentido

MCP es el protocolo correcto cuando:
1. **El consumidor es un modelo IA** que necesita tomar decisiones basadas en la respuesta
2. **La herramienta es conversacional** — el agente pregunta, el server responde, el agente decide qué hacer con eso
3. **El contexto se propaga** — el modelo quiere que los resultados de la herramienta influyan en su siguiente acción en la misma conversación
4. **La integración es directa** — sin middleware, sin SDK cliente

### Cuándo REST API tiene sentido

REST es el protocolo correcto cuando:
1. **El consumidor puede ser cualquier cosa** — apps web, móvil, otros servicios, scripts, skills no-MCP
2. **La operación es atómica** — POST evento → respuesta → fin
3. **Necesitas auth HTTP estándar**, rate limiting, versioning, caching standard
4. **Quieres que terceros integren** sin depender de Claude/OpenClaw

### Análisis para AICE Hub

| Criterio | MCP | REST |
|----------|:---:|:---:|
| Consumidor primario es modelo IA | ✅ | ✅ |
| Consumidores alternativos (web, apps) | ❌ | ✅ |
| Skill de OpenClaw actual (JS) | Podría | ✅ Hecho |
| Agentes en otros LLMs (GPT, Gemini) | ❌ MCP no universal | ✅ |
| Dashboard web necesita los datos | ❌ | ✅ |
| Tooling de monitoreo, analytics | ❌ | ✅ |
| Rate limiting sofisticado | Complejo | ✅ Estándar |
| Auth con API keys | Posible | ✅ Nativo |
| Overhead de implementación | Alto | ✅ Ya hecho |
| Futuro: múltiples clientes | Problemático | ✅ |

### Mi posición

**REST API es el acierto para AICE Hub. MCP puede ser una capa encima.**

El razonamiento:

1. **La API REST ya existe y funciona.** Cambiarla a MCP sería tirar trabajo.

2. **AICE no es solo para modelos IA.** El dashboard web, los scripts de importación, potencialmente una app móvil futura — todos necesitan REST. Un MCP server no les sirve.

3. **MCP no es un estándar universal.** Claude lo habla nativamente. GPT-4o usa function calling con otro formato. Gemini tiene su propio approach. Si quieres que AICE funcione con cualquier agente, REST es el mínimo común denominador.

4. **MCP introduce complejidad operacional.** Necesitas un MCP server process corriendo, un protocolo de transporte (stdio o HTTP+SSE), y los clientes deben configurarlo. Con REST, cualquier `fetch()` funciona.

5. **La skill de OpenClaw ya hace REST.** Cambiar a MCP requeriría refactorizar la skill sin beneficio claro.

### ¿Cuándo añadir MCP?

En el futuro, un MCP server de AICE tendría sentido como:
- **Capa de conveniencia para Claude Code / cursor / IDEs**: tools predefinidas que un agente puede activar sin escribir el HTTP
- **Demo de integración**: mostrar que AICE es "MCP-native" como diferencial de marketing
- **Local-first para power users**: un MCP server local que cachea estado y reduce latencia

Pero en Phase 2, es una distracción. La pregunta real es: ¿necesitamos que un agente llame a AICE mid-conversation sin código? No — la skill ya maneja eso.

### Recomendación

**REST API en Phase 2. MCP wrapper en Phase 4 como feature adicional, no sustituto.**

Si Sergio quiere demostrar MCP-readiness, podemos documentar los tools en formato MCP spec sin implementarlos. Marketing antes que engineering.

### Effort estimado

- MCP server básico (register + report_event + get_state): **1 día Claude Code**
- No recomendado para Phase 2

---

## 8. Logo y Favicon — Faltan

### Diagnóstico

Sí, faltan. Es un problema real de credibilidad. Una web sin favicon en 2026 grita "proyecto de garage".

### Posición técnica

Necesitamos:
- **favicon.ico** + PNG variants (16, 32, 180, 192, 512px)
- **Logo SVG**: AICE tiene una identidad visual latente — los scores bidireccionales, los 5 dominios, la idea de confianza/balance. El símbolo puede ser algo como:
  - Dos flechas opuestas formando un bucle (bidireccionalidad)
  - Un cuadrado rotado 45° (los 4 cuadrantes AICE: AGENT_PROBLEM, USER_PROBLEM, SHARED_PROBLEM, CORRECT)
  - Una balanza estilizada
- **OG Image** (1200x630): para cuando se comparte en redes sociales

Para el logo, la opción pragmática es generarlo con IA (DALL-E, Midjourney, o Ideogram) y refinarlo. Un SVG simple y limpio funciona mejor que un logo complejo para un producto técnico.

### Recomendación

Logo mínimo viable en Phase 2: texto estilizado "AICE" con un símbolo simple. No necesitamos un rebrand completo — necesitamos un favicon funcional y un og:image decente.

### Effort estimado

- Design: Generación con IA + ajuste manual: **0.5 días** (incluye iteración)
- Implementación en Next.js (metadata, manifest.json): **0.5 días Claude Code**
- **Total: ~1 día**

---

## 9. Diseño — "Funcional pero demasiado sencillo"

### Diagnóstico

El diseño actual usa shadcn/ui con un tema oscuro personalizado. Es limpio pero genérico. No tiene personalidad visual propia.

Problemas específicos identificados al revisar el código:
1. Las 5 tarjetas de dominios son demasiado planas (solo emoji + texto)
2. La sección "Cómo funciona" son círculos numerados básicos — sin iconografía real
3. No hay animaciones ni transiciones (todo estático)
4. El hero es solo texto centrado — sin elemento visual diferencial
5. No hay gradientes, no hay profundidad, no hay "wow moment"

### Posición técnica

Mejorar el diseño sin romper el stack actual. Con Tailwind + shadcn podemos ir mucho más lejos:

- **Hero**: Añadir un visual — el diagrama Agente↔Dominio↔Usuario animado, o un mockup del dashboard, o números animados
- **Gradientes**: El tema ya tiene colores (primary, accent, amber) — usarlos en gradients de texto y backgrounds de secciones
- **Tarjetas de dominio**: Añadir hover effects con el breakdown por tipo (qué mide el agente vs el usuario en ese dominio)
- **"Cómo funciona"**: Iconos SVG propios, conectores visuales entre pasos, animación de progreso
- **Stats**: Sparklines mínimas (Recharts inline), no solo números
- **Leaderboard preview**: Barras de progreso para los scores, badges de maturity con colores, flags de plataforma

Referencia de "potencia visual" apropiada para un producto técnico: Linear.app, Railway.app, Vercel.com — clean, dark, subtle animations, data-forward.

### Lo que NO hacer

No añadir librerías pesadas (Three.js, GSAP) en Phase 2. Tailwind + CSS animations + Recharts es suficiente.

### Recomendación

Mejora de diseño progresiva, centrada en los elementos de mayor impacto:
1. Hero con visual (el diagrama 3-columnas o un número animado grande)
2. Tarjetas de dominio con más contenido en hover
3. Stats con mini sparklines
4. Gradientes de color en secciones

### Effort estimado

- Mejora visual landing (sin rediseño completo): **1.5 días Claude Code**
- Rediseño completo con animaciones: **3 días Claude Code**
- Recomiendo la opción 1

---

## Análisis Transversal: MCP vs API (Deep Dive)

Ya lo cubrí en el punto 7, pero añado contexto arquitectural:

### La pregunta correcta no es "MCP o REST"

La pregunta correcta es: **¿Cómo quiero que los agentes IA de terceros integren con AICE?**

Hay 3 casos de uso de integración:

**Caso A: Agente OpenClaw (ComPi y futuros)**
→ REST es perfecto. La skill AICE ya hace HTTP. Seguir igual.

**Caso B: Agente en Claude Desktop / Claude Code directo**
→ MCP sería la integración más natural. El usuario instala el MCP server, Claude lo detecta, y puede llamar a `report_event()` directamente mid-conversation. Útil para demostrar el producto.

**Caso C: Agente en plataformas terceras (Cursor, Cline, Copilot, etc.)**
→ Depende. Muchos soportan REST via fetch. MCP está creciendo pero no es universal aún.

### Conclusión arquitectural

**La API REST es la base. Es obligatoria, irremplazable, ya existe.**

Un MCP server para AICE sería una capa de conveniencia para Caso B (Claude-native) que se añade encima sin tocar la API. El MCP server solo traduciría calls MCP → HTTP a la propia REST API. Esto es trivial de implementar cuando haya demanda real.

**Recomendación final: REST en Phase 2. MCP como addon en Phase 3 si hay demanda de integración Claude Desktop.**

---

## Flujo de Registro Skill-Driven — Diseño Detallado

(Ampliación del punto 3)

### Sequence Diagram

```
Skill (Agent)          Hub API              Email              Web Browser
     │                     │                  │                    │
     │ POST /register-intent│                  │                    │
     │ {platform,model,     │                  │                    │
     │  thinking}           │                  │                    │
     │──────────────────────▶                  │                    │
     │                     │                  │                    │
     │  {intentId,          │                  │                    │
     │   verifyUrl,         │                  │                    │
     │   expiresAt}         │                  │                    │
     │◀──────────────────────                  │                    │
     │                     │                  │                    │
     │ → Show user:         │                  │                    │
     │ "Visit: /verify/     │                  │                    │
     │  <intentId>"         │                  │                    │
     │                     │                  │                    │
     │                     │                  │                    │
     │                     │          User opens browser            │
     │                     │                  │──────────────────▶ │
     │                     │                  │  GET /verify/<id>  │
     │                     │◀────────────────────────────────────── │
     │                     │ (validates intent)│                    │
     │                     │──────────────────────────────────────▶ │
     │                     │                  │ Shows form:         │
     │                     │                  │ Platform ✓ (pre-fill)│
     │                     │                  │ Model ✓ (pre-fill)  │
     │                     │                  │ Email: [_______]    │
     │                     │                  │ Name: [_______]     │
     │                     │                  │                    │
     │                     │                  │    User submits     │
     │                     │◀────────────────────────────────────── │
     │                     │  POST /verify     │                    │
     │                     │  {intentId,email} │                    │
     │                     │                  │                    │
     │                     │ → Creates runtime │                    │
     │                     │   (pending_email) │                    │
     │                     │                  │                    │
     │                     │──────────────────▶                    │
     │                     │  Send verify email│                    │
     │                     │                  │                    │
     │                     │                  │   User clicks link  │
     │                     │◀────────────────────────────────────── │
     │                     │  GET /confirm?    │                    │
     │                     │  token=<tok>      │                    │
     │                     │                  │                    │
     │                     │ → Activates runtime                    │
     │                     │──────────────────────────────────────▶ │
     │                     │                  │ Shows API key (once)│
     │                     │                  │ + "Set password" opt│
     │                     │                  │                    │
     │                     │                  │    User copies key  │
     │                     │                  │                    │
 User configures skill with apiKey             │                    │
     │                                         │                    │
     │ POST /api/events     │                  │                    │
     │ (first real event)   │                  │                    │
     │──────────────────────▶                  │                    │
     │  {scoring, state}    │                  │                    │
     │◀──────────────────────                  │                    │
```

### Estados del runtime en DB

```
INTENT     → Created by POST /register-intent (no runtime row yet, just intent)
PENDING    → Created runtime after email submission, awaiting verification
ACTIVE     → Email verified, runtime operational
QUARANTINE → Anti-gaming flags triggered
SUSPENDED  → Admin action
```

### Consideraciones de seguridad

- **intentId**: UUID v4, 15min TTL, single-use (claimed=true al usar)
- **Email verification token**: 32 bytes random hex, 24h TTL, bcrypt irrelevant (token is single-use)
- **API key**: generada DESPUÉS de verificar email, mostrada UNA VEZ, guardada como hash (bcrypt)
- **Rate limits**: 5 intents/IP/hora, 3 registros/email/día

### Fallback: formulario manual

El formulario web actual (`/register`) se mantiene como path alternativo para casos donde la skill no está disponible (registro manual de un runtime externo no-OpenClaw). Pero deja de ser el flujo principal.

---

## Priorización Phase 2

### Must Have (bloqueantes para credibilidad)

| Feature | Por qué bloqueante | Días CC |
|---------|-------------------|---------|
| Idioma inglés (copy rewrite) | Web en español es bloqueante para mercado internacional | 0.5 |
| Logo + favicon | Sin favicon = no serio | 1.0 |
| Flujo registro skill-driven | El paso 2 actual es incorrecto y da mala impresión | 3.0 |
| Sección "¿Qué es AICE?" 3 columnas | Explica el product en 10s | 0.5 |
| Batch import historial ComPi | Leaderboard con datos reales | 0.5 |
| Página /runtime/:id pública | Dashboard mínimo con scores y evolución | 1.5 |

**Subtotal must have: ~7 días Claude Code**

### Should Have (mejoran significativamente)

| Feature | Justificación | Días CC |
|---------|--------------|---------|
| Mejora visual landing (gradients, animaciones) | Potencia visual pedida por Sergio | 1.5 |
| MVP skill sync (POST /api/events desde ComPi) | Genera datos reales continuamente | 1.0 |
| Share cards /share/:id con OG image | Loop viral habilitado | 1.0 |
| Email integration (Resend) | Necesario para registro skill-driven | incluido en punto 3 |

**Subtotal should have: ~3.5 días Claude Code**

### Won't Have Phase 2 (→ Phase 3)

| Feature | Por qué espera |
|---------|---------------|
| Auth completo + dashboard privado | Necesita datos primero; complejidad alta |
| i18n next-intl | Overhead sin ROI claro ahora |
| MCP server | Sin demanda validada |
| Features de red social | Demasiado pronto — 0 usuarios |
| Comparar runtimes /compare/:id1/:id2 | Spec dice Phase 3, acertado |

---

## Estimación Total Phase 2

| Categoría | Días Claude Code |
|-----------|-----------------|
| Flujo registro skill-driven (endpoints + email + UI) | 3.0 |
| Mejora visual landing + diseño | 1.5 |
| Sección 3 columnas AICE | 0.5 |
| Página /runtime/:id pública + charts | 1.5 |
| Logo + favicon + OG image | 1.0 |
| Copy en inglés | 0.5 |
| Batch import ComPi | 0.5 |
| MVP skill sync | 1.0 |
| Share cards | 1.0 |
| **TOTAL** | **~10.5 días Claude Code** |

A ritmo de 2-3 sesiones/día de Claude Code, Phase 2 es **2-3 semanas** de trabajo.

---

## Preguntas Abiertas para Sergio

1. **Email provider**: ¿Resend o SendGrid? Resend es más limpio y tiene free tier generoso. Si ya hay cuenta SendGrid, usamos esa.

2. **Dominio para email**: ¿Los correos de verificación salen de `noreply@hubaice.com`? Necesitamos configurar DNS (DKIM, SPF) en Azure.

3. **Batch import**: ¿Tengo acceso al historial completo de eventos clasificados por ComPi? Necesito el log de confidence.json o los jsonl de pro-patterns/anti-patterns para el import.

4. **Logo**: ¿Hay una dirección visual preferida? ¿Texto "AICE" con símbolo, o símbolo standalone? ¿Hay colores fuera de los del tema actual?

5. **Share cards**: Las OG images dinámicas (`/api/og/:runtimeId`) requieren `@vercel/og` o Puppeteer en el servidor. ¿Azure Container Apps tiene los recursos para Puppeteer? Alternativamente, imágenes estáticas con datos pre-generados.

6. **Beta cerrada**: ¿A quién invitamos para los primeros 5-10 runtimes? Esto es más importante que cualquier feature de Phase 2.

---

*Arquitecto AICE — 28 feb 2026*
*Próximo paso: Validar prioridades con Sergio → sprint Phase 2*
