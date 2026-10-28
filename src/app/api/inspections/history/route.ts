import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const station_id = searchParams.get('station_id');

    const inspections = await prisma.inspections.findMany({
      where: station_id ? { station_id } : undefined,
      take: 20,
      orderBy: { inspected_at: 'desc' },
      include: {
        station: {
          select: { name: true, code: true },
        },
        room: {
          select: { name: true, location: true },
        },
        inspection_items: {
          include: {
            item: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      inspections,
    });
  } catch (error: any) {
    console.error('Error fetching inspection history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat riwayat inspeksi' },
      { status: 500 }
    );
  }
}
