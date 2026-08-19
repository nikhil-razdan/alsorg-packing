import Header from "./Header";
import Sidebar from "./Sidebar";
import {
	Outlet,
	useLocation,
} from "react-router-dom";

/*
 * Client Master is shared FlowSuite master data, not a PackFlow workspace.
 *
 * The current application mounts PackFlow child routes through this Layout,
 * so /packflow/client-master would otherwise inherit the PackFlow Header and
 * Sidebar.  Keep the existing route for compatibility, but render that one
 * path as a standalone FlowSuite page.
 *
 * No other PackFlow route/layout behaviour is changed.
 */
const isStandaloneFlowSuitePath = (
	pathname
) => {
	const cleanPath = String(
		pathname || ""
	)
		.trim()
		.replace(/\/+$/, "");

	return (
		cleanPath ===
		"/packflow/client-master"
	);
};

function Layout() {
	const location = useLocation();

	if (
		isStandaloneFlowSuitePath(
			location.pathname
		)
	) {
		return (
			<div style={standaloneShell}>
				<Outlet />
			</div>
		);
	}

	return (
		<div style={shell}>
			<Sidebar />

			<div style={main}>
				<Header />

				<div style={contentShell}>
					<div style={contentInner}>
						<Outlet />
					</div>
				</div>
			</div>
		</div>
	);
}

const standaloneShell = {
	width: "100%",
	minHeight: "100vh",
	background:
		"linear-gradient(135deg,#020617 0%,#0f172a 45%,#111827 100%)",
};

const shell = {
	display: "flex",

	width: "100%",

	minHeight: "100vh",

	background:
		"linear-gradient(135deg,#020617 0%,#0f172a 45%,#111827 100%)",

	overflow: "hidden",
};

const main = {
	flex: 1,

	minWidth: 0,

	display: "flex",

	flexDirection: "column",
};

const contentShell = {
	flex: 1,

	overflow: "auto",

	padding: 24,

	background: `
    radial-gradient(
      circle at top left,
      rgba(59,130,246,0.10),
      transparent 20%
    ),

    radial-gradient(
      circle at bottom right,
      rgba(14,165,233,0.08),
      transparent 20%
    )
  `,
};

const contentInner = {
	width: "100%",

	minHeight: "100%",
};

export default Layout;
