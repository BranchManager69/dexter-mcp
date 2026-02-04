import '../styles/base.css';
import '../styles/components.css';
import '../styles/widgets/test-endpoint.css';

import { useOpenAIGlobal } from "../sdk";

type TestPayload = {
  ok?: boolean;
  status?: string;
  message?: string;
  version?: string | number;
  timestamp?: string;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
};

export default function TestEndpoint() {
  const toolOutput = useOpenAIGlobal("toolOutput") as TestPayload | undefined;

  if (!toolOutput) {
    return (
      <div className="test-container test-loading">
        <div className="test-spinner" />
        <span>Running test...</span>
      </div>
    );
  }

  if (toolOutput.error) {
    return (
      <div className="test-container test-error">
        <span className="test-icon">✕</span>
        <span>{toolOutput.error}</span>
      </div>
    );
  }

  const isSuccess = toolOutput.ok === true || toolOutput.status === "ok" || toolOutput.status === "success";
  const statusText = toolOutput.status || (isSuccess ? "OK" : "Unknown");
  const message = toolOutput.message || "Test endpoint response";

  // Get any extra fields
  const extraFields = Object.entries(toolOutput).filter(
    ([key]) => !["ok", "status", "message", "version", "timestamp", "data", "error"].includes(key)
  );

  return (
    <div className="test-container">
      <header className="test-header">
        <span className="test-label">Test Endpoint</span>
        <span className={`test-badge ${isSuccess ? "test-badge-success" : "test-badge-neutral"}`}>
          {statusText}
        </span>
      </header>

      <div className="test-message">{message}</div>

      {toolOutput.version && (
        <div className="test-field">
          <span className="test-field-label">Version</span>
          <span className="test-field-value">{String(toolOutput.version)}</span>
        </div>
      )}

      {toolOutput.timestamp && (
        <div className="test-field">
          <span className="test-field-label">Timestamp</span>
          <span className="test-field-value">{toolOutput.timestamp}</span>
        </div>
      )}

      {extraFields.length > 0 && (
        <div className="test-extra">
          {extraFields.slice(0, 5).map(([key, value]) => (
            <div key={key} className="test-field">
              <span className="test-field-label">{key}</span>
              <span className="test-field-value">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {toolOutput.data && (
        <details className="test-data">
          <summary>Response Data</summary>
          <pre>{JSON.stringify(toolOutput.data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
