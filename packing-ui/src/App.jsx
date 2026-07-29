import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import MatFlowRoutes from "./modules/matflow/MatFlowRoutes";
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

function PackFlowDefaultRedirect() {
	const {
		role,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	if (role === "HARDWARE_PACKING") {
		return (
			<Navigate
				to="/packflow/zoho-items"
				replace
			/>
		);
	}

	return (
		<Navigate
			to="/packflow/dashboard"
			replace
		/>
	);
}

function PackFlowDashboardAccess({
	children,
}) {
	const {
		role,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	if (role === "HARDWARE_PACKING") {
		return (
			<Navigate
				to="/packflow/zoho-items"
				replace
			/>
		);
	}

	return children;
}

function App() {
	useViewportHeight();

	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
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
									<Layout />
								</RequireModule>
							</RequireAuth>
						}
					>
						<Route
							index
							element={
								<PackFlowDefaultRedirect />
							}
						/>
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
										"DISPATCH",
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
								<RequireRole
									allowed={[
										"ADMIN",
										"LOGISTICS",
									]}
								>
									<LogisticsPortalPage />
								</RequireRole>
							}
						/>

						<Route path="users" element={<Navigate to="/users" replace />} />
						<Route
							path="*"
							element={
								<PackFlowDefaultRedirect />
							}
						/>
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