import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "../../auth/RequireAuth";
import RequireModule from "../../auth/RequireModule";
import AssetFlowWorkspace from "./AssetFlowWorkspace";
import AssetFlowRequestPortal from "./AssetFlowRequestPortal";

function ProtectedAssetFlowWorkspace() {
  return (
    <RequireAuth>
      <RequireModule moduleKey="ASSETFLOW">
        <AssetFlowWorkspace />
      </RequireModule>
    </RequireAuth>
  );
}

export default function AssetFlowRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="workspace" replace />} />
      <Route path="workspace" element={<ProtectedAssetFlowWorkspace />} />

      {/*
       * Deliberately public request portal. Identity is established by either
       * the normal FlowSuite requester context or the controlled Reporter-Pass
       * gateway inside AssetFlowRequestPortal/AssetFlowService.
       */}
      <Route path="request" element={<AssetFlowRequestPortal />} />

      <Route path="*" element={<Navigate to="workspace" replace />} />
    </Routes>
  );
}
