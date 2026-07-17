import { useEffect, useState, useMemo } from "react";
import {
  Button,
  TextField,
  MenuItem,
  Box,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { API_BASE_URL } from "../config";
import { Stepper, Step, StepLabel } from "@mui/material";
import { motion } from "framer-motion";
import { Switch } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import API from "../services/api";
import ExcelJS from "exceljs";

import usePackFlowDataRefresh
  from "../dashboard/hooks/usePackFlowDataRefresh";

function InventoryModal({
  open,
  onClose,
  icon = "📦",
  title,
  subtitle,
  width = 620,
  height = "auto",
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
          height,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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

        <Box
          sx={{
            ...modalContentSx,
            ...(height !== "auto"
              ? {
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }
              : {}),
          }}
        >
          {children}
        </Box>

        {footer && (
          <Box
            sx={{
              ...modalFooterSx,
              flexShrink: 0,
            }}
          >
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

function InventoryMasterWorkbench({
  rows = [],
  isAdmin,
  onGenerate,
  onAdd,
  onCustomAdd,
  onEdit,
  onPreviewSticker,
  onDownloadSticker,
}) {
  const [openMap, setOpenMap] =
    useState({});

  const [pageNo, setPageNo] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(6);

  const groups =
    useMemo(() => {
      const map =
        new Map();

      rows.forEach((row) => {
        const key =
          row.masterItemId ||
          [
            row.itemName,
            row.pdNo,
            row.drawingNo,
            row.clientName,
          ]
            .filter(Boolean)
            .join("|") ||
          row.itemId;

        if (!map.has(key)) {
          map.set(key, {
            key,
            masterItemId: row.masterItemId,
            itemName: row.itemName || "Unknown Item",
            clientName: row.clientName || "—",
            pdNo: row.pdNo || "—",
            drawingNo: row.drawingNo || "—",
            plantCode: row.plantCode || "Unassigned",
            rows: [],
          });
        }

        map.get(key).rows.push(row);
      });

      return Array.from(map.values())
        .map((group) => {
          const total =
            group.rows.length;

          const generated =
            group.rows.filter((row) => row.stickerNumber).length;

          const pending =
            total - generated;

          const percent =
            total > 0
              ? Math.round((generated / total) * 100)
              : 0;

          const dispatched =
            group.rows.filter((row) =>
              String(row.status || "")
                .toUpperCase()
                .includes("DISPATCH")
            ).length;

          return {
            ...group,
            total,
            generated,
            pending,
            percent,
            dispatched,
          };
        })
        .sort((a, b) =>
          String(a.itemName).localeCompare(String(b.itemName))
        );
    }, [rows]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(groups.length / pageSize)
    );

  const safePageNo =
    Math.min(pageNo, totalPages);

  const pageStartIndex =
    (safePageNo - 1) * pageSize;

  const pageEndIndex =
    Math.min(
      pageStartIndex + pageSize,
      groups.length
    );

  const paginatedGroups =
    useMemo(() => {
      return groups.slice(
        pageStartIndex,
        pageEndIndex
      );
    }, [
      groups,
      pageStartIndex,
      pageEndIndex,
    ]);

  useEffect(() => {
    setPageNo(1);
  }, [
    rows.length,
    pageSize,
  ]);

  useEffect(() => {
    if (pageNo > totalPages) {
      setPageNo(totalPages);
    }
  }, [
    pageNo,
    totalPages,
  ]);

  const totals =
    useMemo(() => {
      const totalPackets =
        rows.length;

      const generated =
        rows.filter((row) => row.stickerNumber).length;

      const pending =
        totalPackets - generated;

      const masters =
        groups.length;

      return {
        masters,
        totalPackets,
        generated,
        pending,
        percent:
          totalPackets > 0
            ? Math.round((generated / totalPackets) * 100)
            : 0,
      };
    }, [rows, groups]);

  const toggleGroup = (key) => {
    setOpenMap((prev) => {
      const willOpen = !prev[key];

      return willOpen
        ? {
          [key]: true,
        }
        : {};
    });
  };

  return (
    <Box sx={inventoryWorkbenchShellSx}>
      <Box sx={inventoryHeroSx}>
        <Box>
          <Box sx={inventoryChipRowSx}>
            <Chip
              label="INVENTORY WORKBENCH"
              sx={inventoryLabelChipSx}
            />

            <Chip
              label={`${totals.masters} Master Items`}
              sx={inventorySoftChipSx}
            />

            <Chip
              label={`${totals.percent}% Sticker Health`}
              sx={totals.pending > 0 ? inventoryWarnChipSx : inventoryOkChipSx}
            />
          </Box>

          <Box sx={inventoryHeroTitleSx}>
            Master Item Packet Control
          </Box>

          <Box sx={inventoryHeroSubSx}>
            Review every master item with its packet-wise sticker status,
            PDF preview, download, reprint and packet expansion in one place.
          </Box>
        </Box>

        <Box sx={inventoryHeroStatsSx}>
          <InventoryMiniStat
            label="Packets"
            value={totals.totalPackets}
            accent="#60a5fa"
          />

          <InventoryMiniStat
            label="Generated"
            value={totals.generated}
            accent="#22c55e"
          />

          <InventoryMiniStat
            label="Pending"
            value={totals.pending}
            accent="#f59e0b"
          />
        </Box>
      </Box>

      <Box sx={inventorySectionListSx}>
        {paginatedGroups.map((group) => {
          const isOpen =
            Boolean(openMap[group.key]);

          const accent =
            group.pending > 0
              ? "#f59e0b"
              : "#22c55e";

          return (
            <Box
              key={group.key}
              sx={inventoryMasterCardSx(accent, isOpen)}
            >
              <Box sx={inventoryMasterHeaderSx}>
                <Box sx={inventoryMasterLeftSx}>
                  <IconButton
                    disableRipple
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(group.key);
                    }}
                    sx={inventoryExpandBtnSx}
                    aria-label={isOpen ? "Collapse master item" : "Expand master item"}
                  >
                    <Box component="span" sx={inventoryExpandSymbolSx}>
                      {isOpen ? "−" : "+"}
                    </Box>
                  </IconButton>

                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={inventoryMasterTitleRowSx}>
                      <Box sx={inventoryMasterTitleSx}>
                        {group.itemName}
                      </Box>

                      <Chip
                        size="small"
                        label={`${group.total} Packets`}
                        sx={inventorySoftChipSx}
                      />

                      <Chip
                        size="small"
                        label={group.plantCode}
                        sx={inventoryPlantMiniChipSx}
                      />
                    </Box>

                    <Box sx={inventoryMasterMetaSx}>
                      Client: {group.clientName} • PD: {group.pdNo} • DWG: {group.drawingNo}
                    </Box>
                  </Box>
                </Box>

                <Box sx={inventoryMasterRightSx}>
                  <Box sx={inventoryProgressBlockSx}>
                    <Box sx={inventoryProgressTopSx}>
                      <span>Sticker Progress</span>
                      <b>{group.percent}%</b>
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={group.percent}
                      sx={inventoryProgressSx(accent)}
                    />
                  </Box>

                  <Box sx={inventoryMasterCountSx}>
                    <span>{group.generated}</span>
                    Generated
                  </Box>

                  <Box sx={inventoryMasterCountSx}>
                    <span>{group.pending}</span>
                    Pending
                  </Box>
                </Box>
              </Box>

              <Collapse
                in={isOpen}
                timeout={220}
                unmountOnExit
                sx={inventoryCollapseSx}
              >
                <Box sx={inventoryPacketTableSx}>
                  <Box sx={inventoryPacketHeadSx}>
                    <div>Packet</div>
                    <div>SKU</div>
                    <div>Description</div>
                    <div>Location</div>
                    <div>Sticker</div>
                    <div>Actions</div>
                  </Box>

                  {group.rows.map((row) => (
                    <Box
                      key={row.itemId || row.id || row.packetItemId}
                      sx={inventoryPacketRowSx}
                    >
                      <Box sx={inventoryPacketTextSx}>
                        {row.packetNumber ||
                          (row.sku?.match(/Pkt-\d+/)?.[0]) ||
                          "—"}
                      </Box>

                      <Box sx={inventoryPacketMonoSx}>
                        {row.sku || "—"}
                      </Box>

                      <Box sx={inventoryPacketSubSx}>
                        {row.description || "—"}
                      </Box>

                      <Box sx={inventoryPacketSubSx}>
                        {row.currentLocationCode ||
                          row.location ||
                          row.packedAreaCode ||
                          "—"}
                      </Box>

                      <Box>
                        <Chip
                          size="small"
                          label={
                            row.stickerNumber
                              ? row.stickerNumber
                              : "Not Generated"
                          }
                          sx={
                            row.stickerNumber
                              ? printedChipSx
                              : createdChipSx
                          }
                        />
                      </Box>

                      <Box sx={inventoryPacketActionsSx}>
                        <Button
                          size="small"
                          onClick={() => onGenerate(row)}
                          disabled={row.stickerNumber && !isAdmin}
                          sx={inventoryMiniBtnSx("#60a5fa")}
                        >
                          {row.stickerNumber && isAdmin
                            ? "Reprint"
                            : row.stickerNumber
                              ? "Generated"
                              : "Generate"}
                        </Button>

                        {row.stickerNumber && (
                          <>
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreviewSticker(row);
                              }}
                              sx={inventoryMiniBtnSx("#a78bfa")}
                            >
                              Preview
                            </Button>

                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadSticker(row);
                              }}
                              sx={inventoryMiniBtnSx("#22c55e")}
                            >
                              Download
                            </Button>
                          </>
                        )}

                        <Button
                          size="small"
                          onClick={() => onEdit(row)}
                          sx={inventoryMiniBtnSx("#f59e0b")}
                        >
                          Edit
                        </Button>
                      </Box>
                    </Box>
                  ))}

                  <Box sx={inventoryPacketFooterSx}>
                    <Button
                      size="small"
                      onClick={() => onAdd(group.rows[group.rows.length - 1])}
                      sx={inventoryMiniBtnSx("#60a5fa")}
                    >
                      + Add Packets
                    </Button>

                    <Button
                      size="small"
                      onClick={() => onCustomAdd(group.rows[group.rows.length - 1])}
                      sx={inventoryMiniBtnSx("#22c55e")}
                    >
                      + Custom Packet
                    </Button>
                  </Box>
                </Box>
              </Collapse>
            </Box>
          );
        })}

        {groups.length === 0 && (
          <Box sx={inventoryEmptyWorkbenchSx}>
            No master items found for current filters.
          </Box>
        )}
      </Box>

      {groups.length > 0 && (
        <Box sx={inventoryWorkbenchPaginationSx}>
          <Box sx={inventoryPaginationLeftSx}>
            <Box sx={inventoryPaginationTextSx}>
              Showing{" "}
              <b>
                {pageStartIndex + 1}
              </b>
              {" - "}
              <b>
                {pageEndIndex}
              </b>
              {" of "}
              <b>
                {groups.length}
              </b>
              {" master items"}
            </Box>
          </Box>

          <Box sx={inventoryPaginationCenterSx}>
            <Button
              disabled={safePageNo === 1}
              onClick={() =>
                setPageNo((prev) =>
                  Math.max(1, prev - 1)
                )
              }
              sx={inventoryPaginationButtonSx}
            >
              ◀ Previous
            </Button>

            <Box sx={inventoryPageCountSx}>
              Page{" "}
              <span>
                {safePageNo}
              </span>
              {" of "}
              {totalPages}
            </Box>

            <Button
              disabled={safePageNo === totalPages}
              onClick={() =>
                setPageNo((prev) =>
                  Math.min(totalPages, prev + 1)
                )
              }
              sx={{
                ...inventoryPaginationButtonSx,
                background:
                  "linear-gradient(180deg,#2563eb,#1d4ed8)",
              }}
            >
              Next ▶
            </Button>
          </Box>

          <Box sx={inventoryPaginationRightSx}>
            <Box sx={inventoryPaginationTextSx}>
              Show
            </Box>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageNo(1);
              }}
              style={inventoryPageSizeSelectStyle}
            >
              <option value={6}>6</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>

            <Box sx={inventoryPaginationTextSx}>
              per page
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function InventoryMiniStat({
  label,
  value,
  accent,
}) {
  return (
    <Box sx={inventoryMiniStatSx(accent)}>
      <Box sx={inventoryMiniStatValueSx}>
        {value}
      </Box>

      <Box sx={inventoryMiniStatLabelSx}>
        {label}
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

  const {
    user: currentUser,
    role: authRole,
  } = useAuth();

  const cleanRole = String(
    currentUser?.role ||
    authRole ||
    ""
  )
    .replace(/^ROLE_/i, "")
    .trim()
    .toUpperCase();

  const isAdmin =
    cleanRole === "ADMIN";

  const isHardwarePacking =
    cleanRole === "HARDWARE_PACKING";

  const getAuthHeaders = () => ({});

  const authFetch = (
    url,
    options = {}
  ) => {
    const headers = new Headers(options.headers || {});

    headers.delete("Authorization");
    headers.delete("X-Username");

    const finalOptions = {
      ...options,
      credentials: "include",
      cache: "no-store",
      headers,
    };

    if ([...headers.keys()].length === 0) {
      delete finalOptions.headers;
    }

    return fetch(url, finalOptions);
  };

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
  const [masterWorkbenchOpen, setMasterWorkbenchOpen] = useState(false);
  const [generatedHistoryRows, setGeneratedHistoryRows] = useState([]);
  const [generatedHistoryLoading, setGeneratedHistoryLoading] = useState(false);
  const [generatedHistoryUsers, setGeneratedHistoryUsers] = useState([]);
  const [generatedHistoryUserFilter, setGeneratedHistoryUserFilter] = useState("ALL");
  const [generatedHistorySearch, setGeneratedHistorySearch] = useState("");
  const [generatedHistoryFilters, setGeneratedHistoryFilters] = useState({
    client: "",
    pdNo: "",
    sku: "",
    itemName: "",
    drawingNo: "",
    stickerNumber: "",
    packetNumber: "",
  });
  const [generatedHistoryReportMode, setGeneratedHistoryReportMode] =
    useState("DETAILED");

  const [stickerReviewMode, setStickerReviewMode] = useState("GENERATE");

  const [generatedHistoryDateFrom, setGeneratedHistoryDateFrom] =
    useState("");


  const [generatedHistoryDateTo, setGeneratedHistoryDateTo] =
    useState("");

  const [generatedHistoryTimeFrom, setGeneratedHistoryTimeFrom] =
    useState("");

  const [generatedHistoryTimeTo, setGeneratedHistoryTimeTo] =
    useState("");
  const [generatedHistoryPageNo, setGeneratedHistoryPageNo] =
    useState(1);

  const [generatedHistoryPageSize, setGeneratedHistoryPageSize] =
    useState(50);
  const [historyPdfPreview, setHistoryPdfPreview] = useState(null);
  const [stickerReviewOpen, setStickerReviewOpen] = useState(false);
  const [stickerReviewLoading, setStickerReviewLoading] = useState(false);
  const [stickerReviewPdf, setStickerReviewPdf] = useState(null);
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

  const [hardwarePacketOpen, setHardwarePacketOpen] =
    useState(false);

  const [hardwareEditingItem, setHardwareEditingItem] =
    useState(null);

  const [hardwareSaving, setHardwareSaving] =
    useState(false);

  const [hardwareForm, setHardwareForm] =
    useState({
      itemName: "",
      pdNo: "",
      drawingNo: "",
      clientName: "",
      clientAddress: "",
      floor: "",
      plantCode: "",
    });

  const [hardwareLines, setHardwareLines] =
    useState([
      {
        lineNo: 1,
        itemName: "",
        quantity: "",
        uom: "Nos",
      },
    ]);

  const hardwareUomOptions = [
    "Nos",
    "Set",
    "Pair",
    "Box",
    "Packet",
    "Meter",
    "Kg",
    "Gram",
    "MM",
  ];

  const buildHardwareDescription = (
    lines = []
  ) => {
    if (!Array.isArray(lines) || lines.length === 0) {
      return "";
    }

    return lines
      .map((line, index) => {
        const lineNo =
          line?.lineNo ||
          line?.serialNo ||
          index + 1;

        const itemName =
          String(line?.itemName || "").trim();

        const quantity =
          line?.quantity ?? "";

        const uom =
          String(line?.uom || "Nos").trim();

        return `${lineNo}. ${itemName || "Hardware Item"} - Qty: ${quantity || "0"} ${uom}`;
      })
      .join("\n");
  };

  const normalizeHardwarePacketRow = (
    raw
  ) => {
    const lines =
      Array.isArray(raw?.lines)
        ? raw.lines
        : Array.isArray(raw?.hardwareLines)
          ? raw.hardwareLines
          : Array.isArray(raw?.items)
            ? raw.items
            : [];

    return {
      ...raw,

      itemId:
        raw?.itemId ||
        raw?.packetItemId ||
        raw?.id ||
        "",

      packetItemId:
        raw?.packetItemId ||
        raw?.itemId ||
        raw?.id ||
        "",

      itemType: "HARDWARE",

      itemName:
        raw?.itemName ||
        raw?.packetName ||
        "Hardware Packet",

      packetNumber:
        raw?.packetNumber ||
        raw?.packetNo ||
        "",

      description:
        raw?.description ||
        buildHardwareDescription(lines),

      quantity:
        raw?.quantity ??
        1,

      lines,
      hardwareLines: lines,

      weight: "",
      dimensions: "",
      remarks: "",
    };
  };

  const hardwarePacketBasePath =
    "/api/hardware-packets";

  const getStickerPreviewPath = (
    rowOrId
  ) => {
    const itemId =
      getPacketItemIdForSticker(rowOrId);

    if (!itemId) {
      return "";
    }

    if (isHardwarePacking) {
      return `${hardwarePacketBasePath}/${encodeURIComponent(
        itemId
      )}/preview-sticker`;
    }

    return `/api/packets/items/${encodeURIComponent(
      itemId
    )}/preview-sticker`;
  };

  const getStickerGeneratePath = (
    rowOrId
  ) => {
    const itemId =
      getPacketItemIdForSticker(rowOrId);

    if (!itemId) {
      return "";
    }

    if (isHardwarePacking) {
      return `${hardwarePacketBasePath}/${encodeURIComponent(
        itemId
      )}/generate-sticker`;
    }

    return `/api/packets/items/${encodeURIComponent(
      itemId
    )}/generate-sticker`;
  };

  const getDeletePacketPath = (
    rowOrId
  ) => {
    const itemId =
      getPacketItemIdForSticker(rowOrId);

    if (!itemId) {
      return "";
    }

    if (isHardwarePacking) {
      return `${hardwarePacketBasePath}/${encodeURIComponent(
        itemId
      )}`;
    }

    return `/api/packets/items/${encodeURIComponent(
      itemId
    )}`;
  };

  const getUpdatePacketPath = (
    rowOrId
  ) => {
    const itemId =
      getPacketItemIdForSticker(rowOrId);

    if (!itemId) {
      return "";
    }

    if (isHardwarePacking) {
      return `${hardwarePacketBasePath}/${encodeURIComponent(
        itemId
      )}`;
    }

    if (isAdmin) {
      return `/api/packets/items/${encodeURIComponent(
        itemId
      )}/admin-sticker-details`;
    }

    return `/api/packets/items/${encodeURIComponent(
      itemId
    )}`;
  };

  const fetchMyPlants = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/plants/my`, {
        method: "GET",
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

  const getSafeValue = (value) => {
    return value !== undefined && value !== null && value !== ""
      ? value
      : "—";
  };

  const getPlantByCode = (plantCode) => {
    if (!plantCode) return null;

    return myPlants.find(
      (p) => p.plantCode === plantCode
    );
  };

  const plantLabel = (plant) => {
    if (!plant) return "";

    return plant.plantCode || "";
  };

  const plantLabelByCode = (plantCode) => {
    if (!plantCode) return "Unassigned";

    const plant = getPlantByCode(plantCode);

    return plant?.plantCode || plantCode;
  };

  const packingLocationByCode = (plantCode) => {
    const plant = getPlantByCode(plantCode);

    return getSafeValue(plant?.packedAreaCode);
  };

  const getPlantCodeOnly = (row) => {
    return getSafeValue(row?.plantCode);
  };

  const getPackingLocationCode = (row) => {
    if (!row) return "—";

    const plant = getPlantByCode(row.plantCode);

    return getSafeValue(
      row.packedAreaCode ||
      plant?.packedAreaCode ||
      row.currentLocationCode ||
      row.location
    );
  };

  const getFormPlantCodeOnly = () => {
    return getSafeValue(form.plantCode);
  };

  const getFormPackingLocationCode = () => {
    return packingLocationByCode(form.plantCode);
  };

  const getPdfPreviewSrc = (url) => {
    if (!url) return "";

    return `${url}#toolbar=0&navpanes=0&scrollbar=1`;
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

  const itemInfoFields = [
    {
      key: "itemName",
      label: "Item Name",
      placeholder: "Enter item/product name",
    },
    {
      key: "pdNo",
      label: "PD No.",
      placeholder: "Enter production/design number",
    },
    {
      key: "drawingNo",
      label: "Drawing No.",
      placeholder: "Enter drawing reference number",
    },
    {
      key: "clientName",
      label: "Client Name",
      placeholder: "Enter client/customer name",
    },
    {
      key: "clientAddress",
      label: "Client Address",
      placeholder: "Enter client delivery/address details",
    },
    {
      key: "floor",
      label: "Floor / Area",
      placeholder: "Enter floor or area detail",
    },
  ];

  const packetDetailLabels = {
    description: "Packet Description",
    weight: "Packet Weight",
    remarks: "Packet Remarks",
    length: "Length",
    breadth: "Breadth",
    height: "Height",
  };

  const renderFormTextField = ({
    key,
    label,
    placeholder,
    type = "text",
  }) => {
    return (
      <TextField
        key={key}
        label={label}
        placeholder={placeholder}
        fullWidth
        type={type}
        value={form[key] || ""}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [key]: e.target.value,
          }))
        }
        error={!!errors[key]}
        helperText={errors[key]}
        sx={formFieldSx(darkMode)}
      />
    );
  };

  const renderPlantSelect = () => {
    return (
      <>
        <TextField
          select
          label="Plant"
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
              : "Select assigned plant")
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
                {plant.plantCode}
              </MenuItem>
            ))
          )}
        </TextField>

        {form.plantCode && (
          <Box sx={plantAccessInfoCardSx}>
            <Box sx={plantAccessInfoItemSx}>
              <Box sx={plantAccessLabelSx}>
                Plant
              </Box>

              <Box sx={plantAccessValueSx}>
                {getFormPlantCodeOnly()}
              </Box>
            </Box>

            <Box sx={plantAccessInfoItemSx}>
              <Box sx={plantAccessLabelSx}>
                Location
              </Box>

              <Box sx={plantAccessValueSx}>
                {getFormPackingLocationCode()}
              </Box>
            </Box>
          </Box>
        )}
      </>
    );
  };

  const fetchItems = async () => {
    setLoading(true);

    try {
      const path =
        isHardwarePacking
          ? "/api/hardware-packets"
          : "/api/packets/items";

      const res =
        await authFetch(
          `${API_BASE_URL}${path}`,
          {
            method: "GET",
          }
        );

      if (!res.ok) {
        const text =
          await res.text();

        console.error(
          "Inventory API ERROR:",
          text
        );

        throw new Error(
          text ||
          "Failed to fetch inventory items"
        );
      }

      const payload =
        await res.json();

      const data =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.rows)
                ? payload.rows
                : [];

      const finalRows =
        isHardwarePacking
          ? data.map(normalizeHardwarePacketRow)
          : data;

      setRows(finalRows);
      setRowCount(finalRows.length);
    } catch (error) {
      console.error(
        "Inventory fetch failed:",
        error
      );

      setRows([]);
      setRowCount(0);

      showUiAlert(
        "error",
        error?.message ||
        "Failed to load inventory"
      );
    } finally {
      setLoading(false);
    }
  };

  usePackFlowDataRefresh(
    "inventory",
    async () => {
      await fetchItems();
    }
  );

  const IST_OFFSET_MINUTES = 330;

  const parseAppDateTime = (value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? null
        : value;
    }

    let raw =
      String(value)
        .trim()
        .replace(" ", "T");

    if (!raw) return null;

    raw =
      raw.replace(
        /\.(\d{3})\d+/,
        ".$1"
      );

    const hasTimezone =
      /[zZ]$/.test(raw) ||
      /[+-]\d{2}:?\d{2}$/.test(raw);

    if (hasTimezone) {
      const date =
        new Date(raw);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    const match =
      raw.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/
      );


    if (!match) {
      const fallback =
        new Date(raw);

      return Number.isNaN(fallback.getTime())
        ? null
        : fallback;
    }

    const utcMs =
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0)
      ) -
      IST_OFFSET_MINUTES * 60 * 1000;

    return new Date(utcMs);
  };

  const normalizeUtcDateTime = (value) => {
    const date =
      parseAppDateTime(value);

    return date
      ? date.toISOString()
      : null;
  };

  const formatHistoryDateTime = (value) => {
    if (!value) return "—";

    try {
      const normalized =
        normalizeUtcDateTime(value);

      const date = new Date(normalized);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return value;
    }
  };

  const openGeneratedHistory = async () => {
    setGeneratedHistoryOpen(true);
    resetGeneratedHistoryFilters();
    setGeneratedHistoryUserFilter("ALL");
    setGeneratedHistoryRows([]);
    setGeneratedHistoryUsers([]);

    if (historyPdfPreview?.url) {
      URL.revokeObjectURL(historyPdfPreview.url);
    }

    setHistoryPdfPreview(null);

    await fetchGeneratedHistoryUsers();
    await fetchGeneratedHistory("ALL");
  };

  const fetchGeneratedHistoryUsers = async () => {
    try {
      const res = await API.get(
        "/stickers/generated-history/users"
      );

      const data = res.data;

      setGeneratedHistoryUsers(
        Array.isArray(data)
          ? data.filter(Boolean)
          : []
      );
    } catch (e) {
      console.error("Generated history users failed:", e);

      setGeneratedHistoryUsers([]);

      showUiAlert(
        "error",
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load generated history users"
      );
    }
  };

  const fetchGeneratedHistory = async (
    userFilter = generatedHistoryUserFilter
  ) => {
    try {
      setGeneratedHistoryLoading(true);

      const params = {};

      if (userFilter && userFilter !== "ALL") {
        params.generatedBy = userFilter;
      }

      const res = await API.get(
        "/stickers/generated-history",
        {
          params,
        }
      );

      const data = res.data;

      setGeneratedHistoryRows(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (e) {
      console.error("Generated history failed:", e);

      setGeneratedHistoryRows([]);

      showUiAlert(
        "error",
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load generated history"
      );
    } finally {
      setGeneratedHistoryLoading(false);
    }
  };

  const openHistoryPdf = async (historyId) => {
    if (!historyId) {
      showUiAlert("error", "History id missing");
      return;
    }

    try {
      const res = await API.get(
        `/stickers/history/${historyId}/download-pdf`,
        {
          responseType: "blob",
          headers: {
            Accept: "application/pdf",
          },
        }
      );

      const blob = res.data;
      const url = URL.createObjectURL(blob);

      if (historyPdfPreview?.url) {
        URL.revokeObjectURL(historyPdfPreview.url);
      }

      setHistoryPdfPreview({
        historyId,
        url,
      });
    } catch (e) {
      console.error("Generated history PDF failed:", e);

      showUiAlert(
        "error",
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to open sticker PDF"
      );
    }
  };

  const closeHistoryPdfPreview = () => {
    if (historyPdfPreview?.url) {
      URL.revokeObjectURL(historyPdfPreview.url);
    }

    setHistoryPdfPreview(null);
  };

  const closeGeneratedHistoryModal = () => {
    setGeneratedHistoryOpen(false);
    closeHistoryPdfPreview();
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


  useEffect(() => {
    setPageNo((currentPage) =>
      Math.min(
        Math.max(
          1,
          currentPage
        ),
        totalPages
      )
    );
  }, [totalPages]);

  const normalizeHistorySearch = (value) => {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  };

  const historyFieldValue = (row, field) => {
    if (!row) return "";

    if (field === "client") {
      return [
        row.clientName,
        row.clientAddress,
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (field === "pdNo") {
      return row.pdNo || "";
    }

    if (field === "sku") {
      return row.sku || "";
    }

    if (field === "itemName") {
      return row.itemName || "";
    }

    if (field === "drawingNo") {
      return row.drawingNo || "";
    }

    if (field === "stickerNumber") {
      return row.stickerNumber || "";
    }

    if (field === "packetNumber") {
      return row.packetNumber || "";
    }

    return row?.[field] || "";
  };

  const historyAnyAttributeText = (row) => {
    if (!row) return "";

    return Object.values(row)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
      .join(" ")
      .toLowerCase();
  };

  const splitSmartSearchTerms = (value) => {
    const text = String(value || "").trim();

    if (!text) return [];

    const matches =
      text.match(/"([^"]+)"|\S+/g) || [];

    return matches.map((term) =>
      term.replace(/^"|"$/g, "").trim()
    ).filter(Boolean);
  };

  const smartFieldAliases = {
    client: ["client"],
    party: ["client"],
    customer: ["client"],

    pd: ["pdNo"],
    pdno: ["pdNo"],
    "pd-no": ["pdNo"],

    sku: ["sku"],
    code: ["sku"],

    name: ["itemName"],
    item: ["itemName"],
    itemname: ["itemName"],

    dwg: ["drawingNo"],
    drawing: ["drawingNo"],
    drawingno: ["drawingNo"],
    "dwg-no": ["drawingNo"],

    sticker: ["stickerNumber"],
    stickerno: ["stickerNumber"],

    packet: ["packetNumber", "sku"],
    pkt: ["packetNumber", "sku"],

    by: ["generatedBy"],
    user: ["generatedBy"],
    generatedby: ["generatedBy"],

    desc: ["description"],
    description: ["description"],

    remarks: ["remarks"],
    remark: ["remarks"],

    floor: ["floor"],
    weight: ["weight"],
    dimension: ["dimensions"],
    dimensions: ["dimensions"],
    reason: ["reason"],
  };

  const rowMatchesSmartHistorySearch = (row, searchText) => {
    const terms = splitSmartSearchTerms(searchText);

    if (terms.length === 0) return true;

    return terms.every((rawTerm) => {
      const term = normalizeHistorySearch(rawTerm);

      if (!term) return true;

      const colonIndex = term.indexOf(":");

      if (colonIndex > 0) {
        const rawKey = term.slice(0, colonIndex).trim();
        const rawValue = term.slice(colonIndex + 1).trim();

        if (!rawValue) return true;

        const fields = smartFieldAliases[rawKey];

        if (!fields || fields.length === 0) {
          return historyAnyAttributeText(row).includes(term);
        }

        return fields.some((field) =>
          normalizeHistorySearch(
            historyFieldValue(row, field)
          ).includes(rawValue)
        );
      }

      return historyAnyAttributeText(row).includes(term);
    });
  };

  const rowMatchesGeneratedHistoryFilters = (row) => {
    const filters = [
      {
        value: generatedHistoryFilters.client,
        fields: ["client"],
      },
      {
        value: generatedHistoryFilters.pdNo,
        fields: ["pdNo"],
      },
      {
        value: generatedHistoryFilters.sku,
        fields: ["sku"],
      },
      {
        value: generatedHistoryFilters.itemName,
        fields: ["itemName"],
      },
      {
        value: generatedHistoryFilters.drawingNo,
        fields: ["drawingNo"],
      },
      {
        value: generatedHistoryFilters.stickerNumber,
        fields: ["stickerNumber"],
      },
      {
        value: generatedHistoryFilters.packetNumber,
        fields: ["packetNumber", "sku"],
      },
    ];

    return filters.every((filter) => {
      const value = normalizeHistorySearch(filter.value);

      if (!value) return true;

      return filter.fields.some((field) =>
        normalizeHistorySearch(
          historyFieldValue(row, field)
        ).includes(value)
      );
    });
  };

  const updateGeneratedHistoryFilter = (key, value) => {
    setGeneratedHistoryFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetGeneratedHistoryFilters = () => {
    setGeneratedHistorySearch("");

    setGeneratedHistoryFilters({
      client: "",
      pdNo: "",
      sku: "",
      itemName: "",
      drawingNo: "",
      stickerNumber: "",
      packetNumber: "",
    });

    setGeneratedHistoryDateFrom("");
    setGeneratedHistoryDateTo("");
    setGeneratedHistoryTimeFrom("");
    setGeneratedHistoryTimeTo("");
    setGeneratedHistoryReportMode("DETAILED");
  };

  const generatedHistoryReportModes = [
    {
      value: "DETAILED",
      label: "Detailed History",
    },
    {
      value: "CLIENT",
      label: "By Client",
    },
    {
      value: "SKU",
      label: "By SKU",
    },
    {
      value: "DWG",
      label: "By DWG No",
    },
    {
      value: "PD",
      label: "By PD No",
    },
    {
      value: "DESCRIPTION",
      label: "By Description",
    },
    {
      value: "DATE",
      label: "By Date",
    },
    {
      value: "HOUR",
      label: "By Hour",
    },
    {
      value: "GENERATED_BY",
      label: "By Generated User",
    },
    {
      value: "REASON",
      label: "Initial / Reprint",
    },
    {
      value: "CLIENT_SKU",
      label: "Client + SKU",
    },
    {
      value: "CLIENT_DWG",
      label: "Client + DWG",
    },
    {
      value: "CLIENT_PD",
      label: "Client + PD",
    },
    {
      value: "SKU_DWG",
      label: "SKU + DWG",
    },
    {
      value: "DATE_CLIENT",
      label: "Date + Client",
    },
    {
      value: "DATE_SKU",
      label: "Date + SKU",
    },
  ];

  const getHistoryDateParts = (value) => {
    if (!value) return null;

    try {
      const normalized =
        normalizeUtcDateTime(value);

      const date =
        new Date(normalized);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      const parts =
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(date);

      const map = {};

      parts.forEach((part) => {
        map[part.type] = part.value;
      });

      const hour =
        map.hour === "24" ? "00" : map.hour;

      return {
        date: `${map.year}-${map.month}-${map.day}`,
        time: `${hour}:${map.minute}`,
        hour,
        minutes: Number(hour) * 60 + Number(map.minute),
      };
    } catch {
      return null;
    }
  };

  const timeToMinutes = (value) => {
    if (!value) return null;

    const [hour, minute] =
      String(value)
        .split(":")
        .map(Number);

    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }

    return hour * 60 + minute;
  };

  const rowMatchesGeneratedHistoryDateTime = (row) => {
    const parts =
      getHistoryDateParts(row?.generatedAt);

    if (!parts) return true;

    if (
      generatedHistoryDateFrom &&
      parts.date < generatedHistoryDateFrom
    ) {
      return false;
    }

    if (
      generatedHistoryDateTo &&
      parts.date > generatedHistoryDateTo
    ) {
      return false;
    }

    const fromMinutes =
      timeToMinutes(generatedHistoryTimeFrom);

    const toMinutes =
      timeToMinutes(generatedHistoryTimeTo);

    if (
      fromMinutes !== null &&
      parts.minutes < fromMinutes
    ) {
      return false;
    }

    if (
      toMinutes !== null &&
      parts.minutes > toMinutes
    ) {
      return false;
    }

    return true;
  };

  const filteredGeneratedHistoryRows = useMemo(() => {
    const list =
      Array.isArray(generatedHistoryRows)
        ? generatedHistoryRows
        : [];

    return list.filter((row) => {
      return (
        rowMatchesSmartHistorySearch(
          row,
          generatedHistorySearch
        ) &&
        rowMatchesGeneratedHistoryFilters(row) &&
        rowMatchesGeneratedHistoryDateTime(row)
      );
    });
  }, [
    generatedHistoryRows,
    generatedHistorySearch,
    generatedHistoryFilters,
    generatedHistoryDateFrom,
    generatedHistoryDateTo,
    generatedHistoryTimeFrom,
    generatedHistoryTimeTo,
  ]);

  const safeReportValue = (value) => {
    const text =
      String(value ?? "")
        .trim();

    return text || "Unassigned";
  };

  const getHistoryReportKey = (row, mode) => {
    const parts =
      getHistoryDateParts(row?.generatedAt);

    const date =
      parts?.date || "Unknown Date";

    const hour =
      parts?.hour ? `${parts.hour}:00 - ${parts.hour}:59` : "Unknown Hour";

    const client =
      safeReportValue(row?.clientName);

    const sku =
      safeReportValue(row?.sku);

    const dwg =
      safeReportValue(row?.drawingNo);

    const pd =
      safeReportValue(row?.pdNo);

    const description =
      safeReportValue(row?.description);

    const generatedBy =
      safeReportValue(row?.generatedBy);

    const reason =
      row?.reason === "REPRINT"
        ? "Reprint"
        : "Initial";

    if (mode === "CLIENT") return client;
    if (mode === "SKU") return sku;
    if (mode === "DWG") return dwg;
    if (mode === "PD") return pd;
    if (mode === "DESCRIPTION") return description;
    if (mode === "DATE") return date;
    if (mode === "HOUR") return hour;
    if (mode === "GENERATED_BY") return generatedBy;
    if (mode === "REASON") return reason;

    if (mode === "CLIENT_SKU") {
      return `${client} | ${sku}`;
    }

    if (mode === "CLIENT_DWG") {
      return `${client} | ${dwg}`;
    }

    if (mode === "CLIENT_PD") {
      return `${client} | ${pd}`;
    }

    if (mode === "SKU_DWG") {
      return `${sku} | ${dwg}`;
    }

    if (mode === "DATE_CLIENT") {
      return `${date} | ${client}`;
    }

    if (mode === "DATE_SKU") {
      return `${date} | ${sku}`;
    }

    return "Detailed";
  };

  const getHistoryReportLabel = (mode) => {
    return generatedHistoryReportModes.find(
      (item) => item.value === mode
    )?.label || "Report";
  };

  const generatedHistoryReportRows = useMemo(() => {
    if (generatedHistoryReportMode === "DETAILED") {
      return [];
    }

    const map =
      new Map();

    filteredGeneratedHistoryRows.forEach((row) => {
      const key =
        getHistoryReportKey(
          row,
          generatedHistoryReportMode
        );

      if (!map.has(key)) {
        map.set(key, {
          key,
          reportType: getHistoryReportLabel(generatedHistoryReportMode),
          totalPackets: 0,
          initialCount: 0,
          reprintCount: 0,
          clients: new Set(),
          skus: new Set(),
          pdNos: new Set(),
          dwgNos: new Set(),
          itemNames: new Set(),
          descriptions: new Set(),
          generatedByUsers: new Set(),
          firstGeneratedAt: row.generatedAt,
          lastGeneratedAt: row.generatedAt,
        });
      }

      const item =
        map.get(key);

      item.totalPackets += 1;

      if (row.reason === "REPRINT") {
        item.reprintCount += 1;
      } else {
        item.initialCount += 1;
      }

      if (row.clientName) item.clients.add(row.clientName);
      if (row.sku) item.skus.add(row.sku);
      if (row.pdNo) item.pdNos.add(row.pdNo);
      if (row.drawingNo) item.dwgNos.add(row.drawingNo);
      if (row.itemName) item.itemNames.add(row.itemName);
      if (row.description) item.descriptions.add(row.description);
      if (row.generatedBy) item.generatedByUsers.add(row.generatedBy);

      const currentDate =
        new Date(normalizeUtcDateTime(row.generatedAt));

      const firstDate =
        new Date(normalizeUtcDateTime(item.firstGeneratedAt));

      const lastDate =
        new Date(normalizeUtcDateTime(item.lastGeneratedAt));

      if (
        !Number.isNaN(currentDate.getTime()) &&
        (
          Number.isNaN(firstDate.getTime()) ||
          currentDate < firstDate
        )
      ) {
        item.firstGeneratedAt = row.generatedAt;
      }

      if (
        !Number.isNaN(currentDate.getTime()) &&
        (
          Number.isNaN(lastDate.getTime()) ||
          currentDate > lastDate
        )
      ) {
        item.lastGeneratedAt = row.generatedAt;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        clientsText: Array.from(item.clients).join(", ") || "—",
        skusText: Array.from(item.skus).join(", ") || "—",
        pdNosText: Array.from(item.pdNos).join(", ") || "—",
        dwgNosText: Array.from(item.dwgNos).join(", ") || "—",
        itemNamesText: Array.from(item.itemNames).join(", ") || "—",
        descriptionsText: Array.from(item.descriptions).join(", ") || "—",
        generatedByText: Array.from(item.generatedByUsers).join(", ") || "—",
      }))
      .sort((a, b) => b.totalPackets - a.totalPackets);
  }, [
    filteredGeneratedHistoryRows,
    generatedHistoryReportMode,
  ]);

  const activeGeneratedHistoryRows =
    generatedHistoryReportMode === "DETAILED"
      ? filteredGeneratedHistoryRows
      : generatedHistoryReportRows;

  const generatedHistoryTotalPages =
    Math.max(
      1,
      Math.ceil(
        activeGeneratedHistoryRows.length /
        generatedHistoryPageSize
      )
    );

  const generatedHistorySafePageNo =
    Math.min(
      generatedHistoryPageNo,
      generatedHistoryTotalPages
    );

  const generatedHistoryPageStart =
    (generatedHistorySafePageNo - 1) *
    generatedHistoryPageSize;

  const generatedHistoryPageEnd =
    Math.min(
      generatedHistoryPageStart + generatedHistoryPageSize,
      activeGeneratedHistoryRows.length
    );

  const generatedHistoryShowingStart =
    activeGeneratedHistoryRows.length === 0
      ? 0
      : generatedHistoryPageStart + 1;

  const paginatedGeneratedHistoryRows =
    useMemo(() => {
      return activeGeneratedHistoryRows.slice(
        generatedHistoryPageStart,
        generatedHistoryPageEnd
      );
    }, [
      activeGeneratedHistoryRows,
      generatedHistoryPageStart,
      generatedHistoryPageEnd,
    ]);

  useEffect(() => {
    setGeneratedHistoryPageNo(1);
  }, [
    generatedHistorySearch,
    generatedHistoryFilters,
    generatedHistoryDateFrom,
    generatedHistoryDateTo,
    generatedHistoryTimeFrom,
    generatedHistoryTimeTo,
    generatedHistoryReportMode,
    generatedHistoryPageSize,
    generatedHistoryUserFilter,
  ]);

  useEffect(() => {
    if (generatedHistoryPageNo > generatedHistoryTotalPages) {
      setGeneratedHistoryPageNo(generatedHistoryTotalPages);
    }
  }, [
    generatedHistoryPageNo,
    generatedHistoryTotalPages,
  ]);

  const isLastPacket = (row) => {
    const key = row.masterItemId || row.itemName;
    const current = getPacketNumber(row.sku) || 0;
    const max = maxPacketMap?.[key] || 0;

    return current >= max;
  };

  const safeExcelValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    return value;
  };

  const getActiveHistoryFilterText = () => {
    const parts = [];

    if (generatedHistorySearch) {
      parts.push(`Smart Search: ${generatedHistorySearch}`);
    }

    if (generatedHistoryUserFilter && generatedHistoryUserFilter !== "ALL") {
      parts.push(`Generated By: ${generatedHistoryUserFilter}`);
    }

    if (generatedHistoryFilters.client) {
      parts.push(`Client: ${generatedHistoryFilters.client}`);
    }

    if (generatedHistoryFilters.pdNo) {
      parts.push(`PD No: ${generatedHistoryFilters.pdNo}`);
    }

    if (generatedHistoryFilters.sku) {
      parts.push(`SKU: ${generatedHistoryFilters.sku}`);
    }

    if (generatedHistoryFilters.itemName) {
      parts.push(`Item Name: ${generatedHistoryFilters.itemName}`);
    }

    if (generatedHistoryFilters.drawingNo) {
      parts.push(`DWG No: ${generatedHistoryFilters.drawingNo}`);
    }

    if (generatedHistoryFilters.stickerNumber) {
      parts.push(`Sticker: ${generatedHistoryFilters.stickerNumber}`);
    }

    if (generatedHistoryDateFrom) {
      parts.push(`Date From: ${generatedHistoryDateFrom}`);
    }

    if (generatedHistoryDateTo) {
      parts.push(`Date To: ${generatedHistoryDateTo}`);
    }

    if (generatedHistoryTimeFrom) {
      parts.push(`Time From: ${generatedHistoryTimeFrom}`);
    }

    if (generatedHistoryTimeTo) {
      parts.push(`Time To: ${generatedHistoryTimeTo}`);
    }

    return parts.length > 0
      ? parts.join(" | ")
      : "No filters applied";
  };

  const styleGeneratedHistoryWorksheet = (
    worksheet,
    lastColumn
  ) => {
    worksheet.views = [
      {
        state: "frozen",
        ySplit: 5,
      },
    ];

    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 22;
    worksheet.getRow(3).height = 22;
    worksheet.getRow(5).height = 24;

    worksheet.mergeCells(1, 1, 1, lastColumn);
    worksheet.mergeCells(2, 1, 2, lastColumn);
    worksheet.mergeCells(3, 1, 3, lastColumn);

    const titleCell = worksheet.getCell(1, 1);
    titleCell.font = {
      bold: true,
      size: 18,
      color: { argb: "FFFFFFFF" },
    };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    titleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    const subtitleCell = worksheet.getCell(2, 1);
    subtitleCell.font = {
      bold: true,
      size: 11,
      color: { argb: "FFDBEAFE" },
    };
    subtitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    subtitleCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    const filterCell = worksheet.getCell(3, 1);
    filterCell.font = {
      bold: true,
      size: 10,
      color: { argb: "FF334155" },
    };
    filterCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFF6FF" },
    };
    filterCell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    const headerRow = worksheet.getRow(5);

    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 5) return;

      row.height = 24;

      row.eachCell((cell) => {
        cell.font = {
          size: 10,
          color: { argb: "FF0F172A" },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };

        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
      });
    });

    worksheet.autoFilter = {
      from: {
        row: 5,
        column: 1,
      },
      to: {
        row: 5,
        column: lastColumn,
      },
    };
  };

  const downloadExcelWorkbook = async (
    workbook,
    filename
  ) => {
    const buffer =
      await workbook.xlsx.writeBuffer();

    const blob =
      new Blob([buffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const exportGeneratedHistoryReport = async () => {
    try {
      const workbook =
        new ExcelJS.Workbook();

      workbook.creator = "PackFlow";
      workbook.created = new Date();

      const reportLabel =
        getHistoryReportLabel(generatedHistoryReportMode);

      const worksheet =
        workbook.addWorksheet(
          generatedHistoryReportMode === "DETAILED"
            ? "Detailed History"
            : "Packing Report"
        );

      let rows = [];
      let columns = [];

      if (generatedHistoryReportMode === "DETAILED") {
        columns = [
          { header: "Generated Date / Time", key: "generatedAt", width: 24 },
          { header: "Generated By", key: "generatedBy", width: 18 },
          { header: "Client", key: "clientName", width: 26 },
          { header: "Item Name", key: "itemName", width: 34 },
          { header: "Description", key: "description", width: 36 },
          { header: "SKU", key: "sku", width: 28 },
          { header: "PD No", key: "pdNo", width: 18 },
          { header: "DWG No", key: "drawingNo", width: 18 },
          { header: "Packet No", key: "packetNumber", width: 15 },
          { header: "Sticker No", key: "stickerNumber", width: 28 },
          { header: "Reason", key: "reason", width: 16 },
          { header: "Print Iteration", key: "printIteration", width: 16 },
          { header: "Remarks", key: "remarks", width: 32 },
          { header: "Weight", key: "weight", width: 16 },
          { header: "Dimensions", key: "dimensions", width: 26 },
        ];

        rows =
          filteredGeneratedHistoryRows.map((row) => ({
            generatedAt: formatHistoryDateTime(row.generatedAt),
            generatedBy: safeExcelValue(row.generatedBy),
            clientName: safeExcelValue(row.clientName),
            itemName: safeExcelValue(row.itemName),
            description: safeExcelValue(row.description),
            sku: safeExcelValue(row.sku),
            pdNo: safeExcelValue(row.pdNo),
            drawingNo: safeExcelValue(row.drawingNo),
            packetNumber: safeExcelValue(row.packetNumber),
            stickerNumber: safeExcelValue(row.stickerNumber),
            reason:
              row.reason === "REPRINT"
                ? `Reprint #${row.printIteration || ""}`
                : "Initial",
            printIteration: safeExcelValue(row.printIteration),
            remarks: safeExcelValue(row.remarks),
            weight: safeExcelValue(row.weight),
            dimensions: safeExcelValue(row.dimensions),
          }));
      } else {
        columns = [
          { header: "Report Type", key: "reportType", width: 24 },
          { header: "Group", key: "group", width: 38 },
          { header: "Total Packets", key: "totalPackets", width: 16 },
          { header: "Initial Count", key: "initialCount", width: 16 },
          { header: "Reprint Count", key: "reprintCount", width: 16 },
          { header: "Clients", key: "clients", width: 34 },
          { header: "SKUs", key: "skus", width: 36 },
          { header: "PD Nos", key: "pdNos", width: 28 },
          { header: "DWG Nos", key: "dwgNos", width: 28 },
          { header: "Item Names", key: "itemNames", width: 36 },
          { header: "Descriptions", key: "descriptions", width: 38 },
          { header: "Generated By", key: "generatedBy", width: 28 },
          { header: "First Generated", key: "firstGeneratedAt", width: 24 },
          { header: "Last Generated", key: "lastGeneratedAt", width: 24 },
        ];

        rows =
          generatedHistoryReportRows.map((row) => ({
            reportType: row.reportType,
            group: row.key,
            totalPackets: row.totalPackets,
            initialCount: row.initialCount,
            reprintCount: row.reprintCount,
            clients: row.clientsText,
            skus: row.skusText,
            pdNos: row.pdNosText,
            dwgNos: row.dwgNosText,
            itemNames: row.itemNamesText,
            descriptions: row.descriptionsText,
            generatedBy: row.generatedByText,
            firstGeneratedAt: formatHistoryDateTime(row.firstGeneratedAt),
            lastGeneratedAt: formatHistoryDateTime(row.lastGeneratedAt),
          }));
      }

      if (rows.length === 0) {
        showUiAlert("error", "No report data to export");
        return;
      }

      worksheet.columns = columns;

      worksheet.spliceRows(
        1,
        0,
        [`Generated Packet History - ${reportLabel}`],
        [`Exported On: ${new Date().toLocaleString("en-IN")}`],
        [`Filters: ${getActiveHistoryFilterText()}`],
        []
      );

      worksheet.addRows(rows);

      styleGeneratedHistoryWorksheet(
        worksheet,
        columns.length
      );

      const fileDate =
        new Date()
          .toISOString()
          .slice(0, 10);

      await downloadExcelWorkbook(
        workbook,
        `Generated_History_${generatedHistoryReportMode}_${fileDate}.xlsx`
      );

      showUiAlert(
        "success",
        "Excel report exported successfully"
      );
    } catch (e) {
      console.error(e);

      showUiAlert(
        "error",
        "Failed to export Excel report"
      );
    }
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

  const getPacketItemIdForSticker = (rowOrId) => {
    if (!rowOrId) {
      return "";
    }

    if (typeof rowOrId === "string") {
      return rowOrId.trim();
    }

    return (
      rowOrId.packetItemId ||
      rowOrId.itemId ||
      rowOrId.id ||
      rowOrId.packet_item_id ||
      ""
    );
  };

  const getPacketItemId = (row) => {
    return getPacketItemIdForSticker(row);
  };

  const safeFileName = (value) => {
    return String(value || "STICKER")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80);
  };

  const filenameSafe = (value) =>
    String(value || "document")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_");

  const getStickerFileName = (row) => {
    const sku =
      row?.sku ||
      row?.stickerNumber ||
      row?.itemId ||
      row?.packetItemId ||
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

  const latestStickerPdfPath = (
    rowOrId,
    download = false
  ) => {
    const packetItemId =
      getPacketItemIdForSticker(rowOrId);

    if (!packetItemId) {
      return "";
    }

    if (isHardwarePacking) {
      return `/api/hardware-packets/${encodeURIComponent(
        packetItemId
      )}/latest-sticker?download=${download ? "true" : "false"
        }`;
    }

    return `/api/inventory/stickers/packet-items/${encodeURIComponent(
      packetItemId
    )}/latest?download=${download ? "true" : "false"
      }`;
  };

  const buildProtectedFileUrl = (path) => {
    const cleanPath =
      String(path || "").trim();

    if (!cleanPath) {
      return "";
    }

    if (/^https?:\/\//i.test(cleanPath)) {
      return cleanPath;
    }

    return `${API_BASE_URL}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
  };

  const fetchProtectedPdfBlob = async (path) => {
    const url =
      buildProtectedFileUrl(path);

    if (!url) {
      throw new Error("PDF path missing");
    }

    const res =
      await authFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
        },
      });

    const contentType =
      res.headers.get("content-type") || "";

    if (!res.ok) {
      const message =
        await readApiErrorMessage(res);

      throw new Error(
        message ||
        (res.status === 401
          ? "Unauthorized. Please login again."
          : "Failed to load PDF")
      );
    }

    if (!contentType.toLowerCase().includes("pdf")) {
      const message =
        await readApiErrorMessage(res);

      throw new Error(
        message || "Backend did not return a PDF file"
      );
    }

    const blob =
      await res.blob();

    if (!blob || blob.size === 0) {
      throw new Error("Empty PDF received");
    }

    return blob;
  };

  const previewExistingStickerPdf = async (row) => {
    const packetItemId =
      getPacketItemIdForSticker(row);

    if (!packetItemId) {
      showUiAlert("error", "Packet item id missing");
      return;
    }

    const stickerNumber =
      row?.stickerNumber ||
      row?.sticker_number ||
      "";

    if (!stickerNumber) {
      showUiAlert("error", "Sticker is not generated for this packet yet");
      return;
    }

    const path =
      latestStickerPdfPath(row, false);

    try {
      setSelectedItem(row);
      setStickerReviewMode("EXISTING");
      setStickerReviewOpen(true);
      setStickerReviewLoading(true);

      if (stickerReviewPdf) {
        URL.revokeObjectURL(stickerReviewPdf);
      }

      setStickerReviewPdf(null);

      const blob =
        await fetchProtectedPdfBlob(path);

      const url =
        URL.createObjectURL(blob);

      setStickerReviewPdf(url);
    } catch (e) {
      console.error(e);

      showUiAlert(
        "error",
        e.message || "Failed to preview sticker PDF"
      );

      setStickerReviewOpen(false);
    } finally {
      setStickerReviewLoading(false);
    }
  };

  const downloadExistingStickerPdf = async (row) => {
    const packetItemId =
      getPacketItemIdForSticker(row);

    if (!packetItemId) {
      showUiAlert("error", "Packet item id missing");
      return;
    }

    const stickerNumber =
      row?.stickerNumber ||
      row?.sticker_number ||
      "";

    if (!stickerNumber) {
      showUiAlert("error", "Sticker is not generated for this packet yet");
      return;
    }

    const path =
      latestStickerPdfPath(row, true);

    try {
      const blob =
        await fetchProtectedPdfBlob(path);

      const objectUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = objectUrl;
      link.download = `Sticker_${filenameSafe(
        stickerNumber || packetItemId
      )}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (e) {
      console.error(e);

      showUiAlert(
        "error",
        e.message || "Failed to download sticker PDF"
      );
    }
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
    setStickerReviewMode("GENERATE");
    setStickerReviewPdf(null);
    setStickerReviewOpen(true);
    setStickerReviewLoading(true);

    try {
      const previewPath =
        getStickerPreviewPath(itemId);

      if (!previewPath) {
        showUiAlert(
          "error",
          "Sticker preview endpoint missing"
        );

        return;
      }

      const query =
        `factoryFloor=${encodeURIComponent(
          row.floor || ""
        )}` +
        `&showCompanyHeader=${encodeURIComponent(
          form.showCompanyHeader
        )}`;

      const res = await authFetch(
        `${API_BASE_URL}${previewPath}?${query}`,
        {
          method: "POST",
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
    if (isHardwarePacking) {
      openHardwareEditModal(row);
      return;
    }

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

  const saveHardwarePacket = async () => {
  if (!validateHardwarePacket()) {
    return;
  }

  const itemId =
    getPacketItemIdForSticker(
      hardwareEditingItem
    );

  const editing =
    Boolean(
      hardwareEditingItem &&
      itemId
    );

  /*
   * Must match HardwareLineRequest exactly:
   * - itemName
   * - quantity
   * - uom
   *
   * lineNo and id are not required by the backend request DTO.
   * The backend generates IDs and line numbers itself.
   */
  const normalizedItems =
    hardwareLines.map((line) => ({
      itemName:
        String(
          line?.itemName || ""
        ).trim(),

      quantity:
        Number(line?.quantity),

      uom:
        String(
          line?.uom || "Nos"
        ).trim(),
    }));

  const commonDetails = {
    itemName:
      String(
        hardwareForm.itemName || ""
      ).trim(),

    pdNo:
      String(
        hardwareForm.pdNo || ""
      ).trim() || null,

    drawingNo:
      String(
        hardwareForm.drawingNo || ""
      ).trim() || null,

    clientName:
      String(
        hardwareForm.clientName || ""
      ).trim() || null,

    clientAddress:
      String(
        hardwareForm.clientAddress || ""
      ).trim() || null,

    floor:
      String(
        hardwareForm.floor || ""
      ).trim() || null,

    plantCode:
      String(
        hardwareForm.plantCode || ""
      )
        .trim()
        .toUpperCase(),
  };

  /*
   * POST DTO:
   * HardwarePacketCreateRequest
   *   -> packets()
   *      -> HardwarePacketDraftRequest.items()
   *
   * PUT DTO:
   * HardwarePacketUpdateRequest.items()
   */
  const payload = editing
    ? {
        ...commonDetails,
        items: normalizedItems,
      }
    : {
        ...commonDetails,
        packets: [
          {
            items: normalizedItems,
          },
        ],
      };

  const path = editing
    ? `/api/hardware-packets/${encodeURIComponent(
        itemId
      )}`
    : "/api/hardware-packets";

  try {
    setHardwareSaving(true);

    /*
     * Keep this temporarily during testing.
     * Check the browser console before removing it.
     */
    console.log(
      "Hardware packet request payload:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    const res =
      await authFetch(
        `${API_BASE_URL}${path}`,
        {
          method:
            editing
              ? "PUT"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(payload),
        }
      );

    if (!res.ok) {
      await handleApiError(
        res,
        editing
          ? "Update hardware packet failed"
          : "Create hardware packet failed"
      );

      return;
    }

    setHardwarePacketOpen(false);
    setHardwareEditingItem(null);

    resetHardwarePacketForm(
      myPlants
    );

    showUiAlert(
      "success",
      editing
        ? "Hardware packet updated successfully"
        : "Hardware packet created successfully"
    );

    await fetchItems();
  } catch (error) {
    console.error(
      "Hardware packet save failed:",
      error
    );

    showUiAlert(
      "error",
      error?.message ||
        (
          editing
            ? "Failed to update hardware packet"
            : "Failed to create hardware packet"
        )
    );
  } finally {
    setHardwareSaving(false);
  }
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

  const getEmptyHardwareForm = (
    plants = myPlants
  ) => ({
    itemName: "",
    pdNo: "",
    drawingNo: "",
    clientName: "",
    clientAddress: "",
    floor: "",
    plantCode:
      plants.length === 1
        ? plants[0].plantCode
        : "",
  });

  const resetHardwarePacketForm = (
    plants = myPlants
  ) => {
    setHardwareEditingItem(null);

    setHardwareForm(
      getEmptyHardwareForm(plants)
    );

    setHardwareLines([
      {
        lineNo: 1,
        itemName: "",
        quantity: "",
        uom: "Nos",
      },
    ]);

    setErrors({});
  };

  const renumberHardwareLines = (
    lines
  ) => {
    return lines.map((line, index) => ({
      ...line,
      lineNo: index + 1,
    }));
  };

  const addHardwareLine = () => {
    setHardwareLines((previous) =>
      renumberHardwareLines([
        ...previous,
        {
          lineNo: previous.length + 1,
          itemName: "",
          quantity: "",
          uom: "Nos",
        },
      ])
    );
  };

  const removeHardwareLine = (
    indexToRemove
  ) => {
    setHardwareLines((previous) => {
      if (previous.length <= 1) {
        return previous;
      }

      return renumberHardwareLines(
        previous.filter(
          (_, index) =>
            index !== indexToRemove
        )
      );
    });
  };

  const updateHardwareLine = (
    index,
    field,
    value
  ) => {
    setHardwareLines((previous) =>
      previous.map((line, lineIndex) =>
        lineIndex === index
          ? {
            ...line,
            [field]: value,
          }
          : line
      )
    );
  };

  const validateHardwarePacket = () => {
    const nextErrors = {};

    if (!String(
      hardwareForm.itemName || ""
    ).trim()) {
      nextErrors.hardwareItemName =
        "Packet name is required";
    }

    if (!String(
      hardwareForm.plantCode || ""
    ).trim()) {
      nextErrors.hardwarePlantCode =
        "Plant is required";
    }

    if (
      !Array.isArray(hardwareLines) ||
      hardwareLines.length === 0
    ) {
      nextErrors.hardwareLines =
        "Add at least one hardware item";
    }

    hardwareLines.forEach(
      (line, index) => {
        if (!String(
          line?.itemName || ""
        ).trim()) {
          nextErrors[
            `hardware-line-name-${index}`
          ] = "Hardware item is required";
        }

        const quantity =
          Number(line?.quantity);

        if (
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          nextErrors[
            `hardware-line-qty-${index}`
          ] = "Valid quantity is required";
        }

        if (!String(
          line?.uom || ""
        ).trim()) {
          nextErrors[
            `hardware-line-uom-${index}`
          ] = "UOM is required";
        }
      }
    );

    setErrors(nextErrors);

    return Object.keys(nextErrors)
      .length === 0;
  };

  const openHardwareCreateModal =
    async () => {
      let plants =
        myPlants;

      if (plants.length === 0) {
        plants =
          await fetchMyPlants();
      }

      resetHardwarePacketForm(plants);
      setHardwarePacketOpen(true);
    };

  const openHardwareEditModal = (
    row
  ) => {
    if (row?.stickerNumber) {
      showUiAlert(
        "error",
        "A generated hardware packet cannot be edited"
      );

      return;
    }

    const sourceLines =
      Array.isArray(row?.lines)
        ? row.lines
        : Array.isArray(row?.hardwareLines)
          ? row.hardwareLines
          : [];

    setHardwareEditingItem(row);

    setHardwareForm({
      itemName: row?.itemName || "",
      pdNo: row?.pdNo || "",
      drawingNo: row?.drawingNo || "",
      clientName: row?.clientName || "",
      clientAddress:
        row?.clientAddress || "",
      floor: row?.floor || "",
      plantCode:
        row?.plantCode || "",
    });

    setHardwareLines(
      sourceLines.length > 0
        ? renumberHardwareLines(
          sourceLines.map(
            (line, index) => ({
              id: line?.id,
              lineNo:
                line?.lineNo ||
                index + 1,
              itemName:
                line?.itemName || "",
              quantity:
                line?.quantity ?? "",
              uom:
                line?.uom || "Nos",
            })
          )
        )
        : [
          {
            lineNo: 1,
            itemName: "",
            quantity: "",
            uom: "Nos",
          },
        ]
    );

    setErrors({});
    setHardwarePacketOpen(true);
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

      const deletePath =
        getDeletePacketPath(row);

      if (!deletePath) {
        showUiAlert(
          "error",
          "Delete endpoint could not be resolved"
        );

        return;
      }

      const res =
        await authFetch(
          `${API_BASE_URL}${deletePath}`,
          {
            method: "DELETE",
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
    if (!cleanRole) {
      return;
    }

    fetchItems();
    fetchMyPlants();
  }, [cleanRole]);

  useEffect(() => {
    if (!isHardwarePacking) {
      return;
    }

    setMasterWorkbenchOpen(false);
    setCreateOpen(false);
    setDetailsPopup(false);
    setCustomCreateOpen(false);
    setAddMoreOpen(false);
    setCustomAddOpen(false);
    setEditOpen(false);
    setGeneratedHistoryOpen(false);


    setEditItem(null);

    if (historyPdfPreview?.url) {
      URL.revokeObjectURL(
        historyPdfPreview.url
      );
    }

    setHistoryPdfPreview(null);
  }, [isHardwarePacking]);

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
                {isHardwarePacking
                  ? "Hardware Packet Inventory"
                  : "Inventory Items"}
              </div>

              <div style={subtitle}>
                {isHardwarePacking
                  ? "Create hardware packets, manage hardware contents and generate stickers"
                  : "Manage packed inventory, packets and stickers"}
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
            {!isHardwarePacking && (
              <>
                <Button
                  onClick={() =>
                    setMasterWorkbenchOpen(true)
                  }
                  sx={historyHeaderButtonSx}
                >
                  🧩 Master Packet Control
                </Button>

                <Button
                  onClick={openGeneratedHistory}
                  sx={historyHeaderButtonSx}
                >
                  📜 Generated History
                </Button>
              </>
            )}

            <Box sx={countBadgeSx}>
              Total Items:{" "}
              <span
                style={{
                  color: "#60a5fa",
                  fontWeight: 900,
                }}
              >
                {filteredRows.length}
              </span>
            </Box>

            {isHardwarePacking ? (
              <Button
                onClick={
                  openHardwareCreateModal
                }
                sx={premiumButton}
              >
                + Create Hardware Packet
              </Button>
            ) : (
              <>
                <Button
                  onClick={async () => {
                    let plants = myPlants;

                    if (plants.length === 0) {
                      plants =
                        await fetchMyPlants();
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
                      plants =
                        await fetchMyPlants();
                    }

                    resetCustomCreateForm(plants);
                    setCustomCreateOpen(true);
                  }}
                  sx={actionSecondary}
                >
                  + Custom Packet
                </Button>
              </>
            )}
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
                <div>Sticker PDF</div>
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
                      key={
                        getPacketItemIdForSticker(
                          row
                        ) ||
                        row.sku
                      }
                      style={tableRow}
                    >
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
                        {isHardwarePacking ? (
                          <span style={simpleMutedText}>
                            —
                          </span>
                        ) : lastPacket ? (
                          <Box sx={actionCell}>
                            <Button
                              size="small"
                              onClick={() =>
                                openAddPacketsModal(row)
                              }
                              sx={{
                                ...actionPrimary,
                                ...smallActionButton,
                              }}
                            >
                              + Add
                            </Button>

                            <Button
                              size="small"
                              onClick={() =>
                                openCustomAddModal(row)
                              }
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
                          disabled={
                            isHardwarePacking &&
                            Boolean(row.stickerNumber)
                          }
                          onClick={() =>
                            openEditModal(row)
                          }
                          sx={{
                            ...actionWarning,
                            ...tableActionButton,
                            opacity:
                              isHardwarePacking &&
                                row.stickerNumber
                                ? 0.45
                                : 1,
                          }}
                        >
                          {isHardwarePacking &&
                            row.stickerNumber
                            ? "Locked"
                            : "Edit"}
                        </Button>
                      </div>

                      <div style={tableCellWrap}>
                        <Button
                          type="button"
                          size="small"
                          disabled={
                            isHardwarePacking &&
                            Boolean(row.stickerNumber)
                          }
                          onClick={() =>
                            openDeleteConfirm(row)
                          }
                          sx={{
                            ...actionDanger,
                            ...tableActionButton,
                            opacity:
                              isHardwarePacking &&
                                row.stickerNumber
                                ? 0.45
                                : 1,
                            pointerEvents: "auto",
                            cursor:
                              isHardwarePacking &&
                                row.stickerNumber
                                ? "not-allowed"
                                : "pointer",
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
                          label={getPackingLocationCode(row)}
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

                      <div style={tableCellWrap}>
                        {row.stickerNumber ? (
                          <Box sx={actionCell}>
                            <Button
                              size="small"
                              onClick={() => previewExistingStickerPdf(row)}
                              sx={{
                                ...actionSecondary,
                                ...smallActionButton,
                              }}
                            >
                              Preview
                            </Button>

                            <Button
                              size="small"
                              onClick={() => downloadExistingStickerPdf(row)}
                              sx={{
                                ...actionPrimary,
                                ...smallActionButton,
                              }}
                            >
                              Download
                            </Button>
                          </Box>
                        ) : (
                          <span style={simpleMutedText}>
                            —
                          </span>
                        )}
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
          height="92vh"
          footer={
            stickerReviewMode === "EXISTING" ? (
              <>
                <Button
                  disabled={!stickerReviewPdf || stickerReviewLoading}
                  onClick={() =>
                    triggerDownloadFromUrl(
                      stickerReviewPdf,
                      getStickerFileName(selectedItem)
                    )
                  }
                  sx={modalSecondaryButtonSx}
                >
                  Download
                </Button>

                <Button
                  onClick={closeStickerReviewModal}
                  sx={premiumButton}
                >
                  Close
                </Button>
              </>
            ) : (
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
            )
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
                src={getPdfPreviewSrc(stickerReviewPdf)}
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

        {!isHardwarePacking && (
          <InventoryModal
            open={masterWorkbenchOpen}
            onClose={() => setMasterWorkbenchOpen(false)}
            icon="🧩"
            title="Master Item Packet Control"
            subtitle="Master-wise packet status, sticker progress, preview, download, reprint and packet expansion"
            width={1560}
            height="92vh"
            footer={
              <>
                <Button
                  onClick={() => fetchItems()}
                  sx={modalSecondaryButtonSx}
                >
                  Refresh
                </Button>

                <Button
                  onClick={() => setMasterWorkbenchOpen(false)}
                  sx={premiumButton}
                >
                  Close
                </Button>
              </>
            }
          >
            <Box sx={masterWorkbenchModalBodySx}>
              <InventoryMasterWorkbench
                rows={filteredRows}
                isAdmin={isAdmin}
                onGenerate={(row) => {
                  setMasterWorkbenchOpen(false);
                  openGenerateStickerPanel(row);
                }}
                onAdd={(row) => {
                  setMasterWorkbenchOpen(false);
                  openAddPacketsModal(row);
                }}
                onCustomAdd={(row) => {
                  setMasterWorkbenchOpen(false);
                  openCustomAddModal(row);
                }}
                onEdit={(row) => {
                  setMasterWorkbenchOpen(false);
                  openEditModal(row);
                }}
                onPreviewSticker={(row) => {
                  setMasterWorkbenchOpen(false);
                  previewExistingStickerPdf(row);
                }}
                onDownloadSticker={(row) => {
                  downloadExistingStickerPdf(row);
                }}
              />
            </Box>
          </InventoryModal>
        )}
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
                  {getPlantCodeOnly(selectedItem)}
                </Box>
              </Box>

              <Box sx={detailMiniCardSx}>
                <Box sx={detailLabelSx}>
                  Location
                </Box>

                <Box sx={detailValueSx}>
                  {getPackingLocationCode(selectedItem)}
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
                {isHardwarePacking
                  ? "Hardware Contents"
                  : "Description"}
              </Box>

              <Box
                sx={{
                  ...descriptionTextSx,
                  whiteSpace:
                    isHardwarePacking
                      ? "pre-wrap"
                      : "normal",
                }}
              >
                {getSafeValue(
                  selectedItem?.description
                )}
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

                const generatePath =
                  getStickerGeneratePath(itemId);

                if (!generatePath) {
                  showUiAlert(
                    "error",
                    "Sticker generation endpoint missing"
                  );

                  return;
                }

                const query =
                  `factoryFloor=${encodeURIComponent(
                    selectedItem?.floor || ""
                  )}` +
                  `&showCompanyHeader=${encodeURIComponent(
                    form.showCompanyHeader
                  )}`;

                const genRes =
                  await authFetch(
                    `${API_BASE_URL}${generatePath}?${query}`,
                    {
                      method: "POST",
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
        {!isHardwarePacking && (
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

            <Box sx={formSectionHeaderSx}>
              Basic Item Information
            </Box>

            {itemInfoFields.map((field) =>
              renderFormTextField(field)
            )}

            <Box sx={formSectionHeaderSx}>
              Plant Assignment
            </Box>

            {renderPlantSelect()}

            <Box sx={formSectionHeaderSx}>
              Packet Setup
            </Box>

            <TextField
              label="Number of Packets"
              placeholder="Enter total packet count"
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
        )}
        {!isHardwarePacking && (
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

                    const res = await authFetch(`${API_BASE_URL}/api/packets/create`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
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
        )}
        {!isHardwarePacking && (
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

                      const res = await authFetch(`${API_BASE_URL}/api/packets/create-custom`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
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
                      console.error(e);
                      showUiAlert("error", "Failed to create custom packet");
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
                  Basic Item Information
                </Box>

                {itemInfoFields.map((field) =>
                  renderFormTextField(field)
                )}

                <Box sx={sectionTitleSx}>
                  Plant Assignment
                </Box>

                {renderPlantSelect()}
              </Box>

              <Box sx={sectionCardSx}>
                <Box sx={sectionTitleSx}>
                  Custom Packet Information
                </Box>

                <TextField
                  label="Packet Number"
                  placeholder="Enter custom packet number"
                  type="number"
                  fullWidth
                  value={customPacketNo}
                  onChange={(e) => setCustomPacketNo(e.target.value)}
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label={packetDetailLabels.description}
                  placeholder="Enter packet-wise description"
                  fullWidth
                  value={descriptions[0] || ""}
                  onChange={(e) => setDescriptions([e.target.value])}
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label={packetDetailLabels.weight}
                  placeholder="Enter packet weight"
                  fullWidth
                  value={weights[0] || ""}
                  onChange={(e) => setWeights([e.target.value])}
                  sx={formFieldSx(darkMode)}
                />

                <Box sx={dimensionRowSx}>
                  {[
                    ["l", packetDetailLabels.length],
                    ["b", packetDetailLabels.breadth],
                    ["h", packetDetailLabels.height],
                  ].map(([key, label]) => (
                    <TextField
                      key={key}
                      label={label}
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
                  label={packetDetailLabels.remarks}
                  placeholder="Enter handling notes or remarks"
                  fullWidth
                  value={remarksList[0] || ""}
                  onChange={(e) => setRemarksList([e.target.value])}
                  sx={formFieldSx(darkMode)}
                />
              </Box>
            </Box>
          </InventoryModal>
        )}
        {!isHardwarePacking && (
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
                      const res = await authFetch(
                        `${API_BASE_URL}/api/packets/add-more/${selectedItem.masterItemId}`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
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
                      console.error(e);
                      showUiAlert("error", "Failed to add packets");
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
                  Plant: {getPlantCodeOnly(selectedItem)}
                  <br />
                  Location: {getPackingLocationCode(selectedItem)}
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
                      label={packetDetailLabels.description}
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
                      label={packetDetailLabels.weight}
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
                          label={
                            key === "l"
                              ? "Length"
                              : key === "b"
                                ? "Breadth"
                                : "Height"
                          }
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
                      label={packetDetailLabels.remarks}
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
        )}
        {!isHardwarePacking && (
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
                      const res = await authFetch(
                        `${API_BASE_URL}/api/packets/add-custom/${selectedItem.masterItemId}`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
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
                      console.error(e);
                      showUiAlert("error", "Failed to add custom packet");
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
                  Plant: {getPlantCodeOnly(selectedItem)}
                  <br />
                  Location: {getPackingLocationCode(selectedItem)}
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
        )}
        {!isHardwarePacking && (
          <InventoryModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            icon="✏️"
            title="Edit Packet Item"
            subtitle="Update editable packet information"
            width={620}
            height="92vh"
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

                      const res = await authFetch(
                        editUrl,
                        {
                          method: "PUT",
                          headers: {
                            "Content-Type": "application/json",
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
        )}
        {!isHardwarePacking && (
          <InventoryModal
            open={generatedHistoryOpen}
            onClose={closeGeneratedHistoryModal}
            icon="📜"
            title="Generated Packet History"
            subtitle="Search, filter, report and preview generated sticker records"
            width={1520}
            height="92vh"
            footer={
              <>
                <Button
                  onClick={() => fetchGeneratedHistory(generatedHistoryUserFilter)}
                  sx={modalSecondaryButtonSx}
                >
                  Refresh
                </Button>

                <Button
                  onClick={closeGeneratedHistoryModal}
                  sx={premiumButton}
                >
                  Close
                </Button>
              </>
            }
          >
            <Box sx={historyModalBodySx}>
              <Box sx={historyTopBarSx}>
                <Box sx={historySmartRowSx}>
                  <TextField
                    variant="standard"
                    placeholder='Smart search: client:abc pd:PD-12 sku:PKT name:wardrobe dwg:04/15 or any text'
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
                    sx={historyMiniFilterFieldSx}
                    slotProps={selectMenuSlotProps}
                  >
                    <MenuItem value="ALL">All Users</MenuItem>

                    {generatedHistoryUsers.map((user) => (
                      <MenuItem key={user} value={user}>
                        {user}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    size="small"
                    label="Packing Report Type"
                    value={generatedHistoryReportMode}
                    onChange={(e) =>
                      setGeneratedHistoryReportMode(e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                    slotProps={selectMenuSlotProps}
                  >
                    {generatedHistoryReportModes.map((mode) => (
                      <MenuItem
                        key={mode.value}
                        value={mode.value}
                      >
                        {mode.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box sx={historyFilterGridSx}>
                  <TextField
                    size="small"
                    label="Client"
                    value={generatedHistoryFilters.client}
                    onChange={(e) =>
                      updateGeneratedHistoryFilter("client", e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                  />

                  <TextField
                    size="small"
                    label="PD No"
                    value={generatedHistoryFilters.pdNo}
                    onChange={(e) =>
                      updateGeneratedHistoryFilter("pdNo", e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                  />

                  <TextField
                    size="small"
                    label="SKU"
                    value={generatedHistoryFilters.sku}
                    onChange={(e) =>
                      updateGeneratedHistoryFilter("sku", e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                  />

                  <TextField
                    size="small"
                    label="Item Name"
                    value={generatedHistoryFilters.itemName}
                    onChange={(e) =>
                      updateGeneratedHistoryFilter("itemName", e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                  />

                  <TextField
                    size="small"
                    label="DWG No"
                    value={generatedHistoryFilters.drawingNo}
                    onChange={(e) =>
                      updateGeneratedHistoryFilter("drawingNo", e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                  />

                  <TextField
                    size="small"
                    label="Sticker / Packet"
                    value={
                      generatedHistoryFilters.stickerNumber ||
                      generatedHistoryFilters.packetNumber
                    }
                    onChange={(e) => {
                      updateGeneratedHistoryFilter("stickerNumber", e.target.value);
                      updateGeneratedHistoryFilter("packetNumber", e.target.value);
                    }}
                    sx={historyMiniFilterFieldSx}
                  />
                </Box>

                <Box sx={historyDateReportRowSx}>
                  <TextField
                    size="small"
                    label="Date From"
                    type="date"
                    value={generatedHistoryDateFrom}
                    onChange={(e) =>
                      setGeneratedHistoryDateFrom(e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />

                  <TextField
                    size="small"
                    label="Date To"
                    type="date"
                    value={generatedHistoryDateTo}
                    onChange={(e) =>
                      setGeneratedHistoryDateTo(e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />

                  <TextField
                    size="small"
                    label="Time From"
                    type="time"
                    value={generatedHistoryTimeFrom}
                    onChange={(e) =>
                      setGeneratedHistoryTimeFrom(e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />

                  <TextField
                    size="small"
                    label="Time To"
                    type="time"
                    value={generatedHistoryTimeTo}
                    onChange={(e) =>
                      setGeneratedHistoryTimeTo(e.target.value)
                    }
                    sx={historyMiniFilterFieldSx}
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />

                  <Button
                    onClick={exportGeneratedHistoryReport}
                    sx={modalSecondaryButtonSx}
                  >
                    Export Excel
                  </Button>

                  <Button
                    onClick={resetGeneratedHistoryFilters}
                    sx={modalSecondaryButtonSx}
                  >
                    Clear
                  </Button>

                  <Box sx={historyCountBadgeSx}>
                    {generatedHistoryReportMode === "DETAILED"
                      ? `${filteredGeneratedHistoryRows.length} Records`
                      : `${generatedHistoryReportRows.length} Groups`}
                  </Box>
                </Box>
              </Box>

              <Box
                sx={
                  historyPdfPreview?.url
                    ? historyMainContentSplitSx
                    : historyMainContentSx
                }
              >
                <Box sx={historyTablePanelSx}>
                  {generatedHistoryReportMode !== "DETAILED" ? (
                    <Box sx={historyTableViewportSx}>
                      <Box sx={historyReportTitleSx}>
                        {getHistoryReportLabel(generatedHistoryReportMode)} Packing Report
                      </Box>

                      <div style={historyReportHeader}>
                        <div>Group</div>
                        <div>Total</div>
                        <div>Initial</div>
                        <div>Reprint</div>
                        <div>Client</div>
                        <div>SKU</div>
                        <div>PD / DWG</div>
                        <div>First Generated</div>
                        <div>Last Generated</div>
                      </div>

                      {generatedHistoryReportRows.length === 0 && (
                        <Box sx={historyEmptySx}>
                          No packing report data found.
                        </Box>
                      )}

                      {paginatedGeneratedHistoryRows.map((row) => (
                        <div
                          key={row.key}
                          style={historyReportRow}
                        >
                          <div style={historyCellWrap}>
                            <span
                              style={historyMainText}
                              title={row.key}
                            >
                              {row.key}
                            </span>
                          </div>

                          <div style={historyCellWrap}>
                            <Chip
                              label={row.totalPackets}
                              size="small"
                              sx={historyInitialChipSx}
                            />
                          </div>

                          <div style={historyCellWrap}>
                            {row.initialCount}
                          </div>

                          <div style={historyCellWrap}>
                            {row.reprintCount}
                          </div>

                          <div style={historyCellWrap}>
                            <span
                              style={historySubText}
                              title={row.clientsText}
                            >
                              {row.clientsText}
                            </span>
                          </div>

                          <div style={historyCellWrap}>
                            <span
                              style={historyMonoText}
                              title={row.skusText}
                            >
                              {row.skusText}
                            </span>
                          </div>

                          <div style={historyCellWrap}>
                            <span
                              style={historySubText}
                              title={`${row.pdNosText} / ${row.dwgNosText}`}
                            >
                              {row.pdNosText} / {row.dwgNosText}
                            </span>
                          </div>

                          <div style={historyCellWrap}>
                            <span style={historyDateText}>
                              {formatHistoryDateTime(row.firstGeneratedAt)}
                            </span>
                          </div>

                          <div style={historyCellWrap}>
                            <span style={historyDateText}>
                              {formatHistoryDateTime(row.lastGeneratedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </Box>
                  ) : (
                    <Box sx={historyTableViewportSx}>
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
                        paginatedGeneratedHistoryRows.map((row) => (
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
                  )}
                  {activeGeneratedHistoryRows.length > 0 && (
                    <Box sx={historyPaginationBarSx}>
                      <Box sx={historyPaginationTextSx}>
                        Showing{" "}
                        <b>{generatedHistoryShowingStart}</b>
                        {" - "}
                        <b>{generatedHistoryPageEnd}</b>
                        {" of "}
                        <b>{activeGeneratedHistoryRows.length}</b>
                        {generatedHistoryReportMode === "DETAILED"
                          ? " records"
                          : " groups"}
                      </Box>

                      <Box sx={historyPaginationControlsSx}>
                        <Button
                          disabled={generatedHistorySafePageNo === 1}
                          onClick={() =>
                            setGeneratedHistoryPageNo((prev) =>
                              Math.max(1, prev - 1)
                            )
                          }
                          sx={historyPaginationButtonSx}
                        >
                          ◀ Previous
                        </Button>

                        <Box sx={historyPageCountSx}>
                          Page{" "}
                          <span>{generatedHistorySafePageNo}</span>
                          {" of "}
                          {generatedHistoryTotalPages}
                        </Box>

                        <Button
                          disabled={
                            generatedHistorySafePageNo ===
                            generatedHistoryTotalPages
                          }
                          onClick={() =>
                            setGeneratedHistoryPageNo((prev) =>
                              Math.min(
                                generatedHistoryTotalPages,
                                prev + 1
                              )
                            )
                          }
                          sx={{
                            ...historyPaginationButtonSx,
                            background:
                              "linear-gradient(180deg,#2563eb,#1d4ed8)",
                          }}
                        >
                          Next ▶
                        </Button>
                      </Box>

                      <Box sx={historyPageSizeWrapSx}>
                        <span>Show</span>

                        <select
                          value={generatedHistoryPageSize}
                          onChange={(e) => {
                            setGeneratedHistoryPageSize(Number(e.target.value));
                            setGeneratedHistoryPageNo(1);
                          }}
                          style={historyPageSizeSelectStyle}
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>

                        <span>per page</span>
                      </Box>
                    </Box>
                  )}
                </Box>
                {historyPdfPreview?.url && (
                  <Box sx={historyInlinePdfSx}>
                    <Box sx={historyInlinePdfHeaderSx}>
                      <Box>
                        <Box sx={historyInlinePdfTitleSx}>
                          Sticker PDF Preview
                        </Box>

                        <Box sx={historyInlinePdfSubSx}>
                          Preview opens inside Generated History, not as a second modal.
                        </Box>
                      </Box>

                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          onClick={() => {
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
                          onClick={closeHistoryPdfPreview}
                          sx={modalSecondaryButtonSx}
                        >
                          Close Preview
                        </Button>
                      </Box>
                    </Box>

                    <Box sx={historyInlinePdfFrameWrapSx}>
                      <iframe
                        src={getPdfPreviewSrc(historyPdfPreview.url)}
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
                  </Box>
                )}
              </Box>
            </Box>
          </InventoryModal>
        )}
        {isHardwarePacking && (
          <InventoryModal
            open={hardwarePacketOpen}
            onClose={() => {
              if (hardwareSaving) {
                return;
              }

              setHardwarePacketOpen(false);
              setHardwareEditingItem(null);
            }}
            icon="🔩"
            title={
              hardwareEditingItem
                ? "Edit Hardware Packet"
                : "Create Hardware Packet"
            }
            subtitle="Enter packet details and add every hardware item with quantity and UOM"
            width={820}
            height="92vh"
            footer={
              <>
                <Button
                  disabled={hardwareSaving}
                  onClick={() => {
                    setHardwarePacketOpen(false);
                    setHardwareEditingItem(null);
                  }}
                  sx={modalSecondaryButtonSx}
                >
                  Cancel
                </Button>

                <Button
                  disabled={hardwareSaving}
                  onClick={saveHardwarePacket}
                  sx={{
                    ...premiumButton,
                    opacity:
                      hardwareSaving
                        ? 0.55
                        : 1,
                  }}
                >
                  {hardwareSaving
                    ? "Saving..."
                    : hardwareEditingItem
                      ? "Update Hardware Packet"
                      : "Create Hardware Packet"}
                </Button>
              </>
            }
          >
            <Box sx={modalScrollBodySx}>
              <Box sx={sectionCardSx}>
                <Box sx={sectionTitleSx}>
                  Packet Information
                </Box>

                <TextField
                  label="Packet / Item Name"
                  placeholder="Example: Kitchen Hardware Packet"
                  fullWidth
                  value={hardwareForm.itemName}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      itemName: e.target.value,
                    }))
                  }
                  error={!!errors.hardwareItemName}
                  helperText={errors.hardwareItemName}
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label="PD No."
                  fullWidth
                  value={hardwareForm.pdNo}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      pdNo: e.target.value,
                    }))
                  }
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label="Drawing No."
                  fullWidth
                  value={hardwareForm.drawingNo}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      drawingNo: e.target.value,
                    }))
                  }
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label="Client Name"
                  fullWidth
                  value={hardwareForm.clientName}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      clientName: e.target.value,
                    }))
                  }
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label="Client Address"
                  fullWidth
                  multiline
                  minRows={2}
                  value={hardwareForm.clientAddress}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      clientAddress: e.target.value,
                    }))
                  }
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  label="Floor / Area"
                  fullWidth
                  value={hardwareForm.floor}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      floor: e.target.value,
                    }))
                  }
                  sx={formFieldSx(darkMode)}
                />

                <TextField
                  select
                  label="Plant"
                  fullWidth
                  value={hardwareForm.plantCode}
                  onChange={(e) =>
                    setHardwareForm((previous) => ({
                      ...previous,
                      plantCode: e.target.value,
                    }))
                  }
                  error={!!errors.hardwarePlantCode}
                  helperText={
                    errors.hardwarePlantCode ||
                    "Select an assigned plant"
                  }
                  sx={formFieldSx(darkMode)}
                  slotProps={selectMenuSlotProps}
                  SelectProps={{
                    MenuProps:
                      selectMenuSlotProps
                        .select.MenuProps,
                  }}
                >
                  {myPlants.map((plant) => (
                    <MenuItem
                      key={plant.plantCode}
                      value={plant.plantCode}
                    >
                      {plant.plantCode}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box sx={sectionCardSx}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box>
                    <Box sx={sectionTitleSx}>
                      Hardware Contents
                    </Box>

                    <Box
                      sx={{
                        color: "#94a3b8",
                        fontSize: 12,
                        mt: -1,
                      }}
                    >
                      Each row will be printed separately in the sticker description section.
                    </Box>
                  </Box>

                  <Button
                    onClick={addHardwareLine}
                    sx={actionSecondary}
                  >
                    + Add Hardware
                  </Button>
                </Box>

                {errors.hardwareLines && (
                  <Box
                    sx={{
                      color: "#fca5a5",
                      fontSize: 12,
                      fontWeight: 700,
                      mb: 1.5,
                    }}
                  >
                    {errors.hardwareLines}
                  </Box>
                )}

                {hardwareLines.map(
                  (line, index) => (
                    <Box
                      key={
                        line.id ||
                        `hardware-line-${index}`
                      }
                      sx={{
                        ...packetCardSx,
                        mb: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                          mb: 1.5,
                        }}
                      >
                        <Box sx={packetTitleSx}>
                          Serial No. {index + 1}
                        </Box>

                        <Button
                          size="small"
                          disabled={
                            hardwareLines.length === 1
                          }
                          onClick={() =>
                            removeHardwareLine(index)
                          }
                          sx={{
                            ...actionDanger,
                            minWidth: 74,
                            opacity:
                              hardwareLines.length === 1
                                ? 0.4
                                : 1,
                          }}
                        >
                          Remove
                        </Button>
                      </Box>

                      <TextField
                        label="Hardware Item"
                        placeholder="Example: Soft Close Hinge"
                        fullWidth
                        value={line.itemName}
                        onChange={(e) =>
                          updateHardwareLine(
                            index,
                            "itemName",
                            e.target.value
                          )
                        }
                        error={
                          !!errors[
                          `hardware-line-name-${index}`
                          ]
                        }
                        helperText={
                          errors[
                          `hardware-line-name-${index}`
                          ]
                        }
                        sx={formFieldSx(darkMode)}
                      />

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 1.5,
                        }}
                      >
                        <TextField
                          label="Quantity"
                          type="number"
                          fullWidth
                          inputProps={{
                            min: 0.001,
                            step: "any",
                          }}
                          value={line.quantity}
                          onChange={(e) =>
                            updateHardwareLine(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                          error={
                            !!errors[
                            `hardware-line-qty-${index}`
                            ]
                          }
                          helperText={
                            errors[
                            `hardware-line-qty-${index}`
                            ]
                          }
                          sx={formFieldSx(darkMode)}
                        />

                        <TextField
                          select
                          label="UOM"
                          fullWidth
                          value={line.uom}
                          onChange={(e) =>
                            updateHardwareLine(
                              index,
                              "uom",
                              e.target.value
                            )
                          }
                          error={
                            !!errors[
                            `hardware-line-uom-${index}`
                            ]
                          }
                          helperText={
                            errors[
                            `hardware-line-uom-${index}`
                            ]
                          }
                          sx={formFieldSx(darkMode)}
                          slotProps={
                            selectMenuSlotProps
                          }
                        >
                          {hardwareUomOptions.map(
                            (uom) => (
                              <MenuItem
                                key={uom}
                                value={uom}
                              >
                                {uom}
                              </MenuItem>
                            )
                          )}
                        </TextField>
                      </Box>
                    </Box>
                  )
                )}
              </Box>

              <Box
                sx={{
                  p: 1.6,
                  borderRadius: "12px",
                  background:
                    "rgba(59,130,246,.08)",
                  border:
                    "1px solid rgba(59,130,246,.18)",
                }}
              >
                <Box
                  sx={{
                    color: "#93c5fd",
                    fontSize: 12,
                    fontWeight: 900,
                    mb: 1,
                  }}
                >
                  Sticker Description Preview
                </Box>

                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    color: "#cbd5e1",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  {buildHardwareDescription(
                    hardwareLines
                  ) || "Add hardware items to preview the description."}
                </Box>
              </Box>
            </Box>
          </InventoryModal>
        )}
      </div>
      {
        uiAlert && (
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
        )
      }
    </div >
  );
}


/* ===================== STYLES ===================== */

const inventoryGrid =
  "130px 190px 110px 110px 260px 300px 120px 150px 140px 170px 180px 260px 260px 180px 170px";

const inventoryMinWidth = 2940;

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

const inventoryHeroSx = {
  flexWrap: "wrap",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "stretch",
  gap: "16px",
  flexShrink: 0,
  p: "16px",
  borderRadius: "14px",
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,.22), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.88), rgba(15,23,42,.74))",
  border: "1px solid rgba(255,255,255,.08)",
  boxShadow: "0 16px 32px rgba(2,6,23,.28)",
  backdropFilter: "blur(18px)",
};

const inventoryChipRowSx = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  mb: "10px",
};

const inventoryLabelChipSx = {
  height: 26,
  borderRadius: 999,
  background: "rgba(59,130,246,.14)",
  color: "#60a5fa",
  border: "1px solid rgba(59,130,246,.24)",
  fontWeight: 900,
  fontSize: 11,
  letterSpacing: ".07em",
};

const inventorySoftChipSx = {
  height: 24,
  borderRadius: 999,
  background: "rgba(255,255,255,.06)",
  color: "#cbd5e1",
  border: "1px solid rgba(255,255,255,.10)",
  fontWeight: 850,
  fontSize: 11,
};

const inventoryOkChipSx = {
  ...inventorySoftChipSx,
  color: "#4ade80",
  background: "rgba(34,197,94,.12)",
  border: "1px solid rgba(34,197,94,.24)",
};

const inventoryWarnChipSx = {
  ...inventorySoftChipSx,
  color: "#fbbf24",
  background: "rgba(245,158,11,.13)",
  border: "1px solid rgba(245,158,11,.24)",
};

const inventoryPlantMiniChipSx = {
  ...inventorySoftChipSx,
  color: "#93c5fd",
  background: "rgba(59,130,246,.12)",
  border: "1px solid rgba(59,130,246,.22)",
};

const inventoryHeroTitleSx = {
  color: "#fff",
  fontSize: {
    xs: 22,
    md: 30,
  },
  fontWeight: 950,
  lineHeight: 1.05,
  letterSpacing: "-0.04em",
};

const inventoryHeroSubSx = {
  mt: "8px",
  color: "rgba(255,255,255,.68)",
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.5,
  maxWidth: 820,
};

const inventoryHeroStatsSx = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(90px, 1fr))",
  gap: "8px",
  minWidth: 310,
};

const inventoryMiniStatSx = (accent) => ({
  p: "12px",
  borderRadius: "12px",
  background: `${accent}10`,
  border: `1px solid ${accent}26`,
  minHeight: 70,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
});

const inventoryMiniStatValueSx = {
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1,
};

const inventoryMiniStatLabelSx = {
  mt: "6px",
  color: "rgba(255,255,255,.58)",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".07em",
};

const inventoryMasterCardSx = (accent, open) => ({
  flexShrink: 0,
  borderRadius: "12px",
  background: open
    ? `linear-gradient(180deg, ${accent}13, rgba(15,23,42,.86))`
    : "rgba(15,23,42,.80)",
  border: open
    ? `1px solid ${accent}50`
    : "1px solid rgba(255,255,255,.07)",
  borderLeft: `3px solid ${accent}`,
  boxShadow: open
    ? `0 18px 36px ${accent}18`
    : "0 14px 28px rgba(2,6,23,.24)",
  backdropFilter: "blur(18px)",
  overflow: "hidden",
  transition: "box-shadow .22s ease, border-color .22s ease, background .22s ease",
});

const inventoryMasterHeaderSx = {
  minHeight: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  px: "14px",
  py: "9px",

  background: "rgba(2,6,23,.24)",
  borderBottom: "1px solid rgba(255,255,255,.07)",

  flexWrap: "nowrap",
  overflow: "hidden",
};

const inventoryMasterLeftSx = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
  flex: "1 1 auto",
  overflow: "hidden",
  alignSelf: "stretch",
};

const masterWorkbenchModalBodySx = {
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const inventoryWorkbenchShellSx = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  overflow: "hidden",
};

const inventorySectionListSx = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  overflowY: "auto",
  overflowX: "hidden",
  pr: "8px",
  pb: "8px",

  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  scrollbarColor: "#60a5fa rgba(15,23,42,.85)",

  "&::-webkit-scrollbar": {
    width: 10,
  },

  "&::-webkit-scrollbar-track": {
    background: "rgba(15,23,42,.85)",
    borderRadius: 999,
  },

  "&::-webkit-scrollbar-thumb": {
    background: "linear-gradient(180deg,#2563eb,#60a5fa)",
    borderRadius: 999,
    border: "2px solid rgba(15,23,42,.95)",
  },
};

const inventoryWorkbenchPaginationSx = {
  flexShrink: 0,
  marginTop: "0px",
  padding: "12px",
  borderRadius: "14px",
  background:
    "linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.88))",
  border: "1px solid rgba(96,165,250,.15)",
  boxShadow: "0 18px 40px rgba(2,6,23,.30)",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "12px",

  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr",
  },
};

const inventoryPaginationLeftSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "8px",
};

const historyModalBodySx = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const inventoryPaginationCenterSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const inventoryPaginationRightSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
};

const inventoryPaginationTextSx = {
  color: "rgba(255,255,255,.62)",
  fontSize: 12,
  fontWeight: 800,

  "& b": {
    color: "#fff",
    fontWeight: 950,
  },
};

const inventoryPaginationButtonSx = {
  height: 34,
  borderRadius: "9px",
  textTransform: "none",
  fontWeight: 900,
  fontSize: 12,
  color: "#fff",
  background: "rgba(255,255,255,.055)",
  border: "1px solid rgba(255,255,255,.09)",
  minWidth: 104,

  "&:hover": {
    background: "rgba(59,130,246,.16)",
    borderColor: "rgba(59,130,246,.30)",
  },

  "&.Mui-disabled": {
    color: "rgba(255,255,255,.28)",
    background: "rgba(255,255,255,.025)",
    borderColor: "rgba(255,255,255,.05)",
  },
};

const inventoryPageCountSx = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: "9px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.07)",
  display: "flex",
  alignItems: "center",
  color: "rgba(255,255,255,.70)",
  fontSize: 12,
  fontWeight: 850,

  "& span": {
    margin: "0 6px",
    color: "#60a5fa",
    fontWeight: 950,
  },
};

const inventoryPageSizeSelectStyle = {
  height: 34,
  minWidth: 72,
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,.10)",
  background: "#0f172a",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
  fontWeight: 900,
  colorScheme: "dark",
};

const inventoryExpandBtnSx = {
  width: 32,
  height: 32,
  minWidth: 32,
  maxWidth: 32,
  p: 0,
  m: 0,
  flex: "0 0 32px",
  alignSelf: "center",

  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",

  color: "#cbd5e1",
  background: "rgba(255,255,255,.045)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: "9px",

  lineHeight: 1,
  overflow: "hidden",

  "&:hover": {
    background: "rgba(59,130,246,.16)",
    borderColor: "rgba(96,165,250,.34)",
    color: "#fff",
  },
};

const inventoryExpandSymbolSx = {
  width: "100%",
  height: "100%",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  fontSize: 19,
  fontWeight: 950,
  lineHeight: 1,

  transform: "translateY(-1px)",
  userSelect: "none",
};

const inventoryMasterTitleRowSx = {
  minHeight: 30,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const inventoryMasterTitleSx = {
  color: "#fff",
  fontSize: 17,
  fontWeight: 950,
  lineHeight: "22px",
  letterSpacing: "-0.02em",
  maxWidth: 640,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const inventoryMasterMetaSx = {
  mt: "3px",
  color: "rgba(255,255,255,.52)",
  fontSize: 11,
  fontWeight: 650,
};

const inventoryMasterRightSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "nowrap",
  flexShrink: 0,
  minWidth: 360,
};

const inventoryProgressBlockSx = {
  width: 190,
};

const inventoryProgressTopSx = {
  display: "flex",
  justifyContent: "space-between",
  color: "rgba(255,255,255,.58)",
  fontSize: 10,
  fontWeight: 900,
  mb: "6px",

  "& b": {
    color: "#fff",
  },
};

const inventoryProgressSx = (accent) => ({
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,.06)",

  "& .MuiLinearProgress-bar": {
    borderRadius: 999,
    background: accent,
  },
});

const inventoryMasterCountSx = {
  minWidth: 64,
  color: "rgba(255,255,255,.55)",
  fontSize: 10,
  fontWeight: 850,
  textAlign: "center",

  "& span": {
    display: "block",
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1,
    mb: "4px",
  },
};

const inventoryPacketTableSx = {
  background: "rgba(2,6,23,.18)",
  maxHeight: "min(360px, 42vh)",
  overflow: "auto",
  borderTop: "1px solid rgba(255,255,255,.06)",

  scrollbarWidth: "thin",
  scrollbarColor: "#60a5fa rgba(15,23,42,.85)",

  "&::-webkit-scrollbar": {
    width: 10,
    height: 10,
  },

  "&::-webkit-scrollbar-track": {
    background: "rgba(15,23,42,.85)",
    borderRadius: 999,
  },

  "&::-webkit-scrollbar-thumb": {
    background: "linear-gradient(180deg,#2563eb,#60a5fa)",
    borderRadius: 999,
    border: "2px solid rgba(15,23,42,.95)",
  },
};

const inventoryPacketHeadSx = {
  position: "sticky",
  top: 0,
  zIndex: 4,

  display: "grid",
  gridTemplateColumns:
    "90px minmax(220px,1.2fr) minmax(260px,1.3fr) 140px minmax(180px,1fr) minmax(320px,1.4fr)",

  color: "rgba(255,255,255,.62)",
  fontSize: 10,
  fontWeight: 950,
  borderBottom: "1px solid rgba(255,255,255,.08)",
  background: "#0f172a",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  minWidth: 1210,

  "& > div": {
    padding: "10px 9px",
  },
};

const inventoryPacketRowSx = {
  display: "grid",
  gridTemplateColumns:
    "90px minmax(220px,1.2fr) minmax(260px,1.3fr) 140px minmax(180px,1fr) minmax(320px,1.4fr)",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,.06)",
  minHeight: 46,
  background: "rgba(255,255,255,.025)",
  minWidth: 1210,

  "& > div": {
    padding: "6px 9px",
  },
};

const inventoryPacketTextSx = {
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
};

const inventoryPacketMonoSx = {
  color: "#cbd5e1",
  fontFamily: "monospace",
  fontWeight: 800,
  fontSize: 11,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const inventoryPacketSubSx = {
  color: "rgba(255,255,255,.58)",
  fontSize: 11,
  fontWeight: 650,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const inventoryPacketActionsSx = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
};

const inventoryMiniBtnSx = (accent) => ({
  minHeight: 30,
  px: 1.1,
  borderRadius: "8px",
  textTransform: "none",
  fontSize: 10.5,
  fontWeight: 900,
  color: "#fff",
  background: `${accent}18`,
  border: `1px solid ${accent}30`,

  "&:hover": {
    background: `${accent}28`,
  },
});

const inventoryPacketFooterSx = {
  position: "sticky",
  bottom: 0,
  zIndex: 3,

  minHeight: 46,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  px: "14px",

  background:
    "linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.98))",
  borderTop: "1px solid rgba(255,255,255,.08)",
};

const inventoryEmptyWorkbenchSx = {
  p: "24px",
  borderRadius: "12px",
  background: "rgba(15,23,42,.75)",
  border: "1px dashed rgba(255,255,255,.14)",
  color: "rgba(255,255,255,.62)",
  fontWeight: 800,
  textAlign: "center",
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

const inventoryCollapseSx = {
  flexShrink: 0,

  "& .MuiCollapse-wrapper": {
    display: "block",
    width: "100%",
  },

  "& .MuiCollapse-wrapperInner": {
    display: "block",
    width: "100%",
    minHeight: 0,
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

const formSectionHeaderSx = {
  mt: 1,
  mb: 1.4,
  px: 1.2,
  py: 0.9,
  borderRadius: "12px",
  color: "#93c5fd",
  background:
    "linear-gradient(135deg, rgba(59,130,246,.12), rgba(15,23,42,.42))",
  border: "1px solid rgba(59,130,246,.18)",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: ".09em",
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

const plantAccessInfoCardSx = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 1,
  mb: 2,
  p: 1.2,
  borderRadius: "16px",
  background:
    "linear-gradient(135deg, rgba(59,130,246,.10), rgba(15,23,42,.62))",
  border: "1px solid rgba(59,130,246,.18)",
};

const plantAccessInfoItemSx = {
  p: 1.1,
  borderRadius: "12px",
  background: "rgba(15,23,42,.62)",
  border: "1px solid rgba(255,255,255,.06)",
};

const plantAccessLabelSx = {
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".08em",
};

const plantAccessValueSx = {
  mt: 0.5,
  color: "#f8fafc",
  fontSize: 13,
  fontWeight: 900,
  wordBreak: "break-word",
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

const historyReportWrapSx = {
  mb: 2,
  borderRadius: "18px",
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(15,23,42,.95), rgba(15,23,42,.88))",
  border: "1px solid rgba(96,165,250,.16)",
  boxShadow: "0 18px 42px rgba(0,0,0,.28)",
};

const historyReportBodySx = {
  maxHeight: 320,
  overflow: "auto",
};

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

const historyTopBarSx = {
  flexShrink: 0,
  p: 2,
  mb: 1.4,
  borderRadius: "18px",
  background:
    "linear-gradient(180deg, rgba(30,41,59,.72), rgba(15,23,42,.72))",
  border: "1px solid rgba(148,163,184,.16)",
  display: "flex",
  flexDirection: "column",
  gap: 1.35,
  overflow: "visible",
};

const historySmartRowSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr",
    lg: "minmax(360px, 1.8fr) 220px 260px",
  },
  gap: 1.15,
  width: "100%",
  alignItems: "center",
};

const historyFilterGridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
    lg: "repeat(6, minmax(120px, 1fr))",
  },
  gap: 1.15,
  width: "100%",
  alignItems: "center",
};

const historyDateReportRowSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
    lg: "repeat(4, 145px) 120px 90px auto",
  },
  gap: 1.15,
  width: "100%",
  alignItems: "center",
};

const historyMiniFilterFieldSx = {
  minWidth: 0,
  width: "100%",

  "& .MuiOutlinedInput-root": {
    height: 40,
    borderRadius: "12px",
    color: "#fff",
    background: "rgba(255,255,255,.045)",
    border: "1px solid rgba(255,255,255,.07)",
  },

  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(255,255,255,.08)",
  },

  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(96,165,250,.45)",
  },

  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#60a5fa",
  },

  "& .MuiInputLabel-root": {
    color: "rgba(255,255,255,.58)",
    fontWeight: 900,
    fontSize: 11,
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: "#93c5fd",
  },

  "& input": {
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
  },

  "& .MuiSelect-select": {
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
  },

  "& .MuiSvgIcon-root": {
    color: "#94a3b8",
  },

  "& input[type='date']::-webkit-calendar-picker-indicator": {
    filter: "invert(1)",
    opacity: 0.75,
  },

  "& input[type='time']::-webkit-calendar-picker-indicator": {
    filter: "invert(1)",
    opacity: 0.75,
  },
};

const historyDetailedGrid =
  "150px 130px 260px 280px 210px 120px 110px 190px 125px 125px";

const historyReportGrid =
  "300px 90px 90px 90px 230px 240px 230px 170px 170px";

const historyTableHeader = {
  display: "grid",
  gridTemplateColumns: historyDetailedGrid,
  minWidth: 1790,
  position: "sticky",
  top: 0,
  zIndex: 5,
  padding: "12px 14px",
  background: "#111827",
  color: "rgba(255,255,255,.68)",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  borderBottom: "1px solid rgba(255,255,255,.08)",
};

const historyTableRow = {
  display: "grid",
  gridTemplateColumns: historyDetailedGrid,
  minWidth: 1790,
  padding: "12px 14px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,.055)",
  color: "rgba(255,255,255,.82)",
  fontSize: 12,
};

const historyReportTitleSx = {
  position: "sticky",
  top: 0,
  zIndex: 6,
  px: 2,
  py: 1.25,
  fontSize: 14,
  fontWeight: 950,
  color: "#93c5fd",
  background: "#111827",
  borderBottom: "1px solid rgba(255,255,255,.08)",
};

const historyReportHeader = {
  display: "grid",
  gridTemplateColumns: historyReportGrid,
  minWidth: 1620,
  position: "sticky",
  top: 43,
  zIndex: 5,
  padding: "12px 14px",
  background: "#0f172a",
  color: "rgba(255,255,255,.7)",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  borderBottom: "1px solid rgba(255,255,255,.08)",
};

const historyReportRow = {
  display: "grid",
  gridTemplateColumns: historyReportGrid,
  minWidth: 1620,
  padding: "12px 14px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,.055)",
  color: "rgba(255,255,255,.82)",
  fontSize: 12,
};

const historyInlinePdfSubSx = {
  color: "rgba(255,255,255,.5)",
  fontSize: 11,
  fontWeight: 700,
  mt: 0.3,
};

const historyMainContentSx = {
  width: "100%",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
};

const historyMainContentSplitSx = {
  width: "100%",
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(420px, .85fr)",
  gap: 1.6,
  alignItems: "stretch",
  overflow: "hidden",
};

const historyTablePanelSx = {
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 1.2,
};

const historyTableViewportSx = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(15,23,42,.58)",
  scrollbarWidth: "thin",
  scrollbarColor: "#60a5fa rgba(15,23,42,.85)",

  "&::-webkit-scrollbar": {
    width: 10,
    height: 10,
  },

  "&::-webkit-scrollbar-track": {
    background: "rgba(15,23,42,.85)",
    borderRadius: 999,
  },

  "&::-webkit-scrollbar-thumb": {
    background:
      "linear-gradient(180deg,#2563eb,#60a5fa)",
    borderRadius: 999,
    border: "2px solid rgba(15,23,42,.95)",
  },
};

const historyPaginationBarSx = {
  flexShrink: 0,
  minHeight: 54,
  px: 1.4,
  py: 1,
  borderRadius: "14px",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: 1.4,
  background:
    "linear-gradient(180deg, rgba(15,23,42,.92), rgba(2,6,23,.88))",
  border: "1px solid rgba(96,165,250,.16)",
  boxShadow:
    "0 16px 36px rgba(2,6,23,.32)",

  "@media (max-width: 900px)": {
    gridTemplateColumns: "1fr",
  },
};

const historyPaginationTextSx = {
  color: "rgba(255,255,255,.62)",
  fontSize: 12,
  fontWeight: 850,

  "& b": {
    color: "#fff",
    fontWeight: 950,
  },
};

const historyPaginationControlsSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
  flexWrap: "wrap",
};

const historyPaginationButtonSx = {
  height: 34,
  minWidth: 104,
  borderRadius: "10px",
  textTransform: "none",
  fontSize: 12,
  fontWeight: 900,
  color: "#fff",
  background: "rgba(255,255,255,.055)",
  border: "1px solid rgba(255,255,255,.09)",

  "&:hover": {
    background: "rgba(59,130,246,.16)",
    borderColor: "rgba(59,130,246,.30)",
  },

  "&.Mui-disabled": {
    color: "rgba(255,255,255,.28)",
    background: "rgba(255,255,255,.025)",
    borderColor: "rgba(255,255,255,.05)",
  },
};

const historyPageCountSx = {
  minHeight: 34,
  px: 1.5,
  borderRadius: "10px",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.07)",
  display: "flex",
  alignItems: "center",
  color: "rgba(255,255,255,.70)",
  fontSize: 12,
  fontWeight: 850,

  "& span": {
    mx: 0.8,
    color: "#60a5fa",
    fontWeight: 950,
  },
};

const historyPageSizeWrapSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 1,
  color: "rgba(255,255,255,.62)",
  fontSize: 12,
  fontWeight: 850,
};

const historyPageSizeSelectStyle = {
  height: 34,
  minWidth: 76,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.10)",
  background: "#0f172a",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
  fontWeight: 900,
  colorScheme: "dark",
};

const historyInlinePdfSx = {
  height: "100%",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: "18px",
  background:
    "linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.96))",
  border: "1px solid rgba(96,165,250,.20)",
  overflow: "hidden",
};

const historyInlinePdfHeaderSx = {
  flexShrink: 0,
  p: 1.4,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1.4,
  borderBottom: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.035)",
};

const historyInlinePdfFrameWrapSx = {
  flex: 1,
  minHeight: 0,
  p: 1.2,
  overflow: "hidden",
};

const historyInlinePdfTitleSx = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 950,
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