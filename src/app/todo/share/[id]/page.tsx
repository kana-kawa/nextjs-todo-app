import { ensureSharedListsTable, getSql } from "@/db";
import TodoApp from "../../TodoApp";

export default async function SharedTodoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureSharedListsTable();
  const sql = getSql();

  const rows = await sql`
    SELECT todos, events FROM shared_lists WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          リストが見つかりません
        </h1>
        <p className="text-base text-black/60 dark:text-white/60">
          リンクが間違っているか、リストが削除された可能性があります。
        </p>
      </div>
    );
  }

  return (
    <TodoApp
      shareId={id}
      initialTodos={rows[0].todos ?? []}
      initialEvents={rows[0].events ?? []}
    />
  );
}
