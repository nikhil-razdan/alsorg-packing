import { Navigate } from "react-router-dom";

function RequireRole({
  children,
  allowed,
}) {
  const role =
    localStorage.getItem("role");

  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireRole;