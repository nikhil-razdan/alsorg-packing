import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import API from "../services/api";

function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    API.get("/auth/me")
      .then(() => setOk(true))
      .catch(() => setOk(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return ok ? children : <Navigate to="/login" replace />;
}

export default RequireAuth;
