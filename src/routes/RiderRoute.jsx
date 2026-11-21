import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RiderRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Landing page only — do not open sign-in modal on logout / unauth
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== "rider") {
    return <Navigate to="/" replace />;
  }

  if (user.status === "Inactive" || user.status === "Archived") {
    return (
      <div className="access-denied">
        <h2>
          {user.status === "Archived" ? "Account Archived" : "Account Inactive"}
        </h2>
        <p>
          {user.status === "Archived"
            ? "Your rider account has been archived. Please contact administration."
            : "Your rider account has been deactivated. Please contact administration."}
        </p>
      </div>
    );
  }

  return children;
}

export default RiderRoute;