import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserData } from "../services/userService";
import { getNavigationPathByRole } from "../services/authService";

/* /login opens the landing page Sign In modal */
function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const redirect = async () => {
      if (user) {
        try {
          const userData = await getUserData(user.uid);
          const path = userData
            ? getNavigationPathByRole(userData.role)
            : null;
          if (path) {
            navigate(path, { replace: true });
            return;
          }
        } catch (error) {
          console.error("Error checking user role:", error);
        }
      }

      navigate("/?signin=1", { replace: true });
    };

    redirect();
  }, [user, navigate]);

  return null;
}

export default Login;
