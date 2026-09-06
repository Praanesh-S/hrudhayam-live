// ──────────────────────────────────────────────
// WhatsApp Pass Delivery Helper (Bilingual: English + Tamil)
// Reconciled Developer Specification v1.0 (§13, §19.10)
// ──────────────────────────────────────────────

export interface WhatsAppPassMessageParams {
  donorName: string;
  donorPhone: string;
  bandLabel: string;
  passCode: string;
  passCodes?: string[];
  quantity?: number;
  ticketType: 'digital' | 'physical';
  physicalSerial?: string | null;
  physicalSerials?: string[] | null;
  seatDetails?: string | null;
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
 * Generates the WhatsApp deep link (api.whatsapp.com/send)
 * Uses api.whatsapp.com instead of wa.me to prevent Meta's proxy redirect from corrupting text into '?'
 */
export function getWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const cleanMessage = message.replace(/[\uFE00-\uFE0F]/g, '');
  const encodedText = encodeURIComponent(cleanMessage);
  if (formattedPhone) {
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Format Donor Pass WhatsApp message (Digital or Physical, English or Tamil)
 * Pure standard text formatting - zero broken emojis, zero '?' characters, and no external app links.
 */
export function formatDonorPassMessage(params: WhatsAppPassMessageParams): string {
  const {
    donorName,
    bandLabel,
    passCode,
    passCodes,
    quantity = 1,
    ticketType,
    physicalSerial,
    physicalSerials,
    seatDetails,
    passIndex = 1,
    totalPasses = 1,
    paymentStatus = 'received',
    language = 'en',
  } = params;

  const isPaid = paymentStatus === 'received' || paymentStatus === 'paid';
  const passIndexText = totalPasses > 1 ? ` (Pass ${passIndex} of ${totalPasses})` : '';

  // Multi-pass confirmation batch
  if (quantity > 1 && passCodes && passCodes.length > 1) {
    if (language === 'ta') {
      return `*ஹ்ருதயம் LIVE 2026 - அதிகாரப்பூர்வ நுழைவுச் சீட்டுகள் (${quantity} பாஸ்கள்)*
---------------------------------------
அன்பார்ந்த *${donorName}*,

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ் அமைப்பிற்கு உங்கள் மேலான ஆதரவுக்கு மனமார்ந்த நன்றிகள். உங்கள் ${quantity} பாஸ்கள் உறுதிசெய்யப்பட்டன.

*இடம்:* தி மியூசிக் அகாடமி, ஆல்வார்பேட்டை, சென்னை
*தேதி:* வெள்ளி, 9 அக்டோபர் 2026
*நேரம்:* மாலை 5:30 மணி முதல் | இசை நிகழ்ச்சி: 6:30 மணி

*பிரிவு:* *${bandLabel}* (${quantity} இருக்கைகள்)
*பாஸ் குறியீடுகள்:* ${passCodes.join(', ')}
${ticketType === 'physical' && physicalSerials ? `*டிக்கெட் எண்கள்:* ${physicalSerials.join(', ')}\n` : ''}*கட்டணம்:* ${isPaid ? 'பெறப்பட்டது' : 'நிலுவையில்'}

${ticketType === 'digital' ? `உங்கள் ${quantity} அதிகாரப்பூர்வ PDF நுழைவுச் சீட்டுகள் இச்செய்தியுடன் இணைக்கப்பட்டுள்ளன.
அரங்க நுழைவாயிலில் இந்த PDF சீட்டுகளைக் காண்பித்து அனுமதிக்கப்படவும்.` : `தயவுசெய்து உங்கள் அச்சிடப்பட்ட நுழைவுச் சீட்டை அரங்க நுழைவாயிலில் காண்பிக்கவும்.`}

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ்`;
    }

    return `*HRUDHAYAM LIVE 2026 - Official Donor Passes (${quantity} Passes)*
---------------------------------------
Dear *${donorName}*,

Thank you for your generous contribution towards Public-Access AEDs in Chennai! Your ${quantity} donor passes for *HRUDHAYAM LIVE 2026* are confirmed.

*Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
*Date:* Friday, 9 October 2026
*Time:* Gates Open: 5:30 PM | Concert: 6:30 PM

*Category:* *${bandLabel}* (${quantity} Seats)
*Pass Codes:* ${passCodes.join(', ')}
${ticketType === 'physical' && physicalSerials ? `*Ticket Serials:* ${physicalSerials.join(', ')}\n` : ''}*Payment:* ${isPaid ? 'Confirmed / Received' : 'Pending'}

${ticketType === 'digital' ? `Your ${quantity} Official PDF Admission Passes are attached with this message.
Please present the barcode on the attached PDF passes at the gate for admission.` : `Please present your physical ticket at the entrance for admission.`}

Rotary Club of Aarch City Madras`;
  }

  if (language === 'ta') {
    if (ticketType === 'physical') {
      return `*ஹ்ருதயம் LIVE 2026 - நன்கொடையாளர் நுழைவுச் சீட்டு*${passIndexText}
---------------------------------------
அன்பார்ந்த *${donorName}*,

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ் அமைப்பிற்கு உங்கள் மேலான ஆதரவுக்கு மனமார்ந்த நன்றிகள்.

*இடம்:* தி மியூசிக் அகாடமி, ஆல்வார்பேட்டை, சென்னை
*தேதி:* வெள்ளி, 9 அக்டோபர் 2026
*நேரம்:* மாலை 5:30 மணி முதல் | இசை நிகழ்ச்சி: 6:30 மணி

*பிரிவு:* *${bandLabel}*
${seatDetails ? `*இருக்கை:* *${seatDetails}*\n` : ''}*டிக்கெட் எண்:* *${physicalSerial || 'நேரடிச் சீட்டு'}*
*கட்டணம்:* ${isPaid ? 'பெறப்பட்டது' : 'நிலுவையில்'}

தயவுசெய்து உங்கள் அச்சிடப்பட்ட நுழைவுச் சீட்டை அரங்க நுழைவாயிலில் காண்பிக்கவும்.

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ்`;
    }

    return `*ஹ்ருதயம் LIVE 2026 - அதிகாரப்பூர்வ இ-பாஸ்*${passIndexText}
---------------------------------------
அன்பார்ந்த *${donorName}*,

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ் அமைப்பிற்கு உங்கள் மேலான ஆதரவுக்கு மனமார்ந்த நன்றிகள்.

*இடம்:* தி மியூசிக் அகாடமி, ஆல்வார்பேட்டை, சென்னை
*தேதி:* வெள்ளி, 9 அக்டோபர் 2026
*நேரம்:* மாலை 5:30 மணி முதல் | இசை நிகழ்ச்சி: 6:30 மணி

*பிரிவு:* *${bandLabel}*
${seatDetails ? `*இருக்கை:* *${seatDetails}*\n` : ''}*பாஸ் குறியீடு:* *${passCode}*
*கட்டணம்:* ${isPaid ? 'பெறப்பட்டது' : 'நிலுவையில்'}

உங்கள் அதிகாரப்பூர்வ PDF நுழைவுச் சீட்டு இச்செய்தியுடன் இணைக்கப்பட்டுள்ளது.
அரங்க நுழைவாயிலில் இந்த PDF சீட்டைக் காண்பித்து அனுமதிக்கப்படவும்.

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ்`;
  }

  // English
  if (ticketType === 'physical') {
    return `*HRUDHAYAM LIVE 2026 - Official Donor Pass Confirmation*${passIndexText}
---------------------------------------
Dear *${donorName}*,

Thank you for your generous contribution towards Public-Access AEDs in Chennai! Your donor pass for *HRUDHAYAM LIVE 2026* is confirmed.

*Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
*Date:* Friday, 9 October 2026
*Time:* Gates Open: 5:30 PM | Concert: 6:30 PM

*Category:* *${bandLabel}*
${seatDetails ? `*Allocated Seat:* *${seatDetails}*\n` : ''}*Ticket Serial Number:* *${physicalSerial || 'Physical Pass'}*
*Payment:* ${isPaid ? 'Confirmed / Received' : 'Pending'}

Please carry and present your physical ticket at the entrance for admission.

Rotary Club of Aarch City Madras`;
  }

  return `*HRUDHAYAM LIVE 2026 - Official Donor Pass*${passIndexText}
---------------------------------------
Dear *${donorName}*,

Thank you for your generous contribution towards Public-Access AEDs in Chennai! Your donor pass for *HRUDHAYAM LIVE 2026* is confirmed.

*Venue:* The Music Academy, TTK Road, Alwarpet, Chennai
*Date:* Friday, 9 October 2026
*Time:* Gates Open: 5:30 PM | Concert: 6:30 PM

*Category:* *${bandLabel}*
${seatDetails ? `*Allocated Seat:* *${seatDetails}*\n` : ''}*Pass Code:* *${passCode}*
*Payment:* ${isPaid ? 'Confirmed / Received' : 'Pending'}

Your Official PDF Admission Pass is attached with this message.
Please present the barcode on the attached PDF at the entrance gate for admission.

Rotary Club of Aarch City Madras`;
}

/**
 * Format Seller "Funds raised in your name" message (§13)
 */
export function formatSellerCreditMessage(params: SellerCreditMessageParams): string {
  const { sellerName, totalRaised, language = 'en' } = params;
  const formattedAmount = `₹${totalRaised.toLocaleString('en-IN')}`;

  if (language === 'ta') {
    return `*ஹ்ருதயம் LIVE 2026 - உங்கள் ஆதரவுக்கு நன்றி*
---------------------------------------
வணக்கம் *${sellerName}*,

உங்கள் பெயரில் இதுவரை *${formattedAmount}* நிதி திரட்டப்பட்டுள்ளது! பொது மக்கள் பயன்பாட்டிற்கான AED உயிர் காக்கும் கருவிகள் நிறுவும் இந்த நற்பணிக்கு உங்கள் பங்களிப்பிற்கு மனமார்ந்த வாழ்த்துகளும் நன்றிகளும்.

ரோட்டரி கிளப் ஆஃப் ஆர்ச் சிட்டி மெட்ராஸ்`;
  }

  return `*HRUDHAYAM LIVE 2026 - Rotary Club of Aarch City Madras*
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
  return `*Payment Reminder - HRUDHAYAM LIVE 2026*
---------------------------------------
Dear *${donorOrSponsorName}*,

This is a gentle reminder regarding your pledged contribution of *₹${amount.toLocaleString('en-IN')}* for *${category}* for Hrudhayam LIVE 2026.

*UPI ID for payment:* \`${upiVpa}\`

Kindly share the transaction reference / UTR once completed. Thank you for your generous support!

Rotary Club of Aarch City Madras`;
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

/**
 * Triggers direct browser download of the ticket PDF
 */
export async function downloadTicketPdf(passCodeOrSeatId: string, donorNameOrPassCode?: string) {
  try {
    const passCode = donorNameOrPassCode && !donorNameOrPassCode.includes(' ') ? donorNameOrPassCode : passCodeOrSeatId;
    const res = await fetch(`/api/tickets/generate?passCode=${encodeURIComponent(passCode)}&download=1`);
    if (!res.ok) throw new Error('Failed to generate PDF pass');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hrudhayam-Pass-${passCode}.pdf`;
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
 * Sequentially downloads multiple pass PDFs
 */
export async function downloadAllPassPdfs(passCodes: string[]) {
  for (let i = 0; i < passCodes.length; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await downloadTicketPdf(passCodes[i]);
        } catch (e) {
          console.error(`Failed to download pass ${passCodes[i]}:`, e);
        }
        resolve();
      }, i * 350);
    });
  }
}

/**
 * Share pass PDF directly via WhatsApp using Web Share API (mobile/desktop browsers that support file sharing)
 * or fallback to downloading the PDF file and opening WhatsApp.
 */
export async function sharePassPdfViaWhatsApp(params: {
  passCodes: string[];
  donorName: string;
  donorPhone?: string | null;
  message?: string;
}): Promise<{ method: 'native_share' | 'download_and_whatsapp'; cancelled?: boolean }> {
  const { passCodes, donorName, donorPhone, message = '' } = params;

  // 1. Fetch PDF files
  const files: File[] = [];
  try {
    for (const code of passCodes) {
      const res = await fetch(`/api/tickets/generate?passCode=${encodeURIComponent(code)}&download=1`);
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], `Hrudhayam-Pass-${code}.pdf`, { type: 'application/pdf' });
        files.push(file);
      }
    }
  } catch (err) {
    console.warn('Could not fetch PDF files for native share:', err);
  }

  // 2. Check if Web Share API supports sharing files (e.g. mobile Safari, Chrome on Android, Mac Safari)
  if (
    typeof navigator !== 'undefined' &&
    files.length > 0 &&
    typeof (navigator as any).canShare === 'function' &&
    (navigator as any).canShare({ files })
  ) {
    try {
      await (navigator as any).share({
        files,
        title: `Hrudhayam LIVE 2026 Pass - ${donorName}`,
        text: message,
      });
      return { method: 'native_share' };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { method: 'native_share', cancelled: true };
      }
      console.warn('Native share failed, falling back to download + WhatsApp link:', err);
    }
  }

  // 3. Fallback: Download the PDF(s) to device and open WhatsApp chat
  if (files.length > 0) {
    await downloadAllPassPdfs(passCodes);
  }
  const url = getWhatsAppUrl(donorPhone, message);
  window.open(url, '_blank');
  return { method: 'download_and_whatsapp' };
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
  await sharePassPdfViaWhatsApp({
    passCodes: [details.passCode],
    donorName: details.donorName || details.guestName || 'Valued Donor',
    donorPhone: details.donorPhone || details.phone,
    message: text,
  });
  return true;
}

