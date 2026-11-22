import { useEffect, useState } from "react";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import "../styles/ThemeToggleBar.css";

/**
 * Day / Dark mode switch placed above each portal navbar,
 * plus an Android native permissions activator when running inside the APK.
 */
function ThemeToggleBar() {
  const { theme, setLight, setDark } = useTheme();
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [allPermissionsGranted, setAllPermissionsGranted] = useState(false);

  useEffect(() => {
    const bridge =
      typeof window !== "undefined" ? window.LaundryMateAndroid : null;
    if (!bridge) return;

    setIsAndroidApp(true);

    const refreshStatus = () => {
      try {
        if (typeof bridge.hasAllPermissions === "function") {
          setAllPermissionsGranted(Boolean(bridge.hasAllPermissions()));
        } else if (typeof bridge.hasLocationPermission === "function") {
          setAllPermissionsGranted(Boolean(bridge.hasLocationPermission()));
        }
      } catch {
        // ignore bridge read error
      }
    };

    refreshStatus();

    const onPermStatus = (e) => {
      if (e?.detail && typeof e.detail.allGranted === "boolean") {
        setAllPermissionsGranted(e.detail.allGranted);
      } else {
        refreshStatus();
      }
    };

    window.addEventListener("laundrymatePermissionsStatus", onPermStatus);
    window.addEventListener("laundrymateLocationPermissionResult", refreshStatus);
    return () => {
      window.removeEventListener("laundrymatePermissionsStatus", onPermStatus);
      window.removeEventListener(
        "laundrymateLocationPermissionResult",
        refreshStatus
      );
    };
  }, []);

  const handleActivatePermissions = () => {
    const bridge =
      typeof window !== "undefined" ? window.LaundryMateAndroid : null;
    if (!bridge) return;

    if (!allPermissionsGranted && typeof bridge.requestAllPermissions === "function") {
      bridge.requestAllPermissions();
      return;
    }
    if (typeof bridge.openAppSettings === "function") {
      bridge.openAppSettings();
    }
  };

  return (
    <div className="theme-toggle-bar" role="region" aria-label="Display theme">
      {isAndroidApp && (
        <button
          type="button"
          className={`theme-perm-btn ${
            allPermissionsGranted ? "is-granted" : "needs-action"
          }`}
          onClick={handleActivatePermissions}
          title="Configure Location, Files, Camera, and Notification permissions"
        >
          <ShieldCheck size={14} />
          <span>
            {allPermissionsGranted ? "Permissions On" : "Turn On Permissions"}
          </span>
        </button>
      )}

      <span className="theme-toggle-label">Display</span>

      <div className="theme-toggle-switch" role="group" aria-label="Theme mode">
        <button
          type="button"
          className={`theme-mode-btn ${theme === "light" ? "active" : ""}`}
          onClick={setLight}
          aria-pressed={theme === "light"}
        >
          <Sun size={15} />
          <span>Day</span>
        </button>

        <button
          type="button"
          className={`theme-mode-btn ${theme === "dark" ? "active" : ""}`}
          onClick={setDark}
          aria-pressed={theme === "dark"}
        >
          <Moon size={15} />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
}

export default ThemeToggleBar;
