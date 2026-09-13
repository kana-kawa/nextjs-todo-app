"use client";

import { useEffect, useState } from "react";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

const STORAGE_KEY = "todos";

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // SSRとのハイドレーション不整合を避けるため、マウント後にlocalStorageから読み込む
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTodos(JSON.parse(stored));
      }
    } catch {
      // localStorageが使えない環境では初期状態のまま
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // 保存に失敗しても画面上の操作は継続させる
    }
  }, [todos, loaded]);

  function addTodo() {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, completed: false },
    ]);
    setInput("");
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }

  const remaining = todos.filter((todo) => !todo.completed).length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">ToDoリスト</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          データはこのブラウザに保存され、閉じても残ります。
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo();
          }}
          placeholder="タスクを入力"
          className="flex-1 rounded-full border border-black/10 px-4 py-2 text-sm outline-none focus:border-black/30 dark:border-white/20 dark:bg-transparent dark:focus:border-white/40"
        />
        <button
          onClick={addTodo}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          追加
        </button>
      </div>

      {todos.length === 0 ? (
        <p className="py-8 text-center text-sm text-black/50 dark:text-white/50">
          タスクはまだありません。
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="h-4 w-4 shrink-0 accent-foreground"
              />
              <span
                className={`flex-1 text-sm ${
                  todo.completed
                    ? "text-black/40 line-through dark:text-white/40"
                    : ""
                }`}
              >
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="rounded-full px-3 py-1 text-xs font-medium text-black/60 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}

      {todos.length > 0 && (
        <p className="text-xs text-black/50 dark:text-white/50">
          残り {remaining} / {todos.length} 件
        </p>
      )}
    </div>
  );
}
