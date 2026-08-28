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

const cleanRole = (value) =>
  String(value || "")
    .trim()
    .replace(/^ROLE_/i, "")
    .toUpperCase();

function resolvePackFlowLanding(user, hasRole) {
  if (hasRole("ADMIN") || hasRole("PACKFLOW_DIRECTOR")) {
    return "/packflow/dashboard";
  }

  const routeForRole = (role) => {
    switch (cleanRole(role)) {
      case "PACKING":
      case "UTL_PACKING":
        return "/packflow/zoho-items?view=normal";
      case "HARDWARE_PACKING":
        return "/packflow/zoho-items?view=hardware";
      case "WAREHOUSE":
        return "/packflow/warehouse";
      case "DISPATCH":
      case "UTL_DISPATCH":
        return "/packflow/dispatched-items";
      case "LOGISTICS":
        return "/packflow/logistics";
      default:
        return null;
    }
  };

  const primaryRoute = routeForRole(user?.role);
  if (primaryRoute) {
    return primaryRoute;
  }

  for (const role of [
    "PACKING",
    "UTL_PACKING",
    "HARDWARE_PACKING",
    "WAREHOUSE",
    "DISPATCH",
    "UTL_DISPATCH",
    "LOGISTICS",
  ]) {
    if (hasRole(role)) {
      return routeForRole(role);
    }
  }

  return "/modules";
}

function PackFlowDefaultRedirect() {
  const {
    user,
    hasRole,
    authLoading,
  } = useAuth();

  if (authLoading) return null;

  return (
    <Navigate
      to={resolvePackFlowLanding(user, hasRole)}
      replace
    />
  );
}

function PackFlowDashboardAccess({ children }) {
  const {
    user,
    hasRole,
    authLoading,
  } = useAuth();

  if (authLoading) return null;

  if (
    hasRole("ADMIN") ||
    hasRole("PACKFLOW_DIRECTOR")
  ) {
    return children;
  }

  return (
    <Navigate
      to={resolvePackFlowLanding(user, hasRole)}
      replace
    />
  );
}

function App() {
  useViewportHeight();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/*
           * Explicit public routes preserve the hardened HRFlow / AssetFlow
           * direct-link behavior from the current application.
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

          {/*
           * User Administration intentionally remains a separate FlowSuite
           * module/page. It does not inherit the PackFlow workspace shell.
           */}
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
                <RequireRole
                  allowed={[
                    "ADMIN",
                    "PACKING",
                    "UTL_PACKING",
                    "HARDWARE_PACKING",
                  ]}
                >
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
                <RequireRole
                  allowed={[
                    "ADMIN",
                    "PACKING",
                    "UTL_PACKING",
                    "DISPATCH",
                    "UTL_DISPATCH",
                    "WAREHOUSE",
                  ]}
                >
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
