export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatSponsorTier, type SponsorTierValue } from '@/lib/sponsor-constants';
import { formatINR, EVENT_NAME, EVENT_VENUE, EVENT_DATE } from '@/lib/constants';
import { PrintButton } from '@/components/PrintButton';

interface PrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function SponsorPrintPage({ params }: PrintPageProps) {
  const { id } = await params;
  const adminClient = createAdminClient();

  const { data: sponsor } = await adminClient
    .from('sponsors')
    .select('*, brought_by_member:members(full_name, group_id, group:groups(name)), payment:payments(*)')
    .eq('id', id)
    .maybeSingle();

  if (!sponsor) {
    notFound();
  }

  const sponsorTier = sponsor.tier || sponsor.sponsor_tier || 'gold_sponsor';
  const sponsorName = sponsor.sponsor_name || sponsor.name || 'Sponsor';

  return (
    <div className="bg-white text-black min-h-screen p-8 print:p-0 font-sans">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">{EVENT_NAME}</h1>
          <p className="text-sm font-semibold text-gray-700">Official Sponsor Voucher & Entitlement</p>
          <p className="text-xs text-gray-500 mt-1">{EVENT_VENUE} • {EVENT_DATE}</p>
        </div>
        <div className="text-right">
          <span className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded">
            {formatSponsorTier(sponsorTier as SponsorTierValue)}
          </span>
          <p className="text-xs text-gray-600 mt-1 font-mono">Issued: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Sponsor Details Card */}
      <div className="border border-gray-300 rounded p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs font-bold uppercase text-gray-500 block">Sponsor / Organization</span>
          <span className="text-xl font-black block mt-0.5">{sponsorName}</span>
          <span className="text-base font-bold text-amber-900 font-mono mt-1 block">
            {formatINR(sponsor.amount || 0)} ({sponsor.status === 'received' ? '✓ Paid' : 'Committed'})
          </span>
          {sponsor.notes && <p className="text-xs text-gray-600 mt-1">{sponsor.notes}</p>}
        </div>

        <div className="space-y-1.5 text-xs">
          <div>
            <span className="font-bold uppercase text-gray-500">Contact Person: </span>
            <span className="font-semibold text-gray-900">{sponsor.contact_name || 'N/A'}</span>
          </div>
          <div>
            <span className="font-bold uppercase text-gray-500">Phone / Email: </span>
            <span className="font-mono">{sponsor.contact_phone || 'N/A'} {sponsor.contact_email && `• ${sponsor.contact_email}`}</span>
          </div>
          <div>
            <span className="font-bold uppercase text-gray-500">Complimentary Passes: </span>
            <span className="font-bold text-gray-900">{sponsor.complimentary_pass_count || 0} Passes</span>
          </div>
          <div>
            <span className="font-bold uppercase text-gray-500">Brought By: </span>
            <span className="font-medium text-gray-900">
              {sponsor.brought_by_member?.full_name 
                ? `${sponsor.brought_by_member.full_name} (${sponsor.brought_by_member.group?.name || ''})`
                : 'Direct / General'}
            </span>
          </div>
          {sponsor.payment?.reference_no && (
            <div>
              <span className="font-bold uppercase text-gray-500">Payment Reference: </span>
              <span className="font-mono font-bold text-gray-900">{sponsor.payment.reference_no} ({sponsor.payment.mode})</span>
            </div>
          )}
        </div>
      </div>

      {/* Complimentary Entitlement Notice */}
      <div className="border border-gray-300 rounded p-4 mb-6 bg-gray-50 text-xs leading-relaxed">
        <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-1">Pass Issuance Instructions</h3>
        <p className="text-gray-600">
          This sponsor is entitled to <strong className="text-gray-900">{sponsor.complimentary_pass_count || 0} complimentary admission passes</strong>.
          Admission passes can be issued digitally via WhatsApp e-Pass or as physical printed passes by the System Admin or Group Admin.
        </p>
      </div>

      {/* Footer Notes */}
      <div className="mt-12 pt-4 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-500">
        <p>This voucher serves as proof of sponsorship contribution to the Public-Access AED project.</p>
        <p>Rotary Club of Aarch City Madras • All Rights Reserved</p>
      </div>

      {/* Print Trigger */}
      <div className="mt-6 text-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
