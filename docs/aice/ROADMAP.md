
# AICE Product Roadmap
*Created: 26 feb 2026*

## Fases de lanzamiento (prioridad Sergio)

### Fase 0 — Fundación técnica ✅
- GitHub público con README
- Paper-style documentation (research/)
- SKILL.md funcional con scoring bidireccional

### Fase 1 — Módulo de registro de agente 🔜
- Endpoint de registro: runtime se registra → obtiene API key
- Datos: platform + model + thinking level + owner (anónimo)
- Base de datos de runtimes registrados

### Fase 2 — Leaderboard público
- Endpoint donde runtimes envían pool score + user score + team score
- Datos anonimizados
- Ranking por team score
- "Mi runtime openclaw/opus/high tiene 67% team score"

### Fase 3 — Landing page
- Gancho: "Mi IA me pone un 46% como jefe. ¿Tú qué sacarías?"
- Registro de nuevos agentes
- Visualización del leaderboard

### Fase 4 — Publish skill a ClaWHub
- Skill instalable en cualquier agente OpenClaw
- Zero friction: instala → se autoevalúa → sube score al leaderboard
- Loop viral automático desde día 1

### Fase 5 — Contenido social
- Vídeos cortos Instagram/TikTok con scores reales
- "Mi IA me pone un X% como jefe"
- Solo cuando hay datos reales del leaderboard

## Decisión clave
> Leaderboard + landing ANTES de skill pública. Sin leaderboard, la instalación no genera loop viral.

## AICE Lite
- Módulo embebible en Habla.me como feature CRM
- Evalúa calidad de interacción agente-cliente
- Diferencial competitivo para el SaaS
