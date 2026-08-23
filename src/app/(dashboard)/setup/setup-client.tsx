"use client";

import { useState } from "react";
import { VenueRow, SeatMapItem, TierValue, ObligationType, SeatSection } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { updateRowTier, updateRowObligation, updateRowSeatCount, bulkSetTier, bulkSetObligation } from "./actions";
import { toast } from "sonner";
import { OBLIGATION_LABELS, formatINR } from "@/lib/constants";
import SeatMap from "@/components/dashboard/SeatMap";
import { 
  Settings2, 
  Lock, 
  Unlock, 
  Sparkles, 
  CheckCircle2, 
  Tag, 
  ArrowRight,
  Layers,
  IndianRupee,
  ShieldAlert,
  Sliders
} from "lucide-react";

export function SetupClient({ initialRows, seatMapItems }: { initialRows: VenueRow[], seatMapItems: SeatMapItem[] }) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState<string | null>(null);

  // Bulk Tier Assigner state
  const [assignSection, setAssignSection] = useState<SeatSection>("Ground Floor");
  const [fromRow, setFromRow] = useState("");
  const [toRow, setToRow] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("5000");

  const groundFloor = rows.filter(r => r.section === "Ground Floor");
  const balcony = rows.filter(r => r.section === "Balcony");
  const activeSectionRows = assignSection === "Ground Floor" ? groundFloor : balcony;

  const totalSeats = rows.reduce((acc, r) => acc + r.seat_count, 0);
  const totalReserved = seatMapItems.filter(s => s.ownerId || s.haGuest).length;
  const totalUnpriced = rows.filter(r => !r.tier && !r.obligation).reduce((acc, r) => acc + r.seat_count, 0);

  // Calculate potential revenue across configured rows
  const potentialRevenue = rows.reduce((acc, r) => acc + ((r.tier || 0) * r.seat_count), 0);

  const handleUpdateSeatCount = async (rowId: string, count: number) => {
    setLoading(rowId + "-count");
    const res = await updateRowSeatCount(rowId, count);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Seat count updated");
      setRows(rows.map(r => r.id === rowId ? { ...r, seat_count: count } : r));
    }
    setLoading(null);
  };

  const handleUpdateTier = async (rowId: string, tier: TierValue | null) => {
    setLoading(rowId + "-tier");
    const res = await updateRowTier(rowId, tier);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Row tier updated to ${tier ? formatINR(tier) : 'Unpriced'}`);
      setRows(rows.map(r => r.id === rowId ? { ...r, tier, obligation: null } : r));
    }
    setLoading(null);
  };

  const handleUpdateObligation = async (rowId: string, obligation: ObligationType | null) => {
    setLoading(rowId + "-obligation");
    const res = await updateRowObligation(rowId, obligation);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Obligation updated");
      setRows(rows.map(r => r.id === rowId ? { ...r, obligation, tier: null } : r));
    }
    setLoading(null);
  };

  const handleBulkAssign = async () => {
    if (!assignSection || !fromRow || !toRow) {
      toast.error("Please select a valid section and row range");
      return;
    }

    setLoading("bulk-assign");

    if (selectedCategory.startsWith("ob-")) {
      const obligationType = selectedCategory.replace("ob-", "") as ObligationType;
      const res = await bulkSetObligation(assignSection, fromRow, toRow, obligationType);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Set ${OBLIGATION_LABELS[obligationType]} for rows ${fromRow} to ${toRow}`);
        window.location.reload();
      }
    } else {
      const tierVal = selectedCategory === "none" ? null : parseInt(selectedCategory) as TierValue;
      const res = await bulkSetTier(assignSection, fromRow, toRow, tierVal);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Assigned ${tierVal ? formatINR(tierVal) : 'Unpriced'} to rows ${fromRow} to ${toRow} (${res.count} rows)`);
        window.location.reload();
      }
    }
    setLoading(null);
  };

  // Convert seatMapItems into SeatData format for SeatMap component
  const seatMapData = seatMapItems.map(s => ({
    id: s.id,
    section: s.section,
    row_label: s.row_label,
    seat_no: s.seat_no,
    tier: s.tier,
    obligation: s.obligation,
    guest_name: s.haGuest ? 'Occupied' : null,
    payment_status: s.isPaid ? 'received' : 'pending',
    checked_in: s.isCheckedIn,
    owner_id: s.ownerId,
  }));

  const renderTable = (sectionRows: VenueRow[]) => (
    <div className="rounded-xl border border-[#223345] overflow-hidden bg-[#131F2E]">
      <Table>
        <TableHeader className="bg-[#0E1724] border-b border-[#223345]">
          <TableRow className="text-slate-400 text-xs">
            <TableHead className="w-28 text-slate-300">Row</TableHead>
            <TableHead className="w-28 text-slate-300">Seats</TableHead>
            <TableHead className="w-48 text-slate-300">Current Category</TableHead>
            <TableHead className="min-w-[260px] text-slate-300">Quick Assign Price Tier</TableHead>
            <TableHead className="w-24 text-right pr-6 text-slate-300">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectionRows.map(row => (
            <TableRow key={row.id} className="hover:bg-[#1A2839]/60 border-b border-[#1E2D3D] transition-colors">
              <TableCell className="font-mono font-bold text-xs text-white">
                Row {row.row_label}
                {row.row_label === "SPL VIP" && (
                  <Badge className="ml-2 bg-purple-950/80 text-purple-300 border border-purple-800 text-[9px]">
                    VIP BOX
                  </Badge>
                )}
              </TableCell>
              
              <TableCell>
                <div className="flex items-center space-x-1.5">
                  <Input 
                    type="number" 
                    defaultValue={row.seat_count}
                    className="w-16 h-7 text-xs font-mono bg-[#1A2839] border-[#2A3F55] text-white"
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val !== row.seat_count && val > 0) {
                        handleUpdateSeatCount(row.id, val);
                      }
                    }}
                    disabled={loading === row.id + "-count" || row.lock_status === "Locked"}
                  />
                </div>
              </TableCell>

              <TableCell>
                {row.obligation ? (
                  <Badge className="bg-purple-900/60 text-purple-200 border border-purple-700/60 text-xs">
                    {OBLIGATION_LABELS[row.obligation] || row.obligation}
                  </Badge>
                ) : row.tier === 5000 ? (
                  <Badge className="bg-[#B8860B]/30 text-[#FACC15] border border-[#B8860B] text-xs font-bold font-mono">
                    ₹5,000 Platinum
                  </Badge>
                ) : row.tier === 3000 ? (
                  <Badge className="bg-[#0D9488]/30 text-[#2DD4BF] border border-[#0D9488] text-xs font-bold font-mono">
                    ₹3,000 Gold
                  </Badge>
                ) : row.tier === 1500 ? (
                  <Badge className="bg-slate-800 text-slate-300 border border-slate-600 text-xs font-bold font-mono">
                    ₹1,500 Silver
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-500 border-slate-700 text-xs">
                    Unpriced
                  </Badge>
                )}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    disabled={row.lock_status === "Locked" || loading === row.id + "-tier"}
                    onClick={() => handleUpdateTier(row.id, 5000)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                      row.tier === 5000 
                        ? 'bg-[#EAB308] text-slate-950 shadow-sm' 
                        : 'bg-[#1A2839] text-[#FACC15] hover:bg-[#24364A] border border-[#B8860B]/40'
                    }`}
                  >
                    ₹5,000
                  </button>

                  <button
                    type="button"
                    disabled={row.lock_status === "Locked" || loading === row.id + "-tier"}
                    onClick={() => handleUpdateTier(row.id, 3000)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                      row.tier === 3000 
                        ? 'bg-[#14B8A6] text-slate-950 shadow-sm' 
                        : 'bg-[#1A2839] text-[#2DD4BF] hover:bg-[#24364A] border border-[#0D9488]/40'
                    }`}
                  >
                    ₹3,000
                  </button>

                  <button
                    type="button"
                    disabled={row.lock_status === "Locked" || loading === row.id + "-tier"}
                    onClick={() => handleUpdateTier(row.id, 1500)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                      row.tier === 1500 
                        ? 'bg-slate-300 text-slate-950 shadow-sm' 
                        : 'bg-[#1A2839] text-slate-300 hover:bg-[#24364A] border border-slate-700'
                    }`}
                  >
                    ₹1,500
                  </button>

                  <button
                    type="button"
                    disabled={row.lock_status === "Locked" || loading === row.id + "-obligation"}
                    onClick={() => handleUpdateObligation(row.id, "chief")}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                      row.obligation === "chief" 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-[#1A2839] text-purple-300 hover:bg-[#24364A] border border-purple-800/40'
                    }`}
                  >
                    VIP
                  </button>

                  <button
                    type="button"
                    disabled={row.lock_status === "Locked" || loading === row.id + "-tier"}
                    onClick={() => handleUpdateTier(row.id, null)}
                    className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </TableCell>

              <TableCell className="text-right pr-6">
                {row.lock_status === "Locked" ? (
                  <Badge className="bg-red-950/80 text-red-300 border border-red-800 gap-1 text-[10px]">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-800/60 bg-emerald-950/30 gap-1 text-[10px]">
                    <Unlock className="w-2.5 h-2.5" /> Open
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. Dedicated Bulk Price Category Assigner Tool */}
      <Card className="bg-[#131F2E] border-[#223345] shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#0E1724] border-b border-[#223345] pb-4">
          <div className="flex items-center gap-2 text-[#E8913A] text-xs font-bold uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>Price Category Assigner</span>
          </div>
          <CardTitle className="text-lg font-bold text-white mt-1">
            Assign Pricing Tiers to Row Ranges
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Bulk-configure rows with price tiers (₹5,000 / ₹3,000 / ₹1,500) or VIP obligations in one click.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Floor Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">1. Select Section / Floor</Label>
              <Select 
                value={assignSection} 
                onValueChange={(v) => { 
                  if (v) {
                    setAssignSection(v as SeatSection);
                    setFromRow("");
                    setToRow("");
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="Ground Floor">Ground Floor (698 seats)</SelectItem>
                  <SelectItem value="Balcony">Balcony (750 seats)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. From Row */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">2. From Row</Label>
              <Select value={fromRow} onValueChange={(v) => { if (v) setFromRow(v); }}>
                <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                  <SelectValue placeholder="Select start row" />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white max-h-56">
                  {activeSectionRows.map(r => (
                    <SelectItem key={r.id} value={r.row_label}>
                      Row {r.row_label} ({r.seat_count} seats)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. To Row */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">3. To Row</Label>
              <Select value={toRow} onValueChange={(v) => { if (v) setToRow(v); }}>
                <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white">
                  <SelectValue placeholder="Select end row" />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white max-h-56">
                  {activeSectionRows.map(r => (
                    <SelectItem key={r.id} value={r.row_label}>
                      Row {r.row_label} ({r.seat_count} seats)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Price Tier Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-300">4. Assign Category / Tier</Label>
              <Select value={selectedCategory} onValueChange={(v) => { if (v) setSelectedCategory(v); }}>
                <SelectTrigger className="h-9 text-xs bg-[#1A2839] border-[#2A3F55] text-white font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#131F2E] border-[#223345] text-white">
                  <SelectItem value="5000">₹5,000 Platinum Tier</SelectItem>
                  <SelectItem value="3000">₹3,000 Gold Tier</SelectItem>
                  <SelectItem value="1500">₹1,500 Silver Tier</SelectItem>
                  <SelectItem value="ob-chief">VIP / Chief Guest (Obligation)</SelectItem>
                  <SelectItem value="ob-police">Police / Official (Obligation)</SelectItem>
                  <SelectItem value="ob-corp">Corporate / Sponsor (Obligation)</SelectItem>
                  <SelectItem value="none">Unpriced / Clear Price</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#223345]">
            <p className="text-xs text-slate-400">
              {fromRow && toRow 
                ? `Ready to update rows ${fromRow} to ${toRow} in ${assignSection}.`
                : 'Select start and end rows above to apply.'}
            </p>

            <Button 
              className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold text-xs px-6 h-9 shadow-md shadow-amber-950/20"
              onClick={handleBulkAssign}
              disabled={loading === "bulk-assign" || !fromRow || !toRow}
            >
              <Tag className="w-3.5 h-3.5 mr-1.5" />
              Apply Category to Selected Rows
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Live Capacity & Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Venue Capacity
            </span>
            <div className="text-2xl font-extrabold text-white mt-1.5">{totalSeats} Seats</div>
            <p className="text-xs text-slate-400 mt-1">Ground: 698 • Balcony: 750</p>
          </CardContent>
        </Card>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Potential Revenue (Configured)
            </span>
            <div className="text-2xl font-extrabold text-[#E8913A] mt-1.5">{formatINR(potentialRevenue)}</div>
            <p className="text-xs text-slate-400 mt-1">From all priced donation tiers</p>
          </CardContent>
        </Card>

        <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs">
          <CardContent className="p-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Unassigned Pricing
            </span>
            <div className="text-2xl font-extrabold text-slate-300 mt-1.5">{totalUnpriced} Seats</div>
            <p className="text-xs text-slate-400 mt-1">Set categories above to price them</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Section Row Tables & Live Map */}
      <Tabs defaultValue="ground-floor" className="space-y-4">
        <TabsList className="bg-[#131F2E] border border-[#223345] p-1 rounded-xl">
          <TabsTrigger value="ground-floor" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Ground Floor (698 seats)
          </TabsTrigger>
          <TabsTrigger value="balcony" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Balcony (750 seats)
          </TabsTrigger>
          <TabsTrigger value="venue-map" className="text-xs font-semibold text-slate-300 data-[state=active]:bg-[#1A2839] data-[state=active]:text-white">
            Live Visual Seat Map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ground-floor" className="space-y-4">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Ground Floor Rows & Tier Pricing
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Click any price tier button or edit seat count for Rows A–N and SPL VIP.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {renderTable(groundFloor)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balcony" className="space-y-4">
          <Card className="bg-[#131F2E] border-[#223345] rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="bg-[#0E1724] pb-3 border-b border-[#223345]">
              <CardTitle className="text-base font-bold text-white">
                Balcony Rows & Tier Pricing
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Click any price tier button or edit seat count for Balcony Rows A–N (750 total seats).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {renderTable(balcony)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venue-map">
          <SeatMap seats={seatMapData as any} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
