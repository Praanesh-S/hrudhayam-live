import fs from 'fs';

let content = fs.readFileSync('src/app/(dashboard)/guests/guests-client.tsx', 'utf8');

// Add updateGuestGroup import
content = content.replace(
  "import { updateGuest, togglePayment, sendTicket } from './actions';",
  "import { updateGuest, togglePayment, sendTicket, updateGuestGroup } from './actions';"
);

// Add selectedSeats state and Bulk Assign modal
const stateInjection = `
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkName, setBulkName] = useState('');
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkPhone, setBulkPhone] = useState('');

  const toggleSelectAll = () => {
    if (selectedSeats.size === filteredSeats.length) {
      setSelectedSeats(new Set());
    } else {
      setSelectedSeats(new Set(filteredSeats.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedSeats);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSeats(newSet);
  };

  const handleBulkAssign = async () => {
    try {
      nameSchema.parse(bulkName);
      emailSchema.parse(bulkEmail);
      phoneSchema.parse(bulkPhone);
    } catch (e: any) {
      toast.error("Validation error", { description: "Please check your inputs." });
      return;
    }
    
    startTransition(async () => {
      try {
        await updateGuestGroup(Array.from(selectedSeats), { 
          guest_name: bulkName, 
          guest_email: bulkEmail, 
          guest_phone: bulkPhone 
        });
        toast.success("Group assigned successfully");
        setShowBulkModal(false);
        setSelectedSeats(new Set());
        setBulkName(''); setBulkEmail(''); setBulkPhone('');
      } catch (err: any) {
        toast.error("Failed to group assign", { description: err.message });
      }
    });
  };
`;

content = content.replace(
  "export function GuestsClient({ \n  initialSeats, \n  userRole, \n  userId \n}: { \n  initialSeats: Seat[], \n  userRole: string, \n  userId: string \n}) {\n  const [seats, setSeats] = useState<Seat[]>(initialSeats);",
  "export function GuestsClient({ \n  initialSeats, \n  userRole, \n  userId \n}: { \n  initialSeats: Seat[], \n  userRole: string, \n  userId: string \n}) {\n  const [seats, setSeats] = useState<Seat[]>(initialSeats);\n" + stateInjection
);

// Inject bulk action bar above the table
const bulkBar = `
        {selectedSeats.size > 1 && (
          <div className="bg-[#1A2839] p-3 rounded-lg flex items-center justify-between mb-4 border border-amber-500/30">
            <span className="text-amber-400 font-medium text-sm">
              {selectedSeats.size} seats selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="bg-[#0B131E] border-slate-700 hover:text-white" onClick={() => setSelectedSeats(new Set())}>Cancel</Button>
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
                  <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950" disabled={isPending} onClick={handleBulkAssign}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign & Generate QR"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
`;

content = content.replace(
  '<div className="bg-[#131F2E] rounded-xl border border-[#1E3A4C] shadow-sm overflow-hidden flex flex-col">',
  bulkBar + '\n<div className="bg-[#131F2E] rounded-xl border border-[#1E3A4C] shadow-sm overflow-hidden flex flex-col">'
);

// Add Checkboxes to headers
content = content.replace(
  '<TableRow className="text-slate-400 text-xs">\n                <TableHead className="w-24 text-slate-300">Seat ID</TableHead>',
  '<TableRow className="text-slate-400 text-xs">\n                <TableHead className="w-10"><input type="checkbox" checked={selectedSeats.size > 0 && selectedSeats.size === filteredSeats.length} onChange={toggleSelectAll} className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]" /></TableHead>\n                <TableHead className="w-24 text-slate-300">Seat ID</TableHead>'
);

content = content.replace(
  '<TableRow key={seat.id} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">\n                      <TableCell className="font-mono font-bold text-xs text-white">',
  '<TableRow key={seat.id} className="hover:bg-[#1A2839]/60 transition-colors border-b border-[#1E2D3D]">\n                      <TableCell><input type="checkbox" checked={selectedSeats.has(seat.id)} onChange={() => toggleSelect(seat.id)} className="w-4 h-4 accent-amber-500 rounded border-slate-600 bg-[#1A2839]" disabled={!canEdit} /></TableCell>\n                      <TableCell className="font-mono font-bold text-xs text-white">'
);

fs.writeFileSync('src/app/(dashboard)/guests/guests-client.tsx', content);
