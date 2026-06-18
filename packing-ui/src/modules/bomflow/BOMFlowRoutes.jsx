import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import BOMFlowLayout from "./BOMFlowLayout";
import BOMFlowDashboard from "./pages/BOMFlowDashboard";
import BOMFlowProductMaster from "./pages/BOMFlowProductMaster";
import BOMFlowBOMBuilder from "./pages/BOMFlowBOMBuilder";
import BOMFlowPlaceholder from "./pages/BOMFlowPlaceholder";

export default function BOMFlowRoutes() {
	return (
		<Routes>
			<Route element={<BOMFlowLayout />}>
				<Route index element={<Navigate to="dashboard" replace />} />
				<Route path="dashboard" element={<BOMFlowDashboard />} />
				<Route path="products" element={<BOMFlowProductMaster />} />
				<Route path="bom-builder" element={<BOMFlowBOMBuilder />} />

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

				<Route path="*" element={<Navigate to="dashboard" replace />} />
			</Route>
		</Routes>
	);
}