import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    await prisma.rooms.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Ruangan berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus ruangan' },
      { status: 500 }
    );
  }
}
