import { PrismaClient } from '@prisma/client';
import { POST, PATCH } from '../src/app/api/inspections/submit/route';

const prisma = new PrismaClient();

async function runQaTests() {
  console.log('====================================================');
  console.log('🚀 QA TESTER: HPIO FORM INSPECTION & DUPLICATE BUG');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    }
  }

  // 1. SETUP TEST FIXTURE (DUMMY STATION & ROOM)
  console.log('📌 STEP 1: Menyiapkan Data Fixture Uji Coba...');
  const testStation = await prisma.stations.upsert({
    where: { code: 'QA-TEST' },
    update: { name: 'Stasiun QA Test' },
    create: {
      code: 'QA-TEST',
      name: 'Stasiun QA Test',
      location: 'Lab QA Testing Lantai 1',
    },
  });

  const testRoom = await prisma.rooms.findFirst({
    where: { station_id: testStation.id },
  }) || await prisma.rooms.create({
    data: {
      station_id: testStation.id,
      name: 'Ruang Server QA',
      location: 'Lantai 1',
    },
  });

  const testItem = await prisma.items.findFirst({
    where: { room_id: testRoom.id },
  }) || await prisma.items.create({
    data: {
      room_id: testRoom.id,
      name: 'Server Rack QA-1',
    },
  });

  // Clean up any test inspections for today before starting QA
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  await prisma.inspections.deleteMany({
    where: {
      station_id: testStation.id,
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });

  console.log(`     Data Fixture siap: Station="${testStation.name}" (${testStation.id}), Room="${testRoom.name}"\n`);

  // 2. TEST SUBMIT SESI PAGI PERTAMA KALI (HARUS BERHASIL)
  console.log('📌 STEP 2: Test Submit Sesi Pagi (Pertama Kali)...');
  const pagiPayload = {
    station_id: testStation.id,
    technician_name: 'QA Tester Robot',
    session: 'PAGI',
    station_notes: 'Catatan Utama Sesi Pagi: Kondisi normal semua perangkat aktif.',
    room_inspections: [
      {
        room_id: testRoom.id,
        temperature: '21.4',
        humidity: '54.5',
        session: 'PAGI',
        items: [
          {
            item_id: testItem.id,
            status: 'NORMAL',
            notes: null,
          },
        ],
      },
    ],
  };

  const reqPagi1 = new Request('http://localhost:3000/api/inspections/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pagiPayload),
  });

  const resPagi1 = await POST(reqPagi1);
  const dataPagi1 = await resPagi1.json();

  assert(resPagi1.status === 200, 'Response HTTP status Sesi Pagi pertama adalah 200 OK');
  assert(dataPagi1.success === true, 'Data response sukses bernilai true');
  assert(dataPagi1.savedCount === 1, 'Jumlah inspeksi ruangan tersimpan adalah 1');

  // Verify in Database
  const countPagiInDb = await prisma.inspections.count({
    where: {
      station_id: testStation.id,
      session: 'PAGI',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(countPagiInDb === 1, 'Database tepat memiliki 1 record inspeksi Sesi Pagi');

  const savedPagiRecord = await prisma.inspections.findFirst({
    where: {
      station_id: testStation.id,
      session: 'PAGI',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(
    savedPagiRecord?.notes === 'Catatan Utama Sesi Pagi: Kondisi normal semua perangkat aktif.',
    'Catatan utama Sesi Pagi tersimpan dengan benar di DB'
  );
  console.log('');

  // 3. TEST BUG REPRODUCTION: COBA SUBMIT SESI PAGI KE-2 KALI (HARUS DITOLAK / GAGAL)
  console.log('📌 STEP 3: Test Bug Prevention: Coba Kirim Sesi Pagi ke-2 Kali...');
  const reqPagiDuplicate = new Request('http://localhost:3000/api/inspections/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pagiPayload),
  });

  const resPagiDuplicate = await POST(reqPagiDuplicate);
  const dataPagiDuplicate = await resPagiDuplicate.json();

  assert(resPagiDuplicate.status === 400, 'Duplicate submission Sesi Pagi ditolak dengan HTTP 400');
  assert(dataPagiDuplicate.success === false, 'Duplicate response success bernilai false');
  assert(
    typeof dataPagiDuplicate.error === 'string' &&
      dataPagiDuplicate.error.includes('sudah pernah disubmit hari ini'),
    'Pesan error mendeteksi duplikasi sesi dengan tepat',
    dataPagiDuplicate.error
  );

  // Verify Database still has only 1 row (no duplicate row created!)
  const countPagiAfterDuplicate = await prisma.inspections.count({
    where: {
      station_id: testStation.id,
      session: 'PAGI',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(
    countPagiAfterDuplicate === 1,
    'Database tetap memiliki 1 record inspeksi Sesi Pagi (TIDAK TERJADI DUPLIKASI!)'
  );
  console.log('');

  // 4. TEST SUBMIT SESI SIANG (PERTAMA KALI DENGAN CATATAN UTAMA SIANG)
  console.log('📌 STEP 4: Test Submit Sesi Siang beserta Catatan Utama Siang...');
  const siangPayload = {
    station_id: testStation.id,
    technician_name: 'QA Tester Robot',
    session: 'SIANG',
    station_notes: 'Catatan Utama Sesi Siang: Suhu AC naik sedikit tapi masih dalam batas aman.',
    room_inspections: [
      {
        room_id: testRoom.id,
        temperature: '22.1',
        humidity: '56.0',
        session: 'SIANG',
        items: [
          {
            item_id: testItem.id,
            status: 'NORMAL',
            notes: null,
          },
        ],
      },
    ],
  };

  const reqSiang1 = new Request('http://localhost:3000/api/inspections/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siangPayload),
  });

  const resSiang1 = await POST(reqSiang1);
  const dataSiang1 = await resSiang1.json();

  assert(resSiang1.status === 200, 'Response HTTP status Sesi Siang adalah 200 OK');
  assert(dataSiang1.success === true, 'Data response sukses bernilai true');
  assert(dataSiang1.savedCount === 1, 'Jumlah inspeksi Sesi Siang tersimpan adalah 1');

  const countSiangInDb = await prisma.inspections.count({
    where: {
      station_id: testStation.id,
      session: 'SIANG',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(countSiangInDb === 1, 'Database tepat memiliki 1 record inspeksi Sesi Siang');

  const savedSiangRecord = await prisma.inspections.findFirst({
    where: {
      station_id: testStation.id,
      session: 'SIANG',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(
    savedSiangRecord?.notes === 'Catatan Utama Sesi Siang: Suhu AC naik sedikit tapi masih dalam batas aman.',
    'Catatan utama Sesi Siang tersimpan dengan benar di DB'
  );
  console.log('');

  // 5. TEST BUG PREVENTION: COBA SUBMIT SESI SIANG KE-2 KALI (HARUS DITOLAK / GAGAL)
  console.log('📌 STEP 5: Test Bug Prevention: Coba Kirim Sesi Siang ke-2 Kali...');
  const reqSiangDuplicate = new Request('http://localhost:3000/api/inspections/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(siangPayload),
  });

  const resSiangDuplicate = await POST(reqSiangDuplicate);
  const dataSiangDuplicate = await resSiangDuplicate.json();

  assert(resSiangDuplicate.status === 400, 'Duplicate submission Sesi Siang ditolak dengan HTTP 400');
  assert(dataSiangDuplicate.success === false, 'Duplicate response success bernilai false');
  assert(
    typeof dataSiangDuplicate.error === 'string' &&
      dataSiangDuplicate.error.includes('sudah pernah disubmit hari ini'),
    'Pesan error mendeteksi duplikasi Sesi Siang dengan tepat',
    dataSiangDuplicate.error
  );

  const countSiangAfterDuplicate = await prisma.inspections.count({
    where: {
      station_id: testStation.id,
      session: 'SIANG',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(
    countSiangAfterDuplicate === 1,
    'Database tetap memiliki 1 record inspeksi Sesi Siang (TIDAK TERJADI DUPLIKASI!)'
  );
  console.log('');

  // 6. TEST PATCH (PERBARUI CATATAN UTAMA SESI YANG SUDAH TERKIRIM)
  console.log('📌 STEP 6: Test PATCH: Perbarui Catatan Utama Sesi...');
  const reqPatch = new Request('http://localhost:3000/api/inspections/submit', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      station_id: testStation.id,
      session: 'SIANG',
      station_notes: 'Catatan Utama Sesi Siang (Updated by QA Robot): Filter AC dibersihkan.',
    }),
  });

  const resPatch = await PATCH(reqPatch);
  const dataPatch = await resPatch.json();

  assert(resPatch.status === 200, 'Response HTTP status PATCH adalah 200 OK');
  assert(dataPatch.success === true, 'Response PATCH success bernilai true');

  const updatedSiangRecord = await prisma.inspections.findFirst({
    where: {
      station_id: testStation.id,
      session: 'SIANG',
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  assert(
    updatedSiangRecord?.notes === 'Catatan Utama Sesi Siang (Updated by QA Robot): Filter AC dibersihkan.',
    'Catatan utama di DB berhasil diperbarui melalui PATCH'
  );
  console.log('');

  // 7. CLEANUP TEST DATA
  console.log('📌 STEP 7: Membersihkan Data Uji Coba...');
  await prisma.inspections.deleteMany({
    where: {
      station_id: testStation.id,
      inspected_at: { gte: startOfDay, lte: endOfDay },
    },
  });
  console.log('     Data uji coba selesai dibersihkan.');

  console.log('\n====================================================');
  console.log(`🏁 QA TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🎉 SELURUH SKENARIO UJI COBA BERHASIL DENGAN SEMPURNA!');
  } else {
    console.error('⚠️ ADA TES YANG GAGAL!');
    process.exitCode = 1;
  }
  console.log('====================================================\n');
}

runQaTests()
  .catch((err) => {
    console.error('Fatal QA error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
