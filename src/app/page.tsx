const features = [
  {
    title: "高速",
    description: "Next.js App Routerによる最適化されたレンダリングで、快適な表示速度を実現します。",
  },
  {
    title: "レスポンシブ",
    description: "Tailwind CSSでスマートフォンからデスクトップまで美しく表示されます。",
  },
  {
    title: "拡張しやすい",
    description: "TypeScriptによる型安全な設計で、機能追加や保守がしやすい構成です。",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">MyProduct</span>
          <div className="flex items-center gap-4">
            <a
              href="/todo"
              className="text-sm font-medium text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
            >
              ToDoリスト
            </a>
            <a
              href="#cta"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              はじめる
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            もっとシンプルに、
            <br className="hidden sm:block" />
            もっと速く。
          </h1>
          <p className="max-w-2xl text-lg text-black/70 dark:text-white/70">
            Next.jsとTailwind CSSで作られたシンプルなランディングページ。
            あなたのアイデアを最短距離でカタチにします。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              id="cta"
              href="#"
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
            >
              無料で始める
            </a>
            <a
              href="#features"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              詳しく見る
            </a>
          </div>
        </section>

        <section id="features" className="border-t border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              特徴
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-black/70 dark:text-white/70">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/10 px-6 py-8 text-center text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        © {new Date().getFullYear()} MyProduct. All rights reserved.
      </footer>
    </div>
  );
}
