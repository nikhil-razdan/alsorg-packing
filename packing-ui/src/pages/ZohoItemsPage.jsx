import { useEffect, useState, useMemo } from "react";
import {
  Button,
  Divider,
  TextField,
  MenuItem,
  Box,
  Chip,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import { Stepper, Step, StepLabel } from "@mui/material";
import { motion } from "framer-motion";
import { FormControlLabel, Switch } from "@mui/material";

function InventoryModal({
  open,
  onClose,
  icon = "📦",
  title,
  subtitle,
  width = 620,
  children,
  footer,
}) {
  if (!open) return null;

  return (
    <Box
      sx={enhancedOverlaySx}
      onClick={onClose}
    >
      <Box
        sx={{
          ...enhancedModalSx,
          width,
          maxHeight: "88vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={modalHeaderSx}>
          <Box sx={modalTitleWrapSx}>
            <Box sx={modalIconBubble("#3b82f6")}>
              {icon}
            </Box>

            <Box>
              <Box sx={modalTitleSx}>
                {title}
              </Box>

              {subtitle && (
                <Box sx={modalSubtitleSx}>
                  {subtitle}
                </Box>
              )}
            </Box>
          </Box>

          <IconButton
            sx={modalCloseButtonSx}
            onClick={onClose}
          >
            ×
          </IconButton>
        </Box>

        <Box sx={modalContentSx}>
          {children}
        </Box>

        {footer && (
          <Box sx={modalFooterSx}>
            {footer}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function InventorySidePanel({
  open,
  onClose,
  icon = "📦",
  title,
  subtitle,
  children,
}) {
  if (!open) return null;

  return (
    <Box
      sx={sidePanelOverlaySx}
      onClick={onClose}
    >
      <Box
        sx={sidePanelSx}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={modalHeaderSx}>
          <Box sx={modalTitleWrapSx}>
            <Box sx={modalIconBubble("#3b82f6")}>
              {icon}
            </Box>

            <Box>
              <Box sx={modalTitleSx}>
                {title}
              </Box>

              {subtitle && (
                <Box sx={modalSubtitleSx}>
                  {subtitle}
                </Box>
              )}
            </Box>
          </Box>

          <IconButton
            sx={modalCloseButtonSx}
            onClick={onClose}
          >
            ×
          </IconButton>
        </Box>

        <Box sx={sidePanelBodySx}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function ZohoItemsPage() {
  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [addMoreOpen, setAddMoreOpen] = useState(false);
  const [addCount, setAddCount] = useState(1);
  

  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [detailsPopup, setDetailsPopup] = useState(false);
  const darkMode = true;
  const [customPacketNo, setCustomPacketNo] = useState("");
  const [customCreateOpen, setCustomCreateOpen] = useState(false);
  const [customAddOpen, setCustomAddOpen] = useState(false);
  const [weights, setWeights] = useState([]);
  const [dimensionsList, setDimensionsList] = useState([]);
  const [remarksList, setRemarksList] = useState([]);
  
  /* ===== SEARCH + FILTER ===== */
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("NONE");
  const [createOpen, setCreateOpen] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [descriptions, setDescriptions] = useState([]);
  const [form, setForm] = useState({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    dimensions: "",
    weight: "",
    remarks: "",
    numberOfPackets: 1,
	showCompanyHeader: true,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [editForm, setEditForm] = useState({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    description: "",
    weight: "",
    dimensions: "",
    remarks: "",
    location: "",
  });

  /* ===================== COLUMNS ===================== */
 

  const fetchItems = async () => {
    setLoading(true);
    try {
		const res = await fetch(`${API_BASE_URL}/api/packets/items`, {
		  headers: {
		    Authorization: `Bearer ${localStorage.getItem("token")}`,
		  },
		});

		if (!res.ok) {
		  const text = await res.text();
		  console.error("API ERROR:", text);
		  throw new Error("Failed to fetch items");
		}

		const data = await res.json();

		if (!Array.isArray(data)) {
		  console.error("Invalid API:", data);
		  setRows([]);
		  return;
		}

		setRows(data);
      setRowCount(data.length);
    } finally {
      setLoading(false);
    }
  };
  
  const getPacketNumber = (sku) => {
    const match = sku?.match(/Pkt-(\d+)/);
    return match ? Number(match[1]) : 0;
  };
  
  const maxPacketMap = useMemo(() => {
    const map = {};

    rows.forEach((r) => {
      const key = r.masterItemId || r.itemName;
      const pktNo = getPacketNumber(r.sku);

      if (!map[key] || pktNo > map[key]) {
        map[key] = pktNo;
      }
    });

    return map;
  }, [rows]);
  
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = Array.isArray(rows) ? [...rows] : [];

    if (q) {
      list = list.filter((r) => {
        return (
          (r.itemName || "").toLowerCase().includes(q) ||
          (r.sku || "").toLowerCase().includes(q) ||
          (r.clientName || "").toLowerCase().includes(q) ||
          (r.pdNo || "").toLowerCase().includes(q) ||
          (r.drawingNo || "").toLowerCase().includes(q)
        );
      });
    }

    if (groupBy === "SKU") {
      list.sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));
    }

    if (groupBy === "NAME") {
      list.sort((a, b) => (a.itemName || "").localeCompare(b.itemName || ""));
    }

    return list;
  }, [rows, search, groupBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / pageSize)
  );

  const safePageNo = Math.min(pageNo, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePageNo - 1) * pageSize;

    return filteredRows.slice(
      start,
      start + pageSize
    );
  }, [filteredRows, safePageNo, pageSize]);

  const isLastPacket = (row) => {
    const key = row.masterItemId || row.itemName;
    const current = getPacketNumber(row.sku) || 0;
    const max = maxPacketMap?.[key] || 0;

    return current >= max;
  };
  
  const validateStep1 = () => {
    let err = {};

    if (!form.itemName) err.itemName = "Required";
    if (!form.numberOfPackets || form.numberOfPackets <= 0)
      err.numberOfPackets = "Invalid";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validatePackets = () => {
    let valid = true;
    let err = {};

    weights.forEach((w, i) => {
      if (!w) {
        err[`weight-${i}`] = "Required";
        valid = false;
      }
    });

    setErrors(err);
    return valid;
  };
  
  const openGenerateStickerPanel = (row) => {
    setGenerating(false);
    setSelectedItem(row);
    setPdfUrl(null);
    setDrawerOpen(true);
  };

  const openAddPacketsModal = (row) => {
    setSelectedItem(row);
    setAddCount(1);

    setDescriptions([]);
    setWeights([]);
    setDimensionsList([]);
    setRemarksList([]);

    setAddMoreOpen(true);
  };

  const openCustomAddModal = (row) => {
    setSelectedItem(row);
    setCustomPacketNo("");
    setDescriptions([]);
    setWeights([]);
    setDimensionsList([]);
    setRemarksList([]);
    setCustomAddOpen(true);
  };

  const openEditModal = (row) => {
    setEditItem(row);

    setEditForm({
      itemName: row.itemName || "",
      pdNo: row.pdNo || "",
      drawingNo: row.drawingNo || "",
      clientName: row.clientName || "",
      clientAddress: row.clientAddress || "",
      floor: row.floor || "",
      description: row.description || "",
      weight: row.weight || "",
      dimensions: row.dimensions || "",
      remarks: row.remarks || "",
      location: row.location || "",
      stickerNumber: row.stickerNumber,
    });

    setEditOpen(true);
  };

  const deletePacketItem = async (row) => {
    if (!window.confirm("Delete this item?")) return;

    try {
      await fetch(
        `${API_BASE_URL}/api/packets/items/${row.itemId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      fetchItems();
    } catch (e) {
      alert("Delete failed");
    }
  };
  
  useEffect(() => {
    fetchItems();
  }, []);
  
  useEffect(() => {
    const count = Number(form.numberOfPackets || 0);

    const adjust = (arrSetter) => {
      arrSetter(prev => {
        const copy = [...prev];
        while (copy.length < count) copy.push("");
        return copy.slice(0, count);
      });
    };

    adjust(setDescriptions);
    adjust(setWeights);
    adjust(setDimensionsList);
    adjust(setRemarksList);

  }, [form.numberOfPackets]);
  /* ===================== RENDER ===================== */
  return (
    <div style={page}>
      <div style={content}>
        <div style={headerRow}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                fontSize: 34,
                display: "flex",
                alignItems: "center",
                color: "#60a5fa",
              }}
            >
              📦
            </Box>

            <div>
              <div style={logo}>
                Inventory Items
              </div>

              <div style={subtitle}>
                Manage packed inventory, packets and stickers
              </div>
            </div>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={countBadgeSx}>
              Total Items:{" "}
              <span style={{ color: "#60a5fa", fontWeight: 900 }}>
                {filteredRows.length}
              </span>
            </Box>

            <Button
              onClick={() => {
                setActiveStep(0);
                setCreateOpen(true);
              }}
              sx={premiumButton}
            >
              + Create Item
            </Button>

            <Button
              onClick={() => {
                setCustomPacketNo("");
                setCustomCreateOpen(true);
              }}
              sx={actionSecondary}
            >
              + Custom Packet
            </Button>
          </Box>
        </div>

        <Box sx={searchPanel}>
          <SearchIcon
            sx={{
              color: "rgba(255,255,255,.45)",
            }}
          />

          <TextField
            variant="standard"
            placeholder="Search by Item, SKU, Client, PD No..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageNo(1);
            }}
            InputProps={{ disableUnderline: true }}
            sx={searchInputSx}
          />

          <TextField
            select
            size="small"
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value);
              setPageNo(1);
            }}
            sx={selectFieldSx}
            slotProps={selectMenuSlotProps}
          >
            <MenuItem value="NONE">No Group</MenuItem>
            <MenuItem value="SKU">Group by SKU</MenuItem>
            <MenuItem value="NAME">Group by Name</MenuItem>
          </TextField>
        </Box>

        <div style={wrap}>
          <Box sx={tableWrapper}>
            <div
              style={{
                width: "max-content",
                minWidth: "100%",
              }}
            >
              <div style={tableHeader}>
                <div>Generate</div>
                <div>Add Packets</div>
                <div>Edit</div>
                <div>Delete</div>
                <div>Item Name</div>
                <div>SKU</div>
                <div>PD No</div>
                <div>DWG No</div>
                <div>Client</div>
                <div>Address</div>
                <div>Description</div>
                <div>Status</div>
              </div>

              <div style={tableBody}>
                {loading && (
                  <div style={emptyTableState}>
                    Loading inventory items...
                  </div>
                )}

                {!loading && paginatedRows.length === 0 && (
                  <div style={emptyTableState}>
                    No inventory items found.
                  </div>
                )}

                {!loading && paginatedRows.map((row) => {
                  const lastPacket = isLastPacket(row);
                  const isDeletable =
                    row.status === "CREATED" && !row.stickerNumber;

                  return (
                    <div
                      key={row.itemId}
                      style={tableRow}
                    >
                      <div style={tableCellWrap}>
                        <Button
                          size="small"
                          disabled={generating || !!row.stickerNumber}
                          onClick={() => openGenerateStickerPanel(row)}
                          sx={{
                            ...actionPrimary,
                            ...tableActionButton,
                            opacity: row.stickerNumber ? 0.45 : 1,
                          }}
                        >
                          {row.stickerNumber ? "Generated" : "Generate"}
                        </Button>
                      </div>

                      <div style={tableCellWrap}>
                        {lastPacket ? (
                          <Box sx={actionCell}>
                            <Button
                              size="small"
                              onClick={() => openAddPacketsModal(row)}
                              sx={{
                                ...actionPrimary,
                                ...smallActionButton,
                              }}
                            >
                              + Add
                            </Button>

                            <Button
                              size="small"
                              onClick={() => openCustomAddModal(row)}
                              sx={{
                                ...actionSuccess,
                                ...smallActionButton,
                              }}
                            >
                              + Custom
                            </Button>
                          </Box>
                        ) : (
                          <span style={simpleMutedText}>
                            —
                          </span>
                        )}
                      </div>

                      <div style={tableCellWrap}>
                        <Button
                          size="small"
                          onClick={() => openEditModal(row)}
                          sx={{
                            ...actionWarning,
                            ...tableActionButton,
                          }}
                        >
                          Edit
                        </Button>
                      </div>

                      <div style={tableCellWrap}>
                        <Button
                          size="small"
                          disabled={!isDeletable}
                          onClick={() => deletePacketItem(row)}
                          sx={{
                            ...actionDanger,
                            ...tableActionButton,
                            opacity: isDeletable ? 1 : 0.45,
                          }}
                        >
                          Delete
                        </Button>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleCellText}
                          title={row.itemName}
                        >
                          {row.itemName || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleMonoText}
                          title={row.sku}
                        >
                          {row.sku || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleMutedText}
                          title={row.pdNo}
                        >
                          {row.pdNo || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleMonoText}
                          title={row.drawingNo}
                        >
                          {row.drawingNo || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleCellText}
                          title={row.clientName}
                        >
                          {row.clientName || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleMutedText}
                          title={row.clientAddress}
                        >
                          {row.clientAddress || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <span
                          style={simpleMutedText}
                          title={row.description}
                        >
                          {row.description || "—"}
                        </span>
                      </div>

                      <div style={tableCellWrap}>
                        <Chip
                          label={row.stickerNumber ? "Sticker Printed" : row.status || "CREATED"}
                          size="small"
                          sx={row.stickerNumber ? printedChipSx : createdChipSx}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Box>

          <Box sx={paginationBarSx}>
            <Box sx={paginationLeftSx}>
              <Box sx={paginationTextSx}>
                Show
              </Box>

              <TextField
                select
                size="small"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageNo(1);
                }}
                sx={paginationSelectSx}
                slotProps={selectMenuSlotProps}
              >
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>

              <Box sx={paginationTextSx}>
                items per page
              </Box>
            </Box>

            <Box sx={paginationCenterSx}>
              <Button
                disabled={safePageNo === 1}
                onClick={() => setPageNo((p) => Math.max(1, p - 1))}
                sx={paginationButtonSx}
              >
                ◀ Previous
              </Button>

              <Box sx={pageCountSx}>
                Page{" "}
                <Box component="span" sx={{ mx: 1, color: "#60a5fa" }}>
                  {safePageNo}
                </Box>
                of {totalPages}
              </Box>

              <Button
                disabled={safePageNo === totalPages}
                onClick={() => setPageNo((p) => Math.min(totalPages, p + 1))}
                sx={{
                  ...paginationButtonSx,
                  background:
                    "linear-gradient(180deg,#2563eb,#1d4ed8)",
                }}
              >
                Next ▶
              </Button>
            </Box>
          </Box>
        </div>

      {/* ===================== DRAWER ===================== */}
	  <InventorySidePanel
	    open={drawerOpen}
	    onClose={() => setDrawerOpen(false)}
	    icon="🏷️"
	    title={selectedItem?.itemName || "Generate Sticker"}
	    subtitle="Generate and preview sticker PDF"
	  >
	    <p style={infoLineSx}>
	      <b>SKU:</b><br />
	      {selectedItem?.sku || "—"}
	    </p>

	    <p style={infoLineSx}>
	      <b>Location:</b> {selectedItem?.location ?? "—"}
	    </p>

	    <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,.08)" }} />

	    <FormControlLabel
	      control={
	        <Switch
	          checked={form.showCompanyHeader}
	          onChange={(e) =>
	            setForm((prev) => ({
	              ...prev,
	              showCompanyHeader: e.target.checked,
	            }))
	          }
	        />
	      }
	      label="Show Company Header"
	      sx={{
	        mb: 1,
	        color: "#cbd5e1",
	        "& .MuiFormControlLabel-label": {
	          fontWeight: 700,
	          fontSize: 13,
	        },
	      }}
	    />

	    <TextField
	      label="Packing Floor"
	      fullWidth
	      value={form.factoryFloor || ""}
	      onChange={(e) =>
	        setForm((prev) => ({
	          ...prev,
	          factoryFloor: e.target.value,
	        }))
	      }
	      sx={formFieldSx(darkMode)}
	    />

	    <Button
	      disabled={generating}
	      onClick={async () => {
	        try {
	          setGenerating(true);

	          const genRes = await fetch(
	            `${API_BASE_URL}/api/packets/items/${selectedItem.itemId}/generate-sticker?factoryFloor=${encodeURIComponent(form.factoryFloor)}&showCompanyHeader=${form.showCompanyHeader}`,
	            {
	              method: "POST",
	              headers: {
	                Authorization: `Bearer ${localStorage.getItem("token")}`,
	              },
	            }
	          );

	          const contentType = genRes.headers.get("content-type");

	          if (!contentType?.includes("pdf")) {
	            const text = await genRes.text();
	            console.error("NOT PDF:", text);
	            throw new Error("Invalid response");
	          }

	          const blob = await genRes.blob();
	          const url = URL.createObjectURL(blob);

	          setPdfUrl(url);
	          fetchItems();
	        } catch (e) {
	          console.error(e);
	          alert("Failed to generate sticker");
	        } finally {
	          setGenerating(false);
	        }
	      }}
	      sx={{
	        ...premiumButton,
	        width: "100%",
	        height: 42,
	        mt: 1,
	      }}
	    >
	      {generating ? "Generating..." : "Generate Sticker"}
	    </Button>

	    {pdfUrl && (
	      <>
	        <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,.08)" }} />

	        <iframe
	          src={pdfUrl}
	          width="100%"
	          height="480"
	          style={{
	            borderRadius: 12,
	            border: "1px solid rgba(255,255,255,.08)",
	            background: "#fff",
	          }}
	          title="Sticker Preview"
	        />
	      </>
	    )}
	  </InventorySidePanel>
	  <InventorySidePanel
	    open={createOpen}
	    onClose={() => setCreateOpen(false)}
	    icon="➕"
	    title="Create Item"
	    subtitle="Create master item and packet details"
	  >
	    <Stepper
	      activeStep={activeStep}
	      sx={stepperSx}
	    >
	      <Step><StepLabel>Item Info</StepLabel></Step>
	      <Step><StepLabel>Packet Details</StepLabel></Step>
	      <Step><StepLabel>Done</StepLabel></Step>
	    </Stepper>

	    {[
	      "itemName",
	      "pdNo",
	      "drawingNo",
	      "clientName",
	      "clientAddress",
	      "floor",
	      "numberOfPackets",
	    ].map((field) => (
	      <TextField
	        key={field}
	        label={field}
	        fullWidth
	        type={field === "numberOfPackets" ? "number" : "text"}
	        value={form[field]}
	        onChange={(e) =>
	          setForm((prev) => ({
	            ...prev,
	            [field]:
	              field === "numberOfPackets"
	                ? Number(e.target.value)
	                : e.target.value,
	          }))
	        }
	        error={!!errors[field]}
	        helperText={errors[field]}
	        sx={formFieldSx(darkMode)}
	      />
	    ))}

	    <Button
	      onClick={() => {
	        if (!validateStep1()) return;
	        setActiveStep(1);
	        setDetailsPopup(true);
	      }}
	      sx={{
	        ...premiumButton,
	        width: "100%",
	        height: 42,
	      }}
	    >
	      Continue →
	    </Button>
	  </InventorySidePanel>
	  <InventoryModal
	    open={detailsPopup}
	    onClose={() => setDetailsPopup(false)}
	    icon="📋"
	    title="Packet Details"
	    subtitle="Add packet-wise description, weight, dimensions and remarks"
	    width={720}
	    footer={
	      <>
	        <Button
	          onClick={() => setDetailsPopup(false)}
	          sx={modalSecondaryButtonSx}
	        >
	          Cancel
	        </Button>

	        <Button
	          sx={premiumButton}
	          onClick={async () => {
	            if (!validatePackets()) return;

	            await fetch(`${API_BASE_URL}/api/packets/create`, {
	              method: "POST",
	              headers: {
	                "Content-Type": "application/json",
	                Authorization: `Bearer ${localStorage.getItem("token")}`,
	              },
	              body: JSON.stringify({
	                ...form,
	                descriptions,
	                weights,
	                dimensionsList: dimensionsList.map((d) =>
	                  d?.l && d?.b && d?.h
	                    ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                    : ""
	                ),
	                remarksList,
	              }),
	            });

	            setActiveStep(2);
	            setDetailsPopup(false);
	            fetchItems();

	            setTimeout(() => {
	              setCreateOpen(false);
	              setActiveStep(0);
	            }, 800);
	          }}
	        >
	          Create Packets
	        </Button>
	      </>
	    }
	  >
	    <Box sx={modalScrollBodySx}>
	      {descriptions.map((_, i) => (
	        <motion.div
	          key={i}
	          initial={{ opacity: 0, y: 14 }}
	          animate={{ opacity: 1, y: 0 }}
	          transition={{ delay: i * 0.04 }}
	        >
	          <Box sx={packetCardSx}>
	            <Box sx={packetTitleSx}>
	              Packet {i + 1}
	            </Box>

	            <TextField
	              label="Description"
	              fullWidth
	              value={descriptions[i]}
	              onChange={(e) => {
	                const copy = [...descriptions];
	                copy[i] = e.target.value;
	                setDescriptions(copy);
	              }}
	              sx={formFieldSx(darkMode)}
	            />

	            <TextField
	              label="Weight"
	              fullWidth
	              value={weights[i]}
	              onChange={(e) => {
	                const copy = [...weights];
	                copy[i] = e.target.value;
	                setWeights(copy);
	              }}
	              error={!!errors[`weight-${i}`]}
	              helperText={errors[`weight-${i}`]}
	              sx={formFieldSx(darkMode)}
	            />

	            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
	              {["l", "b", "h"].map((key) => (
	                <TextField
	                  key={key}
	                  label={key.toUpperCase()}
	                  type="number"
	                  value={dimensionsList[i]?.[key] || ""}
	                  onChange={(e) => {
	                    const copy = [...dimensionsList];
	                    copy[i] = { ...copy[i], [key]: e.target.value };
	                    setDimensionsList(copy);
	                  }}
	                  sx={{
	                    ...formFieldSx(darkMode),
	                    width: 90,
	                    mb: 0,
	                  }}
	                />
	              ))}

	              <span style={{ color: "#94a3b8", fontWeight: 700 }}>
	                inches
	              </span>
	            </Box>

	            <TextField
	              label="Remarks"
	              fullWidth
	              value={remarksList[i]}
	              onChange={(e) => {
	                const copy = [...remarksList];
	                copy[i] = e.target.value;
	                setRemarksList(copy);
	              }}
	              sx={formFieldSx(darkMode)}
	            />
	          </Box>
	        </motion.div>
	      ))}
	    </Box>
	  </InventoryModal>
	  <InventoryModal
	    open={customCreateOpen}
	    onClose={() => setCustomCreateOpen(false)}
	    icon="📦"
	    title="Create Custom Packet"
	    subtitle="Create a single custom packet with selected packet number"
	    width={640}
	    footer={
	      <>
	        <Button
	          onClick={() => setCustomCreateOpen(false)}
	          sx={modalSecondaryButtonSx}
	        >
	          Cancel
	        </Button>

	        <Button
	          disabled={!customPacketNo}
	          sx={{
	            ...premiumButton,
	            opacity: !customPacketNo ? 0.45 : 1,
	          }}
	          onClick={async () => {
	            try {
	              await fetch(`${API_BASE_URL}/api/packets/create-custom`, {
	                method: "POST",
	                headers: {
	                  "Content-Type": "application/json",
	                  Authorization: `Bearer ${localStorage.getItem("token")}`,
	                },
	                body: JSON.stringify({
	                  ...form,
	                  customPacketNumber: Number(customPacketNo),
	                  descriptions,
	                  weights,
	                  dimensionsList: dimensionsList.map((d) =>
	                    d?.l && d?.b && d?.h
	                      ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                      : ""
	                  ),
	                  remarksList,
	                }),
	              });

	              setCustomCreateOpen(false);
	              fetchItems();
	            } catch (e) {
	              alert("Failed to create custom packet");
	            }
	          }}
	        >
	          Create
	        </Button>
	      </>
	    }
	  >
	    <Box sx={modalScrollBodySx}>
	      <Box sx={sectionCardSx}>
	        <Box sx={sectionTitleSx}>
	          Item Details
	        </Box>

	        {[
	          "itemName",
	          "pdNo",
	          "drawingNo",
	          "clientName",
	          "clientAddress",
	          "floor",
	        ].map((field) => (
	          <TextField
	            key={field}
	            label={field}
	            fullWidth
	            value={form[field]}
	            onChange={(e) =>
	              setForm((prev) => ({
	                ...prev,
	                [field]: e.target.value,
	              }))
	            }
	            sx={formFieldSx(darkMode)}
	          />
	        ))}
	      </Box>

	      <Box sx={sectionCardSx}>
	        <Box sx={sectionTitleSx}>
	          Custom Packet Details
	        </Box>

	        <TextField
	          label="Custom Packet Number"
	          type="number"
	          fullWidth
	          value={customPacketNo}
	          onChange={(e) => setCustomPacketNo(e.target.value)}
	          sx={formFieldSx(darkMode)}
	        />

	        <TextField
	          label="Description"
	          fullWidth
	          value={descriptions[0] || ""}
	          onChange={(e) => setDescriptions([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />

	        <TextField
	          label="Weight"
	          fullWidth
	          value={weights[0] || ""}
	          onChange={(e) => setWeights([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />

	        <Box sx={dimensionRowSx}>
	          {["l", "b", "h"].map((key) => (
	            <TextField
	              key={key}
	              label={key.toUpperCase()}
	              type="number"
	              value={dimensionsList[0]?.[key] || ""}
	              onChange={(e) => {
	                const copy = [...dimensionsList];
	                copy[0] = { ...copy[0], [key]: e.target.value };
	                setDimensionsList(copy);
	              }}
	              sx={{
	                ...formFieldSx(darkMode),
	                width: 90,
	                mb: 0,
	              }}
	            />
	          ))}

	          <span style={dimensionUnitText}>
	            inches
	          </span>
	        </Box>

	        <TextField
	          label="Remarks"
	          fullWidth
	          value={remarksList[0] || ""}
	          onChange={(e) => setRemarksList([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />
	      </Box>
	    </Box>
	  </InventoryModal>
	  <InventoryModal
	    open={addMoreOpen}
	    onClose={() => setAddMoreOpen(false)}
	    icon="➕"
	    title="Add More Packets"
	    subtitle={selectedItem?.itemName ? `Add packets to ${selectedItem.itemName}` : "Add packets to selected item"}
	    width={720}
	    footer={
	      <>
	        <Button
	          onClick={() => setAddMoreOpen(false)}
	          sx={modalSecondaryButtonSx}
	        >
	          Cancel
	        </Button>

	        <Button
	          disabled={!addCount || addCount <= 0}
	          sx={{
	            ...premiumButton,
	            opacity: !addCount || addCount <= 0 ? 0.45 : 1,
	          }}
	          onClick={async () => {
	            try {
	              await fetch(
	                `${API_BASE_URL}/api/packets/add-more/${selectedItem.masterItemId}`,
	                {
	                  method: "POST",
	                  headers: {
	                    "Content-Type": "application/json",
	                    Authorization: `Bearer ${localStorage.getItem("token")}`,
	                  },
	                  body: JSON.stringify({
	                    numberOfPackets: addCount,
	                    descriptions,
	                    weights,
	                    dimensionsList: dimensionsList.map((d) =>
	                      d?.l && d?.b && d?.h
	                        ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                        : ""
	                    ),
	                    remarksList,
	                  }),
	                }
	              );

	              setAddMoreOpen(false);
	              fetchItems();
	            } catch (e) {
	              alert("Failed to add packets");
	            }
	          }}
	        >
	          Add Packets
	        </Button>
	      </>
	    }
	  >
	    <Box sx={modalScrollBodySx}>
	      <Box sx={sectionCardSx}>
	        <Box sx={sectionTitleSx}>
	          Packet Count
	        </Box>

	        <TextField
	          label="Number of packets"
	          type="number"
	          value={addCount}
	          onChange={(e) => setAddCount(Number(e.target.value))}
	          fullWidth
	          sx={formFieldSx(darkMode)}
	        />
	      </Box>

	      {[...Array(addCount)].map((_, i) => (
	        <motion.div
	          key={i}
	          initial={{ opacity: 0, y: 14 }}
	          animate={{ opacity: 1, y: 0 }}
	          transition={{ delay: i * 0.04 }}
	        >
	          <Box sx={packetCardSx}>
	            <Box sx={packetTitleSx}>
	              Packet {i + 1}
	            </Box>

	            <TextField
	              label="Description"
	              fullWidth
	              value={descriptions[i] || ""}
	              onChange={(e) => {
	                const copy = [...descriptions];
	                copy[i] = e.target.value;
	                setDescriptions(copy);
	              }}
	              sx={formFieldSx(darkMode)}
	            />

	            <TextField
	              label="Weight"
	              fullWidth
	              value={weights[i] || ""}
	              onChange={(e) => {
	                const copy = [...weights];
	                copy[i] = e.target.value;
	                setWeights(copy);
	              }}
	              sx={formFieldSx(darkMode)}
	            />

	            <Box sx={dimensionRowSx}>
	              {["l", "b", "h"].map((key) => (
	                <TextField
	                  key={key}
	                  label={key.toUpperCase()}
	                  type="number"
	                  value={dimensionsList[i]?.[key] || ""}
	                  onChange={(e) => {
	                    const copy = [...dimensionsList];
	                    copy[i] = { ...copy[i], [key]: e.target.value };
	                    setDimensionsList(copy);
	                  }}
	                  sx={{
	                    ...formFieldSx(darkMode),
	                    width: 90,
	                    mb: 0,
	                  }}
	                />
	              ))}

	              <span style={dimensionUnitText}>
	                inches
	              </span>
	            </Box>

	            <TextField
	              label="Remarks"
	              fullWidth
	              value={remarksList[i] || ""}
	              onChange={(e) => {
	                const copy = [...remarksList];
	                copy[i] = e.target.value;
	                setRemarksList(copy);
	              }}
	              sx={formFieldSx(darkMode)}
	            />
	          </Box>
	        </motion.div>
	      ))}
	    </Box>
	  </InventoryModal>
	  <InventoryModal
	    open={customAddOpen}
	    onClose={() => setCustomAddOpen(false)}
	    icon="🧩"
	    title="Add Custom Packet"
	    subtitle={selectedItem?.itemName ? `Add custom packet to ${selectedItem.itemName}` : "Add one custom packet"}
	    width={640}
	    footer={
	      <>
	        <Button
	          onClick={() => setCustomAddOpen(false)}
	          sx={modalSecondaryButtonSx}
	        >
	          Cancel
	        </Button>

	        <Button
	          disabled={!customPacketNo}
	          sx={{
	            ...premiumButton,
	            opacity: !customPacketNo ? 0.45 : 1,
	          }}
	          onClick={async () => {
	            try {
	              await fetch(
	                `${API_BASE_URL}/api/packets/add-custom/${selectedItem.masterItemId}`,
	                {
	                  method: "POST",
	                  headers: {
	                    "Content-Type": "application/json",
	                    Authorization: `Bearer ${localStorage.getItem("token")}`,
	                  },
	                  body: JSON.stringify({
	                    customPacketNumber: Number(customPacketNo),
	                    descriptions,
	                    weights,
	                    dimensionsList: dimensionsList.map((d) =>
	                      d?.l && d?.b && d?.h
	                        ? `${d.l} L x ${d.b} B x ${d.h} H inches`
	                        : ""
	                    ),
	                    remarksList,
	                  }),
	                }
	              );

	              setCustomAddOpen(false);
	              fetchItems();
	            } catch (e) {
	              alert("Failed to add custom packet");
	            }
	          }}
	        >
	          Add
	        </Button>
	      </>
	    }
	  >
	    <Box sx={modalScrollBodySx}>
	      <Box sx={sectionCardSx}>
	        <Box sx={sectionTitleSx}>
	          Custom Packet Details
	        </Box>

	        <TextField
	          label="Custom Packet Number"
	          type="number"
	          fullWidth
	          value={customPacketNo}
	          onChange={(e) => setCustomPacketNo(e.target.value)}
	          sx={formFieldSx(darkMode)}
	        />

	        <TextField
	          label="Description"
	          fullWidth
	          value={descriptions[0] || ""}
	          onChange={(e) => setDescriptions([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />

	        <TextField
	          label="Weight"
	          fullWidth
	          value={weights[0] || ""}
	          onChange={(e) => setWeights([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />

	        <Box sx={dimensionRowSx}>
	          {["l", "b", "h"].map((key) => (
	            <TextField
	              key={key}
	              label={key.toUpperCase()}
	              type="number"
	              value={dimensionsList[0]?.[key] || ""}
	              onChange={(e) => {
	                const copy = [...dimensionsList];
	                copy[0] = { ...copy[0], [key]: e.target.value };
	                setDimensionsList(copy);
	              }}
	              sx={{
	                ...formFieldSx(darkMode),
	                width: 90,
	                mb: 0,
	              }}
	            />
	          ))}

	          <span style={dimensionUnitText}>
	            inches
	          </span>
	        </Box>

	        <TextField
	          label="Remarks"
	          fullWidth
	          value={remarksList[0] || ""}
	          onChange={(e) => setRemarksList([e.target.value])}
	          sx={formFieldSx(darkMode)}
	        />
	      </Box>
	    </Box>
	  </InventoryModal>
	  <InventoryModal
	    open={editOpen}
	    onClose={() => setEditOpen(false)}
	    icon="✏️"
	    title="Edit Packet Item"
	    subtitle="Update editable packet information"
	    width={620}
	    footer={
	      <>
	        <Button
	          onClick={() => setEditOpen(false)}
	          sx={modalSecondaryButtonSx}
	        >
	          Cancel
	        </Button>

	        <Button
	          sx={premiumButton}
	          onClick={async () => {
	            try {
	              const res = await fetch(
	                `${API_BASE_URL}/api/packets/items/${editItem.itemId}`,
	                {
	                  method: "PUT",
	                  headers: {
	                    "Content-Type": "application/json",
	                    Authorization: `Bearer ${localStorage.getItem("token")}`,
	                  },
	                  body: JSON.stringify(editForm),
	                }
	              );

	              if (!res.ok) throw new Error();

	              setEditOpen(false);
	              fetchItems();
	            } catch (e) {
	              alert("Update failed");
	            }
	          }}
	        >
	          Save
	        </Button>
	      </>
	    }
	  >
	    <Box sx={modalScrollBodySx}>
	      {[
	        "itemName",
	        "pdNo",
	        "drawingNo",
	        "clientName",
	        "clientAddress",
	        "floor",
	        "description",
	        "weight",
	        "dimensions",
	        "remarks",
	        "location",
	      ].map((field) => {
	        const locked =
	          editForm.stickerNumber &&
	          [
	            "itemName",
	            "pdNo",
	            "drawingNo",
	            "clientName",
	          ].includes(field);

	        return (
	          <TextField
	            key={field}
	            label={field}
	            fullWidth
	            disabled={locked}
	            value={editForm[field] || ""}
	            onChange={(e) =>
	              setEditForm((prev) => ({
	                ...prev,
	                [field]: e.target.value,
	              }))
	            }
	            sx={formFieldSx(darkMode)}
	          />
	        );
	      })}
	    </Box>
	  </InventoryModal>
    </div>
</div>
  );
}


/* ===================== STYLES ===================== */

/* ===================== STYLES ===================== */

const inventoryGrid =
  "130px 190px 110px 110px 260px 300px 120px 150px 180px 260px 260px 160px";

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg,#020617,#0f172a)",
};

const content = {
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const logo = {
  color: "#fff",
  fontSize: 32,
  fontWeight: 900,
  marginBottom: 8,
};

const subtitle = {
  color: "rgba(255,255,255,.62)",
  fontSize: 14,
};

const countBadgeSx = {
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 700,
  px: 2,
  py: 1,
  borderRadius: "12px",
  background: "rgba(255,255,255,.035)",
  border: "1px solid rgba(255,255,255,.06)",
};

const wrap = {
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderRadius: 24,
  padding: 24,
  border:
    "1px solid rgba(255,255,255,.06)",
};

const searchPanel = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  height: 52,
  padding: "0 18px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.03)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const searchInputSx = {
  flex: 1,

  "& .MuiInputBase-root": {
    color: "#fff",
    fontSize: 14,
  },

  "& input::placeholder": {
    color: "rgba(255,255,255,.42)",
    opacity: 1,
  },
};

const selectFieldSx = {
  minWidth: 180,

  "& .MuiOutlinedInput-root": {
    height: 44,
    borderRadius: "14px",
    background:
      "rgba(255,255,255,.04)",
    color: "#fff",

    "& fieldset": {
      borderColor:
        "rgba(255,255,255,.08)",
    },

    "&:hover fieldset": {
      borderColor:
        "rgba(59,130,246,.45)",
    },

    "&.Mui-focused fieldset": {
      borderColor: "#3b82f6",
    },
  },

  "& .MuiSelect-select": {
    color: "#fff",
    fontWeight: 500,
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },
};

const selectMenuSlotProps = {
  select: {
    MenuProps: {
      PaperProps: {
        sx: {
          mt: 1,
          borderRadius: "14px",
          background:
            "linear-gradient(180deg,#0f172a,#111827)",
          color: "#fff",
          border:
            "1px solid rgba(255,255,255,.06)",
          backdropFilter: "blur(20px)",

          "& .MuiMenuItem-root": {
            fontSize: 14,
            fontWeight: 500,
            color: "#fff",
          },

          "& .MuiMenuItem-root:hover": {
            background:
              "rgba(59,130,246,.08)",
          },

          "& .Mui-selected": {
            background:
              "rgba(59,130,246,.16) !important",
            color: "#60a5fa",
            fontWeight: 700,
          },
        },
      },
    },
  },
};

const tableWrapper = {
  overflowX: "auto",

  scrollbarWidth: "thin",
  scrollbarColor: "#3b82f6 #0f172a",

  WebkitOverflowScrolling: "touch",

  "&::-webkit-scrollbar": {
    height: 14,
  },

  "&::-webkit-scrollbar-track": {
    background:
      "linear-gradient(180deg,#0f172a,#111827)",
    borderRadius: 999,
  },

  "&::-webkit-scrollbar-thumb": {
    background:
      "linear-gradient(90deg,#2563eb,#60a5fa)",
    borderRadius: 999,
    border:
      "2px solid #0f172a",
    boxShadow:
      "0 0 16px rgba(59,130,246,.55)",
  },
};

const tableHeader = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "grid",
  gridTemplateColumns: inventoryGrid,
  padding: "14px 16px",
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 700,
  fontSize: 13,
};

const tableBody = {
  display: "flex",
  flexDirection: "column",
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: inventoryGrid,
  alignItems: "center",
  padding: "14px 16px",
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
  minHeight: 58,
  fontSize: 13,
};

const tableCellWrap = {
  minWidth: 0,
  overflow: "hidden",
};

const simpleCellText = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
};

const simpleMutedText = {
  color: "#f1f5f9",
  fontWeight: 750,
  fontSize: 13,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
};

const simpleMonoText = {
  color: "#ffffff",
  fontWeight: 800,
  fontSize: 13,
  lineHeight: 1.25,
  fontFamily: "monospace",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
};

const emptyTableState = {
  padding: "30px 16px",
  color: "#94a3b8",
  fontWeight: 800,
  borderTop:
    "1px solid rgba(255,255,255,.06)",
};

const actionCell = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  flexWrap: "nowrap",
};

const tableActionButton = {
  minWidth: 92,
  height: 32,
  borderRadius: "10px",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "none",
};

const smallActionButton = {
  minWidth: 76,
  height: 30,
  borderRadius: "10px",
  fontSize: 11,
  fontWeight: 800,
};

const premiumButton = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  px: 2.2,
  height: 38,
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  border:
    "1px solid rgba(59,130,246,.35)",
  boxShadow:
    "0 10px 24px rgba(37,99,235,.35)",
  transition: "all .22s ease",

  "&:hover": {
    transform: "translateY(-1px)",
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const actionPrimary = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  border:
    "1px solid rgba(59,130,246,.35)",
  boxShadow:
    "0 10px 24px rgba(37,99,235,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};

const actionSecondary = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  height: 38,
  px: 2,
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  border:
    "1px solid rgba(255,255,255,.08)",

  "&:hover": {
    background:
      "rgba(255,255,255,.08)",
  },
};

const actionSuccess = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  background:
    "linear-gradient(135deg,#059669,#10b981)",
  color: "#fff",
  border:
    "1px solid rgba(16,185,129,.35)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#047857,#059669)",
  },
};

const actionWarning = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  background:
    "linear-gradient(135deg,#d97706,#f59e0b)",
  color: "#fff",
  border:
    "1px solid rgba(245,158,11,.35)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#b45309,#d97706)",
  },
};

const actionDanger = {
  borderRadius: 12,
  textTransform: "none",
  fontWeight: 800,
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  boxShadow:
    "0 10px 24px rgba(239,68,68,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#b91c1c,#dc2626)",
  },
};

const printedChipSx = {
  fontWeight: 800,
  color: "#4ade80",
  background:
    "rgba(34,197,94,.12)",
  border:
    "1px solid rgba(34,197,94,.18)",
};

const createdChipSx = {
  fontWeight: 800,
  color: "#fbbf24",
  background:
    "rgba(251,191,36,.12)",
  border:
    "1px solid rgba(251,191,36,.18)",
};

const paginationBarSx = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  mt: 4,
  gap: 2,
  flexWrap: "wrap",
};

const paginationLeftSx = {
  display: "flex",
  alignItems: "center",
  gap: 2,
};

const paginationTextSx = {
  color: "#94a3b8",
  fontWeight: 600,
  fontSize: 14,
};

const paginationCenterSx = {
  display: "flex",
  alignItems: "center",
  gap: 3,
};

const paginationSelectSx = {
  width: 110,

  "& .MuiOutlinedInput-root": {
    height: 36,
    borderRadius: "12px",
    background:
      "rgba(255,255,255,.04)",
    color: "#fff",

    "& fieldset": {
      borderColor:
        "rgba(255,255,255,.08)",
    },

    "&:hover fieldset": {
      borderColor:
        "rgba(59,130,246,.35)",
    },
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },
};

const paginationButtonSx = {
  minWidth: 100,
  height: 30,
  borderRadius: "12px",
  background:
    "linear-gradient(180deg,#1e293b,#0f172a)",
  color: "#fff",
  border:
    "1px solid rgba(255,255,255,.08)",
  fontSize: 10,
  fontWeight: 700,

  "&:disabled": {
    opacity: 0.45,
    color: "#94a3b8",
  },
};

const pageCountSx = {
  px: 2.5,
  height: 30,
  display: "flex",
  alignItems: "center",
  borderRadius: "12px",
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  color: "#cbd5e1",
  border:
    "1px solid rgba(255,255,255,.06)",
  fontSize: 10,
  fontWeight: 700,
};

/* ===================== MODAL / PANEL ===================== */

const enhancedOverlaySx = {
  position: "fixed",
  inset: 0,
  background: `
    radial-gradient(circle at 20% 10%, rgba(59,130,246,.18), transparent 28%),
    radial-gradient(circle at 80% 90%, rgba(16,185,129,.12), transparent 30%),
    rgba(2,6,23,.72)
  `,
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 5000,
};

const enhancedModalSx = {
  p: 0,
  position: "relative",
  overflow: "hidden",
  borderRadius: 14,
  color: "#fff",
  background: `
    radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 28%),
    linear-gradient(180deg,#0f172a,#111827)
  `,
  border:
    "1px solid rgba(148,163,184,.14)",
  boxShadow:
    "0 40px 110px rgba(0,0,0,.68)",

  "& > *": {
    position: "relative",
    zIndex: 1,
  },
};

const modalHeaderSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  px: 3,
  py: 2.4,
  borderBottom:
    "1px solid rgba(255,255,255,.06)",
};

const modalTitleWrapSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.6,
};

const modalIconBubble = () => ({
  width: 44,
  height: 44,
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  background:
    "linear-gradient(135deg,rgba(59,130,246,.24),rgba(59,130,246,.08))",
  border:
    "1px solid rgba(255,255,255,.08)",
});

const modalTitleSx = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
};

const modalSubtitleSx = {
  color: "rgba(255,255,255,.55)",
  fontSize: 12,
  fontWeight: 600,
  mt: 0.4,
};

const modalCloseButtonSx = {
  width: 36,
  height: 36,
  borderRadius: "8px",
  color: "#94a3b8",
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.06)",

  "&:hover": {
    color: "#fff",
    background:
      "rgba(239,68,68,.16)",
    borderColor:
      "rgba(239,68,68,.28)",
  },
};

const modalContentSx = {
  p: 3,
};

const modalFooterSx = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 1.2,
  px: 3,
  py: 2,
  borderTop:
    "1px solid rgba(255,255,255,.06)",
};

const modalSecondaryButtonSx = {
  height: 36,
  px: 2.2,
  borderRadius: "8px",
  textTransform: "none",
  fontWeight: 800,
  color: "#cbd5e1",
  background:
    "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.08)",

  "&:hover": {
    background:
      "rgba(255,255,255,.08)",
    color: "#fff",
  },
};

const modalScrollBodySx = {
  maxHeight: "58vh",
  overflowY: "auto",
  pr: 0.8,

  "&::-webkit-scrollbar": {
    width: 8,
  },

  "&::-webkit-scrollbar-track": {
    background: "rgba(255,255,255,.03)",
    borderRadius: 999,
  },

  "&::-webkit-scrollbar-thumb": {
    background:
      "linear-gradient(180deg,#2563eb,#60a5fa)",
    borderRadius: 999,
  },
};

const sidePanelOverlaySx = {
  position: "fixed",
  inset: 0,
  background:
    "rgba(2,6,23,.62)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  zIndex: 5000,
  display: "flex",
  justifyContent: "flex-end",
};

const sidePanelSx = {
  width: 540,
  height: "100%",
  color: "#fff",
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  borderLeft:
    "1px solid rgba(255,255,255,.08)",
  boxShadow:
    "-18px 0 60px rgba(0,0,0,.55)",
  display: "flex",
  flexDirection: "column",
};

const sidePanelBodySx = {
  p: 3,
  overflowY: "auto",
};

const infoLineSx = {
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.6,
};

const packetCardSx = {
  mb: 2,
  p: 2,
  borderRadius: "12px",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const sectionCardSx = {
  mb: 2,
  p: 2,
  borderRadius: "12px",
  background:
    "rgba(255,255,255,.035)",
  border:
    "1px solid rgba(255,255,255,.07)",
};

const sectionTitleSx = {
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: ".4px",
  textTransform: "uppercase",
  mb: 1.5,
};

const dimensionRowSx = {
  display: "flex",
  gap: 1,
  alignItems: "center",
  mb: 2,
  flexWrap: "wrap",
};

const dimensionUnitText = {
  color: "#94a3b8",
  fontWeight: 700,
  fontSize: 12,
};

const packetTitleSx = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  mb: 1.5,
};

const stepperSx = {
  mb: 3,

  "& .MuiStepLabel-label": {
    color: "#94a3b8",
    fontWeight: 700,
  },

  "& .Mui-active .MuiStepLabel-label": {
    color: "#60a5fa",
  },

  "& .Mui-completed .MuiStepLabel-label": {
    color: "#4ade80",
  },

  "& .MuiStepIcon-root": {
    color: "rgba(255,255,255,.18)",
  },

  "& .MuiStepIcon-root.Mui-active": {
    color: "#3b82f6",
  },

  "& .MuiStepIcon-root.Mui-completed": {
    color: "#10b981",
  },
};

const formFieldSx = () => ({
  mb: 2,

  "& .MuiFormLabel-root": {
    color: "rgba(255,255,255,.62)",
    fontWeight: 600,
  },

  "& .MuiFormLabel-root.Mui-focused": {
    color: "#60a5fa",
  },

  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    background:
      "rgba(255,255,255,.04)",
    color: "#fff",

    "& fieldset": {
      borderColor:
        "rgba(255,255,255,.08)",
    },

    "&:hover fieldset": {
      borderColor:
        "rgba(59,130,246,.45)",
    },

    "&.Mui-focused fieldset": {
      borderColor:
        "#3b82f6",
      boxShadow:
        "0 0 0 3px rgba(59,130,246,.14)",
    },
  },

  "& .MuiInputBase-input": {
    color: "#fff",
    fontWeight: 600,
    WebkitTextFillColor: "#fff",
  },

  "& textarea": {
    color: "#fff",
    WebkitTextFillColor: "#fff",
  },

  "& .MuiFormHelperText-root": {
    color: "rgba(255,255,255,.55)",
  },

  "& .MuiFormHelperText-root.Mui-error": {
    color: "#f87171",
  },
});

export default ZohoItemsPage;
