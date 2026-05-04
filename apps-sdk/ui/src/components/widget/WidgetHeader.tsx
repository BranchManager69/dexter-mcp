import type { PropsWithChildren, ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'success' | 'warn' | 'danger';

export type WidgetEyebrow = {
  label: string;
  tone?: Tone;
  prefix?: ReactNode;
};

/**
 * Standard widget header: optional eyebrow tag, primary title, optional
 * supporting line, and a trailing slot for actions/badges.
 *
 * Visual treatment is set in CSS — this component just establishes the
 * structural rhythm so every widget reads at the same eye level.
 */
export function WidgetHeader({
  title,
  eyebrow,
  supporting,
  trailing,
}: PropsWithChildren<{
  title: ReactNode;
  eyebrow?: WidgetEyebrow;
  supporting?: ReactNode;
  trailing?: ReactNode;
}>) {
  return (
    <header className="dx-widget__header">
      <div className="dx-widget__heading">
        {eyebrow ? (
          <span
            className="dx-widget__eyebrow"
            data-tone={eyebrow.tone ?? 'default'}
          >
            {eyebrow.prefix}
            {eyebrow.label}
          </span>
        ) : null}
        <h1 className="dx-widget__title">{title}</h1>
        {supporting ? (
          <p className="dx-widget__supporting">{supporting}</p>
        ) : null}
      </div>
      {trailing ? <div className="dx-widget__trailing">{trailing}</div> : null}
    </header>
  );
}
