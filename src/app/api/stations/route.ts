import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const stations = await prisma.stations.findMany({
      orderBy: { name: 'asc' },
      include: {
        rooms: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          include: {
            items: {
              where: { is_active: true },
              orderBy: { name: 'asc' },
            },
          },
        },
        technicians: {
          orderBy: { name: 'asc' },
        },
      },
    });

    const technicians = await prisma.technicians.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      stations,
      technicians,
    });
  } catch (error: any) {
    console.error('Error fetching stations:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stations' },
      { status: 500 }
    );
  }
}
