'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getRecipientCount, sendMassEmail, getQueueStatus } from './actions';
import { Mail, Users, AlertTriangle, Send, Sparkles, Filter } from 'lucide-react';

type EmailClientProps = {
  isSuperAdmin: boolean;
  teamMembers: { id: string; full_name: string; email: string }[];
  userId: string;
};

export function EmailClient({ isSuperAdmin, teamMembers, userId }: EmailClientProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [filters, setFilters] = useState({
    section: 'All',
    tier: 'All',
    paymentStatus: 'All',
    ticketSent: 'All',
    ownerId: 'All'
  });
  
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [queueStats, setQueueStats] = useState<{ queued: number; sent: number; failed: number } | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      setIsLoading(true);
      const count = await getRecipientCount(filters, isSuperAdmin, userId);
      setRecipientCount(count);
      setIsLoading(false);
    };
    fetchCount();
  }, [filters, isSuperAdmin, userId]);

  useEffect(() => {
    const fetchStats = async () => {
      const stats = await getQueueStatus();
      setQueueStats(stats);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!subject || !body) {
      toast.error('Subject and body are required');
      return;
    }
    
    if (recipientCount === 0) {
      toast.error('No recipients match the filters');
      return;
    }

    if (!confirm(`Are you sure you want to queue this email to ${recipientCount} recipients?`)) {
      return;
    }

    setIsSending(true);
    try {
      const result = await sendMassEmail(subject, body, filters, isSuperAdmin, userId);
      toast.success(`Successfully queued ${result.queued} emails`);
      setSubject('');
      setBody('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to queue emails');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-7xl mx-auto pb-12">
      {/* 1. Email Composition Area */}
      <div className="md:col-span-2 flex flex-col gap-6">
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Mail className="w-4 h-4" />
              <span>Broadcast Composer</span>
            </div>
            <CardTitle className="text-base font-bold text-white mt-1">Compose Mass Email</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Send updates, logistics info, or reminders to filtered guest lists.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Subject</label>
              <Input 
                placeholder="Important: Hrudhayam LIVE 2026 Concert Details" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                className="h-10 text-xs bg-[#1A2839] border-[#2A3F55] text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Message Content</label>
              <Textarea 
                placeholder="Write your email announcement here..." 
                rows={10}
                value={body} 
                onChange={(e) => setBody(e.target.value)} 
                className="text-xs bg-[#1A2839] border-[#2A3F55] text-white leading-relaxed font-sans"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-[#0E1724] border-t border-[#223345] px-6 py-4 flex justify-between items-center">
            <div className="text-xs text-slate-400">
              Targeting <strong className="text-amber-400">{recipientCount ?? '...'}</strong> guests with valid emails
            </div>
            <Button 
              onClick={handleSend} 
              disabled={isSending || isLoading || !recipientCount || !subject || !body}
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs shadow-md shadow-amber-950/20"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {isSending ? 'Queueing Broadcast...' : 'Queue Mass Broadcast'}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* 2. Target Audience Filter Sidebar */}
      <div className="flex flex-col gap-6">
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
              <Filter className="w-4 h-4" />
              <span>Recipient Filters</span>
            </div>
            <CardTitle className="text-base font-bold text-white mt-1">Filter Audience</CardTitle>
            <CardDescription className="text-xs text-slate-400">Narrow down recipient scope</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Venue Section</label>
              <Select value={filters.section} onValueChange={(v) => { if (v) setFilters({ ...filters, section: v }); }}>
                <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="All">All Sections (Ground + Balcony)</SelectItem>
                  <SelectItem value="Ground Floor">Ground Floor</SelectItem>
                  <SelectItem value="Balcony">Balcony</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Price Tier</label>
              <Select value={filters.tier} onValueChange={(v) => { if (v) setFilters({ ...filters, tier: v }); }}>
                <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="All">All Tiers</SelectItem>
                  <SelectItem value="5000">₹5,000 Platinum</SelectItem>
                  <SelectItem value="3000">₹3,000 Gold</SelectItem>
                  <SelectItem value="1500">₹1,500 Silver</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Payment Status</label>
              <Select value={filters.paymentStatus} onValueChange={(v) => { if (v) setFilters({ ...filters, paymentStatus: v }); }}>
                <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="All">All Guests</SelectItem>
                  <SelectItem value="received">Paid Only</SelectItem>
                  <SelectItem value="pending">Pending Payment Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Ticket Delivery Status</label>
              <Select value={filters.ticketSent} onValueChange={(v) => { if (v) setFilters({ ...filters, ticketSent: v }); }}>
                <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="sent">Ticket Sent</SelectItem>
                  <SelectItem value="not_sent">Ticket Not Yet Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSuperAdmin && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Team Member Allocation</label>
                <Select value={filters.ownerId} onValueChange={(v) => { if (v) setFilters({ ...filters, ownerId: v }); }}>
                  <SelectTrigger className="h-8 text-xs bg-[#1A2839] border-[#2A3F55] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                    <SelectItem value="All">All Team Members</SelectItem>
                    {teamMembers.map(tm => (
                      <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Queue Live Status */}
        {queueStats && (
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xl overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-2 border-b border-[#223345]">
              <CardTitle className="text-xs font-bold text-slate-300 uppercase tracking-wider">Queue Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                <div className="text-base font-extrabold text-[#E8913A]">{queueStats.queued}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Queued</div>
              </div>
              <div className="p-2 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                <div className="text-base font-extrabold text-emerald-400">{queueStats.sent}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sent</div>
              </div>
              <div className="p-2 bg-[#1A2839] rounded-xl border border-[#2A3F55]">
                <div className="text-base font-extrabold text-red-400">{queueStats.failed}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Failed</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
