import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DownloadIcon from "@mui/icons-material/Download";

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

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(10);

  const [pdfPreview, setPdfPreview] =
    useState({
      open: false,
      url: "",
      challanNumber: "",
    });

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

    return () => {
      if (pdfPreview.url) {
        URL.revokeObjectURL(pdfPreview.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                item.status,
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

  useEffect(() => {
    setPageNo(1);
  }, [search, pageSize]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length / pageSize
      )
    );

  const currentPage =
    Math.min(
      pageNo,
      totalPages
    );

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [pageNo, totalPages]);

  const paginatedRows =
    filteredRows.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

  const totalItems =
    filteredRows.reduce(
      (sum, row) =>
        sum + Number(row.totalItems || 0),
      0
    );

  const getChallanPdfBlob =
    async (challanNumber) => {
      if (!challanNumber) {
        throw new Error("Challan number missing");
      }

      const res =
        await fetch(
          `${API_BASE_URL}/api/chalaan/dispatched/${encodeURIComponent(
            challanNumber
          )}/download`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/pdf",
            },
          }
        );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text || "Failed to load challan PDF"
        );
      }

      return await res.blob();
    };

  const previewChallanPdf =
    async (challanNumber) => {
      try {
        const blob =
          await getChallanPdfBlob(challanNumber);

        const url =
          URL.createObjectURL(blob);

        if (pdfPreview.url) {
          URL.revokeObjectURL(pdfPreview.url);
        }

        setPdfPreview({
          open: true,
          url,
          challanNumber,
        });
      } catch (e) {
        console.error(e);

        showAlert?.(
          e.message || "Unable to preview challan PDF",
          "error"
        );
      }
    };

  const downloadChallanPdf =
    async (challanNumber) => {
      try {
        const blob =
          await getChallanPdfBlob(challanNumber);

        const url =
          URL.createObjectURL(blob);

        const a =
          document.createElement("a");

        a.href = url;
        a.download =
          `${sanitizeFilename(challanNumber)}.pdf`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);

        showAlert?.(
          e.message || "Unable to download challan PDF",
          "error"
        );
      }
    };

  const closePdfPreview = () => {
    if (pdfPreview.url) {
      URL.revokeObjectURL(pdfPreview.url);
    }

    setPdfPreview({
      open: false,
      url: "",
      challanNumber: "",
    });
  };

  return (
    <Box sx={wrap}>
      <Box sx={topRow}>
        <Box>
          <Box sx={title}>
            📄 Dispatch Challans
          </Box>

          <Box sx={subtitle}>
            Challan-wise dispatched items with driver, vehicle and PDF access
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

        <SummaryCard
          label="Current Page"
          value={`${currentPage}/${totalPages}`}
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
        paginatedRows.map((challan) => {
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
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() =>
                      previewChallanPdf(
                        challan.challanNumber
                      )
                    }
                    sx={pdfButton}
                  >
                    Preview PDF
                  </Button>

                  <Button
                    startIcon={<DownloadIcon />}
                    onClick={() =>
                      downloadChallanPdf(
                        challan.challanNumber
                      )
                    }
                    sx={downloadButton}
                  >
                    Download
                  </Button>

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

      {!loading &&
        filteredRows.length > 0 && (
          <PaginationBar
            pageNo={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            setPageNo={setPageNo}
            setPageSize={setPageSize}
            totalItems={filteredRows.length}
          />
        )}

      <Dialog
        open={pdfPreview.open}
        onClose={closePdfPreview}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: "18px",
            background: "#020617",
            border:
              "1px solid rgba(255,255,255,.12)",
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle
          sx={{
            color: "#fff",
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom:
              "1px solid rgba(255,255,255,.08)",
          }}
        >
          Challan PDF • {pdfPreview.challanNumber}

          <IconButton
            onClick={closePdfPreview}
            sx={{
              color: "#fff",
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            height: "78vh",
            background: "#111827",
          }}
        >
          {pdfPreview.url && (
            <iframe
              title="Challan PDF Preview"
              src={pdfPreview.url}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "#fff",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function PaginationBar({
  pageNo,
  totalPages,
  pageSize,
  setPageNo,
  setPageSize,
  totalItems,
}) {
  const from =
    totalItems === 0
      ? 0
      : (pageNo - 1) * pageSize + 1;

  const to =
    Math.min(
      pageNo * pageSize,
      totalItems
    );

  return (
    <Box sx={paginationWrap}>
      <Box sx={paginationText}>
        Showing <b>{from}</b> - <b>{to}</b> of{" "}
        <b>{totalItems}</b>
      </Box>

      <Box sx={paginationActions}>
        <Select
          size="small"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPageNo(1);
          }}
          sx={pageSizeSelect}
        >
          {[5, 10, 25, 50, 100].map((size) => (
            <MenuItem
              key={size}
              value={size}
            >
              {size} / page
            </MenuItem>
          ))}
        </Select>

        <Button
          disabled={pageNo <= 1}
          onClick={() =>
            setPageNo((prev) =>
              Math.max(1, prev - 1)
            )
          }
          sx={pageButton}
        >
          Prev
        </Button>

        <Box sx={pageBadge}>
          {pageNo} / {totalPages}
        </Box>

        <Button
          disabled={pageNo >= totalPages}
          onClick={() =>
            setPageNo((prev) =>
              Math.min(totalPages, prev + 1)
            )
          }
          sx={pageButton}
        >
          Next
        </Button>
      </Box>
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

function sanitizeFilename(value) {
  return String(value || "challan")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
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
  flexWrap: "wrap",
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
  flexWrap: "wrap",
};

const countChip = {
  color: "#6ee7b7",
  fontWeight: 900,
  background:
    "rgba(16,185,129,.14)",
  border:
    "1px solid rgba(16,185,129,.22)",
};

const pdfButton = {
  height: 34,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 800,
  color: "#facc15",
  background:
    "rgba(251,191,36,.12)",
  border:
    "1px solid rgba(251,191,36,.25)",

  "&:hover": {
    background:
      "rgba(251,191,36,.18)",
  },
};

const downloadButton = {
  height: 34,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 800,
  color: "#93c5fd",
  background:
    "rgba(59,130,246,.12)",
  border:
    "1px solid rgba(59,130,246,.22)",

  "&:hover": {
    background:
      "rgba(59,130,246,.22)",
  },
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

const paginationWrap = {
  mt: 2,
  p: 1.5,
  borderRadius: "16px",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexWrap: "wrap",
};

const paginationText = {
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 700,
};

const paginationActions = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "wrap",
};

const pageSizeSelect = {
  height: 36,
  minWidth: 120,
  color: "#fff",
  borderRadius: "10px",
  background:
    "rgba(255,255,255,.04)",

  ".MuiOutlinedInput-notchedOutline": {
    borderColor:
      "rgba(255,255,255,.12)",
  },

  ".MuiSvgIcon-root": {
    color: "#fff",
  },
};

const pageButton = {
  height: 36,
  borderRadius: "10px",
  textTransform: "none",
  fontWeight: 800,
  color: "#fff",
  background:
    "rgba(59,130,246,.16)",
  border:
    "1px solid rgba(59,130,246,.22)",

  "&:disabled": {
    color: "rgba(255,255,255,.3)",
    background:
      "rgba(255,255,255,.04)",
  },
};

const pageBadge = {
  minWidth: 72,
  height: 36,
  px: 1.2,
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 900,
  background:
    "rgba(255,255,255,.055)",
  border:
    "1px solid rgba(255,255,255,.08)",
};

export default DispatchChallans;