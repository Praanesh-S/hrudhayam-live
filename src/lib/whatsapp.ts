export interface WhatsAppPassDetails {
  guestName: string;
  phone?: string | null;
  passCode: string;
  section: string;
  rows: string[];
  seatNumbers: string;
  totalSeats: number;
  paymentStatus: string;
}

export function formatWhatsAppMessage(details: WhatsAppPassDetails, baseUrl?: string): string {
  const domain = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://hrudhayam-live.vercel.app');
  const passUrl = `${domain}/pass/${details.passCode}`;
  
  return `🎟️ *HRUDHAYAM LIVE 2026 - Donor E-Pass*
---------------------------------------
Dear *${details.guestName}*,

Thank you for your generous contribution to the Rotary Club of Aarch City Madras. Your admission pass for *HRUDHAYAM LIVE 2026* is confirmed!

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Show Begins:* 6:30 PM

🎫 *Pass Code:* *${details.passCode}* (${details.totalSeats > 1 ? `Admit ${details.totalSeats}` : 'Admit 1'})
💺 *Section:* ${details.section}
💺 *Row(s):* ${details.rows.join(', ')}
💺 *Seat(s):* ${details.seatNumbers}
💳 *Payment:* ${details.paymentStatus === 'received' ? '✓ Paid' : 'Pending'}

🔗 *View Digital Pass & Entry QR Code:*
${passUrl}

_Please present your digital pass or QR code at venue entrance for barcode scan._`;
}

export function getWhatsAppShareUrl(phone: string | undefined | null, message: string): string {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
