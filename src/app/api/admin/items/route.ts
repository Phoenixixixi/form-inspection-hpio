import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { room_id, name } = body;

    if (!room_id || !name) {
      return NextResponse.json(
        { success: false, error: 'room_id dan nama item wajib diisi' },
        { status: 400 }
      );
    }

    const item = await prisma.items.create({
      data: {
        room_id,
        name: name.trim(),
        is_active: true,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('Error creating item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan item' },
      { status: 500 }
    );
  }
}
