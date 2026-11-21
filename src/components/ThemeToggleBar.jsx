import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import "../styles/ThemeToggleBar.css";

/**
 * Day / Dark mode switch placed above each portal navbar.
 */
function ThemeToggleBar() {
  const { theme, setLight, setDark } = useTheme();

  return (
    <div className="theme-toggle-bar" role="region" aria-label="Display theme">
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
