import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import VenFlowRoutes from "./modules/venflow/VenFlowRoutes";
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

import ModuleHub from "./shell/ModuleHub";
import BOMFlowRoutes from "./modules/bomflow/BOMFlowRoutes";

import useViewportHeight from "./useViewportHeight";

function App() {
	useViewportHeight();

	return (
		<BrowserRouter>
			<Routes>
				{/* PUBLIC */}
				<Route path="/login" element={<LoginPage />} />

				{/* GLOBAL MODULE HUB */}
				<Route
					path="/modules"
					element={
						<RequireAuth>
							<ModuleHub />
						</RequireAuth>
					}
				/>

				{/* GLOBAL USER MANAGEMENT - OUTSIDE PACKFLOW */}
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

				{/* PACKFLOW MODULE */}
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
						element={<Navigate to="dashboard" replace />}
					/>

					<Route
						path="dashboard"
						element={<DashboardPage />}
					/>

					<Route
						path="zoho-items"
						element={
							<RequireRole allowed={["ADMIN", "PACKING"]}>
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

					{/* OLD PACKFLOW USER URL SHOULD NO LONGER OPEN INSIDE PACKFLOW */}
					<Route
						path="users"
						element={<Navigate to="/users" replace />}
					/>

					<Route
						path="*"
						element={<Navigate to="dashboard" replace />}
					/>
				</Route>

				{/* BOMFLOW MODULE */}
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

				{/* VENFLOW MODULE */}
				<Route
					path="/venflow/*"
					element={
						<RequireAuth>
							<RequireModule moduleKey="VENFLOW">
								<VenFlowRoutes />
							</RequireModule>
						</RequireAuth>
					}
				/>

				{/* ROOT REDIRECT */}
				<Route path="/" element={<Navigate to="/modules" replace />} />

				{/* OLD PACKFLOW URL REDIRECTS */}
				<Route
					path="/dashboard"
					element={<Navigate to="/packflow/dashboard" replace />}
				/>

				<Route
					path="/zoho-items"
					element={<Navigate to="/packflow/zoho-items" replace />}
				/>

				<Route
					path="/warehouse"
					element={<Navigate to="/packflow/warehouse" replace />}
				/>

				<Route
					path="/dispatched-items"
					element={<Navigate to="/packflow/dispatched-items" replace />}
				/>

				<Route
					path="/logistics"
					element={<Navigate to="/packflow/logistics" replace />}
				/>

				{/* FALLBACK */}
				<Route path="*" element={<Navigate to="/modules" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;