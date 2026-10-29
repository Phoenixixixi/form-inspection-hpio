'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Trash2,
  QrCode,
  ListPlus,
  Thermometer,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Sparkles,
  ArrowLeft,
  X,
  History,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import PrintableQrSticker from '@/components/PrintableQrSticker';

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
  is_active: boolean;
}

export default function AdminDashboard() {
  // Authentication state
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
  const [adminUser, setAdminUser] = useState<{ id: string; email: string; name: string; role_id: string | null } | null>(null);
  const [loginEmail, setLoginEmail] = useState('admin@kcic.online');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals & Panels
  const [activeQrModal, setActiveQrModal] = useState<{ station: Station; room: Room } | null>(null);
  const [activeItemModal, setActiveItemModal] = useState<Room | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Form New Room
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLocation, setNewRoomLocation] = useState('');
  const [newRoomItems, setNewRoomItems] = useState<string[]>([]);
  const [customItemInput, setCustomItemInput] = useState('');

  // History inspection
  const [inspectionLogs, setInspectionLogs] = useState<any[]>([]);

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      setAuthStatus('checking');
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      if (data.success && data.authenticated && data.user) {
        setAuthStatus('authenticated');
        setAdminUser(data.user);
        await fetchStations();
      } else {
        setAuthStatus('unauthenticated');
        setIsLoading(false);
      }
    } catch {
      setAuthStatus('unauthenticated');
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email || !password) {
      setLoginError('Email dan password wajib diisi');
      return;
    }

    try {
      setIsSubmittingLogin(true);
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        setAuthStatus('authenticated');
        setAdminUser(data.user);
        setLoginPassword('');
        showNotification('success', `Berhasil login sebagai ${data.user.email}`);
        await fetchStations();
      } else {
        setLoginError(data.error || 'Login gagal. Periksa kembali email dan password.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Terjadi kesalahan sistem saat login');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      setAuthStatus('unauthenticated');
      setAdminUser(null);
      setLoginPassword('');
      showNotification('success', 'Berhasil keluar dari Admin Panel');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const fetchStations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/stations');
      const data = await res.json();
      if (data.success && data.stations.length > 0) {
        setStations(data.stations);
        if (!selectedStationId) {
          setSelectedStationId(data.stations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load stations', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedStation = stations.find((s) => s.id === selectedStationId) || stations[0];

  useEffect(() => {
    if (selectedStation?.id) {
      fetchLogs(selectedStation.id);
    }
  }, [selectedStation?.id]);

  const fetchLogs = async (stationId: string) => {
    try {
      const res = await fetch(`/api/inspections/history?station_id=${stationId}`);
      const data = await res.json();
      if (data.success) {
        setInspectionLogs(data.inspections || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Seed default rooms for station
  const handleSeedStation = async () => {
    if (!selectedStation) return;
    try {
      const res = await fetch('/api/admin/seed-station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station_id: selectedStation.id }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', data.message);
        await fetchStations();
      } else {
        showNotification('error', data.error);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal generate template');
    }
  };

  // Create new room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation || !newRoomName.trim()) return;

    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: selectedStation.id,
          name: newRoomName.trim(),
          location: newRoomLocation.trim() || undefined,
          initial_items: newRoomItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showNotification('success', `Ruangan "${newRoomName}" berhasil ditambahkan!`);
        setNewRoomName('');
        setNewRoomLocation('');
        setNewRoomItems([]);
        setIsAddingRoom(false);
        await fetchStations();
      } else {
        showNotification('error', data.error);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal membuat ruangan');
    }
  };

  // Delete room
  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`Hapus ruangan "${roomName}" beserta semua item di dalamnya?`)) return;

    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotification('success', 'Ruangan berhasil dihapus');
        await fetchStations();
      } else {
        showNotification('error', data.error);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menghapus ruangan');
    }
  };

  // Add item to active room
  const handleAddItemToRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemModal || !newItemName.trim()) return;

    try {
      const res = await fetch('/api/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: activeItemModal.id,
          name: newItemName.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewItemName('');
        await fetchStations();
        // Update activeItemModal state
        setActiveItemModal((prev) =>
          prev ? { ...prev, items: [...prev.items, data.item] } : null
        );
        showNotification('success', 'Item berhasil ditambahkan');
      } else {
        showNotification('error', data.error);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menambah item');
    }
  };

  // Delete item from room
  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/admin/items/${itemId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchStations();
        setActiveItemModal((prev) =>
          prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : null
        );
        showNotification('success', 'Item berhasil dihapus');
      } else {
        showNotification('error', data.error);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menghapus item');
    }
  };

  // 1. Loading Screen
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-4">
        <div className="brutal-card p-6 bg-white max-w-sm w-full text-center space-y-3">
          <div className="w-10 h-10 border-4 border-black border-t-red-600 rounded-full animate-spin mx-auto" />
          <h2 className="font-black text-sm uppercase text-black">Memeriksa Akses Admin...</h2>
          <p className="text-xs text-gray-500 font-medium">Memverifikasi otentikasi administrator stasiun HPIO</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Screen (Login Form)
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex flex-col justify-between p-4 sm:p-6">
        <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black bg-white border-2 border-black px-3 py-1.5 shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Mode Teknisi</span>
          </Link>
          <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 border border-black">
            KCIC HPIO SECURE
          </span>
        </header>

        <div className="max-w-md mx-auto w-full my-auto">
          <div className="brutal-card-lg p-6 sm:p-8 bg-white border-4 border-black shadow-[6px_6px_0px_#000] space-y-5">
            {/* Header Login */}
            <div className="border-b-3 border-black pb-4 text-center space-y-2">
              <div className="w-14 h-14 bg-red-600 border-3 border-black mx-auto flex items-center justify-center text-white shadow-[3px_3px_0px_#000]">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <span className="brutal-badge bg-black text-white text-[10px]">
                  PORTAL ADMINISTRATOR
                </span>
                <h1 className="text-xl font-black uppercase text-black mt-1">
                  Login Admin Panel
                </h1>
                <p className="text-xs text-gray-600 font-semibold mt-1">
                  Masuk menggunakan akun admin KCIC untuk konfigurasi ruangan & anti-cheat QR
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {loginError && (
              <div className="p-3 bg-red-100 border-2 border-red-600 text-red-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Email Administrator
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@kcic.online"
                  className="w-full brutal-input font-bold text-xs p-3 bg-slate-50 border-2 border-black focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full brutal-input font-bold text-xs pl-3 pr-10 py-3 bg-slate-50 border-2 border-black focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingLogin}
                  className="w-full brutal-btn bg-red-600 hover:bg-red-700 text-white border-2 border-black py-3 font-black text-xs flex items-center justify-center gap-2 shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  {isSubmittingLogin ? (
                    <span>Memverifikasi Akun...</span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Masuk ke Admin Panel</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Helper Badge */}
            <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg text-center space-y-1.5">
              <span className="text-[10px] text-gray-500 font-bold block">
                Akun Terdaftar di Database KCIC:
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginEmail('admin@kcic.online');
                  setLoginPassword('Admin123');
                }}
                className="text-[11px] font-mono font-bold text-red-600 hover:text-black bg-white border border-slate-300 hover:border-black px-2.5 py-1 rounded shadow-sm inline-flex items-center gap-1"
              >
                <span>admin@kcic.online</span>
                <span className="text-[10px] text-gray-400">|</span>
                <span>Admin123</span>
                <span className="text-[9px] bg-red-100 text-red-800 font-sans px-1 rounded">Isi Form</span>
              </button>
            </div>
          </div>
        </div>

        <footer className="max-w-md mx-auto w-full text-center py-2 text-[11px] text-gray-500 font-semibold">
          KCIC HPIO Inspection System • Secure Authentication
        </footer>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-[#F4F4F5] pb-16">
      {/* Top Navigation */}
      <header className="bg-black text-white border-b-4 border-black px-4 py-3 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 bg-red-600 border-2 border-white hover:bg-white hover:text-black transition-colors shrink-0"
              title="Kembali ke Mode Teknisi"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white font-black text-xs px-2 py-0.5 border border-white">
                  ADMIN
                </span>
                <h1 className="font-black text-base tracking-wide uppercase">
                  IT Room & QR Generator
                </h1>
              </div>
              <p className="text-[11px] text-gray-300 font-semibold hidden sm:block">
                Setup Ruangan, Checklist Item & Cetak Anti-Cheat QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {adminUser && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-gray-300 font-bold">{adminUser.email}</span>
                <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.2 rounded uppercase">
                  {adminUser.role_id || 'Superadmin'}
                </span>
              </div>
            )}
            <Link
              href="/"
              className="brutal-btn brutal-btn-primary text-xs py-1.5 px-3 font-black flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mode Teknisi</span>
            </Link>
            <button
              onClick={handleAdminLogout}
              className="brutal-btn bg-white hover:bg-red-600 hover:text-white text-black text-xs py-1.5 px-2.5 font-black flex items-center gap-1.5 border-2 border-white transition-colors"
              title="Keluar dari Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-16 right-4 left-4 sm:left-auto sm:w-96 z-50">
          <div
            className={`brutal-card p-3 flex items-center gap-2 font-bold text-xs ${
              notification.type === 'success'
                ? 'bg-green-100 border-black text-black'
                : 'bg-red-100 border-red-600 text-red-700'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Station Selector Bar */}
        <div className="brutal-card p-4 sm:p-5 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                Pilih Stasiun Kerja
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-red-600 shrink-0" />
                <select
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="brutal-input text-base font-black py-2"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      [{st.code}] {st.name} — {st.location || 'Stasiun'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedStation && (
              <div className="flex items-center gap-2 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={handleSeedStation}
                  className="brutal-btn brutal-btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
                  title="Generate otomatis template ruangan standar"
                >
                  <Sparkles className="w-4 h-4 text-red-600" />
                  <span>Generate Template Ruangan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingRoom(true)}
                  className="brutal-btn brutal-btn-primary text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Ruangan</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal / Form Tambah Ruangan */}
        {isAddingRoom && (
          <div className="brutal-card-lg p-5 bg-white relative border-4 border-black">
            <button
              onClick={() => setIsAddingRoom(false)}
              className="absolute top-4 right-4 p-1.5 border-2 border-black bg-black text-white hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="border-b-2 border-black pb-3 mb-4">
              <span className="brutal-badge bg-red-600 text-white text-[10px] mb-1">
                FORM BARU
              </span>
              <h2 className="text-lg font-black uppercase text-black">
                Tambah Ruangan di Stasiun {selectedStation?.name}
              </h2>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Nama Ruangan *
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Datacenter Server Room, Station Area, UPS Room"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="brutal-input text-sm"
                  required
                />
                {/* Suggestions / Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] font-bold text-gray-500 mr-1 self-center">
                    Template Nama:
                  </span>
                  {[
                    'Datacenter Server Room',
                    'UPS & Battery Room',
                    'Telecom & Transmission Room',
                    'Station Area',
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setNewRoomName(tpl)}
                      className={`text-[11px] font-black px-2 py-0.5 border border-black ${
                        tpl === 'Station Area'
                          ? 'bg-yellow-300 text-black'
                          : 'bg-white hover:bg-red-100 text-black'
                      }`}
                    >
                      {tpl}
                    </button>
                  ))}
                </div>

                {/* Info jika Station Area */}
                {newRoomName.trim().toLowerCase() === 'station area' && (
                  <div className="mt-2.5 bg-yellow-200 border-2 border-black p-2 text-xs font-black flex items-center gap-2">
                    <span className="bg-black text-yellow-300 px-1 py-0.5 text-[10px]">
                      ATURAN KHUSUS
                    </span>
                    <span>
                      Nama ruangan ini adalah <b>Station Area</b>: Parameter Suhu & Kelembapan otomatis di-skip pada form teknisi!
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Lokasi / Lantai (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lantai 2 Sayap Timur"
                  value={newRoomLocation}
                  onChange={(e) => setNewRoomLocation(e.target.value)}
                  className="brutal-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">
                  Checklist Item Perangkat (Wajib Diinspeksi)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Contoh: Rack Server 01, Switch Core, AC Presisi"
                    value={customItemInput}
                    onChange={(e) => setCustomItemInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customItemInput.trim()) {
                          setNewRoomItems([...newRoomItems, customItemInput.trim()]);
                          setCustomItemInput('');
                        }
                      }
                    }}
                    className="brutal-input text-xs py-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customItemInput.trim()) {
                        setNewRoomItems([...newRoomItems, customItemInput.trim()]);
                        setCustomItemInput('');
                      }
                    }}
                    className="brutal-btn brutal-btn-black text-xs py-2 px-3"
                  >
                    Tambah
                  </button>
                </div>

                {/* Items Tag list */}
                {newRoomItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-gray-100 border-2 border-black">
                    {newRoomItems.map((itm, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-white border border-black px-2 py-0.5 text-xs font-black"
                      >
                        {itm}
                        <button
                          type="button"
                          onClick={() =>
                            setNewRoomItems(newRoomItems.filter((_, i) => i !== idx))
                          }
                          className="text-red-600 hover:text-black font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-gray-400 italic">
                    Belum ada item ditambahkan. Anda juga bisa menambahkannya nanti.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="brutal-btn brutal-btn-primary text-xs py-2.5 px-4"
                >
                  Simpan Ruangan & Generate QR
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingRoom(false)}
                  className="brutal-btn brutal-btn-secondary text-xs py-2.5 px-4"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* List of Rooms */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-3 border-black pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-600 border border-black inline-block"></span>
              <h2 className="font-black text-sm tracking-wide uppercase text-black">
                Daftar Ruangan di Stasiun {selectedStation?.name} ({selectedStation?.rooms?.length || 0})
              </h2>
            </div>
            <span className="text-xs font-bold text-gray-500">
              Kode: <b className="text-black">{selectedStation?.code}</b>
            </span>
          </div>

          {isLoading ? (
            <div className="brutal-card p-8 text-center text-sm font-black">
              Memuat data stasiun & ruangan...
            </div>
          ) : !selectedStation?.rooms || selectedStation.rooms.length === 0 ? (
            <div className="brutal-card p-8 text-center bg-white space-y-3">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-black text-base uppercase text-black">
                Belum Ada Ruangan Terdaftar
              </h3>
              <p className="text-xs font-semibold text-gray-500 max-w-md mx-auto">
                Stasiun ini belum memiliki ruangan inspeksi. Klik tombol di bawah untuk membuat ruangan standar secara instan!
              </p>
              <button
                onClick={handleSeedStation}
                className="brutal-btn brutal-btn-primary text-xs py-2 px-4 inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Template Ruangan Otomatis</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedStation.rooms.map((room) => {
                const isStationArea = room.name.trim().toLowerCase() === 'station area';
                const hasClimate = !isStationArea;

                return (
                  <div
                    key={room.id}
                    className="brutal-card p-4 bg-white flex flex-col justify-between border-3 border-black hover:shadow-[6px_6px_0px_#000] transition-all"
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="brutal-badge bg-black text-white text-[10px]">
                          {selectedStation.code}
                        </span>
                        {hasClimate ? (
                          <span className="brutal-badge bg-red-100 text-red-700 border-red-700 text-[10px] flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-red-600" />
                            SUHU & KELEMBAPAN AKTIF
                          </span>
                        ) : (
                          <span className="brutal-badge bg-yellow-300 text-black text-[10px]">
                            AREA PUBLIK (NO CLIMATE)
                          </span>
                        )}
                      </div>

                      {/* Room title */}
                      <h3 className="font-black text-base uppercase text-black">
                        {room.name}
                      </h3>
                      {room.location && (
                        <p className="text-xs font-semibold text-gray-500 mt-0.5">
                          {room.location}
                        </p>
                      )}

                      {/* Items preview */}
                      <div className="mt-3 pt-3 border-t-2 border-black">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-black uppercase text-gray-600">
                            Checklist Perangkat ({room.items?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveItemModal(room)}
                            className="text-[11px] font-black text-red-600 hover:underline flex items-center gap-0.5"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            Kelola Item
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                          {room.items && room.items.length > 0 ? (
                            room.items.map((itm) => (
                              <span
                                key={itm.id}
                                className="text-[10px] font-bold bg-gray-100 border border-black px-1.5 py-0.5 text-black"
                              >
                                {itm.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] font-bold text-gray-400 italic">
                              Belum ada item perangkat.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t-2 border-black flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveQrModal({ station: selectedStation, room })
                        }
                        className="flex-1 brutal-btn brutal-btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Cetak QR Stiker</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(room.id, room.name)}
                        className="p-2 border-2 border-black bg-white hover:bg-red-600 hover:text-white transition-colors"
                        title="Hapus Ruangan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspeksi Khusus Per Hari Ini */}
        <div className="brutal-card p-4 sm:p-5 bg-white border-3 border-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-2 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-black text-sm uppercase text-black tracking-wide">
                  Inspeksi Hari Ini ({selectedStation?.name})
                </h3>
                <p className="text-[11px] font-bold text-gray-500">
                  Hanya menampilkan form inspeksi yang masuk pada hari ini
                </p>
              </div>
            </div>
            <span className="brutal-badge bg-black text-white text-[10px] self-start sm:self-auto">
              Total: {inspectionLogs.length} Ruangan
            </span>
          </div>

          {inspectionLogs.length === 0 ? (
            <div className="p-4 bg-gray-50 border-2 border-black text-center text-xs font-bold text-gray-500">
              Belum ada data inspeksi yang masuk per hari ini untuk stasiun {selectedStation?.name}.
            </div>
          ) : (
            <div className="space-y-3">
              {inspectionLogs.map((log) => {
                const abnormalItems = (log.inspection_items || []).filter(
                  (i: any) => i.status === 'ABNORMAL'
                );
                const normalCount = (log.inspection_items || []).length - abnormalItems.length;

                return (
                  <div
                    key={log.id}
                    className="p-3 border-2 border-black bg-white hover:bg-gray-50 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black uppercase text-sm text-black">
                          {log.room?.name || 'Area Stasiun'}
                        </span>
                        <span className={`brutal-badge text-[10px] font-black ${
                          log.session === 'SIANG'
                            ? 'bg-orange-100 text-orange-900 border-orange-500'
                            : 'bg-amber-100 text-amber-900 border-amber-500'
                        }`}>
                          {log.session === 'SIANG' ? '☀️ SIANG' : '🌅 PAGI'}
                        </span>
                        <span className="brutal-badge bg-gray-100 text-[10px]">
                          Teknisi: {log.user_id}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-gray-600">
                        {new Date(log.inspected_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        WIB
                      </span>
                    </div>

                    {/* Parameters & Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                      {log.temperature ? (
                        <span className="brutal-badge bg-red-50 text-red-700 border-red-700 text-[10px]">
                          🌡️ {log.temperature}°C • 💧 {log.humidity}%
                        </span>
                      ) : (
                        <span className="brutal-badge bg-yellow-200 text-black text-[10px]">
                          Station Area (Tanpa Suhu)
                        </span>
                      )}

                      <span className="brutal-badge bg-green-100 text-green-800 text-[10px]">
                        ✓ {normalCount} Normal
                      </span>

                      {abnormalItems.length > 0 && (
                        <span className="brutal-badge bg-red-600 text-white text-[10px]">
                          ⚠️ {abnormalItems.length} ABNORMAL
                        </span>
                      )}
                    </div>

                    {/* Item checklist list */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(log.inspection_items || []).map((itm: any) => (
                        <span
                          key={itm.id}
                          className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                            itm.status === 'ABNORMAL'
                              ? 'bg-red-100 border-red-600 text-red-700'
                              : 'bg-white border-black text-black'
                          }`}
                        >
                          {itm.item?.name || 'Item'} [{itm.status}]
                        </span>
                      ))}
                    </div>

                    {/* Catatan Utama Stasiun (jika ada) */}
                    {log.notes && (
                      <div className="mt-2 bg-yellow-50 border-2 border-black p-2 text-xs">
                        <span className="font-black uppercase text-[10px] text-gray-700 block mb-0.5">
                          Catatan Utama Kunjungan Stasiun:
                        </span>
                        <p className="font-semibold text-black whitespace-pre-wrap">
                          {log.notes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal QR Code Sticker Preview */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md my-auto">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-red-600 border-2 border-white text-white font-black hover:bg-black no-print"
            >
              <X className="w-5 h-5" />
            </button>
            <PrintableQrSticker
              station={activeQrModal.station}
              room={activeQrModal.room}
            />
          </div>
        </div>
      )}

      {/* Modal Manage Items */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg brutal-card-lg bg-white p-5 border-4 border-black relative">
            <button
              onClick={() => setActiveItemModal(null)}
              className="absolute top-4 right-4 p-1.5 border-2 border-black bg-black text-white hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b-2 border-black pb-3 mb-4">
              <span className="brutal-badge bg-black text-white text-[10px] mb-1">
                CHECKLIST PERANGKAT
              </span>
              <h2 className="text-base font-black uppercase text-black">
                {activeItemModal.name}
              </h2>
              <p className="text-xs font-semibold text-gray-500">
                Tambah atau hapus daftar perangkat yang wajib dicek oleh teknisi.
              </p>
            </div>

            {/* Form add item */}
            <form onSubmit={handleAddItemToRoom} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nama Perangkat (e.g. UPS String 1, AC Presisi)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="brutal-input text-xs py-2 flex-1"
                required
              />
              <button
                type="submit"
                className="brutal-btn brutal-btn-primary text-xs py-2 px-4"
              >
                + Tambah
              </button>
            </form>

            {/* Items list */}
            <div className="max-h-60 overflow-y-auto divide-y-2 divide-black border-2 border-black p-2 bg-gray-50">
              {activeItemModal.items && activeItemModal.items.length > 0 ? (
                activeItemModal.items.map((itm) => (
                  <div
                    key={itm.id}
                    className="py-2 px-1 flex items-center justify-between text-xs font-black"
                  >
                    <span>{itm.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(itm.id)}
                      className="text-red-600 hover:text-black p-1 font-black"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center py-4 text-xs font-bold text-gray-400 italic">
                  Belum ada item perangkat.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveItemModal(null)}
                className="brutal-btn brutal-btn-secondary text-xs py-2 px-4"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
