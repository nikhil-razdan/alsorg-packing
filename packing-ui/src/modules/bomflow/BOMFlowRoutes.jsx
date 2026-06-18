import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BOMFlowHome from "./pages/BOMFlowHome";

export default function BOMFlowRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<BOMFlowHome />} />
      <Route path="" element={<Navigate to="dashboard" replace />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}