/**
 * Team Score: Ownership-Weighted
 *
 * Quadrant determination based on agent + user global scores:
 *   GOOD:         both >= 50 → 50/50
 *   COMPENSATED:  agent >= 50, user < 50 → 100/0 (agent carries)
 *   PROBLEM:      agent < 50, user >= 50 → 0/100 (user carries)
 *   BREAKDOWN:    both < 50 → 50/50
 */

type Quadrant = "GOOD" | "COMPENSATED" | "PROBLEM" | "BREAKDOWN";

const WEIGHTS: Record<Quadrant, { agent: number; user: number }> = {
  GOOD: { agent: 0.5, user: 0.5 },
  COMPENSATED: { agent: 1.0, user: 0.0 },
  PROBLEM: { agent: 0.0, user: 1.0 },
  BREAKDOWN: { agent: 0.5, user: 0.5 },
};

export function determineQuadrant(agentScore: number, userScore: number): Quadrant {
  if (agentScore >= 50 && userScore >= 50) return "GOOD";
  if (agentScore >= 50 && userScore < 50) return "COMPENSATED";
  if (agentScore < 50 && userScore >= 50) return "PROBLEM";
  return "BREAKDOWN";
}

export function computeTeamScore(agentScore: number, userScore: number): number {
  const quadrant = determineQuadrant(agentScore, userScore);
  const w = WEIGHTS[quadrant];
  const team = agentScore * w.agent + userScore * w.user;
  return Math.round(team * 10) / 10;
}
