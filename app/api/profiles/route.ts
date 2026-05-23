import { NextRequest, NextResponse } from 'next/server';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type ProfilePayload = {
  id?: string;
  display_name?: string;
};

function getFirebaseAdmin() {
  if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured.');
    }

    const parsedServiceAccount = JSON.parse(serviceAccount);
    if (typeof parsedServiceAccount.private_key === 'string') {
      parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(parsedServiceAccount),
    });
  }

  return getAuth();
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

async function requireFirebaseUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return null;
  }

  return getFirebaseAdmin().verifyIdToken(token);
}

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded) return errorResponse(new Error('Unauthorized'), 401);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('uuid', decoded.uid)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ profiles: data || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded) return errorResponse(new Error('Unauthorized'), 401);

    const body = (await request.json()) as ProfilePayload;
    const displayName = body.display_name?.trim();
    if (!displayName) return errorResponse(new Error('Account name is required.'), 400);

    const id = body.id || crypto.randomUUID();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id,
          uuid: decoded.uid,
          display_name: displayName,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded) return errorResponse(new Error('Unauthorized'), 401);

    const body = (await request.json()) as ProfilePayload;
    const displayName = body.display_name?.trim();
    if (!body.id || !displayName) return errorResponse(new Error('Profile id and name are required.'), 400);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', body.id)
      .eq('uuid', decoded.uid)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireFirebaseUser(request);
    if (!decoded) return errorResponse(new Error('Unauthorized'), 401);

    const body = (await request.json()) as ProfilePayload;
    if (!body.id) return errorResponse(new Error('Profile id is required.'), 400);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', body.id)
      .eq('uuid', decoded.uid);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
