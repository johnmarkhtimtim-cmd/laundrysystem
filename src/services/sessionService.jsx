/**
 * Client-side session helpers for LaundryMate.
 * Works with Firebase Auth persistence + local idle timeout.
 */

export const SESSION_STORAGE_KEY = "laundrymate_session";
export const REMEMBER_ME_KEY = "laundrymate_remember_me";

/** Auto-logout after this much idle time (30 minutes). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** How often we check idle expiry while the tab is open. */
export const IDLE_CHECK_INTERVAL_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "visibilitychange",
];

const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const getRememberMePreference = () => {
  const stored = localStorage.getItem(REMEMBER_ME_KEY);
  if (stored === null) return true;
  return stored === "true";
};

export const setRememberMePreference = (rememberMe) => {
  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
};

/**
 * Create or refresh an app session record after a successful login.
 */
export const createSession = (uid, { rememberMe = true } = {}) => {
  const now = Date.now();
  const session = {
    uid,
    rememberMe: Boolean(rememberMe),
    loginAt: now,
    lastActivityAt: now,
  };

  setRememberMePreference(rememberMe);

  if (rememberMe) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return session;
};

export const getSession = () => {
  return (
    safeParse(sessionStorage.getItem(SESSION_STORAGE_KEY)) ||
    safeParse(localStorage.getItem(SESSION_STORAGE_KEY))
  );
};

/**
 * Update last activity timestamp. No-op if there is no session.
 */
export const touchSession = () => {
  const session = getSession();
  if (!session) return null;

  const updated = {
    ...session,
    lastActivityAt: Date.now(),
  };

  const payload = JSON.stringify(updated);
  if (session.rememberMe) {
    localStorage.setItem(SESSION_STORAGE_KEY, payload);
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
  }

  return updated;
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
};

export const isSessionExpired = (session = getSession()) => {
  if (!session?.lastActivityAt) return true;
  return Date.now() - session.lastActivityAt > IDLE_TIMEOUT_MS;
};

/**
 * Listen for user activity and call onIdle when the idle timeout is hit.
 * Returns a cleanup function.
 */
export const startIdleWatcher = (onIdle) => {
  let idleTimer = null;
  let checkTimer = null;
  let disposed = false;

  const scheduleIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!disposed) onIdle();
    }, IDLE_TIMEOUT_MS);
  };

  const onActivity = () => {
    if (disposed) return;
    if (document.visibilityState === "hidden") return;
    touchSession();
    scheduleIdle();
  };

  const checkExpiry = () => {
    if (disposed) return;
    if (isSessionExpired()) {
      onIdle();
    }
  };

  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, onActivity, { passive: true });
  });

  touchSession();
  scheduleIdle();
  checkTimer = setInterval(checkExpiry, IDLE_CHECK_INTERVAL_MS);

  return () => {
    disposed = true;
    if (idleTimer) clearTimeout(idleTimer);
    if (checkTimer) clearInterval(checkTimer);
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, onActivity);
    });
  };
};
