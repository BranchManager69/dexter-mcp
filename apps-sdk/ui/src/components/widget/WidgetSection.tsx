import type { PropsWithChildren, ReactNode } from 'react';

/**
 * A logical section within a widget. Provides a consistent label-and-body
 * rhythm without forcing a visual container around every region — widgets
 * often need to feel like a single composed surface, not a stack of cards.
 *
 * `framed` opts into a bordered container for sections that genuinely need
 * separation (e.g. an actionable subform inside an information panel).
 */
export function WidgetSection({
  title,
  description,
  framed = false,
  trailing,
  children,
}: PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  framed?: boolean;
  trailing?: ReactNode;
}>) {
  return (
    <section
      className="dx-widget__section"
      data-framed={framed ? 'true' : 'false'}
    >
      {title || description || trailing ? (
        <header className="dx-widget__section-header">
          <div className="dx-widget__section-heading">
            {title ? <h2 className="dx-widget__section-title">{title}</h2> : null}
            {description ? (
              <p className="dx-widget__section-description">{description}</p>
            ) : null}
          </div>
          {trailing ? (
            <div className="dx-widget__section-trailing">{trailing}</div>
          ) : null}
        </header>
      ) : null}
      <div className="dx-widget__section-body">{children}</div>
    </section>
  );
}
