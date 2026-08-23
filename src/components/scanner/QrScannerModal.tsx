'use client';

import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';

interface QrScannerModalProps {
  onScanSuccess: (decodedText: string) => void;
}

export function QrScannerModal({ onScanSuccess }: QrScannerModalProps) {
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback((detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes.length > 0 && detectedCodes[0].rawValue) {
      onScanSuccess(detectedCodes[0].rawValue);
    }
  }, [onScanSuccess]);

  const handleError = useCallback((err: unknown) => {
    console.error(err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else {
        setError(err.message);
      }
    }
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-400 font-medium mb-2">Camera Error</p>
        <p className="text-sm text-slate-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full object-cover">
      <Scanner
        onScan={handleScan}
        onError={handleError}
        formats={['qr_code']}
        constraints={{ facingMode: 'environment' }}
        components={{
          finder: true,
          onOff: true,
          torch: true,
        }}
        styles={{
          container: { width: '100%', height: '100%' },
        }}
      />
    </div>
  );
}
