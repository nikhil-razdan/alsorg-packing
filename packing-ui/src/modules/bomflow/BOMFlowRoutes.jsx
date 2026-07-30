import React from "react";

import {
	Navigate,
	Route,
	Routes,
} from "react-router-dom";

import BOMFlowLayout from "./BOMFlowLayout";

import BOMFlowHome from "./pages/BOMFlowHome";
import BOMFlowDashboard from "./pages/BOMFlowDashboard";
import BOMFlowProductMaster from "./pages/BOMFlowProductMaster";
import BOMFlowBOMBuilder from "./pages/BOMFlowBOMBuilder";
import BOMFlowPlaceholder from "./pages/BOMFlowPlaceholder";

export default function BOMFlowRoutes() {
	return (
		<Routes>
			<Route element={<BOMFlowLayout />}>
				{/* BOMFlow portal */}
				<Route
					index
					element={<BOMFlowHome />}
				/>

				{/* Management dashboard */}
				<Route
					path="dashboard"
					element={<BOMFlowDashboard />}
				/>

				{/* Product Master */}
				<Route
					path="products"
					element={<BOMFlowProductMaster />}
				/>

				<Route
					path="products/new"
					element={<BOMFlowProductMaster />}
				/>

				<Route
					path="products/:productId/edit"
					element={<BOMFlowProductMaster />}
				/>

				{/* Revision-specific BOM Builder */}
				<Route
					path="revisions/:revisionId"
					element={<BOMFlowBOMBuilder />}
				/>

				{/*
				 * Legacy route.
				 *
				 * A BOM cannot safely open without knowing which
				 * revision is being edited.
				 */}
				<Route
					path="bom-builder"
					element={
						<Navigate
							to="/bomflow/products"
							replace
						/>
					}
				/>

				<Route
					path="rate-master"
					element={
						<BOMFlowPlaceholder
							title="Rate Master"
							subtitle="Maintain material rates, vendor rates, GST status, effective dates and bill copies."
						/>
					}
				/>

				<Route
					path="labour-master"
					element={
						<BOMFlowPlaceholder
							title="Labour Master"
							subtitle="Maintain process-wise labour rates, departments, time standards and approval status."
						/>
					}
				/>

				<Route
					path="costing"
					element={
						<BOMFlowPlaceholder
							title="Costing Engine"
							subtitle="Calculate material cost, labour cost, overheads, prime cost and final costing scenarios."
						/>
					}
				/>

				<Route
					path="reports"
					element={
						<BOMFlowPlaceholder
							title="Reports"
							subtitle="Export Price Sheet, Direct Material, Direct Labour, Change Log, PDF approval and summaries."
						/>
					}
				/>

				<Route
					path="*"
					element={
						<Navigate
							to="/bomflow"
							replace
						/>
					}
				/>
			</Route>
		</Routes>
	);
}