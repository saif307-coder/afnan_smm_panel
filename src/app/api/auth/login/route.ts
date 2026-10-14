import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, generateAdminToken, getAdminPassword } from '@/lib/auth';
import { handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body || {};

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password !== getAdminPassword()) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    const token = generateAdminToken();
    const res = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
    });

    res.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to process login' },
      { status: 500 }
    );
  }
}
