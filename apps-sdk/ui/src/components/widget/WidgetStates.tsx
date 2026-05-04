import type { ReactNode } from 'react';

/** Inline loading state — small footprint, in-flow. */
export function WidgetLoading({
  label = 'Loading…',
  description,
}: {
  label?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="dx-widget__state" data-state="loading" role="status" aria-live="polite">
      <span className="dx-widget__spinner" aria-hidden />
      <div className="dx-widget__state-text">
        <span className="dx-widget__state-label">{label}</span>
        {description ? (
          <span className="dx-widget__state-description">{description}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Empty / not-yet-populated state. */
export function WidgetEmpty({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="dx-widget__state" data-state="empty">
      <div className="dx-widget__state-text">
        <span className="dx-widget__state-label">{title}</span>
        {description ? (
          <span className="dx-widget__state-description">{description}</span>
        ) : null}
      </div>
      {action ? <div className="dx-widget__state-action">{action}</div> : null}
    </div>
  );
}

/** Error / failure state. Loud enough to be noticed without screaming. */
export function WidgetError({
  title = 'Something went wrong',
  description,
  action,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="dx-widget__state" data-state="error" role="alert">
      <div className="dx-widget__state-text">
        <span className="dx-widget__state-label">{title}</span>
        {description ? (
          <span className="dx-widget__state-description">{description}</span>
        ) : null}
      </div>
      {action ? <div className="dx-widget__state-action">{action}</div> : null}
    </div>
  );
}
