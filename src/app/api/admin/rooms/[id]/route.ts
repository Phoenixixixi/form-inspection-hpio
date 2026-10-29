import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Harap login sebagai administrator' },
        { status: 401 }
      );
    }
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
