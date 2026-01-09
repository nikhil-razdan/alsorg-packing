import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => {
        setOk(res.ok);
        setLoading(false);
      });
  }, []);

  if (loading) return null;

  return ok ? children : <Navigate to="/login" />;
}

export default RequireAuth;
