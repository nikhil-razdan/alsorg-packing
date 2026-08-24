import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AssetFlowWorkspace from "./AssetFlowWorkspace";
import AssetFlowRequestPortal from "./AssetFlowRequestPortal";

export default function AssetFlowRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="workspace" replace />} />
      <Route path="workspace" element={<AssetFlowWorkspace />} />
      <Route path="request" element={<AssetFlowRequestPortal />} />
      <Route path="*" element={<Navigate to="workspace" replace />} />
    </Routes>
  );
}
