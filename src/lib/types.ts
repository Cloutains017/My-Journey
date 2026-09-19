export interface Trip {
  id: string;
  title: string;
  slug: string;
  date: string;
  end_date: string | null;
  location: string;
  city_name: string | null;
  latitude: number;
  longitude: number;
  cover_image: string | null;
  content: string | null;
  rating: number;
  created_at: string;
  photos?: Photo[];
  agreement_votes?: AgreementVote[];
  desire_votes?: DesireVote[];
}

export interface Photo {
  id: string;
  trip_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface AgreementVote {
  id: string;
  trip_id: string;
  nickname: string;
  agreement: number;
  comment: string | null;
  created_at: string;
}

export interface DesireVote {
  id: string;
  trip_id: string;
  nickname: string;
  desire_level: number;
  comment: string | null;
  created_at: string;
}

/** Format date range for display: "2026-01-15 → 2026-01-20" or just "2026-01-15" */
export function formatDateRange(date: string, endDate?: string | null): string {
  if (!endDate || endDate === date) return date;
  return `${date} → ${endDate}`;
}

export const RATING_LABELS: Record<number, string> = {
  1: "拉完了",
  2: "npc",
  3: "人上人",
  4: "顶级",
  5: "夯",
};

export const AGREEMENT_LABELS: Record<number, string> = {
  1: "非常认同",
  2: "认同",
  3: "一般",
  4: "不认同",
  5: "非常不认同",
};

export const DESIRE_LABELS: Record<number, string> = {
  1: "心驰神往",
  2: "颇为向往",
  3: "尚在考虑",
  4: "兴致平平",
  5: "永不踏足",
};

export interface Milestone {
  id: string;
  title: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD
  icon: "school" | "middle" | "high" | "uni" | "grad";
  stage?: string; // overrides the default stage label derived from icon
}
