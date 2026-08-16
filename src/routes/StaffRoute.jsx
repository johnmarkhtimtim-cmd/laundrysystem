import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * StaffRoute Component - Secure route for staff members
 * 
 * Security Features:
 * - Verifies user authentication
 * - Validates user role is "staff"
 * - Redirects unauthenticated users to login
 * - Prevents unauthorized access from other roles
 * - Checks for staff verification status
 * 
 * Usage:
 * <StaffRoute>
 *   <StaffLayout />
 * </StaffRoute>
 */
function StaffRoute({ children }) {
  const { user, loading } = useAuth();

  // Wait for auth to load
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Check if user is authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Check if user has staff role
  if (user.role !== "staff") {
    return <Navigate to="/" replace />;
  }

  // Optional: Check if staff member is verified/active
  if (user.status === "inactive") {
    return (
      <div className="access-denied">
        <h2>Account Inactive</h2>
        <p>Your staff account has been deactivated. Please contact administration.</p>
      </div>
    );
  }

  // All security checks passed
  return children;
}

export default StaffRoute;
