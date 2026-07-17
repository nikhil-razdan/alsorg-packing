import React from "react";
import {
	Routes,
	Route,
	Navigate,
} from "react-router-dom";

import VenFlowLayout from "./VenFlowLayout";
import VenFlowRoleGuard from "./VenFlowRoleGuard";

import VenFlowDashboard from "./pages/VenFlowDashboard";
import VenFlowListPage from "./pages/VenFlowListPage";
import VenFlowCreatePage from "./pages/VenFlowCreatePage";
import VenFlowDetailPage from "./pages/VenFlowDetailPage";
import VenFlowReportsPage from "./pages/VenFlowReportsPage";
import VenFlowPurchaseDeskPage from "./pages/VenFlowPurchaseDeskPage";
import VenFlowProductionDeskPage from "./pages/VenFlowProductionDeskPage";
import VenFlowStoreDeskPage from "./pages/VenFlowStoreDeskPage";
import VenFlowSupervisorDeskPage
	from "./pages/VenFlowSupervisorDeskPage";
import VenFlowDirectorDeskPage
	from "./pages/VenFlowDirectorDeskPage";

import VenFlowQcDeskPage from "./pages/VenFlowQcDeskPage";

import {
	defaultVenFlowPathForRole,
	getVenFlowRole,
} from "./../../utils/venflowAccess";

import { useAuth } from "../../auth/AuthContext";

function VenFlowHomeRedirect() {
	const { role } = useAuth();

	const venFlowRole =
		getVenFlowRole(role);

	return (
		<Navigate
			to={defaultVenFlowPathForRole(venFlowRole)}
			replace
		/>
	);
}

export default function VenFlowRoutes() {
	return (
		<Routes>
			<Route element={<VenFlowLayout />}>
				<Route
					index
					element={<VenFlowHomeRedirect />}
				/>

				<Route
					path="dashboard"
					element={
						<VenFlowRoleGuard screen="dashboard">
							<VenFlowDashboard />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="director"
					element={
						<VenFlowRoleGuard screen="director">
							<VenFlowDirectorDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="production"
					element={
						<VenFlowRoleGuard screen="production">
							<VenFlowProductionDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="supervisor"
					element={
						<VenFlowRoleGuard screen="supervisor">
							<VenFlowSupervisorDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="qc"
					element={
						<VenFlowRoleGuard screen="qc">
							<VenFlowQcDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="store"
					element={
						<VenFlowRoleGuard screen="store">
							<VenFlowStoreDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="purchase"
					element={
						<VenFlowRoleGuard screen="purchase">
							<VenFlowPurchaseDeskPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="entries"
					element={
						<VenFlowRoleGuard screen="entries">
							<VenFlowListPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="create"
					element={
						<VenFlowRoleGuard screen="create">
							<VenFlowCreatePage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="entries/:id"
					element={
						<VenFlowRoleGuard screen="detail">
							<VenFlowDetailPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="reports"
					element={
						<VenFlowRoleGuard screen="reports">
							<VenFlowReportsPage />
						</VenFlowRoleGuard>
					}
				/>

				<Route
					path="*"
					element={<VenFlowHomeRedirect />}
				/>
			</Route>
		</Routes>
	);
}