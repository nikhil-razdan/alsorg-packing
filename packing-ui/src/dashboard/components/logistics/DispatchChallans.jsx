import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  Button,
  Chip,
  TextField,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
  API_BASE_URL,
} from "../../../config";

function DispatchChallans({
  showAlert,
}) {
  const [rows, setRows] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [expanded, setExpanded] =
    useState("");

  const loadData = async () => {
    try {
      setLoading(true);

      const res =
        await fetch(
          `${API_BASE_URL}/api/dispatched/challans`,
          {
            method: "GET",
            credentials: "include",
          }
        );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text || "Failed to load dispatched challans"
        );
      }

      const data =
        await res.json();

      setRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      console.error(e);

      setRows([]);

      if (showAlert) {
        showAlert(
          e.message || "Failed to load dispatched challans",
          "error"
        );
      } else {
        alert(
          e.message || "Failed to load dispatched challans"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRows =
    useMemo(() => {
      const q =
        search.trim().toLowerCase();

      if (!q) {
        return rows;
      }

      return rows.filter((challan) => {
        const mainText = [
          challan.challanNumber,
          challan.driverName,
          challan.vehicleNumber,
          challan.dispatchedBy,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const itemText =
          (challan.items || [])
            .map((item) =>
              [
                item.name,
                item.sku,
                item.pdNo,
                item.drawingNo,
                item.clientName,
                item.description,
                item.plantCode,
              ]
                .filter(Boolean)
                .join(" ")
            )
            .join(" ")
            .toLowerCase();

        return (
          mainText.includes(q) ||
          itemText.includes(q)
        );
      });
    }, [rows, search]);

  const totalItems =
    filteredRows.reduce(
      (sum, row) =>
        sum + Number(row.totalItems || 0),
      0
    );

  return (
    <Box sx={wrap}>
      <Box sx={topRow}>
        <Box>
          <Box sx={title}>
            📄 Dispatch Challans
          </Box>

          <Box sx={subtitle}>
            Challan-wise dispatched items with driver and vehicle details
          </Box>
        </Box>

        <Button
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
          sx={refreshButton}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Box>

      <Box sx={summaryRow}>
        <SummaryCard
          label="Challans"
          value={filteredRows.length}
        />

        <SummaryCard
          label="Dispatched Items"
          value={totalItems}
        />
      </Box>

      <Box sx={searchPanel}>
        <SearchIcon
          sx={{
            color: "rgba(255,255,255,.45)",
          }}
        />

        <TextField
          variant="standard"
          placeholder="Search challan, driver, vehicle, item, client, PD no..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          InputProps={{
            disableUnderline: true,
          }}
          sx={{
            flex: 1,

            "& .MuiInputBase-root": {
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
            },

            "& input::placeholder": {
              color: "rgba(255,255,255,.42)",
              opacity: 1,
            },
          }}
        />
      </Box>

      {loading && (
        <Box sx={emptyState}>
          Loading dispatched challans...
        </Box>
      )}

      {!loading &&
        filteredRows.length === 0 && (
          <Box sx={emptyState}>
            No dispatched challans found.
          </Box>
        )}

      {!loading &&
        filteredRows.map((challan) => {
          const isOpen =
            expanded === challan.challanNumber;

          return (
            <Box
              key={challan.challanNumber}
              sx={challanCard}
            >
              <Box sx={challanHeader}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={challanNo}>
                    {challan.challanNumber}
                  </Box>

                  <Box sx={challanMeta}>
                    Driver:{" "}
                    <b>
                      {challan.driverName || "—"}
                    </b>
                    {"  •  "}
                    Vehicle:{" "}
                    <b>
                      {challan.vehicleNumber || "—"}
                    </b>
                  </Box>

                  <Box sx={challanMeta}>
                    Dispatched By:{" "}
                    <b>
                      {challan.dispatchedBy || "—"}
                    </b>
                    {"  •  "}
                    Date:{" "}
                    <b>
                      {formatDateTime(
                        challan.dispatchedAt
                      )}
                    </b>
                  </Box>
                </Box>

                <Box sx={rightBox}>
                  <Chip
                    label={`${challan.totalItems || 0} Items`}
                    size="small"
                    sx={countChip}
                  />

                  <Button
                    onClick={() =>
                      setExpanded(
                        isOpen
                          ? ""
                          : challan.challanNumber
                      )
                    }
                    sx={viewButton}
                  >
                    {isOpen
                      ? "Hide Items"
                      : "View Items"}
                  </Button>
                </Box>
              </Box>

              {isOpen && (
                <Box sx={itemsBox}>
                  <Box sx={tableHeader}>
                    <Box>Item</Box>
                    <Box>SKU</Box>
                    <Box>PD No</Box>
                    <Box>Client</Box>
                    <Box>Plant</Box>
                    <Box>Status</Box>
                  </Box>

                  {(challan.items || []).map(
                    (item, index) => (
                      <Box
                        key={
                          item.zohoItemId ||
                          index
                        }
                        sx={tableRow}
                      >
                        <Box sx={cellText}>
                          {item.name || "—"}
                          <Box sx={subText}>
                            {item.description || ""}
                          </Box>
                        </Box>

                        <Box sx={monoText}>
                          {item.sku || "—"}
                        </Box>

                        <Box sx={cellText}>
                          {item.pdNo || "—"}
                        </Box>

                        <Box sx={cellText}>
                          {item.clientName || "—"}
                        </Box>

                        <Box sx={cellText}>
                          {item.plantCode || "—"}
                        </Box>

                        <Box>
                          <Chip
                            size="small"
                            label={
                              item.status ||
                              "DISPATCHED"
                            }
                            sx={statusChip}
                          />
                        </Box>
                      </Box>
                    )
                  )}
                </Box>
              )}
            </Box>
          );
        })}
    </Box>
  );
}

function SummaryCard({
  label,
  value,
}) {
  return (
    <Box sx={summaryCard}>
      <Box sx={summaryValue}>
        {value}
      </Box>

      <Box sx={summaryLabel}>
        {label}
      </Box>
    </Box>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const wrap = {
  p: 3,
  borderRadius: "24px",
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  border:
    "1px solid rgba(255,255,255,.06)",
  color: "#fff",
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 2,
  alignItems: "center",
  mb: 2.5,
};

const title = {
  fontSize: 26,
  fontWeight: 900,
  color: "#fff",
};

const subtitle = {
  mt: 0.5,
  color: "rgba(255,255,255,.58)",
  fontSize: 13,
  fontWeight: 600,
};

const refreshButton = {
  height: 40,
  px: 2,
  borderRadius: "12px",
  textTransform: "none",
  fontWeight: 800,
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const summaryRow = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 2,
  mb: 2,
};

const summaryCard = {
  p: 2,
  borderRadius: "16px",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const summaryValue = {
  color: "#60a5fa",
  fontSize: 28,
  fontWeight: 900,
};

const summaryLabel = {
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 700,
};

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  height: 50,
  px: 2,
  mb: 2,
  borderRadius: "14px",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const emptyState = {
  p: 3,
  borderRadius: "16px",
  textAlign: "center",
  color: "#94a3b8",
  background:
    "rgba(255,255,255,.03)",
  border:
    "1px dashed rgba(255,255,255,.12)",
  fontWeight: 700,
};

const challanCard = {
  mb: 1.6,
  borderRadius: "18px",
  overflow: "hidden",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const challanHeader = {
  p: 2,
  display: "flex",
  justifyContent: "space-between",
  gap: 2,
  alignItems: "center",
};

const challanNo = {
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
  fontFamily: "monospace",
};

const challanMeta = {
  mt: 0.6,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 650,
};

const rightBox = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexShrink: 0,
};

const countChip = {
  color: "#6ee7b7",
  fontWeight: 900,
  background:
    "rgba(16,185,129,.14)",
  border:
    "1px solid rgba(16,185,129,.22)",
};

const viewButton = {
  height: 34,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 800,
  color: "#fff",
  background:
    "rgba(59,130,246,.16)",
  border:
    "1px solid rgba(59,130,246,.22)",

  "&:hover": {
    background:
      "rgba(59,130,246,.25)",
  },
};

const itemsBox = {
  borderTop:
    "1px solid rgba(255,255,255,.07)",
  overflowX: "auto",
};

const tableHeader = {
  minWidth: 1100,
  display: "grid",
  gridTemplateColumns:
    "260px 260px 130px 180px 100px 140px",
  gap: 1.5,
  px: 2,
  py: 1.4,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  background:
    "rgba(2,6,23,.55)",
};

const tableRow = {
  minWidth: 1100,
  display: "grid",
  gridTemplateColumns:
    "260px 260px 130px 180px 100px 140px",
  gap: 1.5,
  px: 2,
  py: 1.4,
  alignItems: "center",
  borderTop:
    "1px solid rgba(255,255,255,.05)",
};

const cellText = {
  color: "#f8fafc",
  fontSize: 13,
  fontWeight: 750,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const subText = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 600,
  mt: 0.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const monoText = {
  ...cellText,
  fontFamily: "monospace",
};

const statusChip = {
  color: "#4ade80",
  fontWeight: 800,
  background:
    "rgba(34,197,94,.13)",
  border:
    "1px solid rgba(34,197,94,.22)",
};

export default DispatchChallans;