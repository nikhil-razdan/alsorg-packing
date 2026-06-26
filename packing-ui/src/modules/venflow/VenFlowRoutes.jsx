import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import VenFlowLayout from "./VenFlowLayout";
import VenFlowDashboard from "./pages/VenFlowDashboard";
import VenFlowListPage from "./pages/VenFlowListPage";
import VenFlowCreatePage from "./pages/VenFlowCreatePage";
import VenFlowDetailPage from "./pages/VenFlowDetailPage";
import VenFlowReportsPage from "./pages/VenFlowReportsPage";
import VenFlowPurchaseDeskPage from "./pages/VenFlowPurchaseDeskPage";

export default function VenFlowRoutes() {
    return (
        <Routes>
            <Route element={<VenFlowLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<VenFlowDashboard />} />
                <Route path="entries" element={<VenFlowListPage />} />
                <Route path="create" element={<VenFlowCreatePage />} />
                <Route path="purchase" element={<VenFlowPurchaseDeskPage />} />
                <Route path="entries/:id" element={<VenFlowDetailPage />} />
                <Route path="reports" element={<VenFlowReportsPage />} />

                <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>
        </Routes>
    );
}