import type { KpiFilters, KpiRole, KpiSummaryRow } from './types';

export type KpiDashboardSection = 'overview' | 'sales' | 'kpis' | 'closers' | 'sdrs' | 'business-performance';
export type KpiTeamScope = 'All' | 'Unassigned';

export interface MergedPreviewFilters {
  startDate: string;
  endDate: string;
  role: KpiRole | 'all';
  team: KpiTeamScope;
  teamMember: 'All' | string;
  section: KpiDashboardSection;
}

const DEFAULT_START_DATE = '2026-06-01';
const DEFAULT_END_DATE = '2026-06-14';

const validRoles = new Set(['all', 'closer', 'sdr']);
const validSections = new Set(['overview', 'sales', 'kpis', 'closers', 'sdrs', 'business-performance']);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validIsoDate(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export function normalizeMergedPreviewFilters(
  searchParams: Record<string, string | string[] | undefined> = {},
): MergedPreviewFilters {
  const rawRole = firstParam(searchParams.role);
  const rawSection = firstParam(searchParams.section);
  const rawTeam = firstParam(searchParams.team);
  const rawTeamMember = firstParam(searchParams.teamMember);

  return {
    startDate: validIsoDate(firstParam(searchParams.startDate), DEFAULT_START_DATE),
    endDate: validIsoDate(firstParam(searchParams.endDate), DEFAULT_END_DATE),
    role: validRoles.has(rawRole ?? '') ? (rawRole as MergedPreviewFilters['role']) : 'all',
    team: rawTeam === 'Unassigned' ? 'Unassigned' : 'All',
    teamMember: rawTeamMember && rawTeamMember.trim() ? rawTeamMember.trim() : 'All',
    section: validSections.has(rawSection ?? '') ? (rawSection as KpiDashboardSection) : 'overview',
  };
}

export function filtersToKpiQuery(filters: MergedPreviewFilters, role?: KpiRole): KpiFilters {
  const teamMembers = filters.teamMember === 'All' ? 'All' : [filters.teamMember];

  return {
    startDate: filters.startDate,
    endDate: filters.endDate,
    role: role ?? (filters.role === 'all' ? undefined : filters.role),
    teamMembers,
  };
}

export function filterKpiRows(rows: KpiSummaryRow[], filters: MergedPreviewFilters, role?: KpiRole): KpiSummaryRow[] {
  return rows.filter((row) => {
    if (row.kpiDate < filters.startDate || row.kpiDate > filters.endDate) return false;
    if (role && row.role !== role) return false;
    if (!role && filters.role !== 'all' && row.role !== filters.role) return false;
    if (filters.teamMember !== 'All' && row.teamMember !== filters.teamMember) return false;

    // Team mapping is a known Phase 2A preview gap. The source rows only carry team_member + role.
    // Keep scope explicit rather than silently mixing unknown team membership.
    if (filters.team !== 'All') return false;

    return true;
  });
}

export function getAvailableKpiMembers(rows: KpiSummaryRow[], role?: KpiRole): string[] {
  return [...new Set(rows.filter((row) => !role || row.role === role).map((row) => row.teamMember))].sort();
}
