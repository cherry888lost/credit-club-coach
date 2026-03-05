export type RepRole = 'admin' | 'manager' | 'closer' | 'sdr';
export type RepStatus = 'active' | 'inactive' | 'pending';
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
  clerk_user_id: string;
  email: string;
  name: string;
  role: RepRole;
  status: RepStatus;
  created_at: string;
}

export interface Call {
  id: string;
  org_id: string;
  rep_id: string | null;
  fathom_call_id: string | null;
  title: string | null;
  occurred_at: string | null;
  transcript: string | null;
  recording_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CallScore {
  id: string;
  call_id: string;
  opening_score: number | null;
  discovery_score: number | null;
  rapport_score: number | null;
  objection_handling_score: number | null;
  closing_score: number | null;
  structure_score: number | null;
  product_knowledge_score: number | null;
  ai_summary: string | null;
  ai_summary_short: string | null;
  strengths: string[];
  improvements: string[];
  coaching_recommendation: string | null;
  example_phrase: string | null;
  tone_analysis: Record<string, unknown>;
  product_concepts_mentioned: string[];
  scored_at: string;
}

export interface Flag {
  id: string;
  org_id: string;
  call_id: string;
  type: string;
  note: string | null;
  created_at: string;
}

// Composite types for queries
export interface CallWithScore extends Call {
  call_scores?: CallScore | null;
}

export interface RepWithCalls extends Rep {
  calls?: Call[];
}
