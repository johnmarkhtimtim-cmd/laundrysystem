import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../services/firebase";
import { logout } from "../services/authService";
import { getUserData, updateUserProfile } from "../services/userService";
import {
    clearSession,
    createSession,
    getRememberMePreference,
    getSession,
    isSessionExpired,
    startIdleWatcher,
} from "../services/sessionService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);
    const idleCleanupRef = useRef(null);
    const handlingIdleRef = useRef(false);

    useEffect(() => {
        const stopIdleWatcher = () => {
            if (idleCleanupRef.current) {
                idleCleanupRef.current();
                idleCleanupRef.current = null;
            }
        };

        const handleIdleTimeout = async () => {
            if (handlingIdleRef.current) return;
            handlingIdleRef.current = true;

            try {
                stopIdleWatcher();
                setSessionExpired(true);
                clearSession();
                await logout();
                setUser(null);
            } catch (error) {
                console.error("Failed to end idle session:", error);
            } finally {
                handlingIdleRef.current = false;
            }
        };

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            stopIdleWatcher();

            if (!currentUser) {
                clearSession();
                setUser(null);
                setLoading(false);
                return;
            }

            const existingSession = getSession();

            // Stale idle session left behind — force sign-out
            if (existingSession && isSessionExpired(existingSession)) {
                setSessionExpired(true);
                clearSession();
                try {
                    await logout();
                } catch (error) {
                    console.error("Failed to clear expired session:", error);
                }
                setUser(null);
                setLoading(false);
                return;
            }

            // Restore or create session metadata for this auth user
            if (!existingSession || existingSession.uid !== currentUser.uid) {
                createSession(currentUser.uid, {
                    rememberMe: getRememberMePreference(),
                });
            }

            try {
                const userData = await getUserData(currentUser.uid);

                if (
                    userData?.status === "Archived" ||
                    userData?.status === "Inactive"
                ) {
                    clearSession();
                    await logout();
                    setUser(null);
                    setLoading(false);
                    return;
                }

                setUser({
                    uid: currentUser.uid,
                    email: currentUser.email,
                    ...userData,
                });
                setSessionExpired(false);

                // Soft-touch last login (non-blocking)
                updateUserProfile(currentUser.uid, {
                    lastLoginAt: new Date().toISOString(),
                }).catch(() => {});

                idleCleanupRef.current = startIdleWatcher(handleIdleTimeout);
            } catch (error) {
                console.error("Failed to load user session:", error);
                setUser({
                    uid: currentUser.uid,
                    email: currentUser.email,
                });
                idleCleanupRef.current = startIdleWatcher(handleIdleTimeout);
            }

            setLoading(false);
        });

        return () => {
            stopIdleWatcher();
            unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                sessionExpired,
                clearSessionExpired: () => setSessionExpired(false),
                updateUser: (changes) =>
                    setUser((prev) => ({ ...prev, ...changes })),
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
