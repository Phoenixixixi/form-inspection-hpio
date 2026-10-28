# Rencana Implementasi: IT Inspection Form & Admin QR Generator (Neo-Brutalism Mobile-First)

Dokumen ini memuat arsitektur sistem, desain, dan tahapan implementasi aplikasi **IT Inspection Form** beserta **Dashboard Admin Generator Ruangan & Anti-Cheat QR**.

---

## 1. Analisis Kebutuhan Terbaru

### A. Fitur Dashboard Admin
1. **Manajemen Ruangan per Stasiun**:
   - Pilih Stasiun (contoh: Gambir, Manggarai, Juanda, dll).
   - Tambah/Edit Ruangan (`rooms`), misalnya: *Server Room 1*, *Datacenter*, *UPS & Battery Room*, atau ***Station Area***.
2. **Pengaturan Item Perangkat per Ruangan**:
   - Menambahkan daftar item/perangkat yang wajib diinspeksi untuk ruangan tersebut (contoh di Datacenter: *Rack Server, Switch Core, PDU, AC Presisi, CCTV*).
3. **Logika Khusus Parameter Lingkungan (Suhu & Kelembapan)**:
   - **Default Ruangan**: Memiliki field input Suhu (°C desimal) & Kelembapan (% desimal).
   - **Khusus Ruangan "Station Area"**: **TIDAK** ada input suhu & kelembapan (karena merupakan area stasiun umum / bukan ruangan berpendingin tertutup).
4. **Generator QR Code Anti-Kecurangan (Anti-Cheat)**:
   - **PENTING**: QR Code **BUKAN berupa URL web link** (agar teknisi tidak bisa meng-copy link, bookmark, atau share link lewat WhatsApp untuk isi form dari rumah).
   - QR Code berisi **Encrypted / Signed Proprietary JSON Payload** dengan prefix verifikasi (contoh: `hpio://inspect/...` atau signature hash JSON).
   - Scanner pada aplikasi mobile membedah data JSON tersebut secara internal, mencocokkan dengan stasiun aktif teknisi, lalu membuka formulir di dalam state aplikasi.
   - Admin dapat langsung mengunduh/mencetak stiker QR bergaya Neo-Brutalism siap tempel di pintu/rak datacenter.

---

### B. Alur Bisnis Lengkap (End-to-End)

```mermaid
graph TD
    subgraph Admin Dashboard
        A1[Pilih Stasiun] --> A2[Buat/Pilih Ruangan]
        A2 --> A3[Input Checklist Item Perangkat]
        A3 --> A4{Nama Ruangan == 'Station Area'?}
        A4 -- Ya --> A5[Flag has_climate = false]
        A4 -- Tidak --> A6[Flag has_climate = true, default suhu/humidity]
        A5 --> A7[Generate Anti-Cheat QR Non-URL]
        A6 --> A7[Generate Anti-Cheat QR Non-URL]
        A7 --> A8[Print Stiker QR di Ruangan]
    end

    subgraph Mobile App Teknisi
        T1[Login Teknisi & Pilih Stasiun] --> T2[Buka Scanner Kamera In-App]
        T2 --> T3[Scan Stiker QR di Lokasi]
        T3 --> T4{Verifikasi JSON & Stasiun Valid?}
        T4 -- Gagal --> T5[Tolak: QR Tidak Valid / Salah Stasiun]
        T4 -- Sukses --> T6[Render Form Ruangan Sesuai Tipe]
        T6 --> T7{has_climate == true?}
        T7 -- Ya --> T8[Input Suhu & Kelembapan Desimal]
        T7 -- Tidak --> T9[Skip Suhu & Kelembapan]
        T8 --> T10[Checklist Status Perangkat: NORMAL / ABNORMAL]
        T9 --> T10
        T10 --> T11[Simpan Inspeksi Ruangan]
        T11 --> T12[Ulangi Ruangan Lain atau Masuk Catatan Akhir Stasiun]
        T12 --> T13[Input 1 Catatan Utama Stasiun & Submit Final]
    end
```

---

## 2. Struktur Payload QR Anti-Cheat (Non-URL)

