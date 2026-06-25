import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../../lib/server-token';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();

  // Forward multipart/form-data (file upload)
  const body = await req.formData();
  const res = await fetch(`${API_URL}/api/v1/homework/${id}/submit`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
