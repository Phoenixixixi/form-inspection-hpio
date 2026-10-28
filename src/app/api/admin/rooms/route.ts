import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { station_id, name, location, initial_items } = body;

    if (!station_id || !name) {
      return NextResponse.json(
        { success: false, error: 'station_id dan nama ruangan wajib diisi' },
        { status: 400 }
      );
    }

    const room = await prisma.rooms.create({
      data: {
        station_id,
        name: name.trim(),
        location: location ? location.trim() : null,
        is_active: true,
        items: initial_items && Array.isArray(initial_items) && initial_items.length > 0
          ? {
              create: initial_items
                .filter((itemName: string) => itemName && itemName.trim().length > 0)
                .map((itemName: string) => ({
                  name: itemName.trim(),
                  is_active: true,
                })),
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error: any) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create room' },
      { status: 500 }
    );
  }
}
