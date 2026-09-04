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
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!sponsor) {
    notFound();
  }

  // Fetch tagged sales
  const { data: sales } = await adminClient
    .from('sales')
    .select('*, band:bands(name, standard_price)')
    .eq('sponsor_id', id)
    .eq('cancelled', false)
    .order('created_at');

  const taggedSales = sales || [];

  return (
    <div className="bg-white text-black min-h-screen p-8 print:p-0 font-sans">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">{EVENT_NAME}</h1>
          <p className="text-sm font-semibold text-gray-700">Official Sponsor Pass Allocation Voucher</p>
          <p className="text-xs text-gray-500 mt-1">{EVENT_VENUE} • {EVENT_DATE}</p>
        </div>
        <div className="text-right">
          <span className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded">
            {formatSponsorTier(sponsor.sponsor_tier as SponsorTierValue)}
          </span>
          <p className="text-xs text-gray-600 mt-1 font-mono">Issued: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Sponsor Details Card */}
      <div className="border border-gray-300 rounded p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs font-bold uppercase text-gray-500 block">Sponsor / Organization</span>
          <span className="text-lg font-black block">{sponsor.name}</span>
          {sponsor.notes && <p className="text-xs text-gray-600 mt-1">{sponsor.notes}</p>}
        </div>

        <div className="space-y-1">
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">Contact Person: </span>
            <span className="font-semibold">{sponsor.contact_name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">Phone / Email: </span>
            <span className="font-mono text-xs">{sponsor.contact_phone || 'N/A'} {sponsor.contact_email && `• ${sponsor.contact_email}`}</span>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-gray-500">Complimentary Entitlement: </span>
            <span className="font-bold">{sponsor.complimentary_pass_count} Passes</span>
          </div>
        </div>
      </div>

      {/* Allocated Passes Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Allocated Admission Passes ({taggedSales.length} Passes)
          </h3>
          <span className="text-xs text-gray-500">Admit One Guest Per Pass</span>
        </div>

        <table className="w-full border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-400">
              <th className="border border-gray-400 p-2 text-left">#</th>
              <th className="border border-gray-400 p-2 text-left">Pass Code</th>
              <th className="border border-gray-400 p-2 text-left">Admission Band</th>
              <th className="border border-gray-400 p-2 text-left">Passholder Name</th>
              <th className="border border-gray-400 p-2 text-left">Phone</th>
              <th className="border border-gray-400 p-2 text-left">Issuance Channel</th>
              <th className="border border-gray-400 p-2 text-left">Gate Admission</th>
            </tr>
          </thead>
          <tbody>
            {taggedSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500 italic">
                  No passes have been tagged to this sponsor yet.
                </td>
              </tr>
            ) : (
              taggedSales.map((sale, index) => (
                <tr key={sale.id} className="border-b border-gray-300">
                  <td className="border border-gray-400 p-2 font-mono">{index + 1}</td>
                  <td className="border border-gray-400 p-2 font-bold font-mono text-amber-900">{sale.pass_code}</td>
                  <td className="border border-gray-400 p-2 font-semibold">{sale.band?.name || 'Seating Band'}</td>
                  <td className="border border-gray-400 p-2 font-bold">{sale.donor_name}</td>
                  <td className="border border-gray-400 p-2 font-mono">{sale.donor_phone}</td>
                  <td className="border border-gray-400 p-2 uppercase font-mono text-[10px]">
                    {sale.issuance_type || 'Unissued'}
                  </td>
                  <td className="border border-gray-400 p-2">
                    {sale.checked_in ? '✓ Checked In' : 'Valid for Entry'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Notes */}
      <div className="mt-8 pt-4 border-t border-gray-300 flex items-center justify-between text-[10px] text-gray-500">
        <p>This voucher is strictly non-transferable and subject to gate verification.</p>
        <p>Rotary Club of Aarch City Madras • Fundraiser for Public-Access AEDs</p>
      </div>

      {/* Print Trigger script */}
      <div className="mt-6 text-center print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
