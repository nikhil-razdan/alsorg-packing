import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
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

import {
    MatFlowDashboardPage,
    MatFlowTrackerDetailPage,
    MatFlowMaterialRegisterPage,
    MatFlowReportsPage,
    MatFlowLedgerPage,
} from "./pages/MatFlowInsightWorkspace";
import {
    MatFlowProjectsPage,
    MatFlowMaterialsPage,
    MatFlowProcessingUnitsPage,
} from "./pages/MatFlowMasterDataWorkspace";
import {
    MatFlowBomListPage,
    MatFlowBomCreatePage,
    MatFlowBomDetailPage,
} from "./pages/MatFlowBomWorkspace";
import {
    MatFlowRequisitionListPage,
    MatFlowRequisitionCreatePage,
    MatFlowRequisitionDetailPage,
} from "./pages/MatFlowRequisitionWorkspace";
import {
    MatFlowStoreQueuePage,
    MatFlowStoreDetailPage,
} from "./pages/MatFlowStoreWorkspace";
import { MatFlowReturnsPage } from "./pages/MatFlowMovementWorkspace";
import { MatFlowExceptionPage } from "./pages/MatFlowExceptionWorkspace";
import {
    MatFlowPurchasePage,
    MatFlowReceivingPage,
} from "./pages/MatFlowProcurementWorkspace";
import {
    MatFlowQcPage,
    MatFlowProcessingPage,
    MatFlowProductionExecutionPage,
} from "./pages/MatFlowExecutionWorkspace";

function Guard({ screen, children }) {
    const location = useLocation();
    const { user, role, roles, modules, isLoggedIn, authLoading } = useAuth();
    const { selectedPlantParam, availablePlants } = useMatFlow();

    if (authLoading) return null;
    if (!isLoggedIn) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    const accessUser = {
        ...(user || {}),
        role: role || user?.role || "",
        modules: Array.isArray(modules) ? modules : user?.modules || [],
    };
    if (!hasModuleAccessFromUser(accessUser, MODULE_KEYS.MATFLOW)) {
        return <Navigate to="/modules" replace />;
    }

    const effectiveRoles = getMatFlowRoles([
        ...(Array.isArray(roles) ? roles : []),
        ...(Array.isArray(user?.roles) ? user.roles : []),
        role,
        user?.role,
    ]);
    if (!canAccessMatFlowScreen(screen, effectiveRoles) ||
        !canAccessMatFlowScreenForContext(screen, effectiveRoles, selectedPlantParam ? [selectedPlantParam] : availablePlants)) {
        return <Navigate to={defaultMatFlowPathForRole(effectiveRoles)} replace />;
    }
    return children;
}

function HomeRedirect() {
    const { role, roles, user, authLoading } = useAuth();
    if (authLoading) return null;
    return <Navigate to={defaultMatFlowPathForRole([
        ...(Array.isArray(roles) ? roles : []),
        ...(Array.isArray(user?.roles) ? user.roles : []),
        role,
        user?.role,
    ])} replace />;
}

function LegacyMaterialTrackerRedirect() {
    const { materialId } = useParams();
    return <Navigate to={`/matflow/dashboard?view=materials${materialId ? `&materialId=${encodeURIComponent(materialId)}` : ""}`} replace />;
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
                        <Route path="tracker" element={guarded("tracking", <Navigate to="/matflow/dashboard?view=projects" replace />)} />
                        <Route path="tracker/materials" element={guarded("tracking", <Navigate to="/matflow/dashboard?view=materials" replace />)} />
                        <Route path="tracker/materials/:materialId" element={guarded("tracking", <LegacyMaterialTrackerRedirect />)} />
                        <Route path="tracker/:requisitionId" element={guarded("tracking", <MatFlowTrackerDetailPage />)} />

                        <Route path="projects" element={guarded("projects", <MatFlowProjectsPage />)} />
                        <Route path="materials" element={guarded("materials", <MatFlowMaterialsPage />)} />
                        <Route path="processing-units" element={guarded("processing-units", <MatFlowProcessingUnitsPage />)} />

                        <Route path="boms" element={guarded("boms", <MatFlowBomListPage />)} />
                        <Route path="boms/new" element={guarded("bom-create", <MatFlowBomCreatePage />)} />
                        <Route path="boms/:bomId" element={guarded("boms", <MatFlowBomDetailPage />)} />

                        <Route path="production" element={guarded("production", <MatFlowRequisitionListPage />)} />
                        <Route path="requisitions/new" element={guarded("production", <MatFlowRequisitionCreatePage />)} />
                        <Route path="requisitions/:requisitionId" element={guarded("production", <MatFlowRequisitionDetailPage />)} />
                        <Route path="production-execution" element={guarded("production-execution", <MatFlowProductionExecutionPage />)} />

                        <Route path="store" element={guarded("store", <MatFlowStoreQueuePage />)} />
                        <Route path="store/requisitions/:requisitionId" element={guarded("store", <MatFlowStoreDetailPage />)} />
                        <Route path="indents" element={<Navigate to="/matflow/store" replace />} />

                        <Route path="purchase" element={guarded("purchase", <MatFlowPurchasePage />)} />
                        <Route path="receiving" element={guarded("receiving", <MatFlowReceivingPage />)} />
                        <Route path="qc" element={guarded("qc", <MatFlowQcPage />)} />
                        <Route path="processing" element={guarded("processing", <MatFlowProcessingPage />)} />
                        <Route path="returns" element={guarded("returns", <MatFlowReturnsPage />)} />

                        <Route path="exceptions" element={guarded("exceptions", <MatFlowExceptionPage />)} />
                        <Route path="material-register" element={guarded("material-register", <MatFlowMaterialRegisterPage />)} />
                        <Route path="ledger" element={guarded("ledger", <MatFlowLedgerPage />)} />
                        <Route path="reports" element={guarded("reports", <MatFlowReportsPage />)} />

                        {/* Legacy URLs redirect into the current Universal Dashboard / workflow. */}
                        <Route path="bom-approvals" element={<Navigate to="/matflow/boms" replace />} />
                        <Route path="approvals" element={<Navigate to="/matflow/purchase" replace />} />
                        <Route path="transfers" element={<Navigate to="/matflow/dashboard?view=projects" replace />} />
                        <Route path="transfers/:transferId" element={<Navigate to="/matflow/dashboard?view=projects" replace />} />
                        <Route path="releases" element={<Navigate to="/matflow/boms" replace />} />
                        <Route path="releases/:releaseId" element={<Navigate to="/matflow/boms" replace />} />
                        <Route path="*" element={<HomeRedirect />} />
                    </Route>
                </Routes>
            </MatFlowProvider>
        </MatFlowThemeProvider>
    );
}
