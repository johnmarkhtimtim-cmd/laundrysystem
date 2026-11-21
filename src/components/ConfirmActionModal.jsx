import { useEffect } from "react";
import "../styles/ConfirmActionModal.css";

/**
 * Shared confirmation modal for destructive / status-changing actions.
 */
function ConfirmActionModal({
  open,
  loading = false,
  variant = "danger",
  title,
  message,
  confirmLabel = "Confirm",
  loadingLabel = "Please wait...",
  cancelLabel = "Cancel",
  meta = null,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !loading) {
        onCancel?.();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const icon = variant === "success" ? "✓" : "!";

  return (
    <div
      className="confirm-action-overlay"
      onClick={() => {
        if (!loading) onCancel?.();
      }}
    >
      <div
        className={`confirm-action-modal confirm-action-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-action-icon" aria-hidden="true">
          {icon}
        </div>

        <h2 id="confirm-action-title">{title}</h2>
        {message ? <p className="confirm-action-message">{message}</p> : null}

        {meta && meta.length > 0 ? (
          <div className="confirm-action-meta">
            {meta.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        <div className="confirm-action-actions">
          <button
            type="button"
            className="confirm-action-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-action-confirm confirm-action-confirm-${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmActionModal;
