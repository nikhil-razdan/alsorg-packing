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
    hasRole,
    hasAnyRole,
    authLoading,
  } = useAuth();

  if (authLoading) {
    return null;
  }

  const isHardwareOnly =
    hasRole("HARDWARE_PACKING") &&
    !hasAnyRole(
      "ADMIN",
      "PACKING",
      "WAREHOUSE",
      "DISPATCH",
      "LOGISTICS"
    );

  return (
    <Navigate
      to={
        isHardwareOnly
          ? "/packflow/zoho-items"
          : "/packflow/dashboard"
      }
      replace
    />
  );
}

function PackFlowDashboardAccess({
  children,
}) {
  const {
    hasRole,
    hasAnyRole,
    authLoading,
  } = useAuth();

  if (authLoading) {
    return null;
  }

  const isHardwareOnly =
    hasRole("HARDWARE_PACKING") &&
    !hasAnyRole(
      "ADMIN",
      "PACKING",
      "WAREHOUSE",
      "DISPATCH",
      "LOGISTICS"
    );

  if (isHardwareOnly) {
    return (
      <Navigate
        to="/packflow/zoho-items"
        replace
      />
    );
  }

  return children;
}

/**
 * PackFlow route compatibility module.
 *
 * App.jsx currently hosts the primary /packflow route tree. This module is
 * retained because older builds/imports may still mount PackFlowRoutes
 * directly. Keep its access rules aligned with the primary route tree so an
 * older route registration cannot silently bypass the current guards.
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

      {/*
       * Legacy compatibility path. Keep existing bookmarks working while the
       * same role guard is applied as /dispatched-items.
       */}
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

      {/*
       * User Management is a top-level FlowSuite route. Redirect instead of
       * rendering it inside a nested PackFlow shell.
       */}
      <Route
        path="users"
        element={
          <Navigate
            to="/users"
            replace
          />
        }
      />

      {/*
       * Client Master is shared FlowSuite master data and is hosted by
       * /modules. Keep the legacy PackFlow URL only as a redirect.
       */}
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
