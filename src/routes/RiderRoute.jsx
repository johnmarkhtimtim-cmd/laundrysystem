import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RiderRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== "rider") {
    return <Navigate to="/" replace />;
  }

  if (user.status === "inactive") {
    return (
      <div className="access-denied">
        <h2>Account Inactive</h2>
        <p>Your rider account has been deactivated. Please contact administration.</p>
      </div>
    );
  }

  return children;
}

export default RiderRoute;