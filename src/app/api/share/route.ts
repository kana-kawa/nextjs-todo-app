import { NextRequest, NextResponse } from "next/server";
import { ensureSharedListsTable, getSql } from "@/db";

function generateShareId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export async function POST(request: NextRequest) {
  await ensureSharedListsTable();
  const sql = getSql();

  const body = await request.json().catch(() => ({}));
  const todos = Array.isArray(body?.todos) ? body.todos : [];
  const events = Array.isArray(body?.events) ? body.events : [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateShareId();
    try {
      await sql`
        INSERT INTO shared_lists (id, todos, events)
        VALUES (${id}, ${JSON.stringify(todos)}::jsonb, ${JSON.stringify(events)}::jsonb)
      `;
      return NextResponse.json({ id });
    } catch {
      // idが衝突した場合は別のidで再試行
    }
  }

  return NextResponse.json(
    { error: "共有リストの作成に失敗しました" },
    { status: 500 }
  );
}
