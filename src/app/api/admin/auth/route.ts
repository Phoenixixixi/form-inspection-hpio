import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  getAdminSession,
  verifyUserPassword,
  ADMIN_COOKIE_NAME,
} from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({
        success: true,
        authenticated: false,
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: session,
    });
  } catch (error: any) {
    console.error('Error checking admin auth session:', error);
    return NextResponse.json(
      { success: false, authenticated: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email dan password wajib diisi' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Query user from database
    const user = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Email atau password tidak valid' },
        { status: 401 }
      );
    }

    if (user.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'Akun administrator ini tidak aktif' },
        { status: 403 }
      );
    }

    // Verify password with bcrypt
    const isPasswordValid = await verifyUserPassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Email atau password tidak valid' },
        { status: 401 }
      );
    }

    const sessionUser = {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      role_id: user.role_id,
    };

    const token = createSessionToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      user: sessionUser,
    });

    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error: any) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem saat login' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    });

    response.cookies.delete(ADMIN_COOKIE_NAME);

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal logout' },
      { status: 500 }
    );
  }
}
