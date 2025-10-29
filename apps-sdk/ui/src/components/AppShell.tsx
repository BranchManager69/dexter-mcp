import type { PropsWithChildren, ReactNode } from 'react';

type BadgeProps = {
  label: string;
  tone?: 'default' | 'accent';
  prefix?: ReactNode;
};

export function AppShell({ children }: PropsWithChildren) {
  return <div className="dexter-app">{children}</div>;
}

export function Card({ title, badge, children }: PropsWithChildren<{ title: string; badge?: BadgeProps }>) {
  return (
    <section className="dexter-card">
      <header className="dexter-card__header">
        <h2 className="dexter-card__title">{title}</h2>
        {badge ? (
          <span className="dexter-badge">
            {badge.prefix}
            {badge.label}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function Grid({ columns = 1, children }: PropsWithChildren<{ columns?: 1 | 2 | 3 }>) {
  const className =
    columns === 3 ? 'dexter-grid dexter-grid--cols-3' : columns === 2 ? 'dexter-grid dexter-grid--cols-2 dexter-grid' : 'dexter-grid';
  return <div className={className}>{children}</div>;
}

export function Field({
  label,
  value,
  code = false,
}: {
  label: string;
  value: ReactNode;
  code?: boolean;
}) {
  return (
    <div className="dexter-field">
      <span className="dexter-field__label">{label}</span>
      <span className={`dexter-field__value${code ? ' dexter-field__value--code' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export function Status({ children }: PropsWithChildren) {
  return <footer className="dexter-status">{children}</footer>;
}

export function Warning({ children }: PropsWithChildren) {
  return <div className="dexter-status__warning">{children}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="dexter-empty">{message}</div>;
}
