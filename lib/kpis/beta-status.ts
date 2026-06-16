export type BetaStatusState =
  | 'verified'
  | 'mostly-verified'
  | 'partially-verified'
  | 'not-fully-verified'
  | 'not-migrated'
  | 'read-only';

export interface BetaStatusItem {
  label: string;
  state: BetaStatusState;
  note: string;
}

export interface Phase2BBetaStatus {
  banner: string;
  productionReady: false;
  bigQueryMode: 'read-only';
  dataSource: string;
  parityItems: BetaStatusItem[];
  guardrails: string[];
  knownLimitations: string[];
}

interface UnsupportedFilterInput {
  team: string;
  teamMember: string;
  role: string;
}

export function getPhase2BBetaStatus(): Phase2BBetaStatus {
  return {
    banner: 'Internal merged dashboard beta. Read-only. Not approved as final production replacement. Old KPI tracker remains source of truth.',
    productionReady: false,
    bigQueryMode: 'read-only',
    dataSource: 'Sanitized preview model + approved read-only KPI query layer only',
    parityItems: [
      { label: 'Closer parity', state: 'mostly-verified', note: 'Closer A captured values matched after confirmed legacy display formatting.' },
      { label: 'Formatting parity', state: 'verified', note: 'Legacy Python f-string rounding replicated in lib/kpis/formatting.ts for tested values.' },
      { label: 'SDR parity', state: 'not-fully-verified', note: 'Manual SDR dashboard parity capture remains incomplete.' },
      { label: 'Business Performance parity', state: 'not-fully-verified', note: 'Business Performance manual capture/assertion tests remain incomplete.' },
      { label: 'Refund/ad-spend parity', state: 'not-fully-verified', note: 'Refund, CAC, CPL, ROAS, and zero-ad-spend behavior still need final parity evidence.' },
      { label: 'Historical role parity', state: 'not-fully-verified', note: 'Historical User A role/filter checks remain incomplete.' },
      { label: 'Admin/write workflows', state: 'not-migrated', note: 'No admin input migration or BigQuery write strategy has been approved.' },
    ],
    guardrails: [
      'Feature flag FEATURE_MERGED_KPI_DASHBOARD must be true to view the beta route.',
      'Existing /dashboard route remains the sales tracker default.',
      'KPI values are read-only and formulas stay in lib/kpis helpers.',
      'BigQuery access is SELECT/WITH only through the approved read-only guard.',
      'Old KPI tracker and Cloud Run service remain untouched.',
    ],
    knownLimitations: [
      'Team mapping is not final; unsupported team filters must show warnings instead of final values.',
      'Remaining parity gaps are accepted for internal beta only and remain launch blockers.',
      'Admin input workflows are intentionally absent.',
      'Security remediation is not complete for production launch.',
    ],
  };
}

export function getUnsupportedFilterWarning({ team, teamMember, role }: UnsupportedFilterInput): string | null {
  if (team !== 'All') {
    return `The selected team filter (${team}) is unsupported until team-member mapping is confirmed; no KPI value should be treated as final for this scope.`;
  }

  if (role === 'all' && teamMember !== 'All') {
    return `The selected member filter (${teamMember}) is person-level while role is All; confirm old-dashboard scope before treating values as final.`;
  }

  return null;
}

export function getUserAcceptanceChecklist(): string[] {
  return [
    'Review Sales Tracker section without expecting changed sales formulas.',
    'Review KPI cards as read-only preview values only.',
    'Confirm selected filters match the intended old-dashboard scope.',
    'Flag any value where old-dashboard output does not visually match the beta dashboard.',
    'Do not use this beta as the production source of truth.',
  ];
}

export function getLaunchReadinessChecklist(): string[] {
  return [
    'Complete SDR dashboard parity.',
    'Complete Business Performance parity.',
    'Complete refund/ad-spend parity, including zero-ad-spend behavior.',
    'Complete Historical User A role-check parity.',
    'Complete assertion-level old-vs-new parity tests.',
    'Complete final user acceptance testing.',
    'Approve BigQuery write/admin input strategy before any write workflow exists.',
    'Implement production security remediation plan.',
    'Approve rollback and cutover plan explicitly.',
  ];
}
