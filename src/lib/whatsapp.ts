// ──────────────────────────────────────────────
// WhatsApp Pass Delivery Helper (Bilingual: English + Tamil)
// Reconciled Developer Specification v1.0 (§13, §19.10)
// ──────────────────────────────────────────────

export interface WhatsAppPassMessageParams {
  donorName: string;
  donorPhone: string;
  bandLabel: string;
  passCode: string;
  ticketType: 'digital' | 'physical';
  physicalSerial?: string | null;
  passIndex?: number;
  totalPasses?: number;
  paymentStatus?: string;
  language?: 'en' | 'ta';
  hostUrl?: string;
}

export interface SellerCreditMessageParams {
  sellerName: string;
  sellerPhone?: string | null;
  totalRaised: number;
  language?: 'en' | 'ta';
}

/**
 * Format phone number for WhatsApp deep link.
 * Handles foreign (+1 etc.) as well as Indian (+91) numbers.
 */
export function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If already starts with country code (e.g., 1 for US, 91 for India)
  if (phone.trim().startsWith('+1') || phone.trim().startsWith('1') && digits.length === 11) {
    return digits;
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Generates the WhatsApp deep link (wa.me)
 */
export function getWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Format Donor Pass WhatsApp message (Digital or Physical, English or Tamil)
 */
export function formatDonorPassMessage(params: WhatsAppPassMessageParams): string {
  const {
    donorName,
    bandLabel,
    passCode,
    ticketType,
    physicalSerial,
    passIndex = 1,
    totalPasses = 1,
    paymentStatus = 'received',
    language = 'en',
    hostUrl,
  } = params;

  const baseUrl = hostUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://hrudhayam.live');
  const passUrl = `${baseUrl}/pass/${passCode}`;
  const isPaid = paymentStatus === 'received' || paymentStatus === 'paid';
  const passIndexText = totalPasses > 1 ? ` (Pass ${passIndex} of ${totalPasses})` : '';

  if (language === 'ta') {
    if (ticketType === 'physical') {
      return `🎟️ *ஹ்ருதயம் LIVE 2026 - நன்கொடையாளர் நுழைவுச் சீட்டு*${passIndexText}
---------------------------------------
அன்பார்ந்த *${donorName}*,

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ் அமைப்பிற்கு உங்கள் மேலான ஆதரவுக்கு மனமார்ந்த நன்றிகள்.

📍 *இடம்:* தி மியூசிக் அகாடமி, ஆல்வார்பேட்டை, சென்னை
🗓️ *தேதி:* வெள்ளி, 9 அக்டோபர் 2026
⏰ *நேரம்:* மாலை 5:30 மணி முதல்

🎫 *பிரிவு:* *${bandLabel}*
🔢 *டிக்கெட் எண்:* *${physicalSerial || 'நேரடிச் சீட்டு'}*
💳 *கட்டணம்:* ${isPaid ? '✓ பெறப்பட்டது' : 'நிலுவையில்'}

_தயவுசெய்து உங்கள் அச்சிடப்பட்ட நுழைவுச் சீட்டை அரங்க நுழைவாயிலில் காண்பிக்கவும்._`;
    }

    return `🎟️ *ஹ்ருதயம் LIVE 2026 - அதிகாரப்பூர்வ இ-பாஸ்*${passIndexText}
---------------------------------------
அன்பார்ந்த *${donorName}*,

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ் அமைப்பிற்கு உங்கள் மேலான ஆதரவுக்கு மனமார்ந்த நன்றிகள்.

📍 *இடம்:* தி மியூசிக் அகாடமி, ஆல்வார்பேட்டை, சென்னை
🗓️ *தேதி:* வெள்ளி, 9 அக்டோபர் 2026
⏰ *நேரம்:* மாலை 5:30 மணி முதல்

🎫 *பிரிவு:* *${bandLabel}*
🔢 *பாஸ் குறியீடு:* *${passCode}*
💳 *கட்டணம்:* ${isPaid ? '✓ பெறப்பட்டது' : 'நிலுவையில்'}

📱 *உங்கள் டிஜிட்டல் பாஸ் மற்றும் QR பார்-கோடு:*
👉 ${passUrl}

_அரங்க நுழைவாயிலில் இந்த QR பார்-கோடைக் காண்பித்து அனுமதிக்கப்படவும்._`;
  }

  // English
  if (ticketType === 'physical') {
    return `🎟️ *HRUDHAYAM LIVE 2026 — Official Donor Pass Confirmation*${passIndexText}
---------------------------------------
Dear *${donorName}*,

Thank you for your generous contribution towards Public-Access AEDs in Chennai! Your donor pass for *HRUDHAYAM LIVE 2026* is confirmed.

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Concert:* 6:30 PM

🎫 *Category:* *${bandLabel}*
🔢 *Ticket Serial Number:* *${physicalSerial || 'Physical Pass'}*
💳 *Payment:* ${isPaid ? '✓ Confirmed / Received' : 'Pending'}

_Please carry and present your physical ticket at the entrance for admission._
_Seating is on a first-come, first-served basis within the ${bandLabel} area._`;
  }

  return `🎟️ *HRUDHAYAM LIVE 2026 — Official Donor Pass*${passIndexText}
---------------------------------------
Dear *${donorName}*,

Thank you for your generous contribution towards Public-Access AEDs in Chennai! Your digital pass for *HRUDHAYAM LIVE 2026* is ready.

📍 *Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
🗓️ *Date:* Friday, 9 October 2026
⏰ *Gates Open:* 5:30 PM • *Concert:* 6:30 PM

🎫 *Category:* *${bandLabel}*
🔢 *Pass Code:* *${passCode}*
💳 *Payment:* ${isPaid ? '✓ Confirmed / Received' : 'Pending'}

📱 *View Your Official Mobile Pass & Gate QR:*
👉 ${passUrl}

_Please present the QR barcode at the link above at the venue gate for admission._
_Seating is on a first-come, first-served basis within the ${bandLabel} area._`;
}

/**
 * Format Seller "Funds raised in your name" message (§13)
 */
export function formatSellerCreditMessage(params: SellerCreditMessageParams): string {
  const { sellerName, totalRaised, language = 'en' } = params;
  const formattedAmount = `₹${totalRaised.toLocaleString('en-IN')}`;

  if (language === 'ta') {
    return `🙏 *ஹ்ருதயம் LIVE 2026 — உங்கள் ஆதரவுக்கு நன்றி*
---------------------------------------
வணக்கம் *${sellerName}*,

உங்கள் பெயரில் இதுவரை *${formattedAmount}* நிதி திரட்டப்பட்டுள்ளது! பொது மக்கள் பயன்பாட்டிற்கான AED உயிர் காக்கும் கருவிகள் நிறுவும் இந்த நற்பணிக்கு உங்கள் பங்களிப்பிற்கு மனமார்ந்த வாழ்த்துகளும் நன்றிகளும்.`;
  }

  return `🙏 *HRUDHAYAM LIVE 2026 — Rotary Club of Aarch City Madras*
---------------------------------------
Dear *${sellerName}*,

*${formattedAmount}* has been raised in your name so far for the Public-Access AED project.

Thank you for championing this life-saving cause!`;
}

/**
 * Format Pending Payment Reminder message (§19.5)
 */
export function formatPendingPaymentReminder(params: {
  donorOrSponsorName: string;
  amount: number;
  category: string;
  referenceNo?: string;
  upiVpa?: string;
}): string {
  const { donorOrSponsorName, amount, category, upiVpa = 'hrudhayamlive@indianbank' } = params;
  return `🔔 *Payment Reminder — HRUDHAYAM LIVE 2026*
---------------------------------------
Dear *${donorOrSponsorName}*,

This is a gentle reminder regarding your pledged contribution of *₹${amount.toLocaleString('en-IN')}* for *${category}* for Hrudhayam LIVE 2026.

💳 *UPI ID for payment:* \`${upiVpa}\`

Kindly share the transaction reference / UTR once completed. Thank you for your generous support!`;
}

/**
 * Legacy compatibility alias for existing components
 */
export const getWhatsAppShareUrl = (phoneOrMessage?: string | null, maybeMessage?: string) => {
  if (maybeMessage !== undefined) {
    return getWhatsAppUrl(phoneOrMessage, maybeMessage);
  }
  return getWhatsAppUrl(null, phoneOrMessage || '');
};

export interface LegacyWhatsAppPassDetails {
  seatId?: string;
  guestName?: string;
  donorName?: string;
  phone?: string | null;
  donorPhone?: string | null;
  passCode: string;
  bandName?: string;
  section?: string;
  rows?: string[];
  seatNumbers?: string;
  totalSeats?: number;
  paymentStatus?: string;
}

export function formatWhatsAppMessage(details: LegacyWhatsAppPassDetails): string {
  return formatDonorPassMessage({
    donorName: details.donorName || details.guestName || 'Valued Donor',
    donorPhone: details.donorPhone || details.phone || '',
    bandLabel: details.bandName || details.section || 'General Admission',
    passCode: details.passCode,
    ticketType: 'digital',
    paymentStatus: details.paymentStatus || 'received',
  });
}

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

export async function downloadTicketImage(passCodeOrSeatId: string, maybePassCode?: string) {
  const code = maybePassCode || passCodeOrSeatId;
  window.open(`/pass/${code}`, '_blank');
}

export async function copyTicketImageToClipboard(passCodeOrSeatId: string, maybePassCode?: string) {
  const code = maybePassCode || passCodeOrSeatId;
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${code}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
  }
}

export async function mobileNativeShareTicket(details: LegacyWhatsAppPassDetails): Promise<boolean> {
  const text = formatWhatsAppMessage(details);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${details.passCode}`;
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({
        title: 'Hrudhayam LIVE Admission Pass',
        text: text,
        url: url,
      });
      return true;
    } catch {
      // User cancelled share or fallback
    }
  }
  const shareUrl = getWhatsAppUrl(details.donorPhone || details.phone, text);
  window.open(shareUrl, '_blank');
  return true;
}

