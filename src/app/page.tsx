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
  Send,
  ClipboardCheck,
  Layers,
  Settings,
  Clock,
  Lock,
  Edit3,
  QrCode,
  Sun,
  Sunset,
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
  session: 'PAGI' | 'SIANG';
  has_climate: boolean;
  temperature?: number | null;
  humidity?: number | null;
  items: Array<{
    item_id: string;
    item_name: string;
    status: 'NORMAL' | 'ABNORMAL';
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
  const [activeSession, setActiveSession] = useState<'PAGI' | 'SIANG'>('PAGI');

  useEffect(() => {
    if (new Date().getHours() >= 12) {
      setActiveSession('SIANG');
    }
  }, []);

  // Step 2: Inspection process state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentInspectingRoom, setCurrentInspectingRoom] = useState<Room | null>(null);

  // Step 3: Room Form State (Suhu, Kelembapan, Item Statuses: ONLY Normal/Abnormal without individual notes)
  const [tempInput, setTempInput] = useState<string>('21.5');
  const [humInput, setHumInput] = useState<string>('55.0');
  const [itemStatuses, setItemStatuses] = useState<Record<string, 'NORMAL' | 'ABNORMAL'>>({});

  // Step 4: Station Aggregation State (Catatan Utama per Sesi Inspeksi)
  const [completedRooms, setCompletedRooms] = useState<CompletedRoomInspection[]>([]);
  const [pagiNotes, setPagiNotes] = useState<string>('');
  const [siangNotes, setSiangNotes] = useState<string>('');
  const [submittedSessions, setSubmittedSessions] = useState<{ PAGI: boolean; SIANG: boolean }>({
    PAGI: false,
    SIANG: false,
  });
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

  // Sinkronisasi otomatis data ruangan yang sudah diinspeksi hari ini (DB + LocalStorage)
  const loadStationProgress = async (stationId: string) => {
    const todayKey = new Date().toISOString().split('T')[0];
    let localDrafts: CompletedRoomInspection[] = [];

    try {
      const raw = localStorage.getItem(`hpio_progress_${stationId}_${todayKey}`);
      if (raw) {
        localDrafts = JSON.parse(raw);
      }
    } catch {}

    try {
      const res = await fetch(`/api/inspections/history?station_id=${stationId}&today_only=true`);
      const data = await res.json();
      if (data.success && data.inspections) {
        const dbCompleted: CompletedRoomInspection[] = data.inspections
          .filter((insp: any) => insp.room_id)
          .map((insp: any) => ({
            room_id: insp.room_id,
            room_name: insp.room?.name || 'Ruangan',
            session: (insp.session as 'PAGI' | 'SIANG') || 'PAGI',
            has_climate: insp.temperature !== null,
            temperature: insp.temperature ? Number(insp.temperature) : null,
            humidity: insp.humidity ? Number(insp.humidity) : null,
            items: (insp.inspection_items || []).map((itm: any) => ({
              item_id: itm.item_id || '',
              item_name: itm.item?.name || 'Item',
              status: itm.status || 'NORMAL',
            })),
          }));

        const map = new Map<string, CompletedRoomInspection>();
        dbCompleted.forEach((item) => map.set(`${item.room_id}_${item.session}`, item));
        localDrafts.forEach((item) => map.set(`${item.room_id}_${item.session || 'PAGI'}`, item));

        const merged = Array.from(map.values());
        setCompletedRooms(merged);
        localStorage.setItem(`hpio_progress_${stationId}_${todayKey}`, JSON.stringify(merged));

        // Cek status submit per sesi dari database
        const hasPagi = data.inspections.some((i: any) => i.session === 'PAGI');
        const hasSiang = data.inspections.some((i: any) => i.session === 'SIANG');
        setSubmittedSessions({ PAGI: hasPagi, SIANG: hasSiang });

        // Ambil catatan utama masing-masing sesi jika sudah pernah disimpan
        const existingPagiNote = data.inspections.find(
          (i: any) => i.session === 'PAGI' && i.notes && i.notes.trim().length > 0
        )?.notes;
        if (existingPagiNote) {
          setPagiNotes(existingPagiNote);
        }

        const existingSiangNote = data.inspections.find(
          (i: any) => i.session === 'SIANG' && i.notes && i.notes.trim().length > 0
        )?.notes;
        if (existingSiangNote) {
          setSiangNotes(existingSiangNote);
        }
        return;
      }
    } catch (err) {
      console.error('Failed to sync today inspection history', err);
    }

    if (localDrafts.length > 0) {
      setCompletedRooms(localDrafts);
    }
  };

  // Start Session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechnicianName.trim() || !selectedStationId) {
      showAlert('error', 'Pilih nama teknisi dan stasiun terlebih dahulu!');
      return;
    }
    await loadStationProgress(selectedStationId);
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

    // CEK APAKAH RUANGAN INI SUDAH DIINSPEKSI UNTUK SESI AKTIF (PAGI / SIANG)?
    const isAlreadyCompleted = completedRooms.some(
      (cr) => cr.room_id === matchedRoom.id && cr.session === activeSession
    );
    if (isAlreadyCompleted) {
      showAlert(
        'error',
        `🔒 RUANGAN TERKUNCI: "${matchedRoom.name}" sudah berstatus SELESAI untuk Sesi ${activeSession}. Silakan scan ruangan lainnya yang belum diisi.`
      );
      return;
    }

    // Jika ruangan beda dan belum diisi di sesi ini -> Buka form inspeksi
    startInspectingRoom(matchedRoom);
  };

  // Memulai inspeksi ruangan (melalui QR scan)
  const startInspectingRoom = (room: Room) => {
    // Kunci ruangan jika sudah pernah diinspeksi untuk sesi aktif
    const isAlreadyCompleted = completedRooms.some(
      (cr) => cr.room_id === room.id && cr.session === activeSession
    );
    if (isAlreadyCompleted) {
      showAlert(
        'error',
        `🔒 RUANGAN TERKUNCI: Ruangan "${room.name}" sudah berstatus SELESAI untuk Sesi ${activeSession}.`
      );
      return;
    }

    setCurrentInspectingRoom(room);

    // Initialize item checklist with default NORMAL
    const initialItemMap: Record<string, 'NORMAL' | 'ABNORMAL'> = {};
    (room.items || []).forEach((itm) => {
      initialItemMap[itm.id] = 'NORMAL';
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
  };

  // Toggle Item Status (Pure NORMAL or ABNORMAL, no individual notes)
  const toggleItemStatus = (itemId: string, status: 'NORMAL' | 'ABNORMAL') => {
    setItemStatuses((prev) => ({
      ...prev,
      [itemId]: status,
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
      return {
        item_id: itm.id,
        item_name: itm.name,
        status: itemStatuses[itm.id] || 'NORMAL',
      };
    });

    const completed: CompletedRoomInspection = {
      room_id: currentInspectingRoom.id,
      room_name: currentInspectingRoom.name,
      session: activeSession,
      has_climate: hasClimate,
      temperature: parsedTemp,
      humidity: parsedHum,
      items: itemsPayload,
    };

    const updated = [
      ...completedRooms.filter(
        (r) => !(r.room_id === completed.room_id && r.session === completed.session)
      ),
      completed,
    ];
    setCompletedRooms(updated);

    // Simpan progres ke LocalStorage agar reload/refresh tidak me-reset ke nol
    if (currentInspectingRoom.station_id) {
      const todayKey = new Date().toISOString().split('T')[0];
      try {
        localStorage.setItem(
          `hpio_progress_${currentInspectingRoom.station_id}_${todayKey}`,
          JSON.stringify(updated)
        );
      } catch {}
    }

    showAlert(
      'success',
      `✓ STATUS: SELESAI! Inspeksi "${currentInspectingRoom.name}" (${activeSession === 'PAGI' ? 'Sesi Pagi' : 'Sesi Siang'}) berhasil dicatat.`
    );
    setCurrentInspectingRoom(null);
  };

  // Submit full station inspection for active session (Pagi atau Siang) sekalian dengan catatan utama sesi tsb
  const handleSubmitStationInspection = async () => {
    if (!currentStation) return;
    const totalRooms = currentStation.rooms?.length || 0;
    const sessionCompletedRooms = completedRooms.filter((r) => r.session === activeSession);

    // Cegah kirim 2 kali untuk sesi yang sama
    if (submittedSessions[activeSession]) {
      showAlert(
        'error',
        `🔒 Sesi ${activeSession === 'PAGI' ? 'Pagi' : 'Siang'} sudah pernah disubmit hari ini dan telah terkunci!`
      );
      return;
    }

    if (totalRooms === 0 || sessionCompletedRooms.length < totalRooms) {
      showAlert(
        'error',
        `Submit sesi hanya dapat dikirim jika seluruh ruangan (${sessionCompletedRooms.length}/${totalRooms}) pada Sesi ${activeSession} sudah selesai diinspeksi!`
      );
      return;
    }

    const currentNote = activeSession === 'PAGI' ? pagiNotes : siangNotes;

    try {
      setIsSubmitting(true);

      const payload = {
        station_id: currentStation.id,
        technician_name: selectedTechnicianName,
        session: activeSession,
        station_notes: currentNote.trim() || null,
        room_inspections: sessionCompletedRooms.map((r) => ({
          room_id: r.room_id,
          temperature: r.temperature,
          humidity: r.humidity,
          session: r.session,
          notes: null,
          items: r.items.map((i) => ({
            item_id: i.item_id,
            status: i.status,
            notes: null,
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
        setSubmittedSessions((prev) => ({ ...prev, [activeSession]: true }));
        setSubmissionSuccess({
          stationName: currentStation.name,
          stationCode: currentStation.code,
          technician: selectedTechnicianName,
          session: activeSession,
          roomCount: sessionCompletedRooms.length,
          savedCount: data.savedCount,
          time: new Date().toLocaleTimeString('id-ID'),
        });
        showAlert(
          'success',
          `✓ Sesi ${activeSession === 'PAGI' ? 'Pagi' : 'Siang'} beserta Catatan Utama berhasil disubmit ke server!`
        );
        await loadStationProgress(currentStation.id);
      } else {
        showAlert('error', data.error || 'Gagal menyimpan hasil inspeksi');
      }
    } catch (err: any) {
      showAlert('error', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Perbarui Catatan Utama Sesi jika sudah pernah disubmit
  const handleUpdateSessionNotes = async () => {
    if (!currentStation) return;
    const currentNote = activeSession === 'PAGI' ? pagiNotes : siangNotes;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/inspections/submit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: currentStation.id,
          session: activeSession,
          station_notes: currentNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showAlert(
          'success',
          `✓ Catatan utama Sesi ${activeSession === 'PAGI' ? 'Pagi' : 'Siang'} berhasil diperbarui!`
        );
      } else {
        showAlert('error', data.error || 'Gagal memperbarui catatan utama');
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
    setPagiNotes('');
    setSiangNotes('');
    setSubmittedSessions({ PAGI: false, SIANG: false });
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
                BERHASIL TERSIMPAN • SESI {submissionSuccess.session || 'PAGI'}
              </span>
              <h2 className="text-xl font-black uppercase text-black">
                Inspeksi Sesi {submissionSuccess.session === 'SIANG' ? 'Siang' : 'Pagi'} Selesai!
              </h2>
              <p className="text-xs font-bold text-gray-600 mt-1">
                Data inspeksi stasiun <b>{submissionSuccess.stationName}</b> telah berhasil dikirim ke server HPIO.
              </p>
            </div>

            <div className="bg-gray-100 border-2 border-black p-3 text-xs text-left space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span className="text-gray-500">Stasiun:</span>
                <span className="text-black uppercase">[{submissionSuccess.stationCode}] {submissionSuccess.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sesi:</span>
                <span className="text-black font-extrabold">
                  {submissionSuccess.session === 'SIANG' ? '☀️ Inspeksi Siang' : '🌅 Inspeksi Pagi'}
                </span>
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

            <div className="space-y-2">
              {submissionSuccess.session === 'PAGI' && (
                <button
                  onClick={() => {
                    setActiveSession('SIANG');
                    setSubmissionSuccess(null);
                  }}
                  className="w-full brutal-btn bg-orange-400 hover:bg-orange-500 text-black text-xs py-3 font-black border-2 border-black flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
                >
                  <Sunset className="w-4 h-4" />
                  <span>Lanjut ke Inspeksi Siang ☀️</span>
                </button>
              )}
              <button
                onClick={() => setSubmissionSuccess(null)}
                className="w-full brutal-btn bg-yellow-300 hover:bg-yellow-400 text-black text-xs py-3 font-black border-2 border-black flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>Lihat Ringkasan Ruangan / Edit Catatan</span>
              </button>
              <button
                onClick={handleResetSession}
                className="w-full brutal-btn brutal-btn-black text-xs py-3 font-black"
              >
                Pilih / Pindah ke Stasiun Lain
              </button>
            </div>
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
                Pilih nama teknisi dan stasiun yang dikunjungi.
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
                    className="brutal-input text-xs font-bold"
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
          <div className="space-y-3.5">
            {/* Active Session Info Bar */}
            <div className="bg-slate-900 text-white border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_#000] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 border border-white flex items-center justify-center font-black text-xs text-white shrink-0">
                  IT
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-sm uppercase tracking-wide text-white">
                      {currentStation?.name}
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded border border-slate-700">
                      {currentStation?.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Teknisi: <span className="font-semibold text-white">{selectedTechnicianName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetSession}
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:border-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Ganti
              </button>
            </div>

            {/* ============================================================ */}
            {/* SCREEN A: NOT IN A ROOM -> SHOW QR SCANNER BUTTON & ROOM LIST */}
            {/* ============================================================ */}
            {!currentInspectingRoom && (() => {
              const allStationRooms = currentStation?.rooms || [];
              const pagiRooms = completedRooms.filter((cr) => cr.session === 'PAGI');
              const siangRooms = completedRooms.filter((cr) => cr.session === 'SIANG');

              const activeDoneRooms = activeSession === 'PAGI' ? pagiRooms : siangRooms;

              const uncompletedRooms = allStationRooms.filter(
                (room) => !activeDoneRooms.some((cr) => cr.room_id === room.id)
              );
              const doneRooms = allStationRooms.filter(
                (room) => activeDoneRooms.some((cr) => cr.room_id === room.id)
              );
              const progressPercent = allStationRooms.length > 0
                ? Math.round((doneRooms.length / allStationRooms.length) * 100)
                : 0;

              const isAllRoomsDoneInCurrentSession =
                allStationRooms.length > 0 && doneRooms.length === allStationRooms.length;

              return (
                <div className="space-y-3.5">
                  {/* Selector Sesi Inspeksi (2x Sehari: Pagi & Siang) */}
                  <div className="bg-white border-2 border-black rounded-xl p-2.5 shadow-[3px_3px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Sesi Inspeksi Hari Ini (2x Sehari):</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-extrabold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Catatan Tiap Sesi
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveSession('PAGI')}
                        className={`py-2 px-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-center gap-2 transition-all ${
                          activeSession === 'PAGI'
                            ? 'bg-amber-400 text-black shadow-[2px_2px_0px_#000] -translate-y-0.5'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Sun className="w-4 h-4 text-amber-700" />
                        <span>Inspeksi Pagi</span>
                        {submittedSessions.PAGI ? (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black">
                            ✓ Terkirim
                          </span>
                        ) : (
                          <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-mono">
                            {pagiRooms.length}/{allStationRooms.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveSession('SIANG')}
                        className={`py-2 px-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-center gap-2 transition-all ${
                          activeSession === 'SIANG'
                            ? 'bg-orange-500 text-white shadow-[2px_2px_0px_#000] -translate-y-0.5'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Sunset className="w-4 h-4 text-white" />
                        <span>Inspeksi Siang</span>
                        {submittedSessions.SIANG ? (
                          <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black">
                            ✓ Terkirim
                          </span>
                        ) : (
                          <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-mono">
                            {siangRooms.length}/{allStationRooms.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Scanner & Progress Combined Card */}
                  <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_#000] space-y-3">
                    <button
                      onClick={() => setIsScannerOpen(true)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white border-2 border-black rounded-xl py-3 px-4 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] font-black text-sm flex items-center justify-center gap-2 transition-transform"
                    >
                      <Camera className="w-5 h-5" />
                      <span>Buka Kamera Scan QR Ruangan (Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'})</span>
                    </button>

                    <p className="text-[11px] text-slate-500 font-medium text-center">
                      Arahkan kamera ke stiker QR fisik yang terpasang di ruangan
                    </p>

                    {/* Progress Bar */}
                    <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600">
                          Status Progres Sesi {activeSession === 'PAGI' ? 'Pagi 🌅' : 'Siang ☀️'}:
                        </span>
                        <span className="text-slate-900 font-black">
                          {doneRooms.length} / {allStationRooms.length} Ruangan ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 border border-slate-300 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* DAFTAR 1: RUANGAN BELUM DIISI */}
                  {/* ============================================================== */}
                  <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                          Ruangan Belum Diisi - Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} ({uncompletedRooms.length})
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Wajib Scan QR
                      </span>
                    </div>

                    <div className="space-y-2">
                      {uncompletedRooms.length > 0 ? (
                        uncompletedRooms.map((room) => {
                          const otherSession = activeSession === 'PAGI' ? 'SIANG' : 'PAGI';
                          const isOtherDone = completedRooms.some(
                            (cr) => cr.room_id === room.id && cr.session === otherSession
                          );

                          return (
                            <div
                              key={room.id}
                              className="p-3 border border-slate-200 rounded-xl bg-slate-50/70 flex items-center justify-between gap-3 shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{room.name}</span>
                                  {isOtherDone && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded shrink-0">
                                      ✓ {otherSession} Selesai
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  {room.items?.length || 0} Perangkat
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg">
                                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                                <span>Scan QR</span>
                              </div>
                            </div>
                          );
                        })
                      ) : allStationRooms.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-center text-amber-900">
                          Belum ada ruangan di stasiun ini. Silakan buka menu{' '}
                          <Link href="/admin" className="underline font-bold text-red-600">
                            Admin
                          </Link>{' '}
                          untuk generate ruangan.
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-center space-y-1">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                          <p className="text-xs font-extrabold text-emerald-900">
                            Semua Ruangan Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} Telah Selesai!
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            {activeSession === 'PAGI'
                              ? 'Seluruh ruangan sesi pagi sudah diinspeksi. Lengkapi catatan utama sesi pagi lalu klik submit di bawah.'
                              : 'Seluruh ruangan sesi siang sudah diinspeksi. Lengkapi catatan utama sesi siang lalu klik submit di bawah.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ============================================================== */}
                  {/* DAFTAR 2: RUANGAN SELESAI DIINSPEKSI */}
                  {/* ============================================================== */}
                  <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                          Ruangan Selesai Diinspeksi - Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} ({doneRooms.length})
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Terkunci
                      </span>
                    </div>

                    <div className="space-y-2">
                      {doneRooms.length > 0 ? (
                        doneRooms.map((room) => {
                          const completedData = completedRooms.find(
                            (cr) => cr.room_id === room.id && cr.session === activeSession
                          );
                          const otherSession = activeSession === 'PAGI' ? 'SIANG' : 'PAGI';
                          const otherData = completedRooms.find(
                            (cr) => cr.room_id === room.id && cr.session === otherSession
                          );
                          const isStationArea = room.name.trim().toLowerCase() === 'station area';

                          return (
                            <div
                              key={room.id}
                              className="p-3 border border-emerald-300 rounded-xl bg-emerald-50/70 flex items-center justify-between gap-3 shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="font-bold text-sm text-slate-900 truncate">
                                    {room.name}
                                  </span>
                                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                    activeSession === 'PAGI'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-orange-100 text-orange-900 border-orange-300'
                                  }`}>
                                    {activeSession === 'PAGI' ? '🌅 Pagi' : '☀️ Siang'}
                                  </span>
                                  {otherData && (
                                    <span className="text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded">
                                      + {otherSession}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-600 font-medium pl-5.5 mt-0.5">
                                  {!isStationArea && completedData?.temperature !== undefined && completedData?.temperature !== null ? (
                                    <span>
                                      🌡️ {completedData.temperature}°C • 💧 {completedData.humidity}% • {completedData?.items?.length || room.items?.length || 0} Perangkat
                                    </span>
                                  ) : (
                                    <span>{completedData?.items?.length || room.items?.length || 0} Perangkat</span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  showAlert(
                                    'error',
                                    `🔒 Ruangan "${room.name}" sudah berstatus SELESAI untuk Sesi ${activeSession} dan terkunci.`
                                  )
                                }
                                className="shrink-0 text-[11px] font-bold px-2.5 py-1 bg-white text-slate-600 border border-slate-300 hover:border-slate-500 rounded-lg flex items-center gap-1 shadow-sm"
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>Selesai</span>
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-500">
                          Belum ada ruangan yang selesai diinspeksi pada Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'}.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* KARTU SUBMIT HASIL SESI INSPEKSI & CATATAN UTAMA (PAGI / SIANG) */}
                  <div className="bg-white border-2 border-black rounded-xl p-4 shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="border-b border-slate-200 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                          activeSession === 'PAGI'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-orange-100 text-orange-900 border-orange-300'
                        }`}>
                          SESI {activeSession === 'PAGI' ? 'PAGI 🌅' : 'SIANG ☀️'}
                        </span>
                        {submittedSessions[activeSession] ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tersimpan di Database (Terkunci)
                          </span>
                        ) : isAllRoomsDoneInCurrentSession ? (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {doneRooms.length}/{allStationRooms.length} Ruangan Siap Kirim
                          </span>
                        ) : null}
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        Submit Sesi {activeSession === 'PAGI' ? 'Inspeksi Pagi & Catatan 🌅' : 'Inspeksi Siang & Catatan ☀️'}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Submit checklist seluruh ruangan beserta Catatan Utama Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} dalam 1 kali kirim.
                      </p>
                    </div>

                    <div>
                      {submittedSessions[activeSession] ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex items-start gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="text-xs">
                              <p className="font-extrabold text-emerald-900">
                                Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} Telah Disubmit ke Server!
                              </p>
                              <p className="text-emerald-800 text-[11px] mt-0.5">
                                Seluruh data inspeksi ruangan dan catatan utama sesi ini sudah tersimpan dan terkunci agar tidak terkirim dua kali.
                              </p>
                            </div>
                          </div>

                          {/* Catatan Utama yang tersimpan dengan opsi edit jika diperlukan */}
                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700">
                              Catatan Utama Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} (Tersimpan):
                            </label>
                            <textarea
                              rows={3}
                              value={activeSession === 'PAGI' ? pagiNotes : siangNotes}
                              onChange={(e) =>
                                activeSession === 'PAGI'
                                  ? setPagiNotes(e.target.value)
                                  : setSiangNotes(e.target.value)
                              }
                              placeholder={`Tuliskan catatan utama Sesi ${activeSession === 'PAGI' ? 'Pagi' : 'Siang'}...`}
                              className="w-full border-2 border-slate-300 focus:border-red-600 rounded-xl p-3 text-xs font-medium outline-none transition-colors"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleUpdateSessionNotes}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-xl text-xs py-2.5 font-bold flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
                              >
                                {isSubmitting ? <span>Menyimpan...</span> : <span>Perbarui Catatan Sesi Ini (Edit)</span>}
                              </button>
                              {activeSession === 'PAGI' && (
                                <button
                                  type="button"
                                  onClick={() => setActiveSession('SIANG')}
                                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-2 border-black rounded-xl text-xs py-2.5 font-black flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
                                >
                                  <Sunset className="w-3.5 h-3.5" />
                                  <span>Buka Sesi Siang ☀️</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : isAllRoomsDoneInCurrentSession ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-black text-slate-900 mb-1">
                              Catatan Utama Sesi {activeSession === 'PAGI' ? 'Pagi 🌅' : 'Siang ☀️'} (Wajib/Opsional):
                            </label>
                            <textarea
                              rows={3}
                              value={activeSession === 'PAGI' ? pagiNotes : siangNotes}
                              onChange={(e) =>
                                activeSession === 'PAGI'
                                  ? setPagiNotes(e.target.value)
                                  : setSiangNotes(e.target.value)
                              }
                              placeholder={`Contoh: Perangkat IT, temperatur dan kebersihan ruangan stasiun pada Sesi ${activeSession === 'PAGI' ? 'Pagi' : 'Siang'} berjalan normal...`}
                              className="w-full border-2 border-slate-300 focus:border-red-600 rounded-xl p-3 text-xs font-medium outline-none transition-colors"
                            />
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Catatan utama ini akan disematkan pada seluruh data inspeksi Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'}.
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleSubmitStationInspection}
                            className="w-full bg-red-600 hover:bg-red-700 text-white border-2 border-black rounded-xl text-xs py-3 font-extrabold flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                          >
                            {isSubmitting ? (
                              <span>Menyimpan ke Server...</span>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>Submit Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'} & Catatan ({doneRooms.length} Ruangan)</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-center text-xs text-slate-600 font-medium">
                          Submit sesi {activeSession === 'PAGI' ? 'pagi' : 'siang'} dapat dilakukan setelah <b>seluruh ruangan ({doneRooms.length} / {allStationRooms.length})</b> selesai diinspeksi.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ============================================================ */}
            {/* SCREEN B: ROOM INSPECTION FORM */}
            {/* ============================================================ */}
            {currentInspectingRoom && (
              <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[3px_3px_0px_#000] space-y-4">
                {/* Header Room Info */}
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold bg-red-100 text-red-900 border border-red-300 px-2 py-0.5 rounded-full">
                        FORM RUANGAN
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                        activeSession === 'PAGI'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-orange-100 text-orange-900 border-orange-300'
                      }`}>
                        {activeSession === 'PAGI' ? '🌅 Sesi Pagi' : '☀️ Sesi Siang'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentInspectingRoom(null)}
                      className="text-xs font-bold text-slate-600 hover:text-black underline"
                    >
                      ← Kembali
                    </button>
                  </div>
                  <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                    {currentInspectingRoom.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Stasiun {currentStation?.name} [{currentStation?.code}] {currentInspectingRoom.location && `• ${currentInspectingRoom.location}`}
                  </p>
                </div>

                <form onSubmit={handleSaveRoomInspection} className="space-y-4">
                  {/* Climate Parameters: Suhu & Kelembapan (Kecuali nama ruangan 'Station Area') */}
                  {currentInspectingRoom.name.trim().toLowerCase() === 'station area' ? null : (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-1.5 pb-1">
                        <Thermometer className="w-4 h-4 text-red-600" />
                        <h4 className="font-extrabold text-xs text-slate-900">
                          Suhu & Kelembapan Lingkungan (Desimal)
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Suhu */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                            <Thermometer className="w-3.5 h-3.5 text-red-600" />
                            Suhu (°C)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="21.5"
                            value={tempInput}
                            onChange={(e) => setTempInput(e.target.value)}
                            className="w-full text-center text-lg font-black border border-slate-300 focus:border-red-600 rounded-lg p-1.5 outline-none"
                            required
                          />
                          <span className="text-[10px] text-slate-400 font-medium block text-center mt-1">
                            Normal: 18.0 - 24.0 °C
                          </span>
                        </div>

                        {/* Kelembapan */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5 text-blue-600" />
                            Kelembapan (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="55.0"
                            value={humInput}
                            onChange={(e) => setHumInput(e.target.value)}
                            className="w-full text-center text-lg font-black border border-slate-300 focus:border-blue-600 rounded-lg p-1.5 outline-none"
                            required
                          />
                          <span className="text-[10px] text-slate-400 font-medium block text-center mt-1">
                            Normal: 45.0 - 65.0 %
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checklist Perangkat / Items */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4 text-red-600" />
                        Checklist Perangkat ({currentInspectingRoom.items?.length || 0})
                      </h4>
                      <span className="text-[11px] font-medium text-slate-500">
                        Pilih status:
                      </span>
                    </div>

                    {currentInspectingRoom.items && currentInspectingRoom.items.length > 0 ? (
                      <div className="space-y-2">
                        {currentInspectingRoom.items.map((itm) => {
                          const itmStatus = itemStatuses[itm.id] || 'NORMAL';
                          const isNormal = itmStatus === 'NORMAL';

                          return (
                            <div
                              key={itm.id}
                              className={`p-3 rounded-xl border transition-all ${
                                isNormal
                                  ? 'bg-white border-slate-200'
                                  : 'bg-red-50/70 border-red-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  {itm.name}
                                </span>

                                {/* Toggle Buttons */}
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemStatus(itm.id, 'NORMAL')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                      isNormal
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    Normal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleItemStatus(itm.id, 'ABNORMAL')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                      !isNormal
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    Abnormal
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-3 bg-slate-50 rounded-lg border border-slate-200">
                        Tidak ada item terdaftar pada ruangan ini.
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white border-2 border-black rounded-xl text-xs py-3 font-extrabold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                    >
                      Simpan Inspeksi Ruangan (Sesi {activeSession === 'PAGI' ? 'Pagi' : 'Siang'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentInspectingRoom(null)}
                      className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs py-3 font-bold transition-colors"
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
