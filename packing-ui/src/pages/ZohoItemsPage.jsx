import { useEffect, useState, useMemo } from "react";
import {
  Button,
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
import { Switch } from "@mui/material";

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
  
  const role = String(localStorage.getItem("role") || "")
    .replace("ROLE_", "")
    .toUpperCase();

  const isAdmin = role === "ADMIN";
  
  const [customPacketNo, setCustomPacketNo] = useState("");
  const [customCreateOpen, setCustomCreateOpen] = useState(false);
  const [customAddOpen, setCustomAddOpen] = useState(false);
  const [weights, setWeights] = useState([]);
  const [dimensionsList, setDimensionsList] = useState([]);
  const [remarksList, setRemarksList] = useState([]);
  const [myPlants, setMyPlants] = useState([]);
  /* ===== SEARCH + FILTER ===== */
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState("NONE");
  const [statusFilter, setStatusFilter] = useState("ALL");
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
    plantCode: "",
    dimensions: "",
    weight: "",
    remarks: "",
    numberOfPackets: 1,
    showCompanyHeader: true,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uiAlert, setUiAlert] = useState(null);
  const [generatedHistoryOpen, setGeneratedHistoryOpen] = useState(false);
  const [generatedHistoryRows, setGeneratedHistoryRows] = useState([]);
  const [generatedHistoryLoading, setGeneratedHistoryLoading] = useState(false);
  const [generatedHistoryUsers, setGeneratedHistoryUsers] = useState([]);
  const [generatedHistoryUserFilter, setGeneratedHistoryUserFilter] = useState("ALL");
  const [generatedHistorySearch, setGeneratedHistorySearch] = useState("");
  const [historyPdfPreview, setHistoryPdfPreview] = useState(null);
  const [stickerReviewOpen, setStickerReviewOpen] = useState(false);
  const [stickerReviewLoading, setStickerReviewLoading] = useState(false);
  const [stickerReviewPdf, setStickerReviewPdf] = useState(null);
  const [historyPdfModalOpen, setHistoryPdfModalOpen] = useState(false);
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
 
  const fetchMyPlants = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plants/my`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

	  setMyPlants(list);

	  if (list.length === 1) {
	    setForm((prev) => ({
	      ...prev,
	      plantCode: list[0].plantCode,
	    }));
	  }

	  return list;
	  
  } catch (e) {
    console.error(e);
    setMyPlants([]);
    return [];
  }
  };

  const plantLabel = (plant) => {
    if (!plant) return "";

    return `${plant.plantCode} | ${plant.packedAreaCode} → ${plant.fgAreaCode}`;
  };

  const plantLabelByCode = (plantCode) => {
    if (!plantCode) return "Unassigned";

    const plant = myPlants.find((p) => p.plantCode === plantCode);

    return plant ? plantLabel(plant) : plantCode;
  };

  const normalizePacketCount = (value) => {
    const n = Number(value);

    if (!Number.isFinite(n) || n <= 0) {
      return 1;
    }

    return n;
  };

  const buildTextRows = (count) => {
    return Array.from({ length: count }, () => "");
  };

  const buildDimensionRows = (count) => {
    return Array.from({ length: count }, () => ({}));
  };

  const resizeTextRows = (current, count) => {
    return Array.from({ length: count }, (_, index) => {
      return current?.[index] !== undefined ? current[index] : "";
    });
  };

  const resizeDimensionRows = (current, count) => {
    return Array.from({ length: count }, (_, index) => {
      const value = current?.[index];

      return value && typeof value === "object" ? value : {};
    });
  };

  const preparePacketDetailRows = (packetCount) => {
    const count = normalizePacketCount(packetCount);

    setDescriptions((prev) => resizeTextRows(prev, count));
    setWeights((prev) => resizeTextRows(prev, count));
    setDimensionsList((prev) => resizeDimensionRows(prev, count));
    setRemarksList((prev) => resizeTextRows(prev, count));
  };

  const getDefaultPlantCode = (plants = myPlants) => {
    return plants.length === 1 ? plants[0].plantCode : "";
  };

  const getEmptyForm = (plants = myPlants) => ({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    plantCode: getDefaultPlantCode(plants),
    dimensions: "",
    weight: "",
    remarks: "",
    numberOfPackets: 1,
    showCompanyHeader: true,
    factoryFloor: "",
  });

  const resetCreateForm = (plants = myPlants) => {
    const count = 1;

    setForm(getEmptyForm(plants));
    setDescriptions(buildTextRows(count));
    setWeights(buildTextRows(count));
    setDimensionsList(buildDimensionRows(count));
    setRemarksList(buildTextRows(count));
    setErrors({});
    setActiveStep(0);
  };

  const resetCustomCreateForm = (plants = myPlants) => {
    const count = 1;

    setForm({
      ...getEmptyForm(plants),
      numberOfPackets: 1,
    });

    setCustomPacketNo("");
    setDescriptions(buildTextRows(count));
    setWeights(buildTextRows(count));
    setDimensionsList(buildDimensionRows(count));
    setRemarksList(buildTextRows(count));
    setErrors({});
  };

  const renderPlantSelect = () => {
    return (
      <TextField
        select
        label="Plant Location"
        fullWidth
        value={form.plantCode || ""}
        onChange={(e) => {
          setForm((prev) => ({
            ...prev,
            plantCode: e.target.value,
          }));

          setErrors((prev) => ({
            ...prev,
            plantCode: "",
          }));
        }}
        disabled={myPlants.length === 0}
        error={!!errors.plantCode}
        helperText={
          errors.plantCode ||
          (myPlants.length === 0
            ? "No plant access assigned to this user"
            : "Select the factory plant for this item")
        }
		sx={formFieldSx(darkMode)}
		slotProps={selectMenuSlotProps}
		SelectProps={{
		  MenuProps: selectMenuSlotProps.select.MenuProps,
		}}
      >
        {myPlants.length === 0 ? (
          <MenuItem value="">
            No Plant Assigned
          </MenuItem>
        ) : (
          myPlants.map((plant) => (
            <MenuItem
              key={plant.plantCode}
              value={plant.plantCode}
            >
              {plantLabel(plant)}
            </MenuItem>
          ))
        )}
      </TextField>
    );
  };
  
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
  
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const formatHistoryDateTime = (value) => {
    if (!value) return "—";

    try {
      return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  };

  const openGeneratedHistory = async () => {
    setGeneratedHistoryOpen(true);
    setGeneratedHistorySearch("");
    setHistoryPdfPreview(null);

    await Promise.all([
      fetchGeneratedHistoryUsers(),
      fetchGeneratedHistory("ALL"),
    ]);
  };

  const fetchGeneratedHistoryUsers = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/stickers/generated-history/users`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      setGeneratedHistoryUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setGeneratedHistoryUsers([]);
    }
  };

  const fetchGeneratedHistory = async (userFilter = generatedHistoryUserFilter) => {
    try {
      setGeneratedHistoryLoading(true);

      const query =
        userFilter && userFilter !== "ALL"
          ? `?generatedBy=${encodeURIComponent(userFilter)}`
          : "";

      const res = await fetch(
        `${API_BASE_URL}/api/stickers/generated-history${query}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      setGeneratedHistoryRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);

      if (typeof showUiAlert === "function") {
        showUiAlert("error", "Failed to load generated history");
      }
    } finally {
      setGeneratedHistoryLoading(false);
    }
  };

  const openHistoryPdf = async (historyId) => {
    if (!historyId) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/stickers/history/${historyId}/download-pdf`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (historyPdfPreview?.url) {
        URL.revokeObjectURL(historyPdfPreview.url);
      }

	  setHistoryPdfPreview({
	    historyId,
	    url,
	  });

	  setHistoryPdfModalOpen(true);
    } catch (e) {
      console.error(e);

      if (typeof showUiAlert === "function") {
        showUiAlert("error", "Failed to open sticker PDF");
      }
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
  
  const getStickerStatusKey = (row) => {
    return row?.stickerNumber ? "STICKER_PRINTED" : "CREATED";
  };

  const getStickerStatusLabel = (row) => {
    return row?.stickerNumber ? "Sticker Printed" : "Created";
  };

  const getSafeValue = (value) => {
    return value !== undefined && value !== null && value !== ""
      ? value
      : "—";
  };
  
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
          (r.drawingNo || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q) ||
          (r.remarks || "").toLowerCase().includes(q) ||
          (r.plantCode || "").toLowerCase().includes(q) ||
          (r.packedAreaCode || "").toLowerCase().includes(q) ||
          (r.currentLocationCode || "").toLowerCase().includes(q) ||
          (r.location || "").toLowerCase().includes(q) ||
          getStickerStatusLabel(r).toLowerCase().includes(q)
        );
      });
    }

    if (isAdmin && statusFilter !== "ALL") {
      list = list.filter((r) => {
        return getStickerStatusKey(r) === statusFilter;
      });
    }

    if (groupBy === "SKU") {
      list.sort((a, b) =>
        (a.sku || "").localeCompare(b.sku || "")
      );
    }

    if (groupBy === "NAME") {
      list.sort((a, b) =>
        (a.itemName || "").localeCompare(b.itemName || "")
      );
    }

    return list;
  }, [
    rows,
    search,
    groupBy,
    statusFilter,
    isAdmin,
  ]);

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
  
  const filteredGeneratedHistoryRows = useMemo(() => {
    const q = generatedHistorySearch.trim().toLowerCase();

    if (!q) return generatedHistoryRows;

    return generatedHistoryRows.filter((r) => {
      return (
        (r.itemName || "").toLowerCase().includes(q) ||
        (r.sku || "").toLowerCase().includes(q) ||
        (r.pdNo || "").toLowerCase().includes(q) ||
        (r.drawingNo || "").toLowerCase().includes(q) ||
        (r.clientName || "").toLowerCase().includes(q) ||
        (r.clientAddress || "").toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.remarks || "").toLowerCase().includes(q) ||
        (r.stickerNumber || "").toLowerCase().includes(q) ||
        (r.generatedBy || "").toLowerCase().includes(q)
      );
    });
  }, [generatedHistoryRows, generatedHistorySearch]);

  const isLastPacket = (row) => {
    const key = row.masterItemId || row.itemName;
    const current = getPacketNumber(row.sku) || 0;
    const max = maxPacketMap?.[key] || 0;

    return current >= max;
  };
  
  const validateStep1 = () => {
    let err = {};

    if (!form.itemName) err.itemName = "Required";
	if (!form.plantCode) err.plantCode = "Plant location required";
	
    if (!form.numberOfPackets || form.numberOfPackets <= 0)
      err.numberOfPackets = "Invalid";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const validatePackets = () => {
    let valid = true;
    let err = {};

    const count = normalizePacketCount(form.numberOfPackets);

    for (let i = 0; i < count; i++) {
      if (!weights[i]) {
        err[`weight-${i}`] = "Required";
        valid = false;
      }
    }

    setErrors(err);
    return valid;
  };
  
  const getPacketItemId = (row) => {
    return row?.itemId || row?.id || row?.packetItemId || "";
  };

  const safeFileName = (value) => {
    return String(value || "STICKER")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);
  };

  const getStickerFileName = (row) => {
    const sku =
      row?.sku ||
      row?.stickerNumber ||
      row?.itemId ||
      row?.id ||
      "packet";

    return `STICKER_${safeFileName(sku)}.pdf`;
  };

  const triggerDownloadFromUrl = (url, filename) => {
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "STICKER.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const triggerDownloadFromBlob = (blob, filename) => {
    if (!blob) return;

    const downloadUrl = URL.createObjectURL(blob);

    triggerDownloadFromUrl(
      downloadUrl,
      filename || "STICKER.pdf"
    );

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  }; 
  
  const closeStickerReviewModal = () => {
    if (stickerReviewPdf) {
      URL.revokeObjectURL(stickerReviewPdf);
    }

    setStickerReviewPdf(null);
    setStickerReviewOpen(false);
    setStickerReviewLoading(false);
  };

  const closeGenerateStickerDrawer = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setPdfUrl(null);
    setDrawerOpen(false);
    setGenerating(false);
  };

  const openGenerateStickerDrawer = (row = selectedItem) => {
    if (!row) return;

    closeStickerReviewModal();

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setGenerating(false);
    setSelectedItem(row);
    setPdfUrl(null);
    setDrawerOpen(true);
  };

  const openStickerReviewModal = async (row) => {
    const itemId = getPacketItemId(row);

    if (!itemId) {
      showUiAlert("error", "Packet item id missing");
      return;
    }

    if (stickerReviewPdf) {
      URL.revokeObjectURL(stickerReviewPdf);
    }

    setSelectedItem(row);
    setStickerReviewPdf(null);
    setStickerReviewOpen(true);
    setStickerReviewLoading(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/packets/items/${encodeURIComponent(itemId)}/preview-sticker?factoryFloor=${encodeURIComponent(row.floor || "")}&showCompanyHeader=${form.showCompanyHeader}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      const contentType = res.headers.get("content-type");

      if (!res.ok || !contentType?.includes("pdf")) {
        const message = await readApiErrorMessage(res);
        showUiAlert("error", message || "Preview failed");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setStickerReviewPdf(url);
    } catch (e) {
      console.error(e);
      showUiAlert("error", "Sticker preview failed");
    } finally {
      setStickerReviewLoading(false);
    }
  };
  
  const openGenerateStickerPanel = (row) => {
    openStickerReviewModal(row);
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

  const openDeleteConfirm = (row) => {
    setDeleteTarget(row);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (deleteLoading) return;

    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  const showUiAlert = (type, message) => {
    setUiAlert({
      type,
      message,
    });
  };
  
  const readApiErrorMessage = async (res) => {
    const text = await res.text();

    if (!text) {
      return "Something went wrong";
    }

    try {
      const json = JSON.parse(text);
      return json.message || json.error || text;
    } catch {
      return text;
    }
  };
  
  const handleApiError = async (res, fallbackMessage) => {
    const message = await readApiErrorMessage(res);

    const isDuplicateSku =
      message?.toLowerCase().includes("duplicate sku") ||
      message?.toLowerCase().includes("duplicate");

    showUiAlert(
      "error",
      isDuplicateSku
        ? message
        : `${fallbackMessage}: ${message}`
    );
  };

  const deletePacketItem = async () => {
    const row = deleteTarget;

    const deleteId =
      row?.itemId || row?.id || row?.packetItemId;

    if (!deleteId) {
      showUiAlert(
        "error",
        "Packet Item ID missing. Cannot delete this row."
      );
      console.error("Delete failed. Row has no itemId/id/packetItemId:", row);
      return;
    }

    try {
      setDeleteLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/api/packets/items/${encodeURIComponent(deleteId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Delete backend error:", text);

        showUiAlert(
          "error",
          text || "Delete failed from backend"
        );

        return;
      }

      setRows((prev) =>
        prev.filter((r) => {
          const id = r.itemId || r.id || r.packetItemId;
          return id !== deleteId;
        })
      );

      setDeleteConfirmOpen(false);
      setDeleteTarget(null);

      showUiAlert(
        "success",
        "Item deleted successfully"
      );

      await fetchItems();
    } catch (e) {
      console.error(e);

      showUiAlert(
        "error",
        "Delete failed. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  };
  
  useEffect(() => {
    fetchItems();
    fetchMyPlants();
  }, []);
  
  useEffect(() => {
    preparePacketDetailRows(form.numberOfPackets);
  }, [form.numberOfPackets]);
  
  useEffect(() => {
    if (!uiAlert) return;

	const timer = setTimeout(() => {
	  setUiAlert(null);
	}, uiAlert?.type === "error" ? 6500 : 3500);

    return () => clearTimeout(timer);
  }, [uiAlert]);
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
		  <Button
		      onClick={openGeneratedHistory}
		      sx={historyHeaderButtonSx}
		    >
		      📜 Generated History
		    </Button>
            <Box sx={countBadgeSx}>
              Total Items:{" "}
              <span style={{ color: "#60a5fa", fontWeight: 900 }}>
                {filteredRows.length}
              </span>
            </Box>

			<Button
			  onClick={async () => {
			    let plants = myPlants;

			    if (plants.length === 0) {
			      plants = await fetchMyPlants();
			    }

			    resetCreateForm(plants);
			    setCreateOpen(true);
			  }}
			  sx={premiumButton}
			>
			  + Create Item
			</Button>

			<Button
			  onClick={async () => {
			    let plants = myPlants;

			    if (plants.length === 0) {
			      plants = await fetchMyPlants();
			    }

			    resetCustomCreateForm(plants);
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
		  {isAdmin && (
		    <TextField
		      select
		      size="small"
		      value={statusFilter}
		      onChange={(e) => {
		        setStatusFilter(e.target.value);
		        setPageNo(1);
		      }}
		      sx={selectFieldSx}
		      slotProps={selectMenuSlotProps}
		    >
		      <MenuItem value="ALL">All Status</MenuItem>
		      <MenuItem value="CREATED">Created</MenuItem>
		      <MenuItem value="STICKER_PRINTED">Sticker Printed</MenuItem>
		    </TextField>
		  )}
        </Box>

        <div style={wrap}>
          <Box sx={tableWrapper}>
		  <div
		    style={{
		      width: "max-content",
		      minWidth: inventoryMinWidth,
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
				<div>Plant</div>
				<div>Location</div>
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
				  const rowDeleteId =
				    row.itemId || row.id || row.packetItemId;

                  return (
                    <div
                      key={row.itemId} style={tableRow}>
                      <div style={tableCellWrap}>
					  <Button
					    size="small"
					    disabled={generating || (!!row.stickerNumber && !isAdmin)}
					    onClick={() => openGenerateStickerPanel(row)}
					    sx={{
					      ...actionPrimary,
					      ...tableActionButton,
					      opacity: row.stickerNumber && !isAdmin ? 0.45 : 1,
					    }}
					  >
					    {row.stickerNumber
					      ? isAdmin
					        ? "Reprint"
					        : "Generated"
					      : "Generate"}
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
					      type="button"
					      size="small"
					      onClick={() => openDeleteConfirm(row)}
					      sx={{
					        ...actionDanger,
					        ...tableActionButton,
					        opacity: 1,
					        pointerEvents: "auto",
					        cursor: "pointer",
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
					    <Chip
					      size="small"
					      label={row.plantCode || "Unassigned"}
					      sx={row.plantCode ? plantChipSx : unassignedPlantChipSx}
					    />
					  </div>

					  <div style={tableCellWrap}>
					    <Chip
					      size="small"
					      label={row.currentLocationCode || row.location || "—"}
					      sx={locationChipSx}
					    />
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
					    label={getStickerStatusLabel(row)}
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
		<InventoryModal
		  open={deleteConfirmOpen}
		  onClose={closeDeleteConfirm}
		  icon="🗑️"
		  title="Delete Inventory Item"
		  subtitle="This action will remove the selected packet item from inventory"
		  width={560}
		  footer={
		    <>
		      <Button
		        disabled={deleteLoading}
		        onClick={closeDeleteConfirm}
		        sx={modalSecondaryButtonSx}
		      >
		        Cancel
		      </Button>

		      <Button
		        disabled={deleteLoading}
		        onClick={deletePacketItem}
		        sx={{
		          ...actionDanger,
		          height: 36,
		          px: 2.4,
		          borderRadius: "8px",
		          opacity: deleteLoading ? 0.6 : 1,
		        }}
		      >
		        {deleteLoading ? "Deleting..." : "Yes, Delete"}
		      </Button>
		    </>
		  }
		>
		  <Box sx={deleteWarningBoxSx}>
		    <Box sx={deleteWarningIconSx}>
		      ⚠️
		    </Box>

		    <Box>
		      <Box sx={deleteWarningTitleSx}>
		        Are you sure you want to delete this item?
		      </Box>

		      <Box sx={deleteWarningTextSx}>
		        Once deleted, this item will be removed from the Inventory page.
		      </Box>
		    </Box>
		  </Box>

		  <Box sx={deleteItemCardSx}>
		    <Box sx={deleteItemLabelSx}>
		      Item Name
		    </Box>

		    <Box sx={deleteItemValueSx}>
		      {deleteTarget?.itemName || "—"}
		    </Box>

		    <Box sx={deleteItemMetaSx}>
		      SKU: {deleteTarget?.sku || "—"}
		    </Box>

		    <Box sx={deleteItemMetaSx}>
		      Client: {deleteTarget?.clientName || "—"}
		    </Box>

		    <Box sx={deleteItemMetaSx}>
		      Status: {deleteTarget?.status || "—"}
		    </Box>
		  </Box>
		</InventoryModal>
		
		<InventoryModal
		  open={stickerReviewOpen}
		  onClose={closeStickerReviewModal}
		  icon="👁️"
		  title="Preview Sticker"
		  subtitle="Check sticker details before final generation"
		  width={920}
		  footer={
		    <>
		      <Button
		        onClick={() => {
		          const row = selectedItem;

		          closeStickerReviewModal();

		          if (row) {
		            openEditModal(row);
		          }
		        }}
		        sx={modalSecondaryButtonSx}
		      >
		        Not Done - Edit Details
		      </Button>

		      <Button
		        disabled={!stickerReviewPdf || stickerReviewLoading}
		        onClick={() => openGenerateStickerDrawer(selectedItem)}
		        sx={premiumButton}
		      >
		        Done - Continue Generate
		      </Button>
		    </>
		  }
		>
		  {stickerReviewLoading && (
		    <Box sx={historyEmptySx}>
		      Preparing sticker preview...
		    </Box>
		  )}

		  {!stickerReviewLoading && stickerReviewPdf && (
		    <Box sx={pdfModalFrameWrapSx}>
		      <iframe
		        src={stickerReviewPdf}
		        width="100%"
		        height="100%"
		        title="Sticker Preview Before Generate"
		        style={{
		          border: "1px solid rgba(255,255,255,.08)",
		          borderRadius: 12,
		          background: "#fff",
		        }}
		      />
		    </Box>
		  )}
		</InventoryModal>
		
      {/* ===================== DRAWER ===================== */}
	  <InventorySidePanel
	    open={drawerOpen}
	    onClose={closeGenerateStickerDrawer}
	    icon="🏷️"
	    title="Sticker Generation"
	    subtitle="Generate, download and preview packet sticker"
	  >
	    <Box sx={stickerHeroCardSx}>
	      <Box sx={stickerHeroTopSx}>
	        <Box sx={stickerHeroIconSx}>
	          🏷️
	        </Box>

	        <Chip
	          label={getStickerStatusLabel(selectedItem)}
	          size="small"
	          sx={
	            selectedItem?.stickerNumber
	              ? printedChipSx
	              : createdChipSx
	          }
	        />
	      </Box>

	      <Box sx={stickerSkuSx}>
	        {getSafeValue(selectedItem?.sku)}
	      </Box>

	      <Box sx={stickerItemNameSx}>
	        {getSafeValue(selectedItem?.itemName)}
	      </Box>

	      <Box sx={stickerClientMiniSx}>
	        Client: {getSafeValue(selectedItem?.clientName)}
	      </Box>
	    </Box>

	    <Box sx={drawerSectionCardSx}>
	      <Box sx={drawerSectionTitleSx}>
	        Packet Details
	      </Box>

	      <Box sx={detailGridSx}>
	        <Box sx={detailMiniCardSx}>
	          <Box sx={detailLabelSx}>
	            Plant
	          </Box>

	          <Box sx={detailValueSx}>
	            {plantLabelByCode(selectedItem?.plantCode)}
	          </Box>
	        </Box>

	        <Box sx={detailMiniCardSx}>
	          <Box sx={detailLabelSx}>
	            Location
	          </Box>

	          <Box sx={detailValueSx}>
	            {getSafeValue(
	              selectedItem?.currentLocationCode ||
	                selectedItem?.location
	            )}
	          </Box>
	        </Box>

	        <Box sx={detailMiniCardSx}>
	          <Box sx={detailLabelSx}>
	            PD No
	          </Box>

	          <Box sx={detailValueSx}>
	            {getSafeValue(selectedItem?.pdNo)}
	          </Box>
	        </Box>

	        <Box sx={detailMiniCardSx}>
	          <Box sx={detailLabelSx}>
	            Drawing No
	          </Box>

	          <Box sx={detailValueSx}>
	            {getSafeValue(selectedItem?.drawingNo)}
	          </Box>
	        </Box>
	      </Box>

	      <Box sx={descriptionBoxSx}>
	        <Box sx={detailLabelSx}>
	          Description
	        </Box>

	        <Box sx={descriptionTextSx}>
	          {getSafeValue(selectedItem?.description)}
	        </Box>
	      </Box>
	    </Box>

	    <Box sx={drawerSectionCardSx}>
	      <Box sx={drawerSectionTitleSx}>
	        Sticker Appearance
	      </Box>

	      <Box sx={stickerOptionRowSx}>
	        <Box>
	          <Box sx={optionMainTextSx}>
	            Company Header
	          </Box>

	          <Box sx={optionSubTextSx}>
	            Show ALSORG company header on sticker PDF
	          </Box>
	        </Box>

	        <Switch
	          checked={form.showCompanyHeader}
	          onChange={(e) =>
	            setForm((prev) => ({
	              ...prev,
	              showCompanyHeader: e.target.checked,
	            }))
	          }
	        />
	      </Box>
	    </Box>

	    <Button
	      disabled={generating}
	      onClick={async () => {
	        const itemId = getPacketItemId(selectedItem);

	        if (!itemId) {
	          showUiAlert("error", "Packet item id missing");
	          return;
	        }

	        try {
	          setGenerating(true);

	          const genRes = await fetch(
	            `${API_BASE_URL}/api/packets/items/${encodeURIComponent(
	              itemId
	            )}/generate-sticker?factoryFloor=${encodeURIComponent(
	              selectedItem?.floor || ""
	            )}&showCompanyHeader=${form.showCompanyHeader}`,
	            {
	              method: "POST",
	              headers: {
	                Authorization: `Bearer ${localStorage.getItem("token")}`,
	              },
	            }
	          );

	          const contentType =
	            genRes.headers.get("content-type");

	          if (!genRes.ok || !contentType?.includes("pdf")) {
	            const message =
	              await readApiErrorMessage(genRes);

	            showUiAlert(
	              "error",
	              message || "Failed to generate sticker"
	            );

	            return;
	          }

	          const blob = await genRes.blob();

	          if (pdfUrl) {
	            URL.revokeObjectURL(pdfUrl);
	          }

	          const previewUrl =
	            URL.createObjectURL(blob);

	          setPdfUrl(previewUrl);

	          triggerDownloadFromBlob(
	            blob,
	            getStickerFileName(selectedItem)
	          );

	          showUiAlert(
	            "success",
	            "Sticker generated and downloaded successfully"
	          );

	          await fetchItems();

	          if (generatedHistoryOpen) {
	            await fetchGeneratedHistory(
	              generatedHistoryUserFilter
	            );
	          }
	        } catch (e) {
	          console.error(e);

	          showUiAlert(
	            "error",
	            "Failed to generate sticker"
	          );
	        } finally {
	          setGenerating(false);
	        }
	      }}
	      sx={generateStickerMainButtonSx}
	    >
	      {generating
	        ? "Generating Sticker..."
	        : selectedItem?.stickerNumber && isAdmin
	        ? "Reprint & Download Sticker"
	        : "Generate & Download Sticker"}
	    </Button>

	    <Box sx={autoDownloadHintSx}>
	      Sticker PDF will automatically download after generation.
	    </Box>

	    {pdfUrl && (
	      <>
	        <Box sx={resultSuccessCardSx}>
	          <Box sx={resultSuccessIconSx}>
	            ✅
	          </Box>

	          <Box sx={{ minWidth: 0 }}>
	            <Box sx={resultSuccessTitleSx}>
	              Sticker generated successfully
	            </Box>

	            <Box sx={resultSuccessTextSx}>
	              The PDF has been downloaded. You can download again or open it in a new tab.
	            </Box>
	          </Box>
	        </Box>

	        <Box sx={resultActionsSx}>
	          <Button
	            onClick={() =>
	              triggerDownloadFromUrl(
	                pdfUrl,
	                getStickerFileName(selectedItem)
	              )
	            }
	            sx={downloadAgainButtonSx}
	          >
	            Download Again
	          </Button>

	          <Button
	            onClick={() => {
	              if (pdfUrl) {
	                window.open(pdfUrl, "_blank");
	              }
	            }}
	            sx={openPdfButtonSx}
	          >
	            Open PDF
	          </Button>
	        </Box>

	        <Box sx={pdfPreviewHeaderSx}>
	          Sticker PDF Preview
	        </Box>

	        <iframe
	          src={pdfUrl}
	          width="100%"
	          height="480"
	          style={pdfFrameSx}
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
		    error={!!errors[field]}
		    helperText={errors[field]}
		    sx={formFieldSx(darkMode)}
		  />
		))}

		{renderPlantSelect()}

		<TextField
		  label="numberOfPackets"
		  fullWidth
		  type="number"
		  value={form.numberOfPackets}
		  onChange={(e) =>
		    setForm((prev) => ({
		      ...prev,
		      numberOfPackets: Number(e.target.value),
		    }))
		  }
		  error={!!errors.numberOfPackets}
		  helperText={errors.numberOfPackets}
		  sx={formFieldSx(darkMode)}
		/>

		<Button
		  onClick={() => {
		    if (!validateStep1()) return;

		    preparePacketDetailRows(form.numberOfPackets);

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

			    if (!form.plantCode) {
			      showUiAlert("error", "Please select Plant Location");
			      return;
			    }

			    const res = await fetch(`${API_BASE_URL}/api/packets/create`, {
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

				if (!res.ok) {
				  await handleApiError(res, "Create packets failed");
				  return;
				}

				setActiveStep(2);
				setDetailsPopup(false);

				showUiAlert("success", "Packets created successfully");

				await fetchItems();

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
	          disabled={!customPacketNo || !form.plantCode}
	          sx={{
	            ...premiumButton,
	            opacity: !customPacketNo || !form.plantCode ? 0.45 : 1,
	          }}
	          onClick={async () => {
	            try {
					if (!form.plantCode) {
					  showUiAlert("error", "Please select Plant Location");
					  return;
					}
					
					const res = await fetch(`${API_BASE_URL}/api/packets/create-custom`, {
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

					if (!res.ok) {
					  await handleApiError(res, "Create custom packet failed");
					  return;
					}

					setCustomCreateOpen(false);
					setCustomPacketNo("");

					showUiAlert("success", "Custom packet created successfully");

					await fetchItems();
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

			{renderPlantSelect()}
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
					const res = await fetch(
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

					if (!res.ok) {
					  await handleApiError(res, "Add packets failed");
					  return;
					}

					setAddMoreOpen(false);

					showUiAlert("success", "Packets added successfully");

					await fetchItems();
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
			<Box
			  sx={{
			    mb: 2,
			    p: 1.4,
			    borderRadius: "12px",
			    background: "rgba(59,130,246,.10)",
			    border: "1px solid rgba(59,130,246,.18)",
			    color: "#93c5fd",
			    fontWeight: 900,
			    fontSize: 12,
			  }}
			>
			  Plant: {plantLabelByCode(selectedItem?.plantCode)}
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
					const res = await fetch(
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

					if (!res.ok) {
					  await handleApiError(res, "Add custom packet failed");
					  return;
					}

					setCustomAddOpen(false);
					setCustomPacketNo("");

					showUiAlert("success", "Custom packet added successfully");

					await fetchItems();
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

			<Box
			  sx={{
			    mb: 2,
			    p: 1.4,
			    borderRadius: "12px",
			    background: "rgba(59,130,246,.10)",
			    border: "1px solid rgba(59,130,246,.18)",
			    color: "#93c5fd",
			    fontWeight: 900,
			    fontSize: 12,
			  }}
			>
			  Plant: {plantLabelByCode(selectedItem?.plantCode)}
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
					const editItemId = getPacketItemId(editItem);

					const editUrl =
					  isAdmin
					    ? `${API_BASE_URL}/api/packets/items/${encodeURIComponent(editItemId)}/admin-sticker-details`
					    : `${API_BASE_URL}/api/packets/items/${encodeURIComponent(editItemId)}`;

					const res = await fetch(
					  editUrl,
	                {
	                  method: "PUT",
	                  headers: {
	                    "Content-Type": "application/json",
	                    Authorization: `Bearer ${localStorage.getItem("token")}`,
	                  },
	                  body: JSON.stringify(editForm),
	                }
	              );

				  if (!res.ok) {
				    await handleApiError(res, "Update failed");
				    return;
				  }

				  setEditOpen(false);

				  showUiAlert("success", "Packet item updated successfully");

				  await fetchItems();
			  } catch (e) {
			    console.error(e);
			    showUiAlert("error", "Update failed. Please try again.");
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
			  !isAdmin &&
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
	  <InventoryModal
	    open={generatedHistoryOpen}
	    onClose={() => {
	      setGeneratedHistoryOpen(false);

	      if (historyPdfPreview?.url) {
	        URL.revokeObjectURL(historyPdfPreview.url);
	      }

	      setHistoryPdfPreview(null);
	    }}
	    icon="📜"
	    title="Generated Packet History"
	    subtitle="Items appear here only after sticker generation"
	    width={1320}
	    footer={
	      <>
	        <Button
	          onClick={() => fetchGeneratedHistory(generatedHistoryUserFilter)}
	          sx={modalSecondaryButtonSx}
	        >
	          Refresh
	        </Button>

	        <Button
	          onClick={() => {
	            setGeneratedHistoryOpen(false);

	            if (historyPdfPreview?.url) {
	              URL.revokeObjectURL(historyPdfPreview.url);
	            }

	            setHistoryPdfPreview(null);
	          }}
	          sx={premiumButton}
	        >
	          Close
	        </Button>
	      </>
	    }
	  >
	    <Box sx={historyTopBarSx}>
	      <TextField
	        variant="standard"
	        placeholder="Search item, SKU, client, description, sticker no..."
	        value={generatedHistorySearch}
	        onChange={(e) => setGeneratedHistorySearch(e.target.value)}
	        InputProps={{ disableUnderline: true }}
	        sx={historySearchInputSx}
	      />

	      <TextField
	        select
	        size="small"
	        label="Generated By"
	        value={generatedHistoryUserFilter}
	        onChange={async (e) => {
	          const value = e.target.value;
	          setGeneratedHistoryUserFilter(value);
	          await fetchGeneratedHistory(value);
	        }}
	        sx={historyUserSelectSx}
	        slotProps={selectMenuSlotProps}
	      >
	        <MenuItem value="ALL">All Users</MenuItem>

	        {generatedHistoryUsers.map((user) => (
	          <MenuItem key={user} value={user}>
	            {user}
	          </MenuItem>
	        ))}
	      </TextField>

	      <Box sx={historyCountBadgeSx}>
	        {filteredGeneratedHistoryRows.length} Generated
	      </Box>
	    </Box>

	    <Box sx={historyLayoutSx}>
	      <Box sx={historyTableWrapSx}>
		  <div style={historyTableHeader}>
		    <div>Date / Time</div>
		    <div>Generated By</div>
		    <div>Item</div>
		    <div>Description</div>
		    <div>SKU</div>
		    <div>PD No</div>
		    <div>Packet</div>
		    <div>Sticker No</div>
		    <div>Reason</div>
		    <div>Action</div>
		  </div>

	        <Box sx={historyTableBodySx}>
	          {generatedHistoryLoading && (
	            <Box sx={historyEmptySx}>
	              Loading generated history...
	            </Box>
	          )}

	          {!generatedHistoryLoading &&
	            filteredGeneratedHistoryRows.length === 0 && (
	              <Box sx={historyEmptySx}>
	                No generated packet history found.
	              </Box>
	            )}

	          {!generatedHistoryLoading &&
	            filteredGeneratedHistoryRows.map((row) => (
	              <div
	                key={row.historyId}
	                style={historyTableRow}
	              >
	                <div style={historyCellWrap}>
	                  <span style={historyDateText}>
	                    {formatHistoryDateTime(row.generatedAt)}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <span style={historyUserText}>
	                    {row.generatedBy || "—"}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <span
	                    style={historyMainText}
	                    title={row.itemName}
	                  >
	                    {row.itemName || "—"}
	                  </span>

	                  <span
	                    style={historySubText}
	                    title={row.clientName}
	                  >
	                    {row.clientName || "—"}
	                  </span>
	                </div>
					
					<div style={historyCellWrap}>
					  <span
					    style={historyMainText}
					    title={row.description}
					  >
					    {row.description || "—"}
					  </span>

					  {row.remarks && (
					    <span
					      style={historySubText}
					      title={row.remarks}
					    >
					      Remarks: {row.remarks}
					    </span>
					  )}
					</div>

	                <div style={historyCellWrap}>
	                  <span
	                    style={historyMonoText}
	                    title={row.sku}
	                  >
	                    {row.sku || "—"}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <span style={historyMainText}>
	                    {row.pdNo || "—"}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <span style={historyMainText}>
	                    {row.packetNumber || "—"}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <span
	                    style={historyMonoText}
	                    title={row.stickerNumber}
	                  >
	                    {row.stickerNumber || "—"}
	                  </span>
	                </div>

	                <div style={historyCellWrap}>
	                  <Chip
	                    label={
	                      row.reason === "REPRINT"
	                        ? `Reprint #${row.printIteration || ""}`
	                        : "Initial"
	                    }
	                    size="small"
	                    sx={
	                      row.reason === "REPRINT"
	                        ? historyReprintChipSx
	                        : historyInitialChipSx
	                    }
	                  />
	                </div>

	                <div style={historyCellWrap}>
	                  <Button
	                    size="small"
	                    onClick={() => openHistoryPdf(row.historyId)}
	                    sx={historyViewButtonSx}
	                  >
	                    View PDF
	                  </Button>
	                </div>
	              </div>
	            ))}
	        </Box>
	      </Box>

	    </Box>
	  </InventoryModal>
	  <InventoryModal
	    open={historyPdfModalOpen}
	    onClose={() => {
	      setHistoryPdfModalOpen(false);

	      if (historyPdfPreview?.url) {
	        URL.revokeObjectURL(historyPdfPreview.url);
	      }

	      setHistoryPdfPreview(null);
	    }}
	    icon="🏷️"
	    title="Sticker PDF Preview"
	    subtitle="Generated sticker PDF view"
	    width={980}
	    footer={
	      <>
	        <Button
	          onClick={() => {
	            if (!historyPdfPreview?.url) return;

	            const a = document.createElement("a");
	            a.href = historyPdfPreview.url;
	            a.download = `STICKER_${historyPdfPreview.historyId}.pdf`;
	            document.body.appendChild(a);
	            a.click();
	            a.remove();
	          }}
	          sx={modalSecondaryButtonSx}
	        >
	          Download
	        </Button>

	        <Button
	          onClick={() => {
	            setHistoryPdfModalOpen(false);

	            if (historyPdfPreview?.url) {
	              URL.revokeObjectURL(historyPdfPreview.url);
	            }

	            setHistoryPdfPreview(null);
	          }}
	          sx={premiumButton}
	        >
	          Close
	        </Button>
	      </>
	    }
	  >
	    {historyPdfPreview?.url ? (
	      <Box sx={pdfModalFrameWrapSx}>
	        <iframe
	          src={historyPdfPreview.url}
	          width="100%"
	          height="100%"
	          title="Generated Sticker PDF Preview"
	          style={{
	            border: "1px solid rgba(255,255,255,.08)",
	            borderRadius: 12,
	            background: "#fff",
	          }}
	        />
	      </Box>
	    ) : (
	      <Box sx={historyEmptySx}>
	        No PDF selected.
	      </Box>
	    )}
	  </InventoryModal>
    </div>
	{uiAlert && (
	  <Box sx={uiAlertWrapSx}>
	    <Box
	      sx={{
	        ...uiAlertBoxSx,
	        ...(uiAlert.type === "success"
	          ? uiAlertSuccessSx
	          : uiAlertErrorSx),
	      }}
	    >
	      <Box sx={uiAlertIconSx}>
	        {uiAlert.type === "success" ? "✅" : "❌"}
	      </Box>

	      <Box sx={{ minWidth: 0 }}>
	        <Box sx={uiAlertTitleSx}>
	          {uiAlert.type === "success" ? "Success" : "Error"}
	        </Box>

	        <Box sx={uiAlertMessageSx}>
	          {uiAlert.message}
	        </Box>
	      </Box>

	      <IconButton
	        size="small"
	        onClick={() => setUiAlert(null)}
	        sx={uiAlertCloseSx}
	      >
	        ×
	      </IconButton>
	    </Box>
	  </Box>
	)}
</div>
  );
}


/* ===================== STYLES ===================== */

/* ===================== STYLES ===================== */

const inventoryGrid =
  "130px 190px 110px 110px 260px 300px 120px 150px 140px 170px 180px 260px 260px 180px";

const inventoryMinWidth = 2760;

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
      disablePortal: true,
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
          zIndex: 8000,

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
  minWidth: inventoryMinWidth,
  alignItems: "center",
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
  minWidth: inventoryMinWidth,
  alignItems: "center",
  padding: "14px 16px",
  color: "#fff",
  borderTop: "1px solid rgba(255,255,255,.06)",
  minHeight: 58,
  fontSize: 13,
};

const tableCellWrap = {
  minWidth: 0,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  minHeight: 36,
  paddingRight: 12,
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

const deleteWarningBoxSx = {
  display: "flex",
  alignItems: "flex-start",
  gap: 1.5,

  p: 2,
  mb: 2,

  borderRadius: "12px",

  background:
    "linear-gradient(135deg,rgba(239,68,68,.14),rgba(255,255,255,.035))",

  border:
    "1px solid rgba(239,68,68,.24)",
};

const deleteWarningIconSx = {
  width: 38,
  height: 38,

  borderRadius: "10px",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "rgba(239,68,68,.16)",

  border:
    "1px solid rgba(239,68,68,.22)",

  flexShrink: 0,
};

const deleteWarningTitleSx = {
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
  mb: 0.5,
};

const deleteWarningTextSx = {
  color: "rgba(255,255,255,.62)",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.5,
};

const deleteItemCardSx = {
  p: 2,

  borderRadius: "12px",

  background:
    "rgba(255,255,255,.035)",

  border:
    "1px solid rgba(255,255,255,.07)",
};

const deleteItemLabelSx = {
  color: "#93c5fd",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: ".4px",
  textTransform: "uppercase",
  mb: 0.7,
};

const deleteItemValueSx = {
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1.35,
  mb: 1,
};

const deleteItemMetaSx = {
  color: "rgba(255,255,255,.58)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.7,
};

const uiAlertWrapSx = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 7000,
  pointerEvents: "none",
};

const uiAlertBoxSx = {
  minWidth: 320,
  maxWidth: 430,

  display: "flex",
  alignItems: "flex-start",
  gap: 1.2,

  p: 1.6,

  borderRadius: "14px",

  color: "#fff",

  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",

  boxShadow:
    "0 24px 60px rgba(0,0,0,.45)",

  pointerEvents: "auto",
};

const uiAlertSuccessSx = {
  background:
    "linear-gradient(135deg,rgba(16,185,129,.95),rgba(5,150,105,.88))",

  border:
    "1px solid rgba(110,231,183,.28)",
};

const uiAlertErrorSx = {
  background:
    "linear-gradient(135deg,rgba(220,38,38,.96),rgba(127,29,29,.9))",

  border:
    "1px solid rgba(252,165,165,.28)",
};

const uiAlertIconSx = {
  width: 30,
  height: 30,

  borderRadius: "8px",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  background:
    "rgba(255,255,255,.14)",

  flexShrink: 0,
};

const uiAlertTitleSx = {
  fontSize: 13,
  fontWeight: 900,
  lineHeight: 1.2,
};

const uiAlertMessageSx = {
  mt: 0.3,
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.4,
  color: "rgba(255,255,255,.82)",
};

const uiAlertCloseSx = {
  width: 28,
  height: 28,

  ml: "auto",

  color: "rgba(255,255,255,.75)",

  background:
    "rgba(255,255,255,.10)",

  borderRadius: "8px",

  "&:hover": {
    color: "#fff",
    background:
      "rgba(255,255,255,.18)",
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

const stickerHeroCardSx = {
  position: "relative",
  overflow: "hidden",
  p: 2.2,
  mb: 2,
  borderRadius: "22px",
  background:
    "radial-gradient(circle at top left, rgba(59,130,246,.35), transparent 38%), linear-gradient(135deg, rgba(15,23,42,.98), rgba(30,41,59,.92))",
  border: "1px solid rgba(96,165,250,.28)",
  boxShadow:
    "0 22px 50px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.08)",
};

const stickerHeroTopSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1.5,
  mb: 1.6,
};

const stickerHeroIconSx = {
  width: 44,
  height: 44,
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  background:
    "linear-gradient(135deg,#2563eb,#60a5fa)",
  boxShadow:
    "0 14px 32px rgba(37,99,235,.42)",
};

const stickerSkuSx = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: ".03em",
  lineHeight: 1.15,
  wordBreak: "break-word",
};

const stickerItemNameSx = {
  mt: 0.7,
  color: "#cbd5e1",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.35,
};

const stickerClientMiniSx = {
  mt: 1,
  display: "inline-flex",
  px: 1.2,
  py: 0.6,
  borderRadius: "999px",
  color: "#93c5fd",
  background: "rgba(59,130,246,.12)",
  border: "1px solid rgba(59,130,246,.18)",
  fontSize: 12,
  fontWeight: 900,
  maxWidth: "100%",
};

const drawerSectionCardSx = {
  p: 1.7,
  mb: 2,
  borderRadius: "20px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
};

const drawerSectionTitleSx = {
  mb: 1.3,
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const detailGridSx = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 1,
};

const detailMiniCardSx = {
  p: 1.2,
  minHeight: 68,
  borderRadius: "14px",
  background: "rgba(15,23,42,.62)",
  border: "1px solid rgba(255,255,255,.06)",
};

const detailLabelSx = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const detailValueSx = {
  mt: 0.6,
  color: "#f8fafc",
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const descriptionBoxSx = {
  mt: 1,
  p: 1.2,
  borderRadius: "14px",
  background: "rgba(15,23,42,.62)",
  border: "1px solid rgba(255,255,255,.06)",
};

const descriptionTextSx = {
  mt: 0.6,
  color: "#e5e7eb",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
  wordBreak: "break-word",
};

const stickerOptionRowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  p: 1.2,
  borderRadius: "16px",
  background:
    "linear-gradient(135deg, rgba(59,130,246,.10), rgba(15,23,42,.45))",
  border: "1px solid rgba(59,130,246,.16)",
};

const optionMainTextSx = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const optionSubTextSx = {
  mt: 0.4,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.4,
};

const generateStickerMainButtonSx = {
  width: "100%",
  height: 50,
  mb: 1,
  borderRadius: "16px",
  textTransform: "none",
  fontSize: 14,
  fontWeight: 950,
  letterSpacing: ".02em",
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6,#60a5fa)",
  boxShadow:
    "0 18px 42px rgba(37,99,235,.42)",
  border: "1px solid rgba(147,197,253,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#1d4ed8,#2563eb,#3b82f6)",
    boxShadow:
      "0 20px 48px rgba(37,99,235,.52)",
    transform: "translateY(-1px)",
  },

  "&.Mui-disabled": {
    color: "rgba(255,255,255,.55)",
    background: "rgba(148,163,184,.16)",
    boxShadow: "none",
  },
};

const autoDownloadHintSx = {
  mb: 2,
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
};

const resultSuccessCardSx = {
  display: "flex",
  alignItems: "flex-start",
  gap: 1.4,
  p: 1.5,
  mb: 1.4,
  borderRadius: "18px",
  background:
    "linear-gradient(135deg, rgba(34,197,94,.15), rgba(15,23,42,.72))",
  border: "1px solid rgba(34,197,94,.22)",
};

const resultSuccessIconSx = {
  width: 36,
  height: 36,
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(34,197,94,.14)",
  fontSize: 18,
  flexShrink: 0,
};

const resultSuccessTitleSx = {
  color: "#bbf7d0",
  fontSize: 14,
  fontWeight: 950,
};

const resultSuccessTextSx = {
  mt: 0.4,
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.45,
};

const resultActionsSx = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 1,
  mb: 1.5,
};

const downloadAgainButtonSx = {
  height: 40,
  borderRadius: "14px",
  textTransform: "none",
  fontWeight: 900,
  color: "#fff",
  background:
    "linear-gradient(135deg,#16a34a,#22c55e)",
  boxShadow:
    "0 12px 26px rgba(22,163,74,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,#15803d,#16a34a)",
  },
};

const openPdfButtonSx = {
  height: 40,
  borderRadius: "14px",
  textTransform: "none",
  fontWeight: 900,
  color: "#dbeafe",
  background: "rgba(59,130,246,.10)",
  border: "1px solid rgba(59,130,246,.22)",

  "&:hover": {
    background: "rgba(59,130,246,.18)",
  },
};

const pdfPreviewHeaderSx = {
  mb: 1,
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const pdfFrameSx = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.10)",
  background: "#fff",
  boxShadow:
    "0 18px 38px rgba(0,0,0,.28)",
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

const historyHeaderButtonSx = {
  height: 38,
  px: 2,
  borderRadius: "12px",
  textTransform: "none",
  fontWeight: 900,
  fontSize: 12,
  color: "#fff",
  background:
    "linear-gradient(135deg,rgba(59,130,246,.22),rgba(59,130,246,.10))",
  border:
    "1px solid rgba(59,130,246,.28)",

  "&:hover": {
    background:
      "linear-gradient(135deg,rgba(59,130,246,.34),rgba(59,130,246,.16))",
  },
};

const historyTopBarSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.5,
  mb: 2,
  p: 1.5,
  borderRadius: "12px",
  background: "rgba(255,255,255,.035)",
  border: "1px solid rgba(255,255,255,.07)",
};

const historySearchInputSx = {
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
};

const historyUserSelectSx = {
  minWidth: 190,

  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,.55)",
    fontWeight: 700,
  },

  "& .MuiOutlinedInput-root": {
    height: 42,
    borderRadius: "12px",
    background: "rgba(255,255,255,.04)",
    color: "#fff",

    "& fieldset": {
      borderColor: "rgba(255,255,255,.08)",
    },

    "&:hover fieldset": {
      borderColor: "rgba(59,130,246,.45)",
    },

    "&.Mui-focused fieldset": {
      borderColor: "#3b82f6",
    },
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },

  "& .MuiSelect-select": {
    color: "#fff",
    fontWeight: 800,
  },
};

const historyCountBadgeSx = {
  height: 38,
  px: 1.8,
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  color: "#93c5fd",
  fontWeight: 900,
  fontSize: 12,
  background: "rgba(59,130,246,.10)",
  border: "1px solid rgba(59,130,246,.16)",
  whiteSpace: "nowrap",
};

const historyLayoutSx = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 2,
};

const historyTableWrapSx = {
  overflowX: "auto",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,.07)",
};

const plantChipSx = {
  height: 24,
  fontWeight: 900,
  fontSize: 11,
  color: "#93c5fd",
  background: "rgba(59,130,246,.12)",
  border: "1px solid rgba(59,130,246,.18)",
};

const unassignedPlantChipSx = {
  height: 24,
  fontWeight: 900,
  fontSize: 11,
  color: "#fbbf24",
  background: "rgba(251,191,36,.12)",
  border: "1px solid rgba(251,191,36,.18)",
};

const locationChipSx = {
  height: 24,
  fontWeight: 900,
  fontSize: 11,
  color: "#c4b5fd",
  background: "rgba(139,92,246,.12)",
  border: "1px solid rgba(139,92,246,.18)",
};

const historyGrid =
  "155px 140px 220px 300px 240px 110px 95px 160px 120px 100px";

const historyMinWidth = 1640;

const historyTableHeader = {
  display: "grid",
  gridTemplateColumns: historyGrid,
  minWidth: historyMinWidth,
  padding: "12px 14px",
  background: "#111827",
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
};

const historyTableRow = {
  display: "grid",
  gridTemplateColumns: historyGrid,
  minWidth: historyMinWidth,
  alignItems: "center",
  padding: "12px 14px",
  borderTop: "1px solid rgba(255,255,255,.06)",
  color: "#fff",
};

const historyTableBodySx = {
  maxHeight: "46vh",
  overflowY: "auto",
};

const historyCellWrap = {
  minWidth: 0,
  overflow: "hidden",
  paddingRight: 10,
};

const historyMainText = {
  display: "block",
  color: "#fff",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const historySubText = {
  display: "block",
  marginTop: 3,
  color: "rgba(255,255,255,.48)",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const historyMonoText = {
  display: "block",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 850,
  fontFamily: "monospace",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const historyDateText = {
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 800,
};

const historyUserText = {
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 900,
};

const pdfModalFrameWrapSx = {
  width: "100%",
  height: "70vh",
  borderRadius: "12px",
  overflow: "hidden",
  background: "#fff",
  border: "1px solid rgba(255,255,255,.08)",
};

const historyEmptySx = {
  p: 3,
  color: "#94a3b8",
  fontWeight: 800,
};

const historyInitialChipSx = {
  height: 24,
  fontSize: 11,
  fontWeight: 900,
  color: "#4ade80",
  background: "rgba(34,197,94,.12)",
  border: "1px solid rgba(34,197,94,.18)",
};

const historyReprintChipSx = {
  height: 24,
  fontSize: 11,
  fontWeight: 900,
  color: "#fbbf24",
  background: "rgba(251,191,36,.12)",
  border: "1px solid rgba(251,191,36,.18)",
};

const historyViewButtonSx = {
  minWidth: 82,
  height: 28,
  borderRadius: "8px",
  textTransform: "none",
  fontSize: 11,
  fontWeight: 900,
  color: "#fff",
  background: "linear-gradient(135deg,#2563eb,#3b82f6)",

  "&:hover": {
    background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
  },
};


export default ZohoItemsPage;
