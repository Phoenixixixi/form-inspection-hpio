'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ShieldAlert, Thermometer, MapPin } from 'lucide-react';
import { generateRoomQrPayload } from '@/lib/qr-security';

interface PrintableQrStickerProps {
  station: { id: string; name: string; code: string };
  room: { id: string; name: string; location?: string | null };
}

export default function PrintableQrSticker({ station, room }: PrintableQrStickerProps) {
  const isStationArea = room.name.trim().toLowerCase() === 'station area';
  const hasClimate = !isStationArea;

  const qrPayload = generateRoomQrPayload({
    station_id: station.id,
    station_code: station.code,
    room_id: room.id,
    room_name: room.name,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Visual Sticker Card */}
      <div
        id={`sticker-${room.id}`}
        className="w-full max-w-sm brutal-card bg-white p-5 border-4 border-black relative flex flex-col items-center print:border-4 print:shadow-none print:w-full"
      >
        {/* Top Header Tag */}
        <div className="w-full flex items-center justify-between pb-3 border-b-3 border-black mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-red-600 border border-black inline-block"></span>
            <span className="font-black text-xs tracking-wider uppercase text-black">
              HPIO IT INSPECTION
            </span>
          </div>
          <span className="brutal-badge bg-black text-white text-[10px]">
            {station.code}
          </span>
        </div>

        {/* Station & Room Title */}
        <div className="text-center w-full mb-3">
          <div className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 text-red-600" />
            STASIUN {station.name.toUpperCase()}
          </div>
          <h2 className="text-xl font-black uppercase text-black tracking-tight mt-0.5">
            {room.name}
          </h2>
          {room.location && (
            <p className="text-xs font-semibold text-gray-500 mt-0.5">
              {room.location}
            </p>
          )}
        </div>

        {/* QR Code Container with bold black border */}
        <div className="p-3 bg-white border-4 border-black shadow-[4px_4px_0px_#000] my-2 relative">
          <QRCodeSVG
            value={qrPayload}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Climate Indicator Badge */}
        <div className="mt-3 w-full">
          {hasClimate ? (
            <div className="bg-red-50 border-2 border-red-600 p-2 text-center text-xs font-black text-red-700 flex items-center justify-center gap-1.5">
              <Thermometer className="w-4 h-4 text-red-600 shrink-0" />
              <span>INSPEKSI SUHU & KELEMBAPAN AKTIF</span>
            </div>
          ) : (
            <div className="bg-yellow-200 border-2 border-black p-2 text-center text-xs font-black text-black flex items-center justify-center gap-1.5">
              <span>AREA PUBLIK — TANPA SUHU & KELEMBAPAN</span>
            </div>
          )}
        </div>

        {/* Anti-cheat disclaimer */}
        <div className="mt-3 w-full pt-2 border-t-2 border-black flex items-center justify-between text-[10px] font-bold text-gray-500">
          <span className="flex items-center gap-1 text-black">
            <ShieldAlert className="w-3 h-3 text-red-600" />
            NON-URL SECURE JSON
          </span>
          <span className="font-mono text-black">ROOM #{room.id.substring(0, 6)}</span>
        </div>
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="mt-4 flex gap-2 w-full max-w-sm no-print">
        <button
          onClick={handlePrint}
          className="flex-1 brutal-btn brutal-btn-black text-xs py-2.5 flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Stiker</span>
        </button>
      </div>
    </div>
  );
}
