import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import MatFlowRoutes from "./modules/matflow/MatFlowRoutes";
import HrFlowPublicEntry from "./modules/hrflow/HrFlowPublicEntry";
import AssetFlowRequestPortal from "./modules/assetflow/AssetFlowRequestPortal";
import DashboardPage from "./pages/Dashboard";
import ZohoItemsPage from "./pages/ZohoItemsPage";
import LoginPage from "./pages/LoginPage";
import DispatchedItemsPage from "./pages/DispatchedItemsPage";
import UsersPage from "./pages/UsersPage";
import WarehousePage from "./pages/WarehousePage";
import LogisticsPortalPage from "./pages/LogisticsPortalPage";

import RequireAuth from "./auth/RequireAuth";
import RequireRole from "./auth/RequireRole";
import RequireWarehouseAccess from "./auth/RequireWarehouseAccess";
import RequireModule from "./auth/RequireModule";
import {
  AuthProvider,
  useAuth,
} from "./auth/AuthContext";

import ModuleHub from "./shell/ModuleHub";
import BOMFlowRoutes from "./modules/bomflow/BOMFlowRoutes";
import useViewportHeight from "./useViewportHeight";
import { PackFlowThemeProvider } from "./theme/PackFlowThemeContext";

function PackFlowDefaultRedirect() {
  const { hasRole, hasAnyRole, authLoading } = useAuth();

  if (authLoading) return null;

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

function PackFlowDashboardAccess({ children }) {
  const { hasRole, hasAnyRole, authLoading } = useAuth();

  if (authLoading) return null;

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
    return <Navigate to="/packflow/zoho-items" replace />;
  }

  return children;
}

function App() {
  useViewportHeight();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/*
           * Explicit public routes keep SPA navigation working in addition to
           * AuthContext's direct-page-load interception. Token/reporter-pass
           * validation remains inside the corresponding backend flows.
           */}
          <Route path="/hr/apply/:token" element={<HrFlowPublicEntry />} />
          <Route path="/hr/onboarding/:token" element={<HrFlowPublicEntry />} />
          <Route path="/assetflow/request" element={<AssetFlowRequestPortal />} />

          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/modules"
            element={
              <RequireAuth>
                <ModuleHub />
              </RequireAuth>
            }
          />

          <Route
            path="/users"
            element={
              <RequireAuth>
                <RequireRole allowed={["ADMIN"]}>
                  <UsersPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/packflow"
            element={
              <RequireAuth>
                <RequireModule moduleKey="PACKFLOW">
                  <PackFlowThemeProvider>
                    <Layout />
                  </PackFlowThemeProvider>
                </RequireModule>
              </RequireAuth>
            }
          >
            <Route index element={<PackFlowDefaultRedirect />} />
            <Route
              path="dashboard"
              element={
                <PackFlowDashboardAccess>
                  <DashboardPage />
                </PackFlowDashboardAccess>
              }
            />
            <Route
              path="zoho-items"
              element={
                <RequireRole allowed={["ADMIN", "PACKING", "HARDWARE_PACKING"]}>
                  <ZohoItemsPage />
                </RequireRole>
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
              element={
                <RequireRole allowed={["ADMIN", "PACKING", "DISPATCH", "WAREHOUSE"]}>
                  <DispatchedItemsPage />
                </RequireRole>
              }
            />
            <Route
              path="logistics"
              element={
                <RequireRole allowed={["ADMIN", "LOGISTICS"]}>
                  <LogisticsPortalPage />
                </RequireRole>
              }
            />
            <Route path="users" element={<Navigate to="/users" replace />} />
            <Route path="*" element={<PackFlowDefaultRedirect />} />
          </Route>

          <Route
            path="/bomflow/*"
            element={
              <RequireAuth>
                <RequireModule moduleKey="BOMFLOW">
                  <BOMFlowRoutes />
                </RequireModule>
              </RequireAuth>
            }
          />

          <Route
            path="/matflow/*"
            element={
              <RequireAuth>
                <RequireModule moduleKey="MATFLOW">
                  <MatFlowRoutes />
                </RequireModule>
              </RequireAuth>
            }
          />

          <Route path="/" element={<Navigate to="/modules" replace />} />
          <Route path="/dashboard" element={<Navigate to="/packflow/dashboard" replace />} />
          <Route path="/zoho-items" element={<Navigate to="/packflow/zoho-items" replace />} />
          <Route path="/warehouse" element={<Navigate to="/packflow/warehouse" replace />} />
          <Route path="/dispatched-items" element={<Navigate to="/packflow/dispatched-items" replace />} />
          <Route path="/logistics" element={<Navigate to="/packflow/logistics" replace />} />
          <Route path="*" element={<Navigate to="/modules" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
