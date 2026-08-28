import React from "react";

import {
	Navigate,
	Route,
	Routes,
} from "react-router-dom";

import BOMFlowLayout from "./BOMFlowLayout";
import BOMFlowRouteGuard from "./BOMFlowRouteGuard";

import BOMFlowHome from "./pages/BOMFlowHome";
import BOMFlowDashboard from "./pages/BOMFlowDashboard";
import BOMFlowProductList from "./pages/BOMFlowProductList";
import BOMFlowProductMaster from "./pages/BOMFlowProductMaster";
import BOMFlowBOMBuilder from "./pages/BOMFlowBOMBuilder";
import BOMFlowBOMBuilderLanding from "./pages/BOMFlowBOMBuilderLanding";
import BOMFlowPlaceholder from "./pages/BOMFlowPlaceholder";

const guarded = (
	screen,
	element,
	{ requireEdit = false } = {}
) => (
	<BOMFlowRouteGuard
		screen={screen}
		requireEdit={requireEdit}
	>
		{element}
	</BOMFlowRouteGuard>
);

export default function BOMFlowRoutes() {
	return (
		<Routes>
			<Route element={guarded("home", <BOMFlowLayout />)}>
				<Route
					index
					element={guarded("home", <BOMFlowHome />)}
				/>

				<Route
					path="dashboard"
					element={guarded("dashboard", <BOMFlowDashboard />)}
				/>

				{/*
				 * Product Master opens the product list first.
				 * Creating a new Product is editor/manager/admin-only.
				 * Existing Product details remain viewable to other BOMFlow roles;
				 * the Product Master itself disables mutation controls for them.
				 */}
				<Route
					path="products"
					element={guarded("products", <BOMFlowProductList />)}
				/>

				<Route
					path="products/new"
					element={guarded(
						"product-master",
						<BOMFlowProductMaster />,
						{ requireEdit: true }
					)}
				/>

				<Route
					path="products/:productId/edit"
					element={guarded("product-master", <BOMFlowProductMaster />)}
				/>

				<Route
					path="bom-builder"
					element={guarded("bom-builder", <BOMFlowBOMBuilderLanding />)}
				/>

				<Route
					path="revisions/:revisionId"
					element={guarded("builder", <BOMFlowBOMBuilder />)}
				/>

				<Route
					path="rate-master"
					element={guarded(
						"rate-master",
						<BOMFlowPlaceholder
							mode="rate-master"
							title="Rate Master"
							subtitle="Maintain material rates, vendor rates, GST status, effective dates and source references."
						/>
					)}
				/>

				<Route
					path="labour-master"
					element={guarded(
						"labour-master",
						<BOMFlowPlaceholder
							mode="labour-master"
							title="Labour Master"
							subtitle="Maintain process-wise labour rates, departments, time standards and basis."
						/>
					)}
				/>

				<Route
					path="costing"
					element={guarded(
						"costing",
						<BOMFlowPlaceholder
							mode="costing"
							title="Costing Engine"
							subtitle="Calculate material cost, labour cost, overheads, prime cost and final costing scenarios."
						/>
					)}
				/>

				<Route
					path="reports"
					element={guarded(
						"reports",
						<BOMFlowPlaceholder
							mode="reports"
							title="Reports"
							subtitle="Export Direct Material, Direct Labour, Costing Summary, Change Log and printable PDF views."
						/>
					)}
				/>

				<Route
					path="*"
					element={<Navigate to="/bomflow" replace />}
				/>
			</Route>
		</Routes>
	);
}
