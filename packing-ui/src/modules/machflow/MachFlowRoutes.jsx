import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MachFlowWorkspace from "./MachFlowWorkspace";
import MachFlowRequestPortal from "./MachFlowRequestPortal";

export default function MachFlowRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="workspace" replace />} />
      <Route path="workspace" element={<MachFlowWorkspace />} />
      <Route path="request" element={<MachFlowRequestPortal />} />
      <Route path="*" element={<Navigate to="workspace" replace />} />
    </Routes>
  );
}
