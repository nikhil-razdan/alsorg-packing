import Header from "./Header";
import Sidebar from "./Sidebar";
import {
  Outlet,
  useLocation,
} from "react-router-dom";

const pageKeyFromPath = (pathname) => {
  const path = String(pathname || "").toLowerCase();

  if (path.includes("/dashboard")) return "dashboard";
  if (path.includes("/zoho-items")) return "inventory";
  if (path.includes("/warehouse")) return "warehouse";
  if (
    path.includes("/dispatched-items") ||
    path.includes("/dispatch")
  ) {
    return "dispatch";
  }
  if (path.includes("/logistics")) return "logistics";

  return "workspace";
};

function Layout() {
  const location = useLocation();
  const pageKey = pageKeyFromPath(location.pathname);

  return (
    <div
      className={`packflow-theme-root packflow-page-${pageKey}`}
      data-packflow-page={pageKey}
      style={shell}
    >
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

const shell = {
  display: "flex",
  width: "100%",
  minHeight: "100vh",
  background: "var(--pf-bg)",
  color: "var(--pf-text-strong)",
  overflow: "hidden",
};

const main = {
  flex: 1,
  minWidth: 0,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "var(--pf-bg)",
};

const contentShell = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: 24,
  background: `
    radial-gradient(circle at top left, rgba(59,130,246,.055), transparent 22%),
    radial-gradient(circle at bottom right, rgba(14,165,233,.04), transparent 24%),
    var(--pf-bg)
  `,
};

const contentInner = {
  width: "100%",
  minHeight: "100%",
};

export default Layout;
