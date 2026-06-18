import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "../../pages/Dashboard";
import WarehousePage from "../../pages/WarehousePage";
import DispatchedItemsPage from "../../pages/DispatchedItemsPage";
import LogisticsPortalPage from "../../pages/LogisticsPortalPage";
import UsersPage from "../../pages/UsersPage";
import ZohoItemsPage from "../../pages/ZohoItemsPage";

export default function PackFlowRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="warehouse" element={<WarehousePage />} />
      <Route path="dispatch" element={<DispatchedItemsPage />} />
      <Route path="logistics" element={<LogisticsPortalPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="zoho-items" element={<ZohoItemsPage />} />

      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}