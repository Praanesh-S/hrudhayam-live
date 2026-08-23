import fs from 'fs';

let content = fs.readFileSync('src/app/(dashboard)/guests/guests-client.tsx', 'utf8');

const bulkBar = `
        {selectedSeats.size > 1 && (
          <div className="bg-[#1A2839] p-3 rounded-lg flex items-center justify-between mb-4 border border-amber-500/30">
            <span className="text-amber-400 font-medium text-sm">
              {selectedSeats.size} seats selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="bg-[#0B131E] border-slate-700 text-white hover:bg-slate-800" onClick={() => setSelectedSeats(new Set())}>Cancel</Button>
              <Button size="sm" className="bg-[#E8913A] hover:bg-[#D97706] text-slate-950 font-bold" onClick={() => setShowBulkModal(true)}>
                Group Assign (1 QR)
              </Button>
            </div>
          </div>
        )}

        {showBulkModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F2B3C] border border-[#1E3A4C] p-6 rounded-xl max-w-md w-full">
              <h3 className="text-lg font-bold text-white mb-4">Assign {selectedSeats.size} Seats to Group</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Group / Primary Name *</label>
                  <Input value={bulkName} onChange={e => setBulkName(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Primary Email (Optional)</label>
                  <Input type="email" value={bulkEmail} onChange={e => setBulkEmail(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium mb-1 block">Primary Phone (Optional)</label>
                  <Input type="tel" value={bulkPhone} onChange={e => setBulkPhone(e.target.value)} className="bg-[#1A2839] border-[#2A3F55] text-white" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
                  <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold" disabled={isPending} onClick={handleBulkAssign}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign & Generate QR"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
`;

if (!content.includes('Group Assign')) {
  content = content.replace(
    '<div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">',
    bulkBar + '\n      <div className="bg-[#131F2E] rounded-2xl border border-[#223345] shadow-xs overflow-hidden">'
  );
  fs.writeFileSync('src/app/(dashboard)/guests/guests-client.tsx', content);
}
