import { useEffect } from "react";
import "../styles/LogoutConfirmModal.css";

/**
 * Shared logout confirmation modal for all portals.
 */
function LogoutConfirmModal({
  open,
  loading = false,
  onConfirm,
  onCancel,
  title = "Log out?",
  message = "Are you sure you want to log out of LaundryMate?",
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

  return (
    <div
      className="logout-modal-overlay"
      onClick={() => {
        if (!loading) onCancel?.();
      }}
    >
      <div
        className="logout-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="logout-modal-icon" aria-hidden="true">
          🚪
        </div>

        <h2 id="logout-modal-title">{title}</h2>
        <p>{message}</p>

        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-modal-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="logout-modal-confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmModal;
