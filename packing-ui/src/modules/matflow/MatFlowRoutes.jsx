import React from "react";

import {
	Navigate,
	Route,
	Routes,
} from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
	defaultMatFlowPathForRole,
	getMatFlowRole,
} from "../../utils/matflowAccess";

import MatFlowLayout
	from "./MatFlowLayout";
import MatFlowRouteGuard
	from "./MatFlowRouteGuard";

import MatFlowDashboard
	from "./pages/MatFlowDashboard";
import MatFlowReleaseList
	from "./pages/MatFlowReleaseList";
import MatFlowReleaseDetail
	from "./pages/MatFlowReleaseDetail";
import MatFlowQueue
	from "./pages/MatFlowQueue";
import MatFlowRecordDetailPage
	from "./pages/MatFlowRecordDetailPage";

function MatFlowHomeRedirect() {
	const {
		role,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	const cleanRole =
		getMatFlowRole(role);

	return (
		<Navigate
			to={defaultMatFlowPathForRole(
				cleanRole
			)}
			replace
		/>
	);
}

export default function MatFlowRoutes() {
	return (
		<Routes>
			<Route element={<MatFlowLayout />}>
				<Route
					index
					element={
						<MatFlowHomeRedirect />
					}
				/>

				<Route
					path="dashboard"
					element={
						<MatFlowRouteGuard screen="dashboard">
							<MatFlowDashboard />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="releases"
					element={
						<MatFlowRouteGuard screen="releases">
							<MatFlowReleaseList />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="releases/:releaseId"
					element={
						<MatFlowRouteGuard screen="release-detail">
							<MatFlowReleaseDetail />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="production"
					element={
						<MatFlowRouteGuard screen="production">
							<MatFlowQueue mode="production" />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="requisitions/:requisitionId"
					element={
						<MatFlowRouteGuard screen="requisition-detail">
							<MatFlowRecordDetailPage
								type="requisition"
							/>
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="store"
					element={
						<MatFlowRouteGuard screen="store">
							<MatFlowQueue mode="store" />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="indents"
					element={
						<MatFlowRouteGuard screen="indents">
							<MatFlowQueue mode="indents" />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="indents/:indentId"
					element={
						<MatFlowRouteGuard screen="indent-detail">
							<MatFlowRecordDetailPage
								type="indent"
							/>
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="purchase"
					element={
						<MatFlowRouteGuard screen="purchase">
							<MatFlowQueue mode="purchase" />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="approvals"
					element={
						<MatFlowRouteGuard screen="approvals">
							<MatFlowQueue mode="approvals" />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="purchase-orders/:purchaseOrderId"
					element={
						<MatFlowRouteGuard screen="purchase-order-detail">
							<MatFlowRecordDetailPage
								type="purchaseOrder"
							/>
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="reports"
					element={
						<MatFlowRouteGuard screen="reports">
							<MatFlowDashboard />
						</MatFlowRouteGuard>
					}
				/>

				<Route
					path="*"
					element={
						<MatFlowHomeRedirect />
					}
				/>
			</Route>
		</Routes>
	);
}