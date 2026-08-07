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
import UsersPage from "../../pages/UsersPage";
import ZohoItemsPage from "../../pages/ZohoItemsPage";

import RequireRole from "../../auth/RequireRole";
import RequireWarehouseAccess from "../../auth/RequireWarehouseAccess";

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

export default function PackFlowRoutes() {
  return (
    <Routes>
      <Route
        path="dashboard"
        element={<Dashboard />}
      />

      <Route
        path="warehouse"
        element={
          <RequireWarehouseAccess>
            <WarehousePage />
          </RequireWarehouseAccess>
        }
      />

      {/*
       * Current Sidebar path.
       * Multi-role HARDWARE_PACKING + DISPATCH users pass because
       * RequireRole checks the complete effective role list.
       */}
      <Route
        path="dispatched-items"
        element={dispatchElement}
      />

      {/*
       * Legacy compatibility path.  Keep it so old bookmarks and
       * older links do not break.
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

      <Route
        path="users"
        element={
          <RequireRole allowed={["ADMIN"]}>
            <UsersPage />
          </RequireRole>
        }
      />

      <Route
        path="zoho-items"
        element={<ZohoItemsPage />}
      />

      <Route
        path=""
        element={
          <Navigate
            to="dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}
