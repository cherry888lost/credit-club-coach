export type RepRole = 'admin' | 'closer' | 'sdr';
export type RepStatus = 'active' | 'inactive';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Rep {
  id: string;
  org_id: string;
  clerk_user_id: string | null;
  email: string;
  fathom_email: string | null;
  name: string;
  role: RepRole;
  status: RepStatus;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: string;
  org_id: string;
  rep_id: string | null;
  fathom_call_id: string | null;
  title: string | null;
  occurred_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  video_url: string | null;
  host_email: string | null;
  participants: string[] | null;
  metadata: Record<string, unknown>;
  source: 'fathom' | 'demo' | 'manual';
  created_at: string;
}

// Closer scoring rubric
export interface CloserScore {
  opening_score: number | null;
  rapport_score: number | null;
  discovery_score: number | null;
  credit_expertise_score: number | null;
  value_explanation_score: number | null;
  objection_handling_score: number | null;
  close_attempt_score: number | null;
  structure_score: number | null;
  product_knowledge_score: number | null;
}

// SDR scoring rubric
export interface SDRScore {
  opening_score: number | null;
  rapport_score: number | null;
  qualification_score: number | null;
  curiosity_probing_score: number | null;
  agenda_control_score: number | null;
  booking_quality_score: number | null;
  urgency_score: number | null;
  structure_score: number | null;
  communication_clarity_score: number | null;
}

export interface CallScore extends Partial<CloserScore>, Partial<SDRScore> {
  id: string;
  call_id: string;
  rubric_type: 'closer' | 'sdr' | 'generic';
  overall_score: number | null;
  ai_summary: string | null;
  strengths: string[];
  improvements: string[];
  coaching_recommendation: string | null;
  scored_at: string;
}

export interface Flag {
  id: string;
  org_id: string;
  call_id: string;
  type: 'coaching_needed' | 'quality_issue' | 'celebration';
  note: string | null;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  org_id: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'success' | 'error' | 'pending';
  error_message: string | null;
  created_at: string;
}

// Composite types for queries
export interface CallWithDetails extends Call {
  call_scores?: CallScore | null;
  reps?: { name: string; role: RepRole } | null;
  flags?: { type: string; note: string }[];
}

export interface RepWithStats extends Rep {
  call_count: number;
  avg_score: number | null;
  flagged_count: number;
  last_call_at: string | null;
}
