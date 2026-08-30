export type FailMode = 'closed' | 'open';

export type PolicyInput = {
  killed: boolean;
  failMode: FailMode;
  monthlySpentUsd: number;
  dailySpentUsd: number;
  monthlyBudgetUsd: number;
  dailyBudgetUsd: number;
  trapHit: boolean;
  estimatedNextUsd: number;
};

export type PolicyDecision = {
  allow: boolean;
  status: 200 | 402 | 429 | 451;
  code: 'ok' | 'KILL' | 'BUDGET' | 'DAILY_CAP' | 'TRAP';
  message: string;
};

export function evaluatePolicy(p: PolicyInput): PolicyDecision {
  if (p.trapHit) {
    return { allow: false, status: 451, code: 'TRAP', message: 'Honeypot key used — request blocked' };
  }
  if (p.killed) {
    return { allow: false, status: 402, code: 'KILL', message: 'Kill switch armed — proxy blocked' };
  }
  const nextMonth = p.monthlySpentUsd + p.estimatedNextUsd;
  if (p.monthlyBudgetUsd > 0 && nextMonth > p.monthlyBudgetUsd) {
    if (p.failMode === 'open') {
      return { allow: true, status: 200, code: 'ok', message: 'over monthly budget but fail-open' };
    }
    return { allow: false, status: 402, code: 'BUDGET', message: 'Monthly budget cap — fail-closed' };
  }
  const nextDay = p.dailySpentUsd + p.estimatedNextUsd;
  if (p.dailyBudgetUsd > 0 && nextDay > p.dailyBudgetUsd) {
    if (p.failMode === 'open') {
      return { allow: true, status: 200, code: 'ok', message: 'over daily cap but fail-open' };
    }
    return { allow: false, status: 429, code: 'DAILY_CAP', message: 'Daily cap — fail-closed' };
  }
  return { allow: true, status: 200, code: 'ok', message: 'pass' };
}

export function looksLikeTrapKey(auth: string): boolean {
  return /sk_test_trap_|sk-trap_|trap_honeypot/i.test(auth);
}
