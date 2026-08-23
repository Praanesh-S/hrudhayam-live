import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#0B1E2B',
    width: '105mm', // A6 Standard Dimensions
    height: '148mm',
    padding: 10,
    fontFamily: 'Helvetica',
  },
  card: {
    backgroundColor: '#0F2B3C',
    borderRadius: 8,
    border: '1.5pt solid #D97706',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#07151E',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    textAlign: 'center',
    borderBottom: '1pt solid #D97706',
  },
  organizerText: {
    color: '#E8913A',
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 7,
    marginTop: 2,
  },
  badgeStrip: {
    backgroundColor: '#D97706',
    paddingVertical: 3,
    textAlign: 'center',
  },
  badgeText: {
    color: '#0B1E2B',
    fontSize: 6.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    padding: 10,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestSection: {
    alignItems: 'center',
    marginBottom: 6,
  },
  guestLabel: {
    fontSize: 6,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 1,
  },
  guestName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  seatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#07151E',
    borderRadius: 6,
    border: '1pt solid #1E3A4C',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  seatBox: {
    alignItems: 'center',
    flex: 1,
  },
  seatBoxBorder: {
    borderRight: '1pt solid #1E3A4C',
  },
  seatLabel: {
    fontSize: 6,
    color: '#E8913A',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  seatValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 6,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCode: {
    width: 95,
    height: 95,
  },
  passCode: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#E8913A',
    letterSpacing: 2,
    marginTop: 3,
  },
  venueBlock: {
    alignItems: 'center',
    marginVertical: 2,
  },
  venueText: {
    fontSize: 6.5,
    color: '#E2E8F0',
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 6,
    color: '#94A3B8',
    marginTop: 1,
  },
  tearLine: {
    borderTop: '1pt dashed #475569',
    width: '100%',
    marginVertical: 3,
  },
  footer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#07151E',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 5.5,
    color: '#64748B',
    lineHeight: 1.2,
  },
});

interface TicketPdfProps {
  guestName: string;
  section: string;
  row: string;
  seatNo: string;
  admitCount?: number;
  passCode: string;
  qrCodeBuffer: Buffer;
}

export function TicketPdf({
  guestName,
  section,
  row,
  seatNo,
  admitCount = 1,
  passCode,
  qrCodeBuffer,
}: TicketPdfProps) {
  const imageSrc = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;

  return (
    <Document>
      <Page size="A6" style={styles.page}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.organizerText}>Rotary Club of Aarch City Madras</Text>
            <Text style={styles.headerTitle}>HRUDHAYAM LIVE</Text>
            <Text style={styles.headerSubtitle}>Charity Musical Concert in Aid of Public-Access AEDs</Text>
          </View>

          {/* Golden Banner Strip */}
          <View style={styles.badgeStrip}>
            <Text style={styles.badgeText}>OFFICIAL DONOR E-PASS • ADMIT {admitCount}</Text>
          </View>

          {/* Content Body */}
          <View style={styles.content}>
            {/* Guest Name */}
            <View style={styles.guestSection}>
              <Text style={styles.guestLabel}>PASS ISSUED TO</Text>
              <Text style={styles.guestName}>{guestName}</Text>
            </View>

            {/* Exact Seating Coordinates Box */}
            <View style={styles.seatContainer}>
              <View style={[styles.seatBox, styles.seatBoxBorder]}>
                <Text style={styles.seatLabel}>SECTION</Text>
                <Text style={styles.seatValue}>{section}</Text>
              </View>
              <View style={[styles.seatBox, styles.seatBoxBorder]}>
                <Text style={styles.seatLabel}>ROW</Text>
                <Text style={styles.seatValue}>{row}</Text>
              </View>
              <View style={styles.seatBox}>
                <Text style={styles.seatLabel}>{admitCount > 1 ? "SEATS" : "SEAT NO"}</Text>
                <Text style={styles.seatValue}>{seatNo}</Text>
              </View>
            </View>

            {/* QR Code with White Frame */}
            <View style={styles.qrWrapper}>
              <Image source={imageSrc} style={styles.qrCode} />
            </View>

            {/* Pass Code */}
            <Text style={styles.passCode}>{passCode}</Text>

            {/* Venue & Event Timing */}
            <View style={styles.venueBlock}>
              <Text style={styles.venueText}>THE MUSIC ACADEMY, ALWARPET, CHENNAI</Text>
              <Text style={styles.dateText}>Friday, 9 October 2026 • Gates Open: 5:30 PM • Show: 6:30 PM</Text>
            </View>

            {/* Stub Tear Line */}
            <View style={styles.tearLine} />
          </View>

          {/* Footer Terms */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Present this digital pass or printed copy at gate entry. Strictly one entry scan per barcode.
            </Text>
            <Text style={styles.footerText}>
              No commercial resale. This pass represents a charitable contribution.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
