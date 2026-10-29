import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { station_id, technician_name, session, station_notes, room_inspections } = body;

    if (!station_id || !technician_name) {
      return NextResponse.json(
        { success: false, error: 'station_id dan nama teknisi wajib diisi' },
        { status: 400 }
      );
    }

    if (!room_inspections || !Array.isArray(room_inspections) || room_inspections.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Minimal harus ada 1 inspeksi ruangan yang diselesaikan' },
        { status: 400 }
      );
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // Perform database writes in transaction
    const savedInspections = await prisma.$transaction(async (tx) => {
      // Cari jika sudah ada catatan utama stasiun yang tersimpan hari ini
      let effectiveNote = station_notes && station_notes.trim() ? station_notes.trim() : null;
      if (!effectiveNote) {
        const existingToday = await tx.inspections.findFirst({
          where: {
            station_id,
            inspected_at: { gte: startOfDay },
            notes: { not: null },
          },
          select: { notes: true },
        });
        if (existingToday?.notes) {
          effectiveNote = existingToday.notes;
        }
      }

      const results = [];

      for (const rInsp of room_inspections) {
        // Prepare temperature and humidity as Prisma Decimal or null
        const tempDecimal =
          rInsp.temperature !== null && rInsp.temperature !== undefined && rInsp.temperature !== ''
            ? new Prisma.Decimal(rInsp.temperature)
            : null;

        const humDecimal =
          rInsp.humidity !== null && rInsp.humidity !== undefined && rInsp.humidity !== ''
            ? new Prisma.Decimal(rInsp.humidity)
            : null;

        const targetSession = (rInsp.session || session || 'PAGI').toString().toUpperCase();

        const inspection = await tx.inspections.create({
          data: {
            station_id,
            room_id: rInsp.room_id || null,
            user_id: technician_name,
            session: targetSession,
            temperature: tempDecimal,
            humidity: humDecimal,
            notes: effectiveNote || null,
            inspected_at: now,
            inspection_items: {
              create: (rInsp.items || []).map((itm: any) => ({
                item_id: itm.item_id || null,
                status: itm.status || 'NORMAL',
                notes: itm.notes ? itm.notes.trim() : null,
              })),
            },
          },
          include: {
            inspection_items: true,
          },
        });

        results.push(inspection);
      }

      // Sinkronkan catatan utama ke seluruh record hari ini jika diberikan catatan baru
      if (station_notes && station_notes.trim()) {
        await tx.inspections.updateMany({
          where: {
            station_id,
            inspected_at: { gte: startOfDay },
          },
          data: {
            notes: station_notes.trim(),
          },
        });
      }

      return results;
    });

    return NextResponse.json({
      success: true,
      message: 'Seluruh data inspeksi berhasil disimpan ke database',
      savedCount: savedInspections.length,
      inspections: savedInspections,
    });
  } catch (error: any) {
    console.error('Error submitting inspections:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan hasil inspeksi' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { station_id, station_notes } = body;

    if (!station_id) {
      return NextResponse.json(
        { success: false, error: 'station_id wajib diisi' },
        { status: 400 }
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const updated = await prisma.inspections.updateMany({
      where: {
        station_id,
        inspected_at: {
          gte: todayStart,
        },
      },
      data: {
        notes: station_notes ? station_notes.trim() : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Catatan utama berhasil diperbarui',
      count: updated.count,
    });
  } catch (error: any) {
    console.error('Error updating station notes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui catatan utama' },
      { status: 500 }
    );
  }
}
