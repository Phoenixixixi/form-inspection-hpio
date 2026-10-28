'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Building2,
  UserCheck,
  Thermometer,
  Droplets,
  ArrowRight,
  RefreshCcw,
  Send,
  Sparkles,
  ClipboardCheck,
  ChevronDown,
  Layers,
  Settings,
} from 'lucide-react';
import QrCameraScanner from '@/components/QrCameraScanner';
import { QrInspectionPayload } from '@/lib/qr-security';

interface Station {
  id: string;
  name: string;
  code: string;
  location: string;
  rooms: Room[];
}

interface Room {
  id: string;
  station_id: string;
  name: string;
  location?: string | null;
  items: Item[];
}

interface Item {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  name: string;
  user_id: string;
  specialization: string;
  station_id?: string | null;
}

interface CompletedRoomInspection {
  room_id: string;
  room_name: string;
  has_climate: boolean;
  temperature?: number | null;
  humidity?: number | null;
  room_notes?: string;
  items: Array<{
    item_id: string;
    item_name: string;
    status: 'NORMAL' | 'ABNORMAL';
    notes?: string;
  }>;
}

export default function TechnicianApp() {
  // Global Data
  const [stations, setStations] = useState<Station[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Step 1: Session state
  const [selectedTechnicianName, setSelectedTechnicianName] = useState('');
  const [selectedStationId, setSelectedStationId] = useState('');
  const [isSessionStarted, setIsSessionStarted] = useState(false);

  // Step 2: Inspection process state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentInspectingRoom, setCurrentInspectingRoom] = useState<Room | null>(null);

  // Step 3: Room Form State
  const [tempInput, setTempInput] = useState<string>('21.5');
  const [humInput, setHumInput] = useState<string>('55.0');
  const [roomNotes, setRoomNotes] = useState<string>('');
  const [itemStatuses, setItemStatuses] = useState<
    Record<string, { status: 'NORMAL' | 'ABNORMAL'; notes: string }>
  >({});

  // Step 4: Station Aggregation State
  const [completedRooms, setCompletedRooms] = useState<CompletedRoomInspection[]>([]);
  const [stationNotes, setStationNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<any | null>(null);

  // Notification / Alert
  const [alertMessage, setAlertMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/stations');
      const data = await res.json();
      if (data.success) {
        setStations(data.stations || []);
        setTechnicians(data.technicians || []);
        if (data.stations.length > 0) {
          setSelectedStationId(data.stations[0].id);
        }
        if (data.technicians.length > 0) {
          setSelectedTechnicianName(data.technicians[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentStation = stations.find((s) => s.id === selectedStationId);

  const showAlert = (type: 'error' | 'success', text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Start Session
  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechnicianName.trim() || !selectedStationId) {
      showAlert('error', 'Pilih nama teknisi dan stasiun terlebih dahulu!');
      return;
    }
    setIsSessionStarted(true);
  };

  // When QR code is successfully scanned by camera
  const handleQrScanned = (payload: QrInspectionPayload) => {
    setIsScannerOpen(false);

    if (!currentStation) return;

    // Find the room in the station
    const matchedRoom = currentStation.rooms.find((r) => r.id === payload.room_id);

    if (!matchedRoom) {
      showAlert(
        'error',
        `Ruangan "${payload.room_name}" tidak ditemukan di database stasiun ${currentStation.name}!`
      );
      return;
    }

    startInspectingRoom(matchedRoom);
  };

  // Manual fallback selection or QR trigger
  const startInspectingRoom = (room: Room) => {
    setCurrentInspectingRoom(room);

    // Initialize item checklist
    const initialItemMap: Record<string, { status: 'NORMAL' | 'ABNORMAL'; notes: string }> = {};
    (room.items || []).forEach((itm) => {
      initialItemMap[itm.id] = { status: 'NORMAL', notes: '' };
    });
    setItemStatuses(initialItemMap);

    // Reset temperatures with realistic defaults
    const isStationArea = room.name.trim().toLowerCase() === 'station area';
    if (!isStationArea) {
      setTempInput('21.5');
      setHumInput('55.0');
    } else {
      setTempInput('');
      setHumInput('');
    }
    setRoomNotes('');
  };

  // Toggle Item Status
  const toggleItemStatus = (itemId: string, status: 'NORMAL' | 'ABNORMAL') => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        status,
      },
    }));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes,
      },
    }));
  };

  // Save current room inspection into session
  const handleSaveRoomInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInspectingRoom) return;

    const isStationArea = currentInspectingRoom.name.trim().toLowerCase() === 'station area';
    const hasClimate = !isStationArea;

    let parsedTemp: number | null = null;
    let parsedHum: number | null = null;

    if (hasClimate) {
      parsedTemp = parseFloat(tempInput);
      parsedHum = parseFloat(humInput);

      if (isNaN(parsedTemp) || parsedTemp < 10 || parsedTemp > 45) {
        showAlert('error', 'Input suhu harus berupa desimal valid (misal 21.5 °C)!');
        return;
      }
      if (isNaN(parsedHum) || parsedHum < 20 || parsedHum > 95) {
        showAlert('error', 'Input kelembapan harus berupa desimal valid (misal 55.0 %)!');
        return;
      }
    }

    const itemsPayload = (currentInspectingRoom.items || []).map((itm) => {
      const state = itemStatuses[itm.id] || { status: 'NORMAL', notes: '' };
      return {
        item_id: itm.id,
        item_name: itm.name,
        status: state.status,
        notes: state.status === 'ABNORMAL' ? state.notes : '',
      };
    });

    const completed: CompletedRoomInspection = {
      room_id: currentInspectingRoom.id,
      room_name: currentInspectingRoom.name,
      has_climate: hasClimate,
      temperature: parsedTemp,
      humidity: parsedHum,
      room_notes: roomNotes.trim() || undefined,
      items: itemsPayload,
    };

    // Filter out previous inspection of same room if re-inspected
    setCompletedRooms((prev) => [
      ...prev.filter((r) => r.room_id !== completed.room_id),
      completed,
    ]);

    showAlert('success', `Inspeksi ruangan "${currentInspectingRoom.name}" berhasil dicatat!`);
    setCurrentInspectingRoom(null);
  };

  // Submit full station inspection
  const handleSubmitStationInspection = async () => {
    if (!currentStation || completedRooms.length === 0) {
      showAlert('error', 'Minimal harus ada 1 ruangan yang diinspeksi sebelum submit!');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        station_id: currentStation.id,
        technician_name: selectedTechnicianName,
        station_notes: stationNotes.trim(),
        room_inspections: completedRooms.map((r) => ({
          room_id: r.room_id,
          temperature: r.temperature,
          humidity: r.humidity,
          notes: r.room_notes,
          items: r.items.map((i) => ({
            item_id: i.item_id,
            status: i.status,
            notes: i.notes,
          })),
        })),
      };

      const res = await fetch('/api/inspections/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSubmissionSuccess({
          stationName: currentStation.name,
          stationCode: currentStation.code,
          technician: selectedTechnicianName,
          roomCount: completedRooms.length,
          savedCount: data.savedCount,
          time: new Date().toLocaleTimeString('id-ID'),
        });
      } else {
        showAlert('error', data.error || 'Gagal menyimpan hasil inspeksi');
      }
    } catch (err: any) {
      showAlert('error', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSession = () => {
    setIsSessionStarted(false);
    setCurrentInspectingRoom(null);
    setCompletedRooms([]);
    setStationNotes('');
    setSubmissionSuccess(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex flex-col items-center justify-center p-4">
        <div className="brutal-card-lg p-6 bg-white text-center max-w-xs w-full">
          <div className="w-12 h-12 bg-red-600 border-3 border-black mx-auto mb-3 animate-bounce flex items-center justify-center text-white font-black">
            IT
          </div>
          <h2 className="font-black text-sm uppercase">Memuat Form Inspeksi...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-black pb-20">
      {/* Top Header */}
      <header className="bg-black text-white border-b-4 border-black px-4 py-3 sticky top-0 z-30">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 border-2 border-white flex items-center justify-center font-black text-xs text-white">
              IT
            </div>
            <div>
              <h1 className="font-black text-sm uppercase tracking-wide">
                HPIO INSPECTION
              </h1>
              <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">
                Mobile Field Form
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="brutal-badge bg-white text-black hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        </div>
      </header>

      {/* Alert Banner */}
      {alertMessage && (
        <div className="fixed top-14 left-4 right-4 max-w-md mx-auto z-50">
          <div
            className={`brutal-card p-3 font-black text-xs flex items-center gap-2 ${
              alertMessage.type === 'success'
                ? 'bg-green-300 border-black text-black'
                : 'bg-red-600 border-black text-white'
            }`}
          >
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{alertMessage.text}</span>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* ============================================================== */}
        {/* SUCCESS SUMMARY MODAL / SCREEN */}
        {/* ============================================================== */}
        {submissionSuccess && (
          <div className="brutal-card-lg p-6 bg-white border-4 border-black text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 border-3 border-black mx-auto flex items-center justify-center text-black">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div>
              <span className="brutal-badge bg-black text-white text-[10px] mb-1">
                BERHASIL TERSIMPAN
              </span>
              <h2 className="text-xl font-black uppercase text-black">
                Inspeksi Selesai!
              </h2>
              <p className="text-xs font-bold text-gray-600 mt-1">
                Data inspeksi stasiun <b>{submissionSuccess.stationName}</b> telah berhasil dikirim ke server HPIO.
              </p>
            </div>

            <div className="bg-gray-100 border-2 border-black p-3 text-xs text-left space-y-1 font-bold">
              <div className="flex justify-between">
                <span className="text-gray-500">Stasiun:</span>
                <span className="text-black uppercase">[{submissionSuccess.stationCode}] {submissionSuccess.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Teknisi:</span>
                <span className="text-black">{submissionSuccess.technician}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ruangan Diinspeksi:</span>
                <span className="text-black">{submissionSuccess.roomCount} Ruangan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Waktu Kirim:</span>
                <span className="text-black">{submissionSuccess.time} WIB</span>
              </div>
            </div>

            <button
              onClick={handleResetSession}
              className="w-full brutal-btn brutal-btn-primary text-xs py-3 font-black"
            >
              Mulai Inspeksi Baru
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: LOGIN / SELECT SESSION */}
        {/* ============================================================== */}
        {!isSessionStarted && !submissionSuccess && (
          <div className="brutal-card-lg p-5 bg-white border-4 border-black space-y-4">
            <div className="border-b-3 border-black pb-3">
              <span className="brutal-badge bg-red-600 text-white text-[10px] mb-1">
                LANGKAH 1
              </span>
              <h2 className="text-lg font-black uppercase text-black">
                Identitas Teknisi & Stasiun
              </h2>
              <p className="text-xs font-semibold text-gray-500">
                Pilih nama teknisi Anda dan stasiun yang dikunjungi.
              </p>
            </div>

            <form onSubmit={handleStartSession} className="space-y-4">
              {/* Teknisi */}
              <div>
                <label className="block text-xs font-black uppercase mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-red-600" />
                  Nama Teknisi
                </label>
                {technicians.length > 0 ? (
                  <select
                    value={selectedTechnicianName}
                    onChange={(e) => setSelectedTechnicianName(e.target.value)}
                    className="brutal-input text-sm font-bold"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} • {t.user_id} ({t.specialization})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Ketik Nama Teknisi..."
                    value={selectedTechnicianName}
                    onChange={(e) => setSelectedTechnicianName(e.target.value)}
                    className="brutal-input text-sm"
                    required
                  />
                )}
              </div>

              {/* Stasiun */}
              <div>
                <label className="block text-xs font-black uppercase mb-1 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-red-600" />
                  Kode / Nama Stasiun
                </label>
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="brutal-input text-sm font-bold"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      [{st.code}] {st.name} — {st.location || 'Stasiun'}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full brutal-btn brutal-btn-primary text-sm py-3 font-black flex items-center justify-center gap-2 mt-2"
              >
                <span>Mulai Sesi Inspeksi</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* ACTIVE INSPECTION SESSION */}
        {/* ============================================================== */}
        {isSessionStarted && !submissionSuccess && (
          <div className="space-y-4">
            {/* Active Session Info Bar */}
            <div className="brutal-card p-3 bg-black text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
                  <span className="text-[10px] font-black uppercase text-green-400">
                    Sesi Aktif
                  </span>
                </div>
                <div className="font-black text-sm uppercase">
                  {currentStation?.name} [{currentStation?.code}]
                </div>
                <div className="text-[11px] text-gray-300 font-semibold">
                  Teknisi: {selectedTechnicianName}
                </div>
              </div>
              <button
                onClick={handleResetSession}
                className="text-[10px] font-black bg-red-600 text-white px-2 py-1 border border-white hover:bg-white hover:text-black"
              >
                Ganti Sesi
              </button>
            </div>

            {/* ============================================================ */}
            {/* SCREEN A: NOT IN A ROOM -> SHOW QR SCANNER BUTTON & ROOM LIST */}
            {/* ============================================================ */}
            {!currentInspectingRoom && (
              <div className="space-y-4">
                {/* Big QR Scanner Button */}
                <div className="brutal-card-lg p-5 bg-white border-4 border-black text-center space-y-3">
                  <div className="w-14 h-14 bg-red-600 border-3 border-black mx-auto flex items-center justify-center text-white">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="brutal-badge bg-black text-white text-[10px] mb-1">
                      SCAN STIKER FISIK
                    </span>
                    <h2 className="text-base font-black uppercase text-black">
                      Scan QR Ruangan / Datacenter
                    </h2>
                    <p className="text-xs font-semibold text-gray-600 mt-0.5">
                      Arahkan kamera ke stiker QR terpasang di ruangan stasiun {currentStation?.name}.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full brutal-btn brutal-btn-primary text-sm py-3.5 font-black flex items-center justify-center gap-2 shadow-[5px_5px_0px_#000]"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Buka Kamera QR Scanner</span>
                  </button>

                  <div className="pt-2 border-t-2 border-black flex items-center justify-center gap-1 text-[10px] font-bold text-gray-500">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>Anti-Cheat QR: Bukan berupa link URL browser</span>
                  </div>
                </div>

                {/* Status Ruangan di Stasiun Ini */}
                <div className="brutal-card p-4 bg-white border-3 border-black space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-red-600" />
                      <h3 className="font-black text-xs uppercase tracking-wide">
                        Progres Ruangan ({completedRooms.length} / {currentStation?.rooms?.length || 0})
                      </h3>
                    </div>
                    <span className="text-[11px] font-black text-red-600">
                      {completedRooms.length === (currentStation?.rooms?.length || 0) && currentStation?.rooms?.length !== 0
                        ? 'Semua Selesai'
                        : 'Belum Lengkap'}
                    </span>
                  </div>

                  {/* Room Quick List / Fallback Manual Picker */}
                  <div className="space-y-2">
                    {currentStation?.rooms && currentStation.rooms.length > 0 ? (
                      currentStation.rooms.map((room) => {
                        const isCompleted = completedRooms.some((cr) => cr.room_id === room.id);
                        const isStationArea = room.name.trim().toLowerCase() === 'station area';

                        return (
                          <div
                            key={room.id}
                            className={`p-3 border-2 border-black flex items-center justify-between text-xs font-black ${
                              isCompleted ? 'bg-green-100 border-black' : 'bg-gray-50'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                                ) : (
                                  <span className="w-3 h-3 border border-black bg-white inline-block"></span>
                                )}
                                <span className="uppercase text-black">{room.name}</span>
                              </div>
                              <div className="text-[10px] text-gray-500 font-semibold pl-4">
                                {room.items?.length || 0} Perangkat {isStationArea && '• (No Climate)'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => startInspectingRoom(room)}
                              className="text-[11px] font-black px-2 py-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
                            >
                              {isCompleted ? 'Edit' : 'Inspeksi'}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-yellow-100 border-2 border-black text-xs font-bold text-center">
                        Belum ada ruangan di stasiun ini. Silakan buka menu{' '}
                        <Link href="/admin" className="underline font-black text-red-600">
                          Admin
                        </Link>{' '}
                        untuk generate ruangan.
                      </div>
                    )}
                  </div>
                </div>

                {/* Station Final Notes & Submit Card */}
                {completedRooms.length > 0 && (
                  <div className="brutal-card-lg p-5 bg-white border-4 border-black space-y-3">
                    <div className="border-b-2 border-black pb-2">
                      <span className="brutal-badge bg-red-600 text-white text-[10px] mb-1">
                        FORM AKHIR STASIUN
                      </span>
                      <h3 className="font-black text-base uppercase text-black">
                        Catatan Utama Stasiun {currentStation?.name}
                      </h3>
                      <p className="text-[11px] font-semibold text-gray-500">
                        1 catatan umum stasiun untuk seluruh inspeksi ruangan di atas.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase mb-1">
                        Catatan Kunjungan Stasiun
                      </label>
                      <textarea
                        rows={3}
                        value={stationNotes}
                        onChange={(e) => setStationNotes(e.target.value)}
                        placeholder="Contoh: Seluruh perangkat berjalan normal, AC presisi ruang datacenter stabil, kebersihan ruangan baik..."
                        className="brutal-input text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmitStationInspection}
                      className="w-full brutal-btn brutal-btn-primary text-sm py-3 font-black flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <span>Menyimpan ke Server...</span>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit & Selesaikan Inspeksi</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* SCREEN B: ROOM INSPECTION FORM */}
            {/* ============================================================ */}
            {currentInspectingRoom && (
              <div className="brutal-card-lg p-5 bg-white border-4 border-black space-y-4">
                {/* Header Room Info */}
                <div className="border-b-3 border-black pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="brutal-badge bg-red-600 text-white text-[10px]">
                      FORM RUANGAN
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentInspectingRoom(null)}
                      className="text-xs font-black text-gray-600 hover:text-black underline"
                    >
                      ← Kembali
                    </button>
                  </div>
                  <h2 className="text-xl font-black uppercase text-black tracking-tight">
                    {currentInspectingRoom.name}
                  </h2>
                  <p className="text-xs font-bold text-gray-600">
                    Stasiun {currentStation?.name} [{currentStation?.code}] {currentInspectingRoom.location && `• ${currentInspectingRoom.location}`}
                  </p>
                </div>

                <form onSubmit={handleSaveRoomInspection} className="space-y-4">
                  {/* Climate Parameters: Suhu & Kelembapan */}
                  {/* ATURAN: Kecuali nama ruangan 'Station Area' */}
                  {currentInspectingRoom.name.trim().toLowerCase() === 'station area' ? (
                    <div className="bg-yellow-200 border-2 border-black p-3 text-xs font-black flex items-center gap-2">
                      <span className="bg-black text-white px-1.5 py-0.5 text-[10px]">
                        INFO
                      </span>
                      <span>
                        Ruangan <b>Station Area</b> (Area Publik): Parameter Suhu & Kelembapan tidak diperlukan.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 border-3 border-black space-y-3">
                      <div className="flex items-center gap-1.5 border-b-2 border-black pb-1.5">
                        <Thermometer className="w-4 h-4 text-red-600" />
                        <h4 className="font-black text-xs uppercase text-black">
                          Suhu & Kelembapan Lingkungan (Desimal)
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Suhu */}
                        <div>
                          <label className="block text-[11px] font-black uppercase text-gray-700 mb-1 flex items-center gap-1">
                            <Thermometer className="w-3.5 h-3.5 text-red-600" />
                            Suhu (°C)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="21.5"
                            value={tempInput}
                            onChange={(e) => setTempInput(e.target.value)}
                            className="brutal-input text-base font-black py-2"
                            required
                          />
                          <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                            Standard: 18.0 - 24.0 °C
                          </span>
                        </div>

                        {/* Kelembapan */}
                        <div>
                          <label className="block text-[11px] font-black uppercase text-gray-700 mb-1 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5 text-blue-600" />
                            Kelembapan (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="55.0"
                            value={humInput}
                            onChange={(e) => setHumInput(e.target.value)}
                            className="brutal-input text-base font-black py-2"
                            required
                          />
                          <span className="text-[10px] text-gray-500 font-bold block mt-0.5">
                            Standard: 45.0 - 65.0 %
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checklist Perangkat / Items (Each datacenter has different items) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-black pb-1">
                      <h4 className="font-black text-xs uppercase text-black flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4 text-red-600" />
                        Checklist Perangkat Ruangan ({currentInspectingRoom.items?.length || 0})
                      </h4>
                      <span className="text-[10px] font-bold text-gray-500">
                        Pilih Normal / Abnormal
                      </span>
                    </div>

                    {currentInspectingRoom.items && currentInspectingRoom.items.length > 0 ? (
                      <div className="space-y-2.5">
                        {currentInspectingRoom.items.map((itm) => {
                          const itmState = itemStatuses[itm.id] || { status: 'NORMAL', notes: '' };
                          const isNormal = itmState.status === 'NORMAL';

                          return (
                            <div
                              key={itm.id}
                              className={`p-3 border-2 border-black transition-all ${
                                isNormal ? 'bg-white' : 'bg-red-50 border-red-600'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="font-black text-xs uppercase text-black">
                                  {itm.name}
                                </span>

                                {/* Chunky Toggle Buttons */}
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemStatus(itm.id, 'NORMAL')}
                                    className={`px-2.5 py-1 text-[11px] font-black border-2 border-black uppercase transition-all ${
                                      isNormal
                                        ? 'bg-green-500 text-black shadow-[2px_2px_0px_#000]'
                                        : 'bg-white text-gray-400 hover:text-black'
                                    }`}
                                  >
                                    NORMAL
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleItemStatus(itm.id, 'ABNORMAL')}
                                    className={`px-2.5 py-1 text-[11px] font-black border-2 border-black uppercase transition-all ${
                                      !isNormal
                                        ? 'bg-red-600 text-white shadow-[2px_2px_0px_#000]'
                                        : 'bg-white text-gray-400 hover:text-black'
                                    }`}
                                  >
                                    ABNORMAL
                                  </button>
                                </div>
                              </div>

                              {/* Input catatan jika ABNORMAL */}
                              {!isNormal && (
                                <div className="mt-2 pt-2 border-t border-red-300">
                                  <label className="block text-[10px] font-black uppercase text-red-700 mb-0.5">
                                    Catatan Kerusakan / Abnormalitas *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Jelaskan kendala/indikator error..."
                                    value={itmState.notes}
                                    onChange={(e) => updateItemNotes(itm.id, e.target.value)}
                                    className="brutal-input text-xs py-1.5 border-red-600"
                                    required={!isNormal}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-gray-400 italic text-center py-3 bg-gray-50 border border-black">
                        Tidak ada item terdaftar pada ruangan ini.
                      </p>
                    )}
                  </div>

                  {/* Catatan Ruangan (Opsional) */}
                  <div>
                    <label className="block text-xs font-black uppercase mb-1">
                      Catatan Tambahan Ruangan (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kunci pintu sedikit macet, lampu indikator rack 2 berkedip..."
                      value={roomNotes}
                      onChange={(e) => setRoomNotes(e.target.value)}
                      className="brutal-input text-xs py-2"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 brutal-btn brutal-btn-primary text-xs py-3 font-black"
                    >
                      Simpan Inspeksi Ruangan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentInspectingRoom(null)}
                      className="brutal-btn brutal-btn-secondary text-xs py-3 font-black px-4"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Camera QR Scanner Modal */}
      {isScannerOpen && currentStation && (
        <QrCameraScanner
          expectedStationId={currentStation.id}
          expectedStationCode={currentStation.code}
          onScanSuccess={handleQrScanned}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
