import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  repoId?: number | null;
}

export function Layout({ children, title, repoId }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Plan", requiresRepo: false },
    { path: "/execute", label: "Execute", requiresRepo: true },
    { path: "/settings", label: "Settings", requiresRepo: true },
  ];

  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-left">
          <h1 className="layout__title">Vibe Tree</h1>
          <span className="layout__subtitle">{title}</span>
        </div>
        <nav className="layout__nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const href = item.requiresRepo && repoId
              ? `${item.path}?repoId=${repoId}`
              : item.path;
            const disabled = item.requiresRepo && !repoId;

            return disabled ? (
              <span
                key={item.path}
                className="layout__nav-item layout__nav-item--disabled"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.path}
                to={href}
                className={`layout__nav-item ${isActive ? "layout__nav-item--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="layout__main">{children}</main>

      <style>{`
        .layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .layout__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .layout__header-left {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }
        .layout__title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #0066cc;
        }
        .layout__subtitle {
          font-size: 14px;
          color: #666;
        }
        .layout__nav {
          display: flex;
          gap: 4px;
        }
        .layout__nav-item {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          color: #555;
          transition: background 0.15s, color 0.15s;
        }
        .layout__nav-item:hover:not(.layout__nav-item--disabled) {
          background: #f0f0f0;
          color: #333;
        }
        .layout__nav-item--active {
          background: #e8f4fc;
          color: #0066cc;
        }
        .layout__nav-item--disabled {
          color: #ccc;
          cursor: not-allowed;
        }
        .layout__main {
          flex: 1;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
      `}</style>
    </div>
  );
}
