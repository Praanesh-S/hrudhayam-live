'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-black text-white hover:bg-gray-800 px-6 py-2 rounded text-sm font-bold cursor-pointer transition-colors shadow-md"
    >
      🖨️ Print / Save as PDF
    </button>
  );
}
