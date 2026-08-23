import { NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/email';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authHeader = req.headers.get('Authorization');
  const cronSecret = url.searchParams.get('token');
  
  const validSecret = process.env.CRON_SECRET;
  
  if (!validSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  
  const authMatched = authHeader === `Bearer ${validSecret}` || cronSecret === validSecret;
  
  if (!authMatched) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const stats = await processEmailQueue();
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    console.error('Cron processing error:', error);
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 });
  }
}
