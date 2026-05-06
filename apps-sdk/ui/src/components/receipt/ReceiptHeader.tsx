/**
 * ReceiptHeader — the top of the receipt: a small "DEXTER · RECEIPT"
 * eyebrow, the resource that was called, and an optional expand-to-
 * fullscreen affordance for big payloads.
 *
 * The header reads like a receipt's letterhead — quiet, informative,
 * not the moment. The stamp is the moment.
 */

interface Props {
  /** Display label for the called resource (host+path, already shortened). */
  resourceLabel: string;
  /** HTTP method ("GET", "POST", etc). Optional. */
  method?: string;
  /** Whether the widget is in fullscreen mode. */
  isFullscreen: boolean;
  /** Whether to render the toggle button (only when payload is large). */
  showToggle: boolean;
  onToggleFullscreen: () => void;
}

export function ReceiptHeader({
  resourceLabel,
  method,
  isFullscreen,
  showToggle,
  onToggleFullscreen,
}: Props) {
  return (
    <header className="dx-receipt-header">
      <div className="dx-receipt-header__brand">
        <span className="dx-receipt-header__eyebrow">Dexter · Receipt</span>
        <h2 className="dx-receipt-header__title">
          {method && <span className="dx-receipt-header__method">{method}</span>}
          <span className="dx-receipt-header__resource">{resourceLabel}</span>
        </h2>
      </div>

      {showToggle && (
        <button
          type="button"
          className="dx-receipt-header__toggle"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? 'minimize' : 'expand'}
        </button>
      )}
    </header>
  );
}
