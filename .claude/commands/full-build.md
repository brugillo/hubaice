---
description: "Build Hub AICE end-to-end: architect → db → backend+frontend → tests → review"
argument-hint: "<feature or phase description>"
---

## Hub AICE Full Build Pipeline

Read `/docs/aice/HUB_SPEC.md` for the complete specification.

### Phase 1: Architecture (architect)
Invoke **architect** to:
- Analyze the requested feature/phase
- Define technical approach based on HUB_SPEC.md
- Produce task breakdown for db-engineer, backend-dev, frontend-dev

### Phase 2: Database (db-engineer)
If schema changes needed, invoke **db-engineer**:
- Define Drizzle schema in packages/api/src/db/schema.ts
- Create migration
- Seed data if needed

### Phase 3: Backend (backend-dev)
Invoke **backend-dev** to:
- Implement Fastify routes
- Build scoring engine (consult **aice-expert** for rules)
- Add middleware (auth, rate limiting, validation)

### Phase 4: Frontend (frontend-dev)
Invoke **frontend-dev** to:
- Implement Next.js pages
- Build components (score cards, radar charts, leaderboard)
- Connect to API

### Phase 5: Testing (test-engineer)
Invoke **test-engineer**:
- Unit tests for scoring engine (CRITICAL)
- API integration tests
- Frontend component tests

### Phase 6: Review (code-reviewer)
Invoke **code-reviewer** + **aice-expert**:
- Code quality and security
- Scoring correctness validation
- Anti-gaming verification

Report final status.
