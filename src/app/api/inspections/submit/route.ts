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

    const targetSession = (session || 'PAGI').toString().toUpperCase();

    if (targetSession !== 'PAGI' && targetSession !== 'SIANG') {
      return NextResponse.json(
        { success: false, error: 'Sesi harus bernilai PAGI atau SIANG' },
        { status: 400 }
      );
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Perform database writes in transaction with duplicate check
    const savedInspections = await prisma.$transaction(async (tx) => {
      // 1. CEK DUPLIKASI SESI: Cegah submit sesi yang sama lebih dari 1 kali dalam 1 hari
      const existingSessionCount = await tx.inspections.count({
        where: {
          station_id,
          session: targetSession,
          inspected_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (existingSessionCount > 0) {
        throw new Error(
          `Sesi ${targetSession} untuk stasiun ini sudah pernah disubmit hari ini! Tidak dapat mengirim sesi yang sama dua kali.`
        );
      }

      // Catatan utama untuk sesi ini
      const effectiveNote = station_notes && station_notes.trim() ? station_notes.trim() : null;

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

      // Sinkronkan catatan utama ke seluruh record sesi ini pada hari ini
      if (effectiveNote) {
        await tx.inspections.updateMany({
          where: {
            station_id,
            session: targetSession,
            inspected_at: { gte: startOfDay, lte: endOfDay },
          },
          data: {
            notes: effectiveNote,
          },
        });
      }

      return results;
    });

    return NextResponse.json({
      success: true,
      message: `Seluruh data inspeksi Sesi ${targetSession} berhasil disimpan ke database`,
      savedCount: savedInspections.length,
      inspections: savedInspections,
    });
  } catch (error: any) {
    console.error('Error submitting inspections:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan hasil inspeksi' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { station_id, session, station_notes } = body;

    if (!station_id) {
      return NextResponse.json(
        { success: false, error: 'station_id wajib diisi' },
        { status: 400 }
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const targetSession = session ? session.toString().toUpperCase() : null;

    const updated = await prisma.inspections.updateMany({
      where: {
        station_id,
        ...(targetSession ? { session: targetSession } : {}),
        inspected_at: {
          gte: todayStart,
          lte: todayEnd,
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