Untuk mencegah kecurangan teknisi, isi data QR adalah JSON terstruktur yang ditandatangani (signed/hashed):
```json
{
  "protocol": "HPIO_SECURE_INSPECT_V1",
  "station_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "station_code": "MRI",
  "room_id": "c3a7f8e1-5e2a-4b9d-8c1e-7f6a5b4c3d2e",
  "room_name": "Datacenter Server Room",
  "has_climate": true,
  "checksum": "a8f5c381d9b042e3"
}
```
> **Kenapa Aman?**
> Jika teknisi mencoba scan dengan aplikasi kamera biasa atau browser HP biasa, sistem HP tidak akan membuka halaman apapun karena ini bukan URL web (`http://` atau `https://`). Hanya modul scanner internal di aplikasi Next.js ini yang mengenali payload JSON dan mengecek apakah stasiun dan teknisi yang sedang aktif cocok dengan lokasi fisik tersebut.

---

## 3. Desain & Estetika: Neo-Brutalism (Merah, Putih, Hitam)

- **Warna Utama**:
  - Merah Tegas (`#E11D48` / `#DC2626`)
  - Hitam Pekat (`#000000` / `#111111`)
  - Putih Bersih (`#FFFFFF`)
  - Abu-abu Terang (`#F4F4F5` untuk background kontras)
- **Komponen**:
  - Border tebal: `border-2 border-black` hingga `border-4 border-black`.
  - Box Shadow tegas: `box-shadow: 4px 4px 0px #000000` dan `6px 6px 0px #000000`.
  - Stiker QR Generator: Desain frame stiker kartu fisik siap cetak berlabel stasiun, nama ruangan, dan instruksi inspeksi.
  - Form Switcher: Tombol toggle status NORMAL (Hijau/Hitam) & ABNORMAL (Merah/Hitam) yang chunky dan mudah ditekan di layar HP.

---

## 4. Rencana Tahapan Eksekusi

### Tahap 1: Setup Proyek Next.js & Prisma ORM
1. Inisialisasi Next.js (App Router, TypeScript, Tailwind CSS).
2. Hubungkan koneksi database PostgreSQL dari [.env](file:///Users/user/Desktop/HPIO DASH APP/FORM/.env):
   `DATABASE_URL="postgresql://admin:aliyasin810@100.112.27.4:5432/hpiodb"`
3. Introspeksi skema database dengan Prisma: `npx prisma db pull` dan `npx prisma generate`.

### Tahap 2: Dashboard Admin (`/admin`)
1. **Halaman Kelola Ruangan & Item**:
   - Filter dropdown Stasiun.
   - Form tambah ruangan baru (Nama Ruangan & Lokasi).
   - Deteksi otomatis: Jika nama ruangan adalah `"Station Area"` (case-insensitive), otomatis set `has_climate = false`.
   - Form tambah/kelola daftar item perangkat di ruangan tersebut.
2. **Generator & Print Stiker QR**:
   - Tampilan preview stiker QR Neo-Brutalism (siap cetak/download gambar).
   - QR code dibuat menggunakan library `qrcode.react` dengan raw payload JSON anti-cheat (non-URL).

### Tahap 3: Aplikasi Mobile Teknisi (`/`)
1. **Sesi Teknisi & Stasiun**:
   - Pilih nama teknisi dan stasiun kunjungan.
2. **Scanner Kamera Anti-Cheat**:
   - Scanner in-app menggunakan `@zxing/browser` atau `html5-qrcode`.
   - Validasi payload JSON: Memastikan stasiun sesuai dengan stasiun yang sedang dikunjungi teknisi.
3. **Form Inspeksi Ruangan**:
   - Jika `has_climate == true`: Tampilkan input Suhu & Kelembapan desimal.
   - Jika `has_climate == false` (misal *Station Area*): Suhu & Kelembapan otomatis disembunyikan.
   - Checklist perangkat: NORMAL vs ABNORMAL (+ input deskripsi kendala jika ABNORMAL).
   - Tombol simpan data inspeksi ke database via Prisma.
4. **Form Akhir Stasiun (Notes)**:
   - Ringkasan seluruh ruangan di stasiun.
   - 1 Kolom Catatan Umum Stasiun.
   - Tombol final submit sesi inspeksi.
