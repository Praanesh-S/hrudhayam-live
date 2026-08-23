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

/**
 * Format clean WhatsApp text message (WITHOUT any website links)
 */
export function formatWhatsAppMessage(details: WhatsAppPassDetails): string {
  return `🎟️ *HRUDHAYAM LIVE 2026 - Donor Admission Pass*
---------------------------------------
Dear *${details.guestName}*,

Thank you for your generous contribution to the Rotary Club of Aarch City Madras. Your admission pass for *HRUDHAYAM LIVE 2026* is confirmed!

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Concert Begins:* 6:30 PM

🎫 *Pass Code:* *${details.passCode}* (${details.totalSeats > 1 ? `Admit ${details.totalSeats} Guests` : 'Admit 1 Guest'})
💺 *Section:* ${details.section}
💺 *Row(s):* ${details.rows.join(', ')}
💺 *Seat(s):* ${details.seatNumbers}
💳 *Payment:* ${details.paymentStatus === 'received' ? '✓ Paid' : 'Pending'}

_Your official admission E-Ticket with QR barcode is attached._
_Please present the QR barcode at the venue entrance for gate verification._`;
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
 * Fetch and download the High-Res PNG Ticket Image
 */
export async function downloadTicketImage(seatId: string, passCode: string): Promise<Blob> {
  const res = await fetch('/api/tickets/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatId, passCode }),
  });

  if (!res.ok) {
    throw new Error('Failed to generate ticket image');
  }

  const blob = await res.blob();
  const fileName = `Hrudhayam-Ticket-${passCode}.png`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  return blob;
}

/**
 * Copy ticket image to clipboard for 1-click paste (Cmd+V / Ctrl+V)
 */
export async function copyTicketImageToClipboard(seatId: string, passCode: string): Promise<boolean> {
  try {
    const res = await fetch('/api/tickets/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId, passCode }),
    });

    if (!res.ok) return false;
    const blob = await res.blob();

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }
  return false;
}

/**
 * Fetch and download Ticket PDF
 */
export async function downloadTicketPdf(seatId: string, passCode: string): Promise<Blob> {
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
  return blob;
}

/**
 * Mobile Native Share:
 * For Mobile devices (iOS/Android) where native Web Share is preferred
 */
export async function mobileNativeShareTicket({
  seatId,
  passCode,
  guestName,
  phone,
  section,
  rows,
  seatNumbers,
  totalSeats,
  paymentStatus,
}: {
  seatId: string;
  passCode: string;
  guestName: string;
  phone?: string | null;
  section: string;
  rows: string[];
  seatNumbers: string;
  totalSeats: number;
  paymentStatus: string;
}) {
  const messageText = formatWhatsAppMessage({
    guestName,
    phone,
    passCode,
    section,
    rows,
    seatNumbers,
    totalSeats,
    paymentStatus,
  });

  const res = await fetch('/api/tickets/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seatId, passCode }),
  });

  if (!res.ok) {
    throw new Error('Failed to generate ticket image');
  }

  const imageBlob = await res.blob();
  const fileName = `Hrudhayam-Ticket-${passCode}.png`;
  const imageFile = new File([imageBlob], fileName, { type: 'image/png' });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [imageFile] })
  ) {
    await navigator.share({
      files: [imageFile],
      title: `Hrudhayam Ticket - ${passCode}`,
      text: messageText,
    });
    return true;
  }
  return false;
}
