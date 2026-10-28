'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { parseAndValidateQrPayload, QrInspectionPayload } from '@/lib/qr-security';

interface QrCameraScannerProps {
  expectedStationId: string;
  expectedStationCode: string;
  onScanSuccess: (payload: QrInspectionPayload) => void;
  onClose: () => void;
}

export default function QrCameraScanner({
  expectedStationId,
  expectedStationCode,
  onScanSuccess,
  onClose,
}: QrCameraScannerProps) {
  const [scanError, setScanError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'hpio-qr-reader';

  useEffect(() => {
    let html5QrCode: any = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText: string) => {
            const result = parseAndValidateQrPayload(decodedText, expectedStationId);
            if (result.valid && result.data) {
              // Pause and trigger success
              if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(() => {});
              }
              onScanSuccess(result.data);
            } else {
              setScanError(result.error || 'QR tidak valid');
            }
          },
          () => {
            // QR scan frame error, normal when moving camera
          }
        );

        setIsInitializing(false);
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        setScanError(
          err.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera aktif.'
        );
        setIsInitializing(false);
      }
    }

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [expectedStationId, onScanSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md brutal-card bg-white p-4 relative flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b-2 border-black mb-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-red-600" />
            <span className="font-black text-sm tracking-wide uppercase">
              Scan QR Ruangan [{expectedStationCode}]
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 border-2 border-black bg-red-600 text-white hover:bg-black transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="w-full bg-yellow-300 border-2 border-black p-2 mb-3 text-xs font-bold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-black" />
          <span>Arahkan kamera ke stiker QR fisik di pintu/rak datacenter.</span>
        </div>

        {/* Viewport Scanner */}
        <div className="w-full aspect-square border-4 border-black relative overflow-hidden bg-black flex items-center justify-center">
          <div id={scannerContainerId} className="w-full h-full" />
          {isInitializing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
              <span className="font-bold text-xs uppercase tracking-wider">
                Membuka Kamera HP...
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {scanError && (
          <div className="w-full mt-3 bg-red-100 border-2 border-red-600 p-2 text-xs font-black text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{scanError}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="w-full mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 brutal-btn brutal-btn-secondary text-xs py-2"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
