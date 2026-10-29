export const STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export interface Job {
  id: number;
  source: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  salary: string | null;
  posted_at: string | null;
  tags: string[];
  skills: string[];
  snippet: string;
  score: number | null;
  matched: string[];
  missing: string[];
  status: Status | null;
}

export interface JobDetail extends Job {
  description: string;
}

export interface JobList {
  total: number;
  items: Job[];
  demo_available: boolean;
}

export interface Application {
  id: number;
  status: Status;
  notes: string;
  applied_at: string | null;
  updated_at: string;
  job: Job;
}

export interface Profile {
  resume_text: string;
  roles: string;
  location: string;
  skills: string[];
  ready: boolean;
}

export interface Analysis {
  summary: string;
  strengths: string[];
  gaps: string[];
  tips: string[];
  source: "claude" | "heuristic";
}

export interface Stats {
  funnel: { status: Status; count: number }[];
  weekly: { week: string; count: number }[];
  skill_gap: { skill: string; jobs: number }[];
  avg_top_match: number | null;
  response_rate: number | null;
  tracked: number;
  total_jobs: number;
}
