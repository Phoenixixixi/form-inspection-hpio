import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const station_id = searchParams.get('station_id');
    const session = searchParams.get('session');
    const today_only = searchParams.get('today_only') !== 'false'; // default true

    // Filter per hari ini (Today: 00:00:00 s/d 23:59:59 waktu lokal)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const inspections = await prisma.inspections.findMany({
      where: {
        ...(station_id ? { station_id } : {}),
        ...(session ? { session: session.toUpperCase() } : {}),
        ...(today_only
          ? {
              inspected_at: {
                gte: startOfDay,
                lte: endOfDay,
              },
            }
          : {}),
      },
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
      filter: {
        today_only,
        date: startOfDay.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching inspection history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat riwayat inspeksi' },
      { status: 500 }
    );
  }
}
