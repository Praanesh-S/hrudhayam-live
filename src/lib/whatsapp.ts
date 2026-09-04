// ──────────────────────────────────────────────
// WhatsApp Pass Delivery Helper (Band-Based Model)
// Generates clean WhatsApp messages with hosted pass links
// ──────────────────────────────────────────────

export interface WhatsAppPassDetails {
  donorName?: string;
  guestName?: string;
  donorPhone?: string | null;
  phone?: string | null;
  passCode: string;
  bandName?: string;
  totalSeats?: number;
  paymentStatus?: string;
  collectedAmount?: number;
  batchNote?: string | null;
  seatId?: string;
  section?: string;
  row?: string;
  rows?: string[] | string;
  seats?: any;
  seatNumbers?: any;
  seatNo?: string | number;
}

/**
 * Format clean WhatsApp text message with hosted pass link
 */
export function formatWhatsAppMessage(details: WhatsAppPassDetails, hostUrl?: string): string {
  const baseUrl = hostUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://hrudhayam.live');
  const passUrl = `${baseUrl}/pass/${details.passCode}`;
  const total = details.totalSeats || (Array.isArray(details.seats) ? details.seats.length : 1);
  const name = details.donorName || details.guestName || 'Valued Donor';
  const band = details.bandName || 'Admission Pass';
  const isPaid = details.paymentStatus === 'paid' || details.paymentStatus === 'received';

  return `🎟️ *HRUDHAYAM LIVE 2026 - Official Donor Pass*
---------------------------------------
Dear *${name}*,

Thank you for your generous contribution to the Rotary Club of Aarch City Madras. Your admission pass for *HRUDHAYAM LIVE 2026* is confirmed!

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Concert Begins:* 6:30 PM

🎫 *Admission Pass:* *${band}*
🔢 *Pass Code:* *${details.passCode}* (${total > 1 ? `Admit ${total} Guests` : 'Admit 1 Guest'})
💳 *Payment:* ${isPaid ? '✓ Received / Confirmed' : 'Pending'}

📱 *View Your Official Mobile E-Ticket & QR Barcode:*
👉 ${passUrl}

_Please present the QR barcode on the link above at the venue entrance for gate admission._
_Seating is on a first-come, first-served basis within the ${band} area._`;
}

/**
 * Get direct WhatsApp share URL (wa.me)
 * Accepts either (phone, message) or (message)
 */
export function getWhatsAppShareUrl(phoneOrMessage?: string | null, maybeMessage?: string): string {
  let phone = '';
  let msg = '';
  if (maybeMessage !== undefined) {
    phone = phoneOrMessage || '';
    msg = maybeMessage;
  } else {
    msg = phoneOrMessage || '';
  }
  let cleanPhone = phone.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }
  
  const encodedText = encodeURIComponent(msg);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Download ticket PDF for printing / sharing
 */
export async function downloadTicketPdf(passCodeOrSeatId: string, donorNameOrPassCode?: string) {
  try {
    const passCode = donorNameOrPassCode && !donorNameOrPassCode.includes(' ') ? donorNameOrPassCode : passCodeOrSeatId;
    const res = await fetch(`/api/tickets/generate?passCode=${encodeURIComponent(passCode)}`);
    if (!res.ok) throw new Error('Failed to generate PDF pass');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hrudhayam_Pass_${passCode}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download error:', err);
    throw err;
  }
}

/**
 * Download ticket image / open pass view
 */
export async function downloadTicketImage(passCodeOrSeatId: string, maybePassCode?: string) {
  const code = maybePassCode || passCodeOrSeatId;
  window.open(`/pass/${code}`, '_blank');
}

/**
 * Copy ticket link / image link to clipboard
 */
export async function copyTicketImageToClipboard(passCodeOrSeatId: string, maybePassCode?: string) {
  const code = maybePassCode || passCodeOrSeatId;
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${code}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
}

/**
 * Native mobile share for tickets
 */
export async function mobileNativeShareTicket(details: WhatsAppPassDetails): Promise<boolean> {
  const text = formatWhatsAppMessage(details);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${details.passCode}`;
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'Hrudhayam LIVE Admission Pass',
        text: text,
        url: url,
      });
      return true;
    } catch {
      // User cancelled share or fallback
    }
  }
  const shareUrl = getWhatsAppShareUrl(details.donorPhone || details.phone, text);
  window.open(shareUrl, '_blank');
  return true;
}
