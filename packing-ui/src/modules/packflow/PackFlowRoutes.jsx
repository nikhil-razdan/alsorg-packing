import React from "react";
import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Dashboard from "../../pages/Dashboard";
import WarehousePage from "../../pages/WarehousePage";
import DispatchedItemsPage from "../../pages/DispatchedItemsPage";
import LogisticsPortalPage from "../../pages/LogisticsPortalPage";
import ZohoItemsPage from "../../pages/ZohoItemsPage";

import RequireRole from "../../auth/RequireRole";
import RequireWarehouseAccess from "../../auth/RequireWarehouseAccess";
import { useAuth } from "../../auth/AuthContext";

const cleanRole = (value) =>
  String(value || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .toUpperCase();

const routeForPackFlowRole = (role) => {
  switch (cleanRole(role)) {
    case "PACKING":
      return "/packflow/zoho-items?view=normal";
    case "HARDWARE_PACKING":
      return "/packflow/zoho-items?view=hardware";
    case "WAREHOUSE":
      return "/packflow/warehouse";
    case "DISPATCH":
      return "/packflow/dispatched-items";
    case "LOGISTICS":
      return "/packflow/logistics";
    default:
      return null;
  }
};

const resolvePackFlowLanding = (
  user,
  hasRole
) => {
  if (
    hasRole("ADMIN") ||
    hasRole("PACKFLOW_DIRECTOR")
  ) {
    return "/packflow/dashboard";
  }

  const primary =
    routeForPackFlowRole(
      user?.role
    );

  if (primary) {
    return primary;
  }

  for (const role of [
    "PACKING",
    "HARDWARE_PACKING",
    "WAREHOUSE",
    "DISPATCH",
    "LOGISTICS",
  ]) {
    if (hasRole(role)) {
      return routeForPackFlowRole(role);
    }
  }

  return "/modules";
};

const dispatchElement = (
  <RequireRole
    allowed={[
      "ADMIN",
      "DISPATCH",
      "WAREHOUSE",
      "PACKING",
    ]}
  >
    <DispatchedItemsPage />
  </RequireRole>
);

function PackFlowDefaultRedirect() {
  const {
    user,
    hasRole,
    authLoading,
  } = useAuth();

  if (authLoading) {
    return null;
  }

  return (
    <Navigate
      to={resolvePackFlowLanding(
        user,
        hasRole
      )}
      replace
    />
  );
}

function PackFlowDashboardAccess({
  children,
}) {
  const {
    user,
    hasRole,
    authLoading,
  } = useAuth();

  if (authLoading) {
    return null;
  }

  if (
    hasRole("ADMIN") ||
    hasRole("PACKFLOW_DIRECTOR")
  ) {
    return children;
  }

  return (
    <Navigate
      to={resolvePackFlowLanding(
        user,
        hasRole
      )}
      replace
    />
  );
}

/**
 * PackFlow route compatibility module.
 *
 * App.jsx owns the primary nested /packflow route tree. This component is
 * retained for older imports/builds, so its role guards and landing behavior
 * intentionally mirror App.jsx. It must never become a weaker alternate path.
 */
export default function PackFlowRoutes() {
  return (
    <Routes>
      <Route
        path="dashboard"
        element={
          <PackFlowDashboardAccess>
            <Dashboard />
          </PackFlowDashboardAccess>
        }
      />

      <Route
        path="warehouse"
        element={
          <RequireWarehouseAccess>
            <WarehousePage />
          </RequireWarehouseAccess>
        }
      />

      <Route
        path="dispatched-items"
        element={dispatchElement}
      />

      <Route
        path="dispatch"
        element={dispatchElement}
      />

      <Route
        path="logistics"
        element={
          <RequireRole
            allowed={[
              "ADMIN",
              "LOGISTICS",
            ]}
          >
            <LogisticsPortalPage />
          </RequireRole>
        }
      />

      <Route
        path="users"
        element={
          <Navigate
            to="/users"
            replace
          />
        }
      />

      <Route
        path="client-master"
        element={
          <Navigate
            to="/modules?module=client-master"
            replace
          />
        }
      />

      <Route
        path="zoho-items"
        element={
          <RequireRole
            allowed={[
              "ADMIN",
              "PACKING",
              "HARDWARE_PACKING",
            ]}
          >
            <ZohoItemsPage />
          </RequireRole>
        }
      />

      <Route
        index
        element={<PackFlowDefaultRedirect />}
      />

      <Route
        path="*"
        element={<PackFlowDefaultRedirect />}
      />
    </Routes>
  );
}
