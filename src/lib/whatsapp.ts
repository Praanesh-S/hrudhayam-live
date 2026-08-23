export interface WhatsAppPassDetails {
  guestName: string;
  phone?: string | null;
  passCode: string;
  section: string;
  rows: string[];
  seatNumbers: string;
  totalSeats: number;
  paymentStatus: string;
  baseUrl?: string;
}

export function formatWhatsAppMessage(details: WhatsAppPassDetails): string {
  const domain = details.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://hrudhayam-live.vercel.app');
  const passUrl = `${domain}/pass/${details.passCode}`;

  return `🎟️ *HRUDHAYAM LIVE 2026 - Donor Admission Pass*
---------------------------------------
Dear *${details.guestName}*,

Thank you for your generous contribution to the Rotary Club of Aarch City Madras. Your admission pass for *HRUDHAYAM LIVE 2026* is confirmed!

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Concert:* 6:30 PM

🎫 *Pass Code:* *${details.passCode}* (${details.totalSeats > 1 ? `Admit ${details.totalSeats} Guests` : 'Admit 1 Guest'})
💺 *Section:* ${details.section}
💺 *Row(s):* ${details.rows.join(', ')}
💺 *Seat(s):* ${details.seatNumbers}
💳 *Payment:* ${details.paymentStatus === 'received' ? '✓ Paid' : 'Pending'}

🔗 *View Digital Pass & Live QR Barcode:*
${passUrl}

_Please present the digital pass or QR barcode at venue entrance for barcode scan._`;
}

export function getWhatsAppShareUrl(phone: string | undefined | null, message: string): string {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Download ticket PDF helper
 */
export async function downloadTicketPdf(seatId: string, passCode: string) {
  const res = await fetch('/api/tickets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatId, passCode }),
  });

  if (!res.ok) {
    throw new Error('Failed to generate ticket PDF');
  }

  const blob = await res.blob();
  const pdfFileName = `Hrudhayam-Pass-${passCode}.pdf`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  return pdfFileName;
}
