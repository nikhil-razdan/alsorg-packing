import Header from "./Header";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

function Layout() {
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#f6f5f2", // warm neutral base
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0, // prevents flex overflow
        }}
      >
        {/* Header */}
        <Header />

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            padding: 22,
            overflow: "auto",
            background:
              "linear-gradient(180deg, #fffdf7 0%, #f3efe4 100%)",
          }}
        >
          {/* Content container */}
          <div
            style={{
              maxWidth: 1600,
              margin: "0 auto",
              height: 100,
            }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Layout;
