import { useEffect, useState } from "react";
import { fetchZohoItemsPaged } from "../api/zohoApi";

function StatCard({ title, value }) {
  return (
    <div style={statCard}>
      {/* Gloss highlight */}
      <div style={cardHighlight} />

      <p style={statTitle}>{title}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function DashboardPage() {
  const [totalItems, setTotalItems] = useState("—");
  const [packedItems, setPackedItems] = useState("—");
  const [pendingItems, setPendingItems] = useState("—");

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      try {
        const data = await fetchZohoItemsPaged(1, 1);

        if (!active) return;

        const total = data.total ?? 0;
        const packed = 0; // UI-only for now
        const pending = total - packed;

        setTotalItems(total);
        setPackedItems(packed);
        setPendingItems(pending);
      } catch {
        if (!active) return;
        setTotalItems("—");
        setPackedItems("—");
        setPendingItems("—");
      }
    };

    loadStats();
    return () => (active = false);
  }, []);

  return (
    <div style={page}>
      {/* Background Brand Text */}
      <div style={backgroundText}>Alsorg</div>

      {/* Page Content */}
      <div style={content}>
        <h2 style={pageTitle}>Dashboard</h2>

        {/* Stats */}
        <div style={statsRow}>
          <StatCard title="Total Dispatch Warehouse Inventory" value={totalItems} />
          <StatCard title="Stickers Generated" value={packedItems} />
          <StatCard title="Pending Stickers" value={pendingItems} />
        </div>

        {/* Activity Section */}
        <div style={activityCard}>
          <div style={cardHighlight} />

          <h3 style={activityTitle}>Activity</h3>
          <p style={activityText}>
            Sticker generation activity will appear here once persistence is
            enabled.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ===================== STYLES ===================== */

const page = {
  minHeight: "100vh",
  padding: 36,
  background: "linear-gradient(135deg, #f5c542, #b8860b)",
  position: "relative",
  overflow: "hidden",
};

const backgroundText = {
  position: "absolute",
  fontSize: 190,
  fontWeight: 900,
  color: "rgba(255,255,255,0.12)",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  userSelect: "none",
};

const content = {
  position: "relative",
  zIndex: 1,
};

const pageTitle = {
  marginBottom: 34,
  fontSize: 32,
  fontWeight: 700,
  color: "#fff",
  letterSpacing: 0.3,
};

const statsRow = {
  display: "flex",
  gap: 26,
  marginBottom: 46,
};

/* ---------- Stat Card ---------- */

const statCard = {
  position: "relative",
  flex: 1,
  padding: 26,
  borderRadius: 16,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.18))",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  boxShadow:
    "0 18px 45px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)",
  color: "#fff",
  overflow: "hidden",
};

const cardHighlight = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 70,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.35), transparent)",
  pointerEvents: "none",
};

const statTitle = {
  color: "rgba(255,255,255,0.75)",
  marginBottom: 10,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: 0.3,
};

const statValue = {
  margin: 0,
  fontSize: 30,
  fontWeight: 700,
};

/* ---------- Activity ---------- */

const activityCard = {
  position: "relative",
  padding: 30,
  borderRadius: 18,
  maxWidth: 820,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.16))",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxShadow:
    "0 20px 50px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.35)",
  color: "#fff",
  overflow: "hidden",
};

const activityTitle = {
  marginBottom: 12,
  fontSize: 20,
  fontWeight: 600,
};

const activityText = {
  color: "rgba(255,255,255,0.85)",
  lineHeight: 1.6,
};

export default DashboardPage;
