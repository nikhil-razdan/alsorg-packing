import Header from "./Header";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

function Layout() {
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

const shell = {
  display: "flex",
  width: "100%",
  minHeight: "100vh",
  background: "#f1f5f9",
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
 padding: "16px 20px",
 background: "#f1f5f9",
};

const contentInner = {
  width: "100%",
  minHeight: "100%",
  maxWidth: "100%",
};

export default Layout;