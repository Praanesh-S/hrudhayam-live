import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventSummaryMetrics } from '@/lib/band-utils';

/**
 * Daily Summary Digest Endpoint (§19.4).
 * Computes daily sales count, total collected today, cumulative fill %, and AED stations funded.
 * Can be called by Vercel cron or on demand from admin dashboard.
 */
export async function GET(req: Request) {
  try {
    const adminClient = createAdminClient();

    // Release any expired holds (§19.7)
    await adminClient.rpc('release_expired_holds');

    // Fetch overall metrics
    const metrics = await fetchEventSummaryMetrics(adminClient);

    // Calculate today's sales (since 00:00 IST today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayPasses } = await adminClient
      .from('passes')
      .select('id, payments(amount, status)')
      .gt('created_at', todayStart.toISOString())
      .neq('status', 'cancelled');

    const todayCount = todayPasses?.length || 0;
    let todayRevenue = 0;
    for (const p of todayPasses || []) {
      const pays = (p as any).payments;
      if (Array.isArray(pays)) {
        for (const pay of pays) {
          if (pay.status === 'received') todayRevenue += pay.amount || 0;
        }
      }
    }

    const occupancyPercent = metrics.totalCapacity > 0
      ? Math.round((metrics.totalSold / metrics.totalCapacity) * 100)
      : 0;

    const digestMessage = `📊 *HRUDHAYAM LIVE 2026 — Daily Progress Digest*
---------------------------------------
🗓️ Date: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}

🎯 *Today's Highlights:*
• New Passes Issued Today: *${todayCount}*
• Funds Collected Today: *₹${todayRevenue.toLocaleString('en-IN')}*

📈 *Overall Campaign Status:*
• Total Passes Sold: *${metrics.totalSold} / ${metrics.totalCapacity}* (${occupancyPercent}% Fill)
• Remaining Available Seats: *${metrics.totalRemaining}*
• Total Net Funds Raised: *₹${metrics.totalRaised.toLocaleString('en-IN')}*
• Pending Commitments: *₹${metrics.totalPending.toLocaleString('en-IN')}*

❤️ *Public-Access AED Stations:*
• Fully Funded: *${metrics.fundedStations} Stations* (Target: ${metrics.targetStations})
• Progress to Next Station: *${metrics.partialStationPercent}%*

Thank you for your tireless dedication to this life-saving cause!`;

    return NextResponse.json({
      success: true,
      todayCount,
      todayRevenue,
      totalRaised: metrics.totalRaised,
      occupancyPercent,
      fundedStations: metrics.fundedStations,
      digestMessage,
    });
  } catch (err: any) {
    console.error('Digest error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate digest' }, { status: 500 });
  }
}
