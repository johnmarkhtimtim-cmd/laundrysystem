import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "./firebase";

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} Firebase user credential
 */
export const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
};

/**
 * Logout the current user
 * @returns {Promise} Firebase logout promise
 */
export const logout = async () => {
    return await signOut(auth);
};

/**
 * Get the navigation path based on user role
 * @param {string} role - User role (admin, customer, staff)
 * @returns {string|null} Navigation path or null if invalid role
 */
export const getNavigationPathByRole = (role) => {
    switch (role) {
        case "admin":
            return "/admin";
        case "customer":
            return "/customer";
        case "staff":
            return "/staff";
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
    return ["admin", "customer", "staff"].includes(role);
};
