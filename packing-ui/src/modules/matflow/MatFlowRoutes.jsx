import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { MODULE_KEYS, hasModuleAccessFromUser } from "../../utils/moduleAccess";
import MatFlowLayout from "./MatFlowLayout";
import {
  MatFlowProvider,
  MatFlowThemeProvider,
  canAccessMatFlowScreen,
  canAccessMatFlowScreenForContext,
  defaultMatFlowPathForRole,
  getMatFlowRoles,
  useMatFlow,
} from "./matflowUi";
import { MatFlowDashboardPage } from "./pages/MatFlowManagementDashboard";
import { MatFlowWorkWorkspacePage } from "./pages/MatFlowWorkWorkspace";
import { MatFlowProjectsPage } from "./pages/MatFlowProjectsWorkspace";
import { MatFlowBomListPage, MatFlowBomDetailPage } from "./pages/MatFlowBomWorkspace";
import { MatFlowMaterialsPage } from "./pages/MatFlowMaterialsWorkspace";
import { MatFlowReleasePage } from "./pages/MatFlowReleaseWorkspace";

function Guard({ screen, children }) {
  const location = useLocation();
  const { user, role, roles, modules, isLoggedIn, authLoading } = useAuth();
  const { selectedPlantParam, availablePlants } = useMatFlow();
  if (authLoading) return null;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  const accessUser = {
    ...(user || {}), role: role || user?.role || "",
    roles: Array.isArray(roles) ? roles : Array.isArray(user?.roles) ? user.roles : [],
    modules: Array.isArray(modules) ? modules : Array.isArray(user?.modules) ? user.modules : [],
  };
  if (!hasModuleAccessFromUser(accessUser, MODULE_KEYS.MATFLOW)) return <Navigate to="/modules" replace />;
  const effectiveRoles = getMatFlowRoles([...(Array.isArray(roles) ? roles : []), ...(Array.isArray(user?.roles) ? user.roles : []), role, user?.role]);
  if (!canAccessMatFlowScreen(screen, effectiveRoles) || !canAccessMatFlowScreenForContext(screen, effectiveRoles, selectedPlantParam ? [selectedPlantParam] : availablePlants)) {
    return <Navigate to={defaultMatFlowPathForRole(effectiveRoles)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { role, roles, user } = useAuth();
  return <Navigate to={defaultMatFlowPathForRole([...(Array.isArray(roles) ? roles : []), ...(Array.isArray(user?.roles) ? user.roles : []), role, user?.role])} replace />;
}
const guarded = (screen, element) => <Guard screen={screen}>{element}</Guard>;

export default function MatFlowRoutes() {
  return (
    <MatFlowThemeProvider>
      <MatFlowProvider>
        <Routes>
          <Route element={<MatFlowLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={guarded("dashboard", <MatFlowDashboardPage />)} />
            <Route path="work" element={guarded("work", <MatFlowWorkWorkspacePage />)} />
            <Route path="projects" element={guarded("projects", <MatFlowProjectsPage />)} />
            <Route path="boms" element={guarded("boms", <MatFlowBomListPage />)} />
            <Route path="boms/:bomId" element={guarded("boms", <MatFlowBomDetailPage />)} />
            <Route path="materials" element={guarded("materials", <MatFlowMaterialsPage />)} />
            <Route path="release" element={guarded("release", <MatFlowReleasePage />)} />

            {/* Safe redirects for old MatFlow URLs. They do not recreate the retired workflow. */}
            <Route path="production" element={<Navigate to="/matflow/release" replace />} />
            <Route path="production-execution" element={<Navigate to="/matflow/release" replace />} />
            <Route path="store/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="purchase/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="receiving/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="qc/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="processing/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="requisitions/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="returns/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="tracker/*" element={<Navigate to="/matflow/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/matflow/dashboard" replace />} />
          </Route>
        </Routes>
      </MatFlowProvider>
    </MatFlowThemeProvider>
  );
}
