import { NextRequest, NextResponse } from "next/server";
import { ensureSharedListsTable, getSql } from "@/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSharedListsTable();
  const sql = getSql();

  const rows = await sql`
    SELECT todos, events FROM shared_lists WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ todos: rows[0].todos, events: rows[0].events });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureSharedListsTable();
  const sql = getSql();

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.todos) || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE shared_lists
    SET todos = ${JSON.stringify(body.todos)}::jsonb,
        events = ${JSON.stringify(body.events)}::jsonb,
        updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
