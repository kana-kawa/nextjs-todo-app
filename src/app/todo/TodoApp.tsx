"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  dueDate: string | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
};

type TodoAppProps = {
  shareId?: string;
  initialTodos?: Todo[];
  initialEvents?: CalendarEvent[];
};

const STORAGE_KEY = "todos";
const EVENTS_STORAGE_KEY = "events";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SYNC_DEBOUNCE_MS = 800;
const POLL_INTERVAL_MS = 5000;

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDueSoon(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
}

export default function TodoApp({
  shareId,
  initialTodos,
  initialEvents,
}: TodoAppProps) {
  const isShared = !!shareId;
  const router = useRouter();

  const [todos, setTodos] = useState<Todo[]>(initialTodos ?? []);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents ?? []);
  const [input, setInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loaded, setLoaded] = useState(isShared);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [eventInput, setEventInput] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [origin, setOrigin] = useState("");
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const dirtyRef = useRef(false);
  const skipNextSyncRef = useRef(isShared);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrigin(window.location.origin);
    }
  }, []);

  // ローカルモード: 初回マウント時にlocalStorageから読み込む
  useEffect(() => {
    if (isShared) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Todo[] = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTodos(
          parsed.map((todo) => ({ ...todo, dueDate: todo.dueDate ?? null }))
        );
      }
      const storedEvents = window.localStorage.getItem(EVENTS_STORAGE_KEY);
      if (storedEvents) {
        setEvents(JSON.parse(storedEvents));
      }
    } catch {
      // localStorageが使えない環境では初期状態のまま
    } finally {
      setLoaded(true);
    }
  }, [isShared]);

  // ローカルモード: 変更をlocalStorageに保存
  useEffect(() => {
    if (isShared || !loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // 保存に失敗しても画面上の操作は継続させる
    }
  }, [todos, loaded, isShared]);

  useEffect(() => {
    if (isShared || !loaded) return;
    try {
      window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch {
      // 保存に失敗しても画面上の操作は継続させる
    }
  }, [events, loaded, isShared]);

  // 共有モード: 変更をサーバーへデバウンス保存
  useEffect(() => {
    if (!isShared) return;
    if (skipNextSyncRef.current) {
      // 初期データ読み込み直後の書き込みはスキップ
      skipNextSyncRef.current = false;
      return;
    }
    dirtyRef.current = true;
    const timer = setTimeout(async () => {
      try {
        await fetch(`/api/share/${shareId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todos, events }),
        });
      } catch {
        // 同期に失敗しても画面上の操作は継続させる
      } finally {
        dirtyRef.current = false;
      }
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [todos, events, isShared, shareId]);

  // 共有モード: 他の人の変更を定期的に取得
  useEffect(() => {
    if (!isShared) return;
    const interval = setInterval(async () => {
      if (dirtyRef.current) return;
      try {
        const res = await fetch(`/api/share/${shareId}`);
        if (!res.ok) return;
        const data = await res.json();
        skipNextSyncRef.current = true;
        setTodos(data.todos ?? []);
        setEvents(data.events ?? []);
      } catch {
        // ポーリング失敗時は次回に任せる
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isShared, shareId]);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todos, events }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/todo/share/${data.id}`);
      }
    } catch {
      // 失敗した場合はボタンを再度押せる状態に戻す
    } finally {
      setSharing(false);
    }
  }

  async function copyShareLink() {
    if (!shareId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/todo/share/${shareId}`);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  async function handleRevoke() {
    if (!shareId) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/share/${shareId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/todo");
        return;
      }
    } catch {
      // 失敗した場合はボタンを再度押せる状態に戻す
    }
    setRevoking(false);
    setConfirmingRevoke(false);
  }

  function addTodo() {
    const text = input.trim();
    if (!text) return;
    setTodos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        dueDate: dueDate || null,
      },
    ]);
    setInput("");
    setDueDate("");
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

  function addEvent() {
    const title = eventInput.trim();
    if (!title || !selectedDate) return;
    setEvents((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, date: selectedDate },
    ]);
    setEventInput("");
  }

  function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((event) => event.id !== id));
  }

  const remaining = todos.filter((todo) => !todo.completed).length;

  const dueTodos = [...todos]
    .filter((todo) => todo.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0));
  const todayTodos = todos.filter((todo) => !todo.dueDate);

  const todosByDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.dueDate) continue;
      const list = map.get(todo.dueDate) ?? [];
      list.push(todo);
      map.set(todo.dueDate, list);
    }
    return map;
  }, [todos]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const calendarWeeks = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calendarMonth]);

  const todayKey = formatDateKey(new Date());
  const selectedDateTodos = selectedDate ? todosByDate.get(selectedDate) ?? [] : [];
  const selectedDateEvents = selectedDate ? eventsByDate.get(selectedDate) ?? [] : [];

  function goToPrevMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function renderTodoItem(todo: Todo) {
    const isSoon = !todo.completed && !!todo.dueDate && isDueSoon(todo.dueDate);
    return (
      <li key={todo.id} className="flex items-center gap-1 py-1">
        <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
            className="h-5 w-5 accent-foreground"
          />
        </label>
        <span
          className={`flex-1 text-base ${
            todo.completed
              ? "text-black/40 line-through dark:text-white/40"
              : isSoon
                ? "font-medium text-red-600 dark:text-red-400"
                : ""
          }`}
        >
          {todo.text}
        </span>
        {todo.dueDate && (
          <span
            className={`text-sm ${
              isSoon
                ? "font-medium text-red-600 dark:text-red-400"
                : "text-black/50 dark:text-white/50"
            }`}
          >
            {todo.dueDate}
          </span>
        )}
        <button
          onClick={() => deleteTodo(todo.id)}
          className="flex min-h-11 items-center justify-center rounded-full px-4 text-base font-medium text-black/60 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          削除
        </button>
      </li>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight">ToDoリスト</h1>
          {!isShared && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex min-h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium transition hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {sharing ? "作成中…" : "共有する"}
            </button>
          )}
        </div>
        <p className="text-base text-black/60 dark:text-white/60">
          {isShared
            ? "このリストは共有中です。リンクを知っている人は誰でも閲覧・編集できます。"
            : "データはこのブラウザに保存され、閉じても残ります。"}
        </p>
        {isShared && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate text-black/60 dark:text-white/60">
              {origin}/todo/share/{shareId}
            </span>
            <button
              onClick={copyShareLink}
              className="flex min-h-8 items-center justify-center rounded-full border border-black/10 px-3 text-sm transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              {copyStatus === "copied" ? "コピーしました" : "リンクをコピー"}
            </button>
            {!confirmingRevoke ? (
              <button
                onClick={() => setConfirmingRevoke(true)}
                className="flex min-h-8 items-center justify-center rounded-full border border-black/10 px-3 text-sm text-black/60 transition hover:bg-black/5 dark:border-white/20 dark:text-white/60 dark:hover:bg-white/10"
              >
                共有を解除する
              </button>
            ) : (
              <span className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm dark:border-red-900 dark:bg-red-950">
                本当に解除しますか？
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="font-medium text-red-600 underline disabled:opacity-50 dark:text-red-400"
                >
                  {revoking ? "解除中…" : "解除する"}
                </button>
                <button
                  onClick={() => setConfirmingRevoke(false)}
                  disabled={revoking}
                  className="text-black/60 underline disabled:opacity-50 dark:text-white/60"
                >
                  キャンセル
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo();
          }}
          placeholder="タスクを入力"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 px-4 text-base outline-none focus:border-black/30 dark:border-white/20 dark:bg-transparent dark:focus:border-white/40"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="min-h-11 rounded-full border border-black/10 px-4 text-base outline-none focus:border-black/30 dark:border-white/20 dark:bg-transparent dark:focus:border-white/40"
        />
        <button
          onClick={addTodo}
          className="flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition hover:opacity-90"
        >
          追加
        </button>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevMonth}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-base hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="前の月"
          >
            ‹
          </button>
          <h2 className="text-lg font-semibold">
            {calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月
          </h2>
          <button
            onClick={goToNextMonth}
            className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-base hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="次の月"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-sm text-black/50 dark:text-white/50">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarWeeks.flat().map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />;
            const key = formatDateKey(date);
            const dayTodos = todosByDate.get(key) ?? [];
            const dayEvents = eventsByDate.get(key) ?? [];
            const isSelected = selectedDate === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition ${
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : isToday
                      ? "border-foreground/40"
                      : "border-transparent hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span>{date.getDate()}</span>
                {(dayTodos.length > 0 || dayEvents.length > 0) && (
                  <span className="flex h-1.5 items-center gap-0.5">
                    {dayTodos.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    )}
                    {dayEvents.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="flex flex-col gap-4 border-t border-black/10 pt-3 dark:border-white/10">
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {selectedDate} のタスク
              </h3>
              {selectedDateTodos.length === 0 ? (
                <p className="text-sm text-black/50 dark:text-white/50">
                  この日のタスクはありません。
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                  {selectedDateTodos.map((todo) => renderTodoItem(todo))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {selectedDate} の予定
              </h3>
              {selectedDateEvents.length === 0 ? (
                <p className="text-sm text-black/50 dark:text-white/50">
                  この日の予定はありません。
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                  {selectedDateEvents.map((event) => (
                    <li key={event.id} className="flex items-center gap-1 py-1">
                      <span className="flex-1 text-base">{event.title}</span>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="flex min-h-11 items-center justify-center rounded-full px-4 text-base font-medium text-black/60 transition hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={eventInput}
                  onChange={(e) => setEventInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addEvent();
                  }}
                  placeholder="予定を入力"
                  className="min-h-11 min-w-0 flex-1 rounded-full border border-black/10 px-4 text-base outline-none focus:border-black/30 dark:border-white/20 dark:bg-transparent dark:focus:border-white/40"
                />
                <button
                  onClick={addEvent}
                  className="flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition hover:opacity-90"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {todos.length === 0 ? (
        <p className="py-8 text-center text-base text-black/50 dark:text-white/50">
          タスクはまだありません。
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">今日やること</h2>
            {todayTodos.length === 0 ? (
              <p className="py-4 text-center text-sm text-black/50 dark:text-white/50">
                今日やるタスクはありません。
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                {todayTodos.map((todo) => renderTodoItem(todo))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">期日のあるタスク</h2>
            {dueTodos.length === 0 ? (
              <p className="py-4 text-center text-sm text-black/50 dark:text-white/50">
                期日のあるタスクはありません。
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
                {dueTodos.map((todo) => renderTodoItem(todo))}
              </ul>
            )}
          </section>
        </div>
      )}

      {todos.length > 0 && (
        <p className="text-base text-black/50 dark:text-white/50">
          残り {remaining} / {todos.length} 件
        </p>
      )}
    </div>
  );
}
