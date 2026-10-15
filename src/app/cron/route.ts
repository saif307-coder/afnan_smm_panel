import { NextRequest } from 'next/server';
import { handleOptions } from '@/lib/cors';
import { GET as cronGet, POST as cronPost } from '../api/cron/route';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  return cronGet(req);
}

export async function POST(req: NextRequest) {
  return cronPost(req);
}
