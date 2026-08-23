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

export function formatWhatsAppMessage(details: WhatsAppPassDetails): string {
  return `🎟️ *HRUDHAYAM LIVE 2026 - Official Donor E-Pass*
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

📄 *Please find your official E-Ticket PDF with admission barcode attached.*
_Present the barcode at venue entrance for door check-in._`;
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

/**
 * Universal Native / WhatsApp File Sharing:
 * Attempts native Web Share API with PDF file attachment (supported on iOS / Android / Mac).
 * Fallback: Downloads PDF locally and opens WhatsApp with pre-filled text.
 */
export async function sharePdfToWhatsApp({
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

  // Fetch the PDF blob from generator endpoint
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
  const pdfFile = new File([blob], pdfFileName, { type: 'application/pdf' });

  // 1. Try Native Web Share with attached PDF (Mobile iOS / Android / Desktop Safari / Edge)
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Hrudhayam LIVE E-Pass - ${passCode}`,
        text: messageText,
      });
      return { sharedNatively: true };
    } catch (e: any) {
      if (e.name === 'AbortError') return { sharedNatively: true }; // user cancelled
      console.warn('Native share failed, falling back to download + wa.me', e);
    }
  }

  // 2. Desktop Fallback: Download PDF file & open WhatsApp
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);

  // Open WhatsApp with text
  const waUrl = getWhatsAppShareUrl(phone, messageText);
  window.open(waUrl, '_blank');

  return { sharedNatively: false, downloaded: true };
}
