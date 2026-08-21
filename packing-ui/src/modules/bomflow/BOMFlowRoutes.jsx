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
import BOMFlowBOMBuilderLanding from "./pages/BOMFlowBOMBuilderLanding";
import BOMFlowPlaceholder from "./pages/BOMFlowPlaceholder";

export default function BOMFlowRoutes() {
	return (
		<Routes>
			<Route element={<BOMFlowLayout />}>
				<Route
					index
					element={<BOMFlowHome />}
				/>

				<Route
					path="dashboard"
					element={<BOMFlowDashboard />}
				/>

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

				{/*
				 * FIX:
				 * The sidebar and quick links point to /bomflow/bom-builder.
				 * Previously this route immediately redirected to Product Master,
				 * so BOM Builder looked broken.
				 *
				 * It now opens a real product/revision selector.
				 */}
				<Route
					path="bom-builder"
					element={<BOMFlowBOMBuilderLanding />}
				/>

				{/*
				 * A concrete revision opens the actual editable BOM Builder.
				 */}
				<Route
					path="revisions/:revisionId"
					element={<BOMFlowBOMBuilder />}
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
