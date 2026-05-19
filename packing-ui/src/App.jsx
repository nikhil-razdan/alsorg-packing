import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import ZohoItemsPage from "./pages/ZohoItemsPage";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./auth/RequireAuth";
import DispatchedItemsPage from "./pages/DispatchedItemsPage";
import useViewportHeight from "./useViewportHeight";
import UsersPage from "./pages/UsersPage";
import WarehousePage from "./pages/WarehousePage";

function App() {
  useViewportHeight();
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<LoginPage />} />

        {/* PROTECTED */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
		  <Route path="/users" element={<UsersPage />} />
          <Route path="/zoho-items" element={<ZohoItemsPage />} />
		  <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/dispatched-items" element={<DispatchedItemsPage />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
