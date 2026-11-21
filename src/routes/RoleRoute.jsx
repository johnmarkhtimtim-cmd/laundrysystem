import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * RoleRoute Component - Secure route for role-based access
 * 
 * Security Features:
 * - Verifies user authentication
 * - Validates user role matches allowed role
 * - Handles loading state to prevent premature redirects
 * - Redirects unauthorized users to the landing page
 * 
 * Usage:
 * <RoleRoute allowedRole="admin">
 *   <AdminLayout />
 * </RoleRoute>
 */
function RoleRoute({ allowedRole, children }) {
    const { user, loading } = useAuth();

    // Wait for auth to load
    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    // Check if user is authenticated — landing page, not sign-in modal
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // Check if user has the required role
    if (user.role !== allowedRole) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default RoleRoute;
