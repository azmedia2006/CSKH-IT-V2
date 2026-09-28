export enum Priority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
}

export enum TicketStatus {
  NEW = 'NEW',
  PROCESSING = 'PROCESSING',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface Ticket {
  id: string;
  ticket_code: string;
  title: string;
  description: string;
  category_id: string;
  category_name?: string;
  requester_name?: string;
  priority: Priority;
  ai_suggested_priority?: Priority;
  ai_confidence_score?: number;
  status: TicketStatus;
  requester_id: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string | null;
  previous_agent_id?: string | null;
  previous_agent_name?: string | null;
  
  // Support level & escalation
  support_level?: 'L1' | 'L2' | string;
  risk_flag?: 'NORMAL' | 'HIGH' | 'CHECK_REQUIRED' | string;
  sentiment?: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' | string;
  sentiment_score?: number;
  sentiment_reason?: string;
  sentiment_evidence?: string;
  escalation_status?: 'NONE' | 'AUTO_ESCALATED' | 'MANUAL_ESCALATED' | 'L2_WAITING' | string;
  escalated_at?: string;
  escalation_reason?: string;

  first_response_due_at?: string;
  first_responded_at?: string;
  resolution_due_at?: string;
  resolved_at?: string;
  closed_at?: string;
  is_escalated?: boolean;
  ai_summary?: string | null;
  ai_suggested_category?: string | null;
  ai_triage_rationale?: string | null;
  ai_missing_info?: string | null;
  likely_exceeds_l1?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  new_tickets: number;
  processing_tickets: number;
  sla_warning_tickets: number;
  sla_overdue_tickets: number;
}
