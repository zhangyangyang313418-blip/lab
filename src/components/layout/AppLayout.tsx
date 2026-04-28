import type { ReactNode } from "react";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}

export function AppLayout({ title, subtitle, children, wide = false }: AppLayoutProps) {
  return (
    <div className={`app-shell ${wide ? "app-shell--wide" : ""}`}>
      <header className={`app-shell__header ${wide ? "app-shell__header--wide" : ""}`}>
        <div>
          <p className="app-shell__eyebrow">产品测试流程自动化</p>
          <h1 className="app-shell__title">{title}</h1>
          {subtitle ? <p className="app-shell__subtitle">{subtitle}</p> : null}
        </div>
      </header>

      <main className={`app-shell__main ${wide ? "app-shell__main--wide" : ""}`}>{children}</main>
    </div>
  );
}
