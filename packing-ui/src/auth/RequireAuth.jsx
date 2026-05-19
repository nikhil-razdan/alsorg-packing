import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import API from "../services/api";

function RequireAuth({ children }) {
  const token = localStorage.getItem("token");

  // ✅ derive initial state synchronously (NO effect state writes)
  const [loading, setLoading] = useState(!!token);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) return;

    let active = true;

    API.get("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(() => {
        if (active) setOk(true);
      })
      .catch(() => {
        if (active) {
          localStorage.clear();
          setOk(false);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) return null;

  return ok ? children : <Navigate to="/login" replace />;
}

export default RequireAuth;
