// ──────────────────────────────────────────────
// Hrudhayam — Sponsor Constants & Configuration
// ──────────────────────────────────────────────

export type SponsorTierValue =
  | 'title_sponsor'
  | 'powered_by'
  | 'co_sponsor'
  | 'platinum_sponsor'
  | 'diamond_sponsor'
  | 'gold_sponsor'
  | 'special_sponsor'
  | 'other_sponsor'
  | 'event_supporters';

export const SPONSOR_TIERS: {
  value: SponsorTierValue;
  label: string;
  amount: number;
  color: string;
}[] = [
  { value: 'title_sponsor', label: 'Title Sponsor', amount: 1000000, color: '#FFD700' },
  { value: 'powered_by', label: 'Powered By Sponsor', amount: 750000, color: '#C0C0C0' },
  { value: 'co_sponsor', label: 'Co-Sponsor', amount: 500000, color: '#CD7F32' },
  { value: 'platinum_sponsor', label: 'Platinum Sponsor', amount: 300000, color: '#E5E4E2' },
  { value: 'diamond_sponsor', label: 'Diamond Sponsor', amount: 200000, color: '#B9F2FF' },
  { value: 'gold_sponsor', label: 'Gold Sponsor', amount: 100000, color: '#B8860B' },
  { value: 'special_sponsor', label: 'Special Sponsor', amount: 75000, color: '#9B59B6' },
  { value: 'other_sponsor', label: 'Other Sponsor', amount: 50000, color: '#0D9488' },
  { value: 'event_supporters', label: 'Event Supporters', amount: 25000, color: '#475569' },
];

export const SPONSOR_TIER_MAP: Record<string, { label: string; amount: number; color: string }> =
  Object.fromEntries(
    SPONSOR_TIERS.map((t) => [t.value, { label: t.label, amount: t.amount, color: t.color }])
  );

export function formatSponsorTier(tier: SponsorTierValue): string {
  return SPONSOR_TIER_MAP[tier]?.label ?? tier;
}

export function getSponsorTierColor(tier: SponsorTierValue): string {
  return SPONSOR_TIER_MAP[tier]?.color ?? '#475569';
}
