import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { station_id, technician_name, station_notes, room_inspections } = body;

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

    // Perform database writes in transaction
    const savedInspections = await prisma.$transaction(async (tx) => {
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

        // Combine room notes with station notes if applicable
        const combinedNotes = [
          rInsp.notes ? `[Catatan Ruangan]: ${rInsp.notes}` : null,
          station_notes ? `[Catatan Stasiun]: ${station_notes}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        const inspection = await tx.inspections.create({
          data: {
            station_id,
            room_id: rInsp.room_id || null,
            user_id: technician_name,
            temperature: tempDecimal,
            humidity: humDecimal,
            notes: combinedNotes || null,
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
