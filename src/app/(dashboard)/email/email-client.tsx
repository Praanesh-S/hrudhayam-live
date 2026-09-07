'use client';

import { useState, useMemo } from 'react';
import { AuthUser } from '@/lib/auth/session';
import { logWhatsAppCampaign } from './actions';
import { formatWhatsAppPhone, getWhatsAppUrl } from '@/lib/whatsapp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Copy, 
  Send, 
  Check, 
  Users, 
  Ticket, 
  ExternalLink, 
  Sparkles, 
  History, 
  Filter, 
  Smartphone,
  Info,
  CheckCircle2,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppHubClientProps {
  templates: any[];
  members: any[];
  groups: any[];
  bands: any[];
  passes: any[];
  recentCampaigns: any[];
  currentUser: AuthUser;
  isSuperAdmin: boolean;
}

export function WhatsAppHubClient({
  templates,
  members,
  groups,
  bands,
  passes,
  recentCampaigns: initialCampaigns,
  currentUser,
  isSuperAdmin,
}: WhatsAppHubClientProps) {
  // Navigation tabs: 'broadcast' | 'click_to_send' | 'history'
  const [activeTab, setActiveTab] = useState<'broadcast' | 'click_to_send' | 'history'>('broadcast');

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates.length > 0 ? templates[0].id : ''
  );
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;

  // Custom / Edited message text
  const [messageBody, setMessageBody] = useState<string>(
    currentTemplate?.body || ''
  );

  // When template selection changes, update message body
  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplateId(tpl.id);
    setMessageBody(tpl.body);
  };

  // Audience State
  const [audienceType, setAudienceType] = useState<
    'all_members' | 'team_members' | 'all_donors' | 'donors_by_band' | 'donors_by_row' | 'custom'
  >('all_donors');

  const [selectedGroupId, setSelectedGroupId] = useState<number>(
    currentUser.groupId || 1
  );
  const [selectedBandId, setSelectedBandId] = useState<string>('band_5000');
  const [selectedRow, setSelectedRow] = useState<string>('');
  const [customNumbersInput, setCustomNumbersInput] = useState<string>('');

  // Copy buttons state
  const [copiedNumbers, setCopiedNumbers] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Click-to-send tracking
  const [sentRecipientIds, setSentRecipientIds] = useState<Set<string>>(new Set());
  const [recipientSearch, setRecipientSearch] = useState<string>('');

  // Campaigns list
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns);
  const [isLoggingCampaign, setIsLoggingCampaign] = useState<boolean>(false);

  // Available unique rows from passes
  const availableRows = useMemo(() => {
    const rowsSet = new Set<string>();
    for (const p of passes) {
      if (p.row_label) rowsSet.add(p.row_label);
    }
    return Array.from(rowsSet).sort();
  }, [passes]);

  // Compute resolved audience recipient list
  const recipients = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      phone: string;
      cleanPhone: string;
      meta: string;
      band?: string;
      row?: string;
      serial?: string;
      group?: string;
    }> = [];

    if (audienceType === 'all_members') {
      for (const m of members) {
        const raw = m.phone_e164 || m.phone_raw || '';
        const clean = formatWhatsAppPhone(raw);
        if (clean) {
          list.push({
            id: `member-${m.id}`,
            name: m.full_name,
            phone: raw,
            cleanPhone: clean,
            meta: m.groups?.name || `Team ${m.group_id}`,
            group: m.groups?.name || `Team ${m.group_id}`,
          });
        }
      }
    } else if (audienceType === 'team_members') {
      const filtered = members.filter((m) => m.group_id === Number(selectedGroupId));
      for (const m of filtered) {
        const raw = m.phone_e164 || m.phone_raw || '';
        const clean = formatWhatsAppPhone(raw);
        if (clean) {
          list.push({
            id: `member-${m.id}`,
            name: m.full_name,
            phone: raw,
            cleanPhone: clean,
            meta: m.groups?.name || `Team ${m.group_id}`,
            group: m.groups?.name || `Team ${m.group_id}`,
          });
        }
      }
    } else if (audienceType === 'all_donors') {
      // Group passes by donor phone
      const donorMap = new Map<string, typeof passes>();
      for (const p of passes) {
        if (!p.donor_phone) continue;
        const clean = formatWhatsAppPhone(p.donor_phone);
        if (!clean) continue;
        const cur = donorMap.get(clean) || [];
        cur.push(p);
        donorMap.set(clean, cur);
      }

      for (const [clean, donorPasses] of donorMap.entries()) {
        const first = donorPasses[0];
        const serials = donorPasses.map((p) => p.physical_serial || p.serial_no || p.pass_code).filter(Boolean);
        list.push({
          id: `donor-${clean}`,
          name: first.donor_name || 'Donor',
          phone: first.donor_phone,
          cleanPhone: clean,
          meta: `${donorPasses.length} pass${donorPasses.length > 1 ? 'es' : ''} (${first.bands?.label || 'Pass'})`,
          band: first.bands?.label || 'General',
          row: first.row_label || 'Allocated',
          serial: serials.join(', '),
          group: first.seller?.groups?.name || 'Rotary Club of Madras',
        });
      }
    } else if (audienceType === 'donors_by_band') {
      const filteredPasses = passes.filter((p) => p.band_id === selectedBandId);
      const donorMap = new Map<string, typeof passes>();
      for (const p of filteredPasses) {
        if (!p.donor_phone) continue;
        const clean = formatWhatsAppPhone(p.donor_phone);
        if (!clean) continue;
        const cur = donorMap.get(clean) || [];
        cur.push(p);
        donorMap.set(clean, cur);
      }

      for (const [clean, donorPasses] of donorMap.entries()) {
        const first = donorPasses[0];
        const serials = donorPasses.map((p) => p.physical_serial || p.serial_no || p.pass_code).filter(Boolean);
        list.push({
          id: `donor-${clean}`,
          name: first.donor_name || 'Donor',
          phone: first.donor_phone,
          cleanPhone: clean,
          meta: `${donorPasses.length} pass${donorPasses.length > 1 ? 'es' : ''} (${first.bands?.label})`,
          band: first.bands?.label || 'General',
          row: first.row_label || 'Allocated',
          serial: serials.join(', '),
          group: first.seller?.groups?.name || 'Rotary Club of Madras',
        });
      }
    } else if (audienceType === 'donors_by_row') {
      const filteredPasses = passes.filter((p) => p.row_label === selectedRow);
      const donorMap = new Map<string, typeof passes>();
      for (const p of filteredPasses) {
        if (!p.donor_phone) continue;
        const clean = formatWhatsAppPhone(p.donor_phone);
        if (!clean) continue;
        const cur = donorMap.get(clean) || [];
        cur.push(p);
        donorMap.set(clean, cur);
      }

      for (const [clean, donorPasses] of donorMap.entries()) {
        const first = donorPasses[0];
        const serials = donorPasses.map((p) => p.physical_serial || p.serial_no || p.pass_code).filter(Boolean);
        list.push({
          id: `donor-${clean}`,
          name: first.donor_name || 'Donor',
          phone: first.donor_phone,
          cleanPhone: clean,
          meta: `Row ${first.row_label} · ${donorPasses.length} pass${donorPasses.length > 1 ? 'es' : ''}`,
          band: first.bands?.label || 'General',
          row: first.row_label || '',
          serial: serials.join(', '),
          group: first.seller?.groups?.name || 'Rotary Club of Madras',
        });
      }
    } else if (audienceType === 'custom') {
      const rawNumbers = customNumbersInput.split(/[\n,;]+/);
      const seen = new Set<string>();
      for (const raw of rawNumbers) {
        const clean = formatWhatsAppPhone(raw.trim());
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          list.push({
            id: `custom-${clean}`,
            name: 'Guest',
            phone: raw.trim(),
            cleanPhone: clean,
            meta: 'Custom number',
            group: 'Rotary Club of Madras',
          });
        }
      }
    }

    // Deduplicate by cleanPhone
    const uniqueMap = new Map<string, typeof list[0]>();
    for (const item of list) {
      if (!uniqueMap.has(item.cleanPhone)) {
        uniqueMap.set(item.cleanPhone, item);
      }
    }
    return Array.from(uniqueMap.values());
  }, [
    audienceType,
    members,
    passes,
    selectedGroupId,
    selectedBandId,
    selectedRow,
    customNumbersInput,
  ]);

  // Clean comma-separated phone numbers string for Broadcast List
  const formattedBroadcastNumbers = useMemo(() => {
    return recipients.map((r) => r.cleanPhone).join(', ');
  }, [recipients]);

  // Substitute tags for sample preview or individual recipient
  const renderMessageForRecipient = (r?: typeof recipients[0]) => {
    let text = messageBody;
    const donorName = r?.name || '{name}';
    const bandLabel = r?.band || '{band}';
    const rowLabel = r?.row ? `Row ${r.row}` : '{row}';
    const serialNo = r?.serial || '{serial}';
    const groupName = r?.group || 'Team 1';

    text = text.replace(/{name}|{{name}}|{{donor_name}}/g, donorName);
    text = text.replace(/{band}|{{band}}|{{band_label}}/g, bandLabel);
    text = text.replace(/{row}|{{row}}|{{seat_details}}/g, rowLabel);
    text = text.replace(/{serial}|{{serial}}|{{serial_no}}/g, serialNo);
    text = text.replace(/{group}|{{group}}/g, groupName);
    text = text.replace(/{{event_date}}/g, 'Sunday, 22 March 2026');
    text = text.replace(/{{venue}}/g, 'The Music Academy, Madras');
    return text;
  };

  // Sample rendered preview
  const previewMessage = useMemo(() => {
    return renderMessageForRecipient(recipients[0]);
  }, [messageBody, recipients]);

  // Insert merge tag into textarea
  const handleInsertTag = (tag: string) => {
    setMessageBody((prev) => prev + tag);
  };

  // Copy Numbers
  const handleCopyNumbers = async () => {
    if (!formattedBroadcastNumbers) {
      toast.error('No recipients to copy.');
      return;
    }
    await navigator.clipboard.writeText(formattedBroadcastNumbers);
    setCopiedNumbers(true);
    toast.success(`Copied ${recipients.length} phone numbers to clipboard!`);
    setTimeout(() => setCopiedNumbers(false), 3000);
  };

  // Copy Message Text
  const handleCopyMessage = async () => {
    if (!previewMessage) {
      toast.error('No message text to copy.');
      return;
    }
    await navigator.clipboard.writeText(previewMessage);
    setCopiedMessage(true);
    toast.success('Message copied to clipboard!');
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  // Log Campaign
  const handleLogCampaign = async (method: 'broadcast_list' | 'click_to_send') => {
    if (recipients.length === 0) {
      toast.error('No recipients selected.');
      return;
    }
    setIsLoggingCampaign(true);
    try {
      const res = await logWhatsAppCampaign({
        templateId: selectedTemplateId || null,
        body: messageBody,
        audienceType,
        audienceFilter:
          audienceType === 'team_members'
            ? `Team ${selectedGroupId}`
            : audienceType === 'donors_by_band'
            ? selectedBandId
            : audienceType === 'donors_by_row'
            ? selectedRow
            : null,
        recipientCount: recipients.length,
        method,
      });

      if (res.success && res.campaign) {
        toast.success(`Campaign logged successfully (${recipients.length} recipients)!`);
        setCampaigns((prev) => [res.campaign, ...prev]);
      } else {
        toast.error(res.error || 'Failed to log campaign.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error logging campaign.');
    } finally {
      setIsLoggingCampaign(false);
    }
  };

  // Filtered click-to-send recipients
  const filteredRecipients = useMemo(() => {
    if (!recipientSearch.trim()) return recipients;
    const q = recipientSearch.toLowerCase();
    return recipients.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(q) || r.meta.toLowerCase().includes(q)
    );
  }, [recipients, recipientSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-emerald-400" />
          WhatsApp Communications Hub
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          100% Free Broadcast Lists & 1-Click <code className="text-emerald-400 font-mono">wa.me</code> Messaging — Zero Meta API Fees
        </p>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={cn(
            "px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2",
            activeTab === 'broadcast'
              ? "bg-[#E58327] text-slate-950 shadow-amber-950/40"
              : "bg-[#102030] text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Broadcast List Generator (Free)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('click_to_send')}
          className={cn(
            "px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm",
            activeTab === 'click_to_send'
              ? "bg-[#E58327] text-slate-950 shadow-amber-950/40"
              : "bg-[#102030] text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Send className="w-4 h-4" />
          <span>Click-to-Send (wa.me 1-Click)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-400 bg-[#102030] border border-slate-800 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-1.5 ml-auto",
            activeTab === 'history' && "border-amber-500 text-white"
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span>Campaign History ({campaigns.length})</span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Audience & Template Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: 1. SELECT AUDIENCE */}
          <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-500" />
                1. Select Audience
              </h2>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
                {recipients.length} Recipient{recipients.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'all_donors', label: 'All Donors (Pass Buyers)' },
                { id: 'all_members', label: 'All 88 Club Members' },
                { id: 'team_members', label: 'Specific Team' },
                { id: 'donors_by_band', label: 'Donors by Band' },
                { id: 'donors_by_row', label: 'Donors by Row' },
                { id: 'custom', label: 'Custom Number List' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAudienceType(opt.id as any)}
                  className={cn(
                    "p-3 rounded-xl font-bold text-xs text-left border transition-all flex flex-col justify-between",
                    audienceType === opt.id
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500"
                      : "bg-[#0B1724] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  )}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Sub-selectors for team, band, row, or custom input */}
            {audienceType === 'team_members' && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-200">Select Team</Label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-[#0B1724] border border-slate-800 rounded-xl text-white font-medium text-sm"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({members.filter((m) => m.group_id === g.id).length} members)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'donors_by_band' && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-200">Select Price Band</Label>
                <select
                  value={selectedBandId}
                  onChange={(e) => setSelectedBandId(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0B1724] border border-slate-800 rounded-xl text-white font-medium text-sm"
                >
                  {bands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'donors_by_row' && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-200">Select Row</Label>
                <select
                  value={selectedRow}
                  onChange={(e) => setSelectedRow(e.target.value)}
                  className="w-full h-11 px-3 bg-[#0B1724] border border-slate-800 rounded-xl text-white font-medium text-sm"
                >
                  <option value="">-- Choose a Row --</option>
                  {availableRows.map((row) => (
                    <option key={row} value={row}>
                      Row {row}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'custom' && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-semibold text-slate-200">
                  Paste Phone Numbers (comma or newline separated)
                </Label>
                <Textarea
                  placeholder="98410 11111, 98410 22222, +1 415 555 0134"
                  value={customNumbersInput}
                  onChange={(e) => setCustomNumbersInput(e.target.value)}
                  rows={3}
                  className="bg-[#0B1724] border-slate-800 text-white font-mono text-xs rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Card: 2. MESSAGE TEMPLATES & EDITOR */}
          <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                2. Choose Template & Edit Message
              </h2>
            </div>

            {/* Template Selector Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={cn(
                    "p-3 rounded-xl text-left border transition-all text-xs flex flex-col justify-between",
                    selectedTemplateId === tpl.id
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold ring-1 ring-emerald-500"
                      : "bg-[#0B1724] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  )}
                >
                  <span className="font-bold">{tpl.label}</span>
                  <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{tpl.category}</span>
                </button>
              ))}
            </div>

            {/* Interactive Merge Tags */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Click to insert personalized tag:</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{name}', desc: 'Donor Name' },
                  { tag: '{band}', desc: 'Price Band' },
                  { tag: '{row}', desc: 'Row Number' },
                  { tag: '{serial}', desc: 'Physical Serial' },
                  { tag: '{{event_date}}', desc: '22 Mar 2026' },
                  { tag: '{{venue}}', desc: 'Music Academy' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="px-2.5 py-1 bg-[#0B1724] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-amber-400 text-[11px] font-mono rounded-lg transition-colors"
                  >
                    {item.tag} <span className="text-slate-400 text-[10px]">({item.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Editor */}
            <div className="space-y-1.5">
              <Label htmlFor="msgBody" className="text-xs font-semibold text-slate-200">
                Message Text (Plain Text + Emojis)
              </Label>
              <Textarea
                id="msgBody"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={8}
                className="bg-[#0B1724] border-slate-800 text-white font-sans text-sm rounded-xl leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Preview & Dispatch (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: REAL-TIME WHATSAPP PREVIEW */}
          <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                WhatsApp Message Preview
              </h3>
              <span className="text-[10px] text-slate-400 font-mono uppercase">
                {recipients.length > 0 ? `To: ${recipients[0].name}` : 'Sample'}
              </span>
            </div>

            {/* WhatsApp Bubble Preview */}
            <div className="bg-[#081B15] border border-emerald-900/60 rounded-2xl p-4 text-slate-100 text-sm whitespace-pre-wrap leading-relaxed shadow-inner">
              {previewMessage || 'Your message will appear here...'}
              <div className="text-[10px] text-emerald-500/60 text-right mt-2 font-mono">
                5:30 PM ✓✓
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyMessage}
              className="w-full h-10 border-slate-800 bg-[#0B1724] hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              {copiedMessage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedMessage ? 'Copied Message!' : 'Copy Message Text'}</span>
            </Button>
          </div>

          {/* TAB 1: BROADCAST LIST GENERATOR ACTION */}
          {activeTab === 'broadcast' && (
            <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E58327]" />
                Free Broadcast List Export
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                WhatsApp Broadcast Lists allow sending a message to up to 256 people at once for <strong>100% free</strong>. The message lands in their personal 1-on-1 chat.
              </p>

              {/* Step-by-Step Elder Guide */}
              <div className="bg-[#0B1724] border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-amber-400 text-[11px] uppercase tracking-wider">
                  How to send in 3 simple steps:
                </div>
                <div className="space-y-1">
                  <p>1. Tap <strong>"Copy Phone Numbers"</strong> below.</p>
                  <p>2. Open WhatsApp on your phone → Tap <strong>New Broadcast</strong> → Select / paste these contacts.</p>
                  <p>3. Tap <strong>"Copy Message Text"</strong> above, paste it into the broadcast chat, and send!</p>
                </div>
              </div>

              {/* Copy Numbers CTA */}
              <div className="pt-1 space-y-3">
                <Button
                  type="button"
                  onClick={handleCopyNumbers}
                  className="w-full h-12 bg-[#E58327] hover:bg-amber-600 text-slate-950 font-black text-sm rounded-xl transition-colors shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2"
                >
                  {copiedNumbers ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  <span>Copy {recipients.length} Phone Numbers</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoggingCampaign || recipients.length === 0}
                  onClick={() => handleLogCampaign('broadcast_list')}
                  className="w-full h-10 border-slate-800 bg-[#0B1724] hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold rounded-xl"
                >
                  Log Broadcast as Sent ({recipients.length} recipients)
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: CLICK-TO-SEND LIST */}
          {activeTab === 'click_to_send' && (
            <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  1-Click Direct Sending
                </h3>
                <span className="text-xs text-slate-400">
                  {sentRecipientIds.size} of {recipients.length} sent
                </span>
              </div>

              <Input
                placeholder="Search recipient name or phone..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                className="h-10 bg-[#0B1724] border-slate-800 rounded-xl text-white text-xs"
              />

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 pr-1">
                {filteredRecipients.map((r) => {
                  const isSent = sentRecipientIds.has(r.id);
                  const personalizedText = renderMessageForRecipient(r);
                  const waUrl = getWhatsAppUrl(r.cleanPhone, personalizedText);

                  return (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-white text-xs block">{r.name}</span>
                        <span className="text-[11px] font-mono text-slate-400">{r.cleanPhone}</span>
                        <span className="text-[10px] text-slate-500 block">{r.meta}</span>
                      </div>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          setSentRecipientIds((prev) => new Set(prev).add(r.id));
                        }}
                        className={cn(
                          "h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shrink-0",
                          isSent
                            ? "bg-slate-800 text-slate-400 border border-slate-700"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-950/30"
                        )}
                      >
                        {isSent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Send className="w-3.5 h-3.5" />}
                        <span>{isSent ? 'Sent' : 'Send'}</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RECENT CAMPAIGNS AUDIT */}
          {activeTab === 'history' && (
            <div className="bg-[#102030] border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Recent Campaigns History
              </h3>

              {campaigns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No campaigns logged yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto pr-1">
                  {campaigns.map((c) => (
                    <div key={c.id} className="py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">
                          {c.audience_type.replace('_', ' ').toUpperCase()} ({c.recipient_count} recipients)
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {c.adhoc_body}
                      </p>
                      <div className="text-[10px] text-amber-500/80">
                        Method: {c.method} · Logged by: {c.sent_by || 'Admin'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
