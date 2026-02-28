# AICE Product Roadmap
*Created: 26 feb 2026 · Updated: 28 feb 2026*

---

## Estado Actual

| Fase | Estado | Fecha |
|------|--------|-------|
| Fase 0 — Fundación técnica | ✅ COMPLETA | 26 feb 2026 |
| Fase 1 — Módulo de registro | ✅ COMPLETA | 28 feb 2026 |
| **Fase 2 — Hub completo** | 🚀 **EN EJECUCIÓN** | 28 feb 2026 |
| Fase 3 — Dashboard privado + red social | 📋 Planificada | — |
| Fase 4 — ClaWHub + MCP wrapper | 📋 Planificada | — |
| Fase 5 — Contenido social | 📋 Planificada | — |

---

## Fase 0 — Fundación técnica ✅
- GitHub público con README
- Paper-style documentation (research/)
- SKILL.md funcional con scoring bidireccional
- AICE scoring engine: pool-based, bidireccional (agent + user), 5 dominios

---

## Fase 1 — Hub production ✅
- Next.js + API REST desplegado en Azure Container Apps
- Leaderboard público con runtimes
- Endpoint de registro: runtime → API key
- Base de datos PostgreSQL en producción
- Dominio: www.hubaice.com

---

## Fase 2 — Hub completo 🚀 APROBADA (28 feb 2026)

**Spec completa:** `/tmp/hubaice/docs/PHASE2_SPEC.md`

### Decisiones confirmadas por Sergio

| Decisión | Resolución |
|----------|-----------|
| **Email** | Microsoft 365 / Eurekis tenant. Investigar Graph API antes de SMTP relay |
| **MCP** | Descartado en Phase 2. REST API es suficiente |
| **Batch import** | Script `scripts/batch-import.ts` — datos reales de ComPi |
| **Logo** | Sergio se encarga (pendiente entrega) |
| **OG images** | `@vercel/og` (Satori) — share cards dinámicas por runtime |
| **Beta** | Aitor + Discord/ClaWHub. Rate limits + invite codes |
| **Niveles info** | Público > Registrado > Personal > Amigos/equipo |
| **Dashboard** | Genérico por runtime (público) primero, per-user post-login en Phase 3 |
| **i18n** | Inglés prioritario + español. Default: inglés. next-intl en Sprint 2 |
| **Diseño** | Mejorar visual manteniendo dark+neón. Sin rediseño completo |

### Sprint 1 — Must Have
- [ ] **S1-F1** Copy en inglés (0.5 días CC)
- [ ] **S1-F2** Diseño mejorado — sección 3 columnas AICE, stats sparklines, hover states (1.5 días CC)
- [ ] **S1-F3** Flujo registro skill-driven — intents, email verification, confirmed page (3 días CC)
- [ ] **S1-F4** Página pública `/runtime/:id` con radar chart + evolución 30d (1.5 días CC)
- [ ] **S1-F5** Batch import historial ComPi → Hub production (0.5 días CC)

### Sprint 2 — Should Have
- [ ] **S2-F1** Share cards con `@vercel/og` — OG image dinámica por runtime (1 día CC)
- [ ] **S2-F2** MVP skill sync — ComPi envía POST /api/events en tiempo real (1 día CC)
- [ ] **S2-F3** i18n con next-intl — `/` inglés, `/es/` español (1.5 días CC)
- [ ] **S2-F4** Beta — rate limits + invite codes para Aitor/ClaWHub (0.5 días CC)

**Estimación total:** ~11 días Claude Code · ~2.5 semanas

---

## Fase 3 — Dashboard privado + red social 📋
*(No antes de tener Phase 2 con datos reales)*

- Auth completo: email/password login, JWT sessions
- Dashboard privado post-login: historial completo, anti-patrones propios, evolución detallada
- Multi-runtime: un usuario gestiona varios runtimes
- Team scores: grupos de runtimes con score compartido
- Comparativas: `/compare/:id1/:id2`
- Notificaciones de logros por email

**Prerequisito:** Fase 2 completa + ≥20 runtimes activos

---

## Fase 4 — ClaWHub + MCP wrapper 📋

- Skill AICE publicada en ClaWHub (instalación zero-friction)
- Sync bidireccional completo skill ↔ Hub (no solo POST /api/events)
- MCP server wrapper sobre la REST API (para Claude Desktop/Code)
  - `register_runtime()`, `report_event()`, `get_state()`, `get_leaderboard()`
  - Solo si hay demanda validada — no antes
- AICE Lite embebido en Habla.me como feature CRM

**Prerequisito:** Fase 3 con ≥50 runtimes activos

---

## Fase 5 — Contenido social 📋

- Vídeos cortos Instagram/TikTok con scores reales
- "Mi IA me pone un X% como jefe"
- Integración con X/Twitter para share automático de hitos
- Solo cuando hay datos reales del leaderboard (≥100 runtimes)

**Prerequisito:** Fase 4 + datos virales reales

---

## Decisión clave (sigue vigente)

> Leaderboard + landing con datos reales ANTES de skill pública.
> Sin leaderboard interesante, la instalación no genera loop viral.

---

## AICE Lite
- Módulo embebible en Habla.me como feature CRM
- Evalúa calidad de interacción agente-cliente
- Diferencial competitivo para el SaaS
- Planificado en Fase 4

---

*Roadmap actualizado por Arquitecto AICE — 28 feb 2026*
*Phase 2 decisions locked — spec en PHASE2_SPEC.md*
