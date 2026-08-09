import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { MODULE_KEYS, hasModuleAccessFromUser } from "../../utils/moduleAccess";
import MatFlowLayout from "./MatFlowLayout";
import {
	MatFlowProvider,
	MatFlowThemeProvider,
	canAccessMatFlowScreen,
	defaultMatFlowPathForRole,
	getMatFlowRoles,
} from "./matflowUi";

import {
	MatFlowDashboardPage,
	MatFlowTrackerPage,
	MatFlowReportsPage,
	MatFlowLedgerPage,
} from "./pages/MatFlowInsightWorkspace";
import {
	MatFlowProjectsPage,
	MatFlowMaterialsPage,
	MatFlowLocationsPage,
} from "./pages/MatFlowMasterDataWorkspace";
import {
	MatFlowBomListPage,
	MatFlowBomCreatePage,
	MatFlowBomDetailPage,
	MatFlowBomReviewPage,
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
import {
	MatFlowTransfersPage,
	MatFlowTransferDetailPage,
	MatFlowReturnsPage,
} from "./pages/MatFlowMovementWorkspace";
import {
	MatFlowPurchasePage,
	MatFlowPoApprovalPage,
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
	if (!canAccessMatFlowScreen(screen, effectiveRoles)) {
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

const guarded = (screen, element) => <Guard screen={screen}>{element}</Guard>;

export default function MatFlowRoutes() {
	return (
		<MatFlowThemeProvider>
			<MatFlowProvider>
				<Routes>
					<Route element={<MatFlowLayout />}>
						<Route index element={<HomeRedirect />} />
						<Route path="dashboard" element={guarded("dashboard", <MatFlowDashboardPage />)} />
						<Route path="tracker" element={guarded("tracking", <MatFlowTrackerPage />)} />

						<Route path="projects" element={guarded("projects", <MatFlowProjectsPage />)} />
						<Route path="materials" element={guarded("materials", <MatFlowMaterialsPage />)} />
						<Route path="locations" element={guarded("locations", <MatFlowLocationsPage />)} />

						<Route path="boms" element={guarded("boms", <MatFlowBomListPage />)} />
						<Route path="boms/new" element={guarded("bom-create", <MatFlowBomCreatePage />)} />
						<Route path="boms/:bomId" element={guarded("boms", <MatFlowBomDetailPage />)} />
						<Route path="bom-approvals" element={guarded("bom-review", <MatFlowBomReviewPage />)} />

						<Route path="production" element={guarded("production", <MatFlowRequisitionListPage />)} />
						<Route path="requisitions/new" element={guarded("production", <MatFlowRequisitionCreatePage />)} />
						<Route path="requisitions/:requisitionId" element={guarded("production", <MatFlowRequisitionDetailPage />)} />
						<Route path="production-execution" element={guarded("production-execution", <MatFlowProductionExecutionPage />)} />

						<Route path="store" element={guarded("store", <MatFlowStoreQueuePage />)} />
						<Route path="store/requisitions/:requisitionId" element={guarded("store", <MatFlowStoreDetailPage />)} />
						<Route path="indents" element={<Navigate to="/matflow/store" replace />} />

						<Route path="transfers" element={guarded("transfers", <MatFlowTransfersPage />)} />
						<Route path="transfers/:transferId" element={guarded("transfers", <MatFlowTransferDetailPage />)} />
						<Route path="returns" element={guarded("returns", <MatFlowReturnsPage />)} />

						<Route path="purchase" element={guarded("purchase", <MatFlowPurchasePage />)} />
						<Route path="approvals" element={guarded("approvals", <MatFlowPoApprovalPage />)} />
						<Route path="receiving" element={guarded("receiving", <MatFlowReceivingPage />)} />

						<Route path="qc" element={guarded("qc", <MatFlowQcPage />)} />
						<Route path="processing" element={guarded("processing", <MatFlowProcessingPage />)} />

						<Route path="ledger" element={guarded("ledger", <MatFlowLedgerPage />)} />
						<Route path="reports" element={guarded("reports", <MatFlowReportsPage />)} />

						{/* Explicit removal of the old release-based frontend. */}
						<Route path="releases" element={<Navigate to="/matflow/boms" replace />} />
						<Route path="releases/:releaseId" element={<Navigate to="/matflow/boms" replace />} />
						<Route path="*" element={<HomeRedirect />} />
					</Route>
				</Routes>
			</MatFlowProvider>
		</MatFlowThemeProvider>
	);
}
