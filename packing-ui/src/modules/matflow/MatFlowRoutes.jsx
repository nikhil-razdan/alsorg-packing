import {
	Navigate,
	Route,
	Routes,
} from "react-router-dom";

import { useAuth }
	from "../../auth/AuthContext";

import {
	defaultMatFlowPathForRole,
	getMatFlowRole,
} from "../../utils/matflowAccess";

import {
	MatFlowProvider,
} from "./MatFlowContext";

import MatFlowLayout
	from "./MatFlowLayout";

import MatFlowRouteGuard
	from "./MatFlowRouteGuard";

import MatFlowDashboard
	from "./pages/MatFlowDashboard";

import MatFlowPlaceholder
	from "./pages/MatFlowPlaceHolder";

function MatFlowHomeRedirect() {
	const {
		role,
		authLoading,
	} = useAuth();

	if (authLoading) {
		return null;
	}

	return (
		<Navigate
			to={defaultMatFlowPathForRole(
				getMatFlowRole(role)
			)}
			replace
		/>
	);
}

function MatFlowRoot() {
	return (
		<MatFlowProvider>
			<MatFlowLayout />
		</MatFlowProvider>
	);
}

const guarded = (
	screen,
	element
) => {
	return (
		<MatFlowRouteGuard
			screen={screen}
		>
			{element}
		</MatFlowRouteGuard>
	);
};

export default function MatFlowRoutes() {
	return (
		<Routes>
			<Route element={<MatFlowRoot />}>
				<Route
					index
					element={
						<MatFlowHomeRedirect />
					}
				/>

				<Route
					path="dashboard"
					element={guarded(
						"dashboard",
						<MatFlowDashboard />
					)}
				/>

				<Route
					path="projects"
					element={guarded(
						"projects",
						<MatFlowPlaceholder
							title="Projects and Drawings"
							subtitle="Manage PD, project and drawing records used by operational MatFlow BOMs."
						/>
					)}
				/>

				<Route
					path="projects/:projectDrawingId"
					element={guarded(
						"tracking",
						<MatFlowPlaceholder
							title="Project Material Tracking"
							subtitle="Track BOM revisions, requisitions, shortages, purchasing, QC, processing and production movement."
						/>
					)}
				/>

				<Route
					path="materials"
					element={guarded(
						"materials",
						<MatFlowPlaceholder
							title="Material Master"
							subtitle="Maintain MatFlow material codes, units, specifications and reorder information."
						/>
					)}
				/>

				<Route
					path="boms"
					element={guarded(
						"boms",
						<MatFlowPlaceholder
							title="Operational BOMs"
							subtitle="Create and control project-specific operational BOM revisions inside MatFlow."
						/>
					)}
				/>

				<Route
					path="boms/new"
					element={guarded(
						"bom-create",
						<MatFlowPlaceholder
							title="Create Operational BOM"
							subtitle="Prepare an operational project BOM with quantities, wastage and plant routing."
						/>
					)}
				/>

				<Route
					path="boms/:bomId"
					element={guarded(
						"bom-detail",
						<MatFlowPlaceholder
							title="Operational BOM Detail"
							subtitle="Review BOM lines, route steps, revision history and approval status."
						/>
					)}
				/>

				<Route
					path="bom-approvals"
					element={guarded(
						"bom-approval",
						<MatFlowPlaceholder
							title="BOM Approval Queue"
							subtitle="Review submitted operational BOM revisions before they become effective."
						/>
					)}
				/>

				<Route
					path="production"
					element={guarded(
						"production",
						<MatFlowPlaceholder
							title="Production Requisitions"
							subtitle="Raise material requisitions against effective MatFlow operational BOMs."
						/>
					)}
				/>

				<Route
					path="requisitions/:requisitionId"
					element={guarded(
						"requisition-detail",
						<MatFlowPlaceholder
							title="Material Requisition Detail"
							subtitle="Review planning, reservation, shortage, issue, consumption and return quantities."
						/>
					)}
				/>

				<Route
					path="store"
					element={guarded(
						"store",
						<MatFlowPlaceholder
							title="Store and Reservations"
							subtitle="Review available stock, reservations, direct issues and material commitments."
						/>
					)}
				/>

				<Route
					path="transfers"
					element={guarded(
						"transfers",
						<MatFlowPlaceholder
							title="Material Transfers"
							subtitle="Dispatch and receive inter-plant, processing, QC and production transfers."
						/>
					)}
				/>

				<Route
					path="indents"
					element={guarded(
						"indents",
						<MatFlowPlaceholder
							title="Material Indents"
							subtitle="Review automatic shortage indents generated during production planning."
						/>
					)}
				/>

				<Route
					path="purchase"
					element={guarded(
						"purchase",
						<MatFlowPlaceholder
							title="Purchase and Vendors"
							subtitle="Maintain vendors and create purchase orders against open material indents."
						/>
					)}
				/>

				<Route
					path="approvals"
					element={guarded(
						"approvals",
						<MatFlowPlaceholder
							title="Director Approvals"
							subtitle="Review purchase orders requiring commercial approval."
						/>
					)}
				/>

				<Route
					path="receiving"
					element={guarded(
						"receiving",
						<MatFlowPlaceholder
							title="GRN and Receiving"
							subtitle="Receive purchase-order materials and place incoming quantities under QC block."
						/>
					)}
				/>

				<Route
					path="qc"
					element={guarded(
						"qc",
						<MatFlowPlaceholder
							title="Quality Control"
							subtitle="Accept or reject GRN and transfer quantities before downstream use."
						/>
					)}
				/>

				<Route
					path="processing"
					element={guarded(
						"processing",
						<MatFlowPlaceholder
							title="Material Processing"
							subtitle="Track processing inputs, outputs, wastage and downstream reservations."
						/>
					)}
				/>

				<Route
					path="returns"
					element={guarded(
						"returns",
						<MatFlowPlaceholder
							title="Material Returns"
							subtitle="Control production, processing, QC and store return movements."
						/>
					)}
				/>

				<Route
					path="ledger"
					element={guarded(
						"ledger",
						<MatFlowPlaceholder
							title="Stock Ledger"
							subtitle="Search immutable stock movements by material, plant, location, project and movement type."
						/>
					)}
				/>

				<Route
					path="reports"
					element={guarded(
						"reports",
						<MatFlowPlaceholder
							title="MatFlow Reports"
							subtitle="Review shortages, project progress, purchasing, QC, transfers and stock activity."
						/>
					)}
				/>

				{/*
				 * Compatibility redirects for the obsolete
				 * release-based frontend.
				 */}
				<Route
					path="releases"
					element={
						<Navigate
							to="/matflow/boms"
							replace
						/>
					}
				/>

				<Route
					path="releases/:releaseId"
					element={
						<Navigate
							to="/matflow/boms"
							replace
						/>
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