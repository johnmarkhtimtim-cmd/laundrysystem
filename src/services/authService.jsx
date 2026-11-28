import {
    EmailAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
} from "firebase/auth";
import { auth } from "./firebase";
import { clearSession, createSession, setRememberMePreference } from "./sessionService";

/**
 * Change the current user's password after re-authenticating
 * @param {string} currentPassword - The user's current password
 * @param {string} newPassword - The new password
 * @returns {Promise<void>}
 */
export const changePassword = async (currentPassword, newPassword) => {
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
        throw new Error("No authenticated user.");
    }

    const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword,
    );

    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
};

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {boolean} [rememberMe=true] - Keep session after browser restart when true
 * @returns {Promise} Firebase user credential
 */
export const login = async (email, password, rememberMe = true) => {
    setRememberMePreference(rememberMe);
    await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
    );

    const credential = await signInWithEmailAndPassword(auth, email, password);
    createSession(credential.user.uid, { rememberMe });
    return credential;
};

/**
 * Send a password reset email via Firebase Auth mailer
 * @param {string} email - Account email address
 * @returns {Promise<void>}
 */
export const resetPassword = async (email) => {
    const trimmedEmail = email?.trim();

    if (!trimmedEmail) {
        throw new Error("Please enter your email address.");
    }

    await sendPasswordResetEmail(auth, trimmedEmail);
};

/**
 * Logout the current user and clear the local app session
 * @returns {Promise} Firebase logout promise
 */
export const logout = async () => {
    clearSession();
    return await signOut(auth);
};

/**
 * Get the navigation path based on user role
 * @param {string} role - User role (admin, customer, staff, rider)
 * @returns {string|null} Navigation path or null if invalid role
 */
export const getNavigationPathByRole = (role) => {
    switch (String(role || "").trim().toLowerCase()) {
        case "admin":
            return "/admin";
        case "customer":
            return "/customer";
        case "staff":
            return "/staff";
        case "rider":
            return "/rider/transactions";
        default:
            return null;
    }
};

/**
 * Validate if role is valid
 * @param {string} role - User role to validate
 * @returns {boolean} True if role is valid
 */
export const isValidRole = (role) => {
    return ["admin", "customer", "staff", "rider"].includes(role);
};
