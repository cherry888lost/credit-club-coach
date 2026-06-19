export type CollectionRisk = 'Low' | 'Medium' | 'High';
export type CollectionStatus = 'Open' | 'Due Soon' | 'Overdue' | 'Collected' | 'Failed Payment' | 'Refund Risk' | 'Cancelled';

export interface CollectionRecord {
  id: string;
  org_id?: string;
  client_name?: string;
  telegram?: string | null;
  phone_number?: string | null;
  owner_user_id: string | null;
  owner_name?: string | null;
  owner_role?: string | null;
  total_sale_value?: number;
  amount_paid?: number;
  balance_due?: number;
  collection_type?: string;
  sale_date?: string | null;
  balance_due_date?: string | null;
  next_follow_up_date?: string | null;
  risk?: CollectionRisk | string;
  status?: CollectionStatus | string;
  payment_link?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  legacy_google_sheet_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionsUserContext {
  repId: string;
  isAdmin: boolean;
}

export interface CollectionOwnerAssignment {
  ownerUserId: string | null;
}

export interface CollectionInput {
  client_name: string;
  telegram?: string | null;
  phone_number?: string | null;
  owner_user_id?: string | null;
  total_sale_value: number;
  amount_paid: number;
  collection_type: string;
  sale_date?: string | null;
  balance_due_date?: string | null;
  next_follow_up_date?: string | null;
  risk: CollectionRisk;
  status: CollectionStatus;
  payment_link?: string | null;
  notes?: string | null;
}
