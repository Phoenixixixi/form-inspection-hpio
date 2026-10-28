import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    await prisma.items.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Item berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleting item:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus item' },
      { status: 500 }
    );
  }
}
