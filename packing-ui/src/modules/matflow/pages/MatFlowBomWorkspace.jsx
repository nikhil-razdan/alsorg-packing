import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    Collapse,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RuleOutlinedIcon from "@mui/icons-material/RuleOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { MATFLOW_ROLES, useMatFlow } from "../matflowUi";
import { extractMatFlowPage, matflowApi, readMatFlowError } from "../api/matflowApi";
import { downloadMatFlowBomExcel, downloadMatFlowExcel } from "../api/matflowExcel";
import {
    EmptyState,
    ErrorBox,
    LoadingBlock,
    MatFlowDeleteDialog,
    MatFlowKanbanBoard,
    MatFlowPagination,
    MatFlowStatusChip,
    MatFlowViewToggle,
    PageHero,
    SummaryCard,
    clean,
    dangerBtnSx,
    dialogActionsSx,
    dialogContentSx,
    dialogPaperSx,
    dialogTitleSx,
    fieldSx,
    formatDate,
    formatQty,
    mainTextSx,
    normalize,
    numeric,
    pageSx,
    panelSx,
    primaryBtnSx,
    readable,
    secondaryBtnSx,
    subTextSx,
    tableCellSx,
    tableHeaderSx,
    tableRowSx,
    tableShellSx,
    useMatFlowPagination,
} from "../matflowUi";

const BOM_STATUSES = ["", "DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "SUPERSEDED"];
const EDIT_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.ENGINEERING];
const REVIEW_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];
const REQUISITION_ROLES = [MATFLOW_ROLES.ADMIN, MATFLOW_ROLES.MANAGER, MATFLOW_ROLES.PRODUCTION];

const projectOf = (bom) => bom?.project || {};
const linesOf = (bom) => Array.isArray(bom?.lines) ? bom.lines : [];
const upperCode = (value) => clean(value).toUpperCase();

const bomWorkflow = (bom) => {
    const status = normalize(bom?.status);
    if (status === "DRAFT") {
        return ["Engineering", "Add material lines and define one Processing Unit only where the material needs preprocessing, then submit."];
    }
    if (status === "RETURNED") {
        return ["Engineering", "Correct the returned BOM and resubmit to Production."];
    }
    if (status === "SUBMITTED") {
        return ["Production", "Review the BOM on this same page and mark Reviewed or Return."];
    }
    if (status === "APPROVED") {
        return ["Production", bom?.effective
            ? "Production review complete. This BOM is effective and can be requisitioned."
            : "Approved revision is waiting to become effective."];
    }
    if (status === "SUPERSEDED") {
        return ["Engineering", "Use the current latest revision."];
    }
    return ["MatFlow", "Review BOM state."];
};

const BOM_KANBAN_COLUMNS = [
    { key: "DRAFT", label: "Engineering Draft", subtitle: "BOM is being prepared" },
    { key: "REVIEW", label: "Production Review", subtitle: "Submitted and waiting for review" },
    { key: "READY", label: "MR Ready", subtitle: "Reviewed/effective BOM" },
    { key: "RETURNED", label: "Needs Correction", subtitle: "Returned to Engineering" },
    { key: "ARCHIVED", label: "Superseded", subtitle: "Older revision retained for trace" },
];

const bomKanbanLane = (bom) => {
    const status = normalize(bom?.status);
    if (status === "SUBMITTED") return "REVIEW";
    if (status === "APPROVED") return "READY";
    if (status === "RETURNED") return "RETURNED";
    if (status === "SUPERSEDED") return "ARCHIVED";
    return "DRAFT";
};

export function MatFlowBomListPage() {
    const navigate = useNavigate();
    const { hasRole, selectedPlantParam } = useMatFlow();
    const canCreate = hasRole(EDIT_ROLES);

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [viewMode, setViewMode] = useState("KANBAN");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteWorking, setDeleteWorking] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await matflowApi.listBoms({
                search: clean(search) || undefined,
                status: status || undefined,
                latestOnly: true,
            });
            const list = extractMatFlowPage(response?.data).rows;
            setRows(list.filter((row) =>
                !selectedPlantParam ||
                upperCode(row?.plantCode) === upperCode(selectedPlantParam)
            ));
        } catch (requestError) {
            setRows([]);
            setError(readMatFlowError(requestError, "Unable to load Operational BOMs."));
        } finally {
            setLoading(false);
        }
    }, [search, status, selectedPlantParam]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => ({
        draft: rows.filter((row) => normalize(row.status) === "DRAFT").length,
        review: rows.filter((row) => normalize(row.status) === "SUBMITTED").length,
        ready: rows.filter((row) => normalize(row.status) === "APPROVED" && row.effective === true).length,
        correction: rows.filter((row) => normalize(row.status) === "RETURNED").length,
    }), [rows]);

    const pagination = useMatFlowPagination(rows, 20);

    const confirmDelete = async () => {
        if (!deleteTarget?.id || deleteTarget.rowVersion == null) return;
        setDeleteWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftBom(deleteTarget.id, deleteTarget.rowVersion);
            setDeleteTarget(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete the Draft BOM."));
        } finally {
            setDeleteWorking(false);
        }
    };

    const openLabel = (row) =>
        normalize(row?.status) === "SUBMITTED" && hasRole(REVIEW_ROLES) ? "Review" : "Open";

    const renderCard = (row) => {
        const workflow = bomWorkflow(row);
        return (
            <Card sx={{ ...panelSx, m: 0, p: 1.05, boxShadow: "none" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: .7, alignItems: "flex-start" }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ ...mainTextSx, fontSize: 12.5 }}>{row.bomNumber || "-"}</Typography>
                        <Typography sx={subTextSx}>Rev {row.revisionNo ?? "-"} · {row.projectCode || "-"}</Typography>
                    </Box>
                    <MatFlowStatusChip status={row.status} />
                </Box>
                <Typography sx={{ ...mainTextSx, mt: .75 }}>{row.productName || "-"}</Typography>
                <Typography sx={subTextSx}>{row.drawingNo || "-"} · {row.plantCode || "-"}</Typography>
                <Box sx={{ mt: .8, p: .75, borderRadius: 1.6, background: "var(--mf-surface)", border: "1px solid var(--mf-border)" }}>
                    <Typography sx={{ ...subTextSx, m: 0 }}>NEXT OWNER</Typography>
                    <Typography sx={mainTextSx}>{workflow[0]}</Typography>
                </Box>
                <Box sx={{ mt: .85, display: "flex", gap: .5, flexWrap: "wrap" }}>
                    <Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={primaryBtnSx}>{openLabel(row)}</Button>
                    {canCreate && normalize(row.status) === "DRAFT" && row.latestRevision && !row.effective && row.rowVersion != null && (
                        <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>Delete</Button>
                    )}
                </Box>
            </Card>
        );
    };

    return (
        <Box sx={pageSx}>
            <PageHero
                badge="BOM WORKFLOW"
                title="Product BOMs"
                subtitle="Engineering prepares the BOM → Production reviews it → the effective BOM becomes ready for MR."
                actions={
                    <>
                        <Button
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={() => downloadMatFlowExcel({
                                fileName: "MatFlow_Operational_BOMs",
                                sheetName: "BOMs",
                                title: "MatFlow Operational BOMs",
                                rows,
                            })}
                            sx={secondaryBtnSx}
                        >
                            Excel
                        </Button>
                        <Button startIcon={<RefreshIcon />} onClick={load} sx={secondaryBtnSx}>Refresh</Button>
                        {canCreate && (
                            <Button startIcon={<AddIcon />} onClick={() => navigate("/matflow/boms/new")} sx={primaryBtnSx}>
                                Create BOM
                            </Button>
                        )}
                    </>
                }
            />

            <ErrorBox>{error}</ErrorBox>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
                <SummaryCard label="Draft" value={counts.draft} />
                <SummaryCard label="Waiting Review" value={counts.review} />
                <SummaryCard label="MR Ready" value={counts.ready} />
                <SummaryCard label="Needs Correction" value={counts.correction} />
            </Box>

            <Card sx={{ ...panelSx, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 190px auto" }, gap: 1, alignItems: "center" }}>
                <TextField
                    label="Search BOM / PD / Product / Drawing"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    sx={fieldSx}
                />
                <TextField
                    select
                    label="Status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    sx={fieldSx}
                >
                    {BOM_STATUSES.map((value) => (
                        <MenuItem key={value || "ALL"} value={value}>
                            {value ? readable(value) : "All"}
                        </MenuItem>
                    ))}
                </TextField>
                <MatFlowViewToggle
                    value={viewMode}
                    onChange={setViewMode}
                    options={[{ value: "KANBAN", label: "Workflow Board" }, { value: "TABLE", label: "Table" }]}
                />
            </Card>

            <Card sx={panelSx}>
                {loading ? <LoadingBlock /> : viewMode === "KANBAN" ? (
                    <MatFlowKanbanBoard
                        columns={BOM_KANBAN_COLUMNS}
                        items={rows}
                        laneFor={bomKanbanLane}
                        renderCard={renderCard}
                        minColumnWidth={255}
                        boardHeight={{ xs: 560, md: "clamp(480px, calc(100vh - 315px), 690px)" }}
                        completedLaneKeys={["ARCHIVED"]}
                        completedLaneLimit={8}
                        boardKey={`${status || "ALL"}:${search}`}
                    />
                ) : (
                    <Box sx={tableShellSx}>
                        <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "165px minmax(230px,1fr) 135px 120px 150px 220px 170px" }}>
                            {["BOM / Revision", "PD No. / Product", "Drawing", "Plant", "Status", "Current Owner / Next", "Action"].map((heading) => (
                                <Box key={heading} sx={tableCellSx}>{heading}</Box>
                            ))}
                        </Box>
                        {pagination.pageItems.length === 0 ? <EmptyState>No BOMs found.</EmptyState> : pagination.pageItems.map((row) => {
                            const workflow = bomWorkflow(row);
                            return (
                                <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "165px minmax(230px,1fr) 135px 120px 150px 220px 170px" }}>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.bomNumber || "-"}</Typography>
                                        <Typography sx={subTextSx}>Rev {row.revisionNo ?? "-"}{row.effective ? " · Effective" : ""}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{row.projectCode || "-"}</Typography>
                                        <Typography sx={subTextSx}>{row.productName || "-"} · {row.clientName || "-"}</Typography>
                                    </Box>
                                    <Box sx={tableCellSx}>{row.drawingNo || "-"}</Box>
                                    <Box sx={tableCellSx}>{row.plantCode || "-"}</Box>
                                    <Box sx={tableCellSx}><MatFlowStatusChip status={row.status} /></Box>
                                    <Box sx={tableCellSx}>
                                        <Typography sx={mainTextSx}>{workflow[0]}</Typography>
                                        <Typography sx={subTextSx}>{workflow[1]}</Typography>
                                    </Box>
                                    <Box sx={{ ...tableCellSx, display: "flex", gap: .6, flexWrap: "wrap" }}>
                                        <Button onClick={() => navigate(`/matflow/boms/${row.id}`)} sx={secondaryBtnSx}>
                                            {openLabel(row)}
                                        </Button>
                                        {canCreate && normalize(row.status) === "DRAFT" && row.latestRevision && !row.effective && row.rowVersion != null && (
                                            <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(row)} sx={dangerBtnSx}>
                                                Delete
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                {!loading && viewMode === "TABLE" && (
                    <MatFlowPagination
                        {...pagination}
                        onPageChange={pagination.setPage}
                        onPageSizeChange={pagination.setPageSize}
                        label="Operational BOMs"
                    />
                )}
            </Card>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={deleteTarget ? `${deleteTarget.bomNumber || "BOM"} · Rev ${deleteTarget.revisionNo ?? "-"}` : "Draft BOM"}
                description="Only the latest non-effective Draft revision can be permanently deleted. Submitted, returned, reviewed and superseded revisions remain traceable."
                working={deleteWorking}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
            />
        </Box>
    );
}

const sectionPalette = {
    METAL: "#60a5fa",
    WOOD: "#8b5cf6",
    VENEER: "#a78bfa",
    LAMINATE: "#c084fc",
    STONE_TILE: "#14b8a6",
    GLASS_MIRROR: "#38bdf8",
    FABRIC_LEATHER: "#ec4899",
    UPHOLSTERY: "#f472b6",
    HARDWARE: "#f59e0b",
    PAINT_POLISH: "#fb7185",
    ADHESIVE_CHEMICAL: "#f97316",
    PACKAGING: "#22c55e",
    RAW_MATERIAL: "#94a3b8",
    OTHER: "#94a3b8",
};

const categoryKey = (line) =>
    normalize(
        line?.materialCategorySnapshot ||
        line?.materialCategory ||
        line?.category ||
        "OTHER"
    ) || "OTHER";

const categoryAccent = (key) => sectionPalette[normalize(key)] || "#60a5fa";

const sectionTitle = (key) => readable(key || "OTHER");

const routesForLine = (routes, lineId) =>
    (Array.isArray(routes) ? routes : [])
        .filter((step) => String(step?.bomLineId || "") === String(lineId || ""))
        .filter((step) => normalize(step?.stepType) === "PROCESSING")
        .sort((a, b) => numeric(a?.sequenceNo) - numeric(b?.sequenceNo));

function BuilderMetaPill({ label, value, accent = "#60a5fa" }) {
    return (
        <Box sx={builderMetaPillSx(accent)}>
            <Typography sx={builderMetaLabelSx}>{label}</Typography>
            <Typography noWrap sx={builderMetaValueSx}>{value ?? "-"}</Typography>
        </Box>
    );
}

function BuilderMiniStat({ icon, title, value, subtitle, accent = "#60a5fa" }) {
    return (
        <Card sx={builderMiniStatSx(accent)}>
            <Box sx={builderMiniIconSx(accent)}>{icon}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={builderMiniTitleSx}>{title}</Typography>
                <Typography sx={builderMiniValueSx}>{value}</Typography>
                <Typography sx={builderMiniSubSx}>{subtitle}</Typography>
            </Box>
        </Card>
    );
}

const emptyProductAttachmentState = {
    productImageAvailable: false,
    drawingAvailable: false,
    productImageFileName: "",
    drawingFileName: "",
};

const revokeObjectUrl = (url) => {
    if (!url) return;
    try {
        URL.revokeObjectURL(url);
    } catch {
        // Best-effort browser cleanup.
    }
};

const fileExtension = (name) => {
    const value = clean(name).toLowerCase();
    const dot = value.lastIndexOf(".");
    return dot >= 0 ? value.slice(dot + 1) : "";
};

const productDimensionsText = (product) => {
    if (clean(product?.dimensions)) return clean(product.dimensions);
    const values = [product?.dimensionLength, product?.dimensionBreadth, product?.dimensionHeight];
    if (values.some((value) => value === null || value === undefined || value === "")) return "Not specified";
    return `${values.map((value) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })).join(" × ")} ${clean(product?.dimensionUom) || "MM"}`;
};

const openProductFileBlob = (blob, fileName = "MatFlow_Product_Attachment") => {
    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("The Product attachment is empty.");
    }

    const url = URL.createObjectURL(blob);
    const type = clean(blob.type).toLowerCase();
    const previewable = type.startsWith("image/") || type === "application/pdf";

    if (previewable) {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (!opened) {
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        }
    } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = clean(fileName) || "MatFlow_Product_Attachment";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    window.setTimeout(() => revokeObjectUrl(url), 60_000);
};

function useProductReferenceFiles({ projectId, productId, enabled = true, canManage = false, setError }) {
    const [attachments, setAttachments] = useState(emptyProductAttachmentState);
    const [imageUrl, setImageUrl] = useState("");
    const [drawingPreviewUrl, setDrawingPreviewUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [working, setWorking] = useState(false);

    const replaceImageUrl = useCallback((nextUrl = "") => {
        setImageUrl((current) => {
            if (current && current !== nextUrl) revokeObjectUrl(current);
            return nextUrl || "";
        });
    }, []);

    const replaceDrawingPreviewUrl = useCallback((nextUrl = "") => {
        setDrawingPreviewUrl((current) => {
            if (current && current !== nextUrl) revokeObjectUrl(current);
            return nextUrl || "";
        });
    }, []);

    const reset = useCallback(() => {
        setAttachments(emptyProductAttachmentState);
        replaceImageUrl("");
        replaceDrawingPreviewUrl("");
    }, [replaceImageUrl, replaceDrawingPreviewUrl]);

    const load = useCallback(async () => {
        if (!enabled || !projectId || !productId) {
            reset();
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const statusResponse = await matflowApi.getProjectProductAttachmentStatus(projectId, productId);
            const next = {
                ...emptyProductAttachmentState,
                ...(statusResponse?.data || {}),
            };
            setAttachments(next);

            if (next.productImageAvailable) {
                try {
                    const imageResponse = await matflowApi.getProjectProductImage(projectId, productId);
                    const blob = imageResponse?.data;
                    if (
                        blob instanceof Blob &&
                        blob.size > 0 &&
                        clean(blob.type).toLowerCase().startsWith("image/")
                    ) {
                        replaceImageUrl(URL.createObjectURL(blob));
                    } else {
                        replaceImageUrl("");
                    }
                } catch {
                    // Status remains useful even if the inline preview cannot be loaded.
                    replaceImageUrl("");
                }
            } else {
                replaceImageUrl("");
            }

            if (
                next.drawingAvailable &&
                ["png", "jpg", "jpeg", "webp"].includes(fileExtension(next.drawingFileName))
            ) {
                try {
                    const drawingResponse = await matflowApi.getProjectProductDrawing(projectId, productId);
                    const drawingBlob = drawingResponse?.data;
                    if (
                        drawingBlob instanceof Blob &&
                        drawingBlob.size > 0 &&
                        clean(drawingBlob.type).toLowerCase().startsWith("image/")
                    ) {
                        replaceDrawingPreviewUrl(URL.createObjectURL(drawingBlob));
                    } else {
                        replaceDrawingPreviewUrl("");
                    }
                } catch {
                    replaceDrawingPreviewUrl("");
                }
            } else {
                replaceDrawingPreviewUrl("");
            }
        } catch (requestError) {
            reset();
            if (typeof setError === "function") {
                setError(readMatFlowError(
                    requestError,
                    "Unable to load Product image / drawing attachments."
                ));
            }
        } finally {
            setLoading(false);
        }
    }, [
        enabled,
        projectId,
        productId,
        replaceImageUrl,
        replaceDrawingPreviewUrl,
        reset,
        setError,
    ]);

    useEffect(() => {
        load();
        return () => {
            replaceImageUrl("");
            replaceDrawingPreviewUrl("");
        };
    }, [load, replaceImageUrl, replaceDrawingPreviewUrl]);

    const upload = useCallback(async (kind, file) => {
        if (!canManage || !projectId || !productId || !file) return;

        if (kind === "IMAGE") {
            if (file.size > 8 * 1024 * 1024) {
                setError?.("Product image cannot exceed 8 MB.");
                return;
            }
            const ext = fileExtension(file.name);
            if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
                setError?.("Product image must be PNG, JPG/JPEG or WEBP.");
                return;
            }
        } else {
            if (file.size > 20 * 1024 * 1024) {
                setError?.("Product drawing cannot exceed 20 MB.");
                return;
            }
            const ext = fileExtension(file.name);
            if (!["pdf", "png", "jpg", "jpeg", "webp", "dwg", "dxf"].includes(ext)) {
                setError?.("Product drawing must be PDF, image, DWG or DXF.");
                return;
            }
        }

        setWorking(true);
        setError?.("");
        try {
            if (kind === "IMAGE") {
                await matflowApi.uploadProjectProductImage(projectId, productId, file);
            } else {
                await matflowApi.uploadProjectProductDrawing(projectId, productId, file);
            }
            await load();
        } catch (requestError) {
            setError?.(readMatFlowError(
                requestError,
                kind === "IMAGE"
                    ? "Unable to attach the Product image."
                    : "Unable to attach the Product drawing."
            ));
        } finally {
            setWorking(false);
        }
    }, [canManage, projectId, productId, load, setError]);

    const open = useCallback(async (kind) => {
        if (!projectId || !productId) return;

        setWorking(true);
        setError?.("");
        try {
            const response = kind === "IMAGE"
                ? await matflowApi.getProjectProductImage(projectId, productId)
                : await matflowApi.getProjectProductDrawing(projectId, productId);

            openProductFileBlob(
                response?.data,
                kind === "IMAGE"
                    ? attachments.productImageFileName || "MatFlow_Product_Image"
                    : attachments.drawingFileName || "MatFlow_Product_Drawing"
            );
        } catch (requestError) {
            setError?.(readMatFlowError(
                requestError,
                kind === "IMAGE"
                    ? "Unable to open the Product image."
                    : "Unable to open the Product drawing."
            ));
        } finally {
            setWorking(false);
        }
    }, [
        projectId,
        productId,
        attachments.productImageFileName,
        attachments.drawingFileName,
        setError,
    ]);

    const remove = useCallback(async (kind) => {
        if (!canManage || !projectId || !productId) return;

        setWorking(true);
        setError?.("");
        try {
            if (kind === "IMAGE") {
                await matflowApi.deleteProjectProductImage(projectId, productId);
            } else {
                await matflowApi.deleteProjectProductDrawing(projectId, productId);
            }
            await load();
        } catch (requestError) {
            setError?.(readMatFlowError(
                requestError,
                kind === "IMAGE"
                    ? "Unable to remove the Product image."
                    : "Unable to remove the Product drawing."
            ));
        } finally {
            setWorking(false);
        }
    }, [canManage, projectId, productId, load, setError]);

    return {
        attachments,
        imageUrl,
        drawingPreviewUrl,
        loading,
        working,
        load,
        upload,
        open,
        remove,
    };
}

function ProductReferencePanel({
    project,
    product,
    files,
    canManage = false,
    contextUnavailable = false,
}) {
    const ready = Boolean(project?.id && product?.id);
    const attachments = files?.attachments || emptyProductAttachmentState;
    const busy = files?.loading || files?.working;

    return (
        <Card sx={builderSidePanelSx}>
            <Box sx={builderSideTitleRowSx}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={builderSideTitleSx}>Product References</Typography>
                    <Typography sx={builderAssistantSubSx}>
                        Product image and drawing stay linked to the Product across BOM revisions.
                    </Typography>
                </Box>
                <ImageOutlinedIcon sx={{ color: "#93c5fd" }} />
            </Box>

            {!ready ? (
                <Box sx={builderAttachmentEmptySx}>
                    <ImageOutlinedIcon sx={{ fontSize: 28, opacity: .55 }} />
                    <Typography sx={{ ...builderAssistantSubSx, mt: .55, textAlign: "center" }}>
                        {contextUnavailable
                            ? "Product attachment context could not be resolved from the Project portfolio."
                            : "Select the Product / Drawing to show or attach its reference files."}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ mt: 1.05, display: "grid", gap: 1 }}>
                    <Box sx={builderAttachmentIdentitySx}>
                        <Typography noWrap sx={builderQuickTitleSx}>
                            {product.productName || "Product / Item"}
                        </Typography>
                        <Typography sx={builderAssistantSubSx}>
                            {project.projectCode || "-"} · {product.drawingNo || "-"} · Rev {product.drawingRevision || "0"}
                        </Typography>
                        <Typography sx={{ ...builderAssistantSubSx, mt: .25, fontWeight: 850 }}>
                            Size: {productDimensionsText(product)} · L × B × H
                        </Typography>
                    </Box>

                    <Box>
                        <Box sx={builderAttachmentLabelRowSx}>
                            <Typography sx={builderAttachmentLabelSx}>PRODUCT IMAGE</Typography>
                            <Chip
                                size="small"
                                label={attachments.productImageAvailable ? "ATTACHED" : "OPTIONAL"}
                                sx={attachments.productImageAvailable
                                    ? builderAttachmentAttachedChipSx
                                    : builderAttachmentOptionalChipSx}
                            />
                        </Box>

                        {attachments.productImageAvailable && files?.imageUrl ? (
                            <Box
                                component="button"
                                type="button"
                                onClick={() => files.open("IMAGE")}
                                disabled={busy}
                                sx={builderProductImageButtonSx}
                                title="Open Product image"
                            >
                                <Box
                                    component="img"
                                    src={files.imageUrl}
                                    alt={`${product.productName || "Product"} reference`}
                                    sx={builderProductImageSx}
                                />
                            </Box>
                        ) : (
                            <Box sx={builderAttachmentEmptySx}>
                                <ImageOutlinedIcon sx={{ fontSize: 28, opacity: .55 }} />
                                <Typography sx={{ ...builderAssistantSubSx, mt: .45 }}>
                                    {files?.loading
                                        ? "Loading image..."
                                        : "No Product image attached."}
                                </Typography>
                            </Box>
                        )}

                        <Box sx={builderAttachmentActionRowSx}>
                            {attachments.productImageAvailable && (
                                <Button
                                    size="small"
                                    startIcon={<OpenInNewOutlinedIcon />}
                                    onClick={() => files.open("IMAGE")}
                                    disabled={busy}
                                    sx={secondaryBtnSx}
                                >
                                    View
                                </Button>
                            )}

                            {canManage && (
                                <Button
                                    component="label"
                                    size="small"
                                    startIcon={<FileUploadOutlinedIcon />}
                                    disabled={busy}
                                    sx={attachments.productImageAvailable ? secondaryBtnSx : primaryBtnSx}
                                >
                                    {attachments.productImageAvailable ? "Replace" : "Attach Image"}
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={(event) => {
                                            const selected = event.target.files?.[0] || null;
                                            event.target.value = "";
                                            if (selected) files.upload("IMAGE", selected);
                                        }}
                                    />
                                </Button>
                            )}

                            {canManage && attachments.productImageAvailable && (
                                <IconButton
                                    size="small"
                                    title="Remove Product image"
                                    onClick={() => files.remove("IMAGE")}
                                    disabled={busy}
                                    sx={builderAttachmentDeleteSx}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>

                    <Box sx={builderDrawingTileSx}>
                        <Box sx={builderAttachmentLabelRowSx}>
                            <Typography sx={builderAttachmentLabelSx}>PRODUCT DRAWING</Typography>
                            <Chip
                                size="small"
                                label={attachments.drawingAvailable ? "ATTACHED" : "OPTIONAL"}
                                sx={attachments.drawingAvailable
                                    ? builderAttachmentAttachedChipSx
                                    : builderAttachmentOptionalChipSx}
                            />
                        </Box>

                        {attachments.drawingAvailable && files?.drawingPreviewUrl ? (
                            <Box
                                component="button"
                                type="button"
                                onClick={() => files.open("DRAWING")}
                                disabled={busy}
                                sx={builderDrawingPreviewButtonSx}
                                title="Open Product drawing"
                            >
                                <Box
                                    component="img"
                                    src={files.drawingPreviewUrl}
                                    alt={`${product.drawingNo || "Product"} drawing`}
                                    sx={builderDrawingPreviewSx}
                                />
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", alignItems: "center", gap: .8, mt: .75 }}>
                                <Box sx={builderDrawingIconSx}><DescriptionOutlinedIcon /></Box>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography noWrap sx={builderQuickTitleSx}>
                                        {attachments.drawingAvailable
                                            ? attachments.drawingFileName || product.drawingNo || "Product Drawing"
                                            : "No drawing attachment"}
                                    </Typography>
                                    <Typography sx={builderAssistantSubSx}>
                                        PDF / image / DWG / DXF · up to 20 MB
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        <Box sx={builderAttachmentActionRowSx}>
                            {attachments.drawingAvailable && (
                                <Button
                                    size="small"
                                    startIcon={<OpenInNewOutlinedIcon />}
                                    onClick={() => files.open("DRAWING")}
                                    disabled={busy}
                                    sx={secondaryBtnSx}
                                >
                                    Open / Download
                                </Button>
                            )}

                            {canManage && (
                                <Button
                                    component="label"
                                    size="small"
                                    startIcon={<FileUploadOutlinedIcon />}
                                    disabled={busy}
                                    sx={attachments.drawingAvailable ? secondaryBtnSx : primaryBtnSx}
                                >
                                    {attachments.drawingAvailable ? "Replace" : "Attach Drawing"}
                                    <input
                                        hidden
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,application/pdf,image/png,image/jpeg,image/webp"
                                        onChange={(event) => {
                                            const selected = event.target.files?.[0] || null;
                                            event.target.value = "";
                                            if (selected) files.upload("DRAWING", selected);
                                        }}
                                    />
                                </Button>
                            )}

                            {canManage && attachments.drawingAvailable && (
                                <IconButton
                                    size="small"
                                    title="Remove Product drawing"
                                    onClick={() => files.remove("DRAWING")}
                                    disabled={busy}
                                    sx={builderAttachmentDeleteSx}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    </Box>

                    {!canManage && (
                        <Typography sx={{ ...builderAssistantSubSx, mt: -.1 }}>
                            View-only here. Engineering manages Product reference files.
                        </Typography>
                    )}
                </Box>
            )}
        </Card>
    );
}

function BuilderWorkflowItem({ number, title, subtitle, active, done }) {
    return (
        <Box sx={builderWorkflowItemSx(active, done)}>
            <Box sx={builderWorkflowNumberSx(active, done)}>{done ? "✓" : number}</Box>
            <Box sx={{ minWidth: 0 }}>
                <Typography sx={builderWorkflowTitleSx}>{title}</Typography>
                <Typography sx={builderAssistantSubSx}>{subtitle}</Typography>
            </Box>
        </Box>
    );
}

function BuilderQuickAction({ icon, title, subtitle, onClick }) {
    return (
        <Button onClick={onClick} sx={builderQuickActionSx}>
            <Box sx={builderQuickIconSx}>{icon}</Box>
            <Box sx={{ minWidth: 0, textAlign: "left", flex: 1 }}>
                <Typography sx={builderQuickTitleSx}>{title}</Typography>
                <Typography sx={builderAssistantSubSx}>{subtitle}</Typography>
            </Box>
            <ArrowForwardIcon sx={{ fontSize: 17, opacity: .65 }} />
        </Button>
    );
}

export function MatFlowBomCreatePage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { selectedPlantParam, hasRole } = useMatFlow();

    const requestedProductId = params.get("productId") || "";
    const [projects, setProjects] = useState([]);
    const [form, setForm] = useState({
        projectId: "",
        projectDrawingId: requestedProductId,
        remarks: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError("");
            try {
                const response = await matflowApi.listProjects({
                    active: true,
                    plantCode: selectedPlantParam || undefined,
                });
                const list = (Array.isArray(response?.data) ? response.data : [])
                    .filter((project) => project?.active !== false)
                    .map((project) => ({
                        ...project,
                        products: (Array.isArray(project?.products) ? project.products : [])
                            .filter((product) => product?.active !== false),
                    }))
                    .filter((project) => project.products.length > 0);

                if (!active) return;
                setProjects(list);

                if (requestedProductId) {
                    const owner = list.find((project) =>
                        project.products.some((product) => String(product.id) === String(requestedProductId))
                    );
                    if (owner) {
                        setForm((current) => ({
                            ...current,
                            projectId: String(owner.id),
                            projectDrawingId: String(requestedProductId),
                        }));
                    } else {
                        setError("The requested Product is inactive or outside your current plant access.");
                    }
                }
            } catch (requestError) {
                if (active) {
                    setProjects([]);
                    setError(readMatFlowError(requestError, "Unable to load active Projects and Products."));
                }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [requestedProductId, selectedPlantParam]);

    const selectedProject = projects.find((project) => String(project.id) === String(form.projectId)) || null;
    const products = Array.isArray(selectedProject?.products) ? selectedProject.products : [];
    const selectedProduct = products.find((product) => String(product.id) === String(form.projectDrawingId)) || null;

    const canManageProductFiles = hasRole(EDIT_ROLES);
    const productFiles = useProductReferenceFiles({
        projectId: selectedProject?.id || "",
        productId: selectedProduct?.id || "",
        enabled: Boolean(selectedProject?.id && selectedProduct?.id),
        canManage: canManageProductFiles,
        setError,
    });

    const save = async () => {
        if (!selectedProject?.id) {
            setError("Select a PD No. / Project.");
            return;
        }
        if (!selectedProduct?.id) {
            setError("Select an active Product / Drawing.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            const response = await matflowApi.createBom({
                projectDrawingId: selectedProduct.id,
                remarks: clean(form.remarks) || null,
            });
            if (!response?.data?.id) throw new Error("Created BOM ID was not returned.");
            navigate(`/matflow/boms/${response.data.id}`, { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to create BOM Draft."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingBlock />;

    const ready = Boolean(selectedProject?.id && selectedProduct?.id);
    const completion = ready ? 100 : selectedProject?.id ? 50 : 0;

    return (
        <Box sx={pageSx}>
            <Box sx={builderHeroSx}>
                <Box sx={builderHeroLeftSx}>
                    <Box sx={builderChipRowSx}>
                        <Chip label="MATFLOW BOM BUILDER" sx={builderLabelChipSx} />
                        <Chip label={selectedProject?.projectCode || "SELECT PD NO."} sx={builderProjectChipSx} />
                        <Chip label="● NEW DRAFT" sx={builderStatusChipSx("DRAFT")} />
                    </Box>
                    <Typography sx={builderPageTitleSx}>
                        {selectedProduct?.productName || "Create Product BOM"}
                    </Typography>
                    <Typography sx={builderPageSubSx}>
                        Start the operational material BOM against one Product / Drawing. MatFlow will generate the
                        canonical BOM number automatically and open the section-wise builder for Engineering.
                    </Typography>
                    <Box sx={builderMetaRowSx}>
                        <BuilderMetaPill label="PD No." value={selectedProject?.projectCode || "Not selected"} accent="#60a5fa" />
                        <BuilderMetaPill label="Drawing" value={selectedProduct?.drawingNo || "Not selected"} accent="#a78bfa" />
                        <BuilderMetaPill label="Plant" value={selectedProject?.plantCode || selectedPlantParam || "-"} accent="#22c55e" />
                    </Box>
                </Box>

                <Box sx={builderHeroRightSx}>
                    <Card sx={builderReadinessCardSx}>
                        <Box sx={builderReadinessTopSx}>
                            <Box>
                                <Typography sx={builderReadinessLabelSx}>Builder Context</Typography>
                                <Typography sx={builderReadinessValueSx}>{completion}%</Typography>
                            </Box>
                            <Box sx={builderReadinessIconSx}><Inventory2OutlinedIcon /></Box>
                        </Box>
                        <LinearProgress variant="determinate" value={completion} sx={builderProgressSx("#60a5fa")} />
                        <Typography sx={builderReadinessHintSx}>
                            {ready ? "Project and Product selected. Create the Draft to begin material authoring." : "Select PD No. and Product / Drawing."}
                        </Typography>
                    </Card>
                    <Box sx={builderHeroActionRowSx}>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>
                        <Button startIcon={<SaveOutlinedIcon />} onClick={save} disabled={saving || !ready} sx={primaryBtnSx}>
                            {saving ? "Creating..." : "Create Draft BOM"}
                        </Button>
                    </Box>
                </Box>
            </Box>

            <ErrorBox>{error}</ErrorBox>

            <Box sx={builderSummaryGridSx}>
                <BuilderMiniStat icon={<RuleOutlinedIcon />} title="PD No." value={selectedProject?.projectCode || "-"} subtitle={selectedProject?.projectName || "Select Project"} accent="#60a5fa" />
                <BuilderMiniStat icon={<Inventory2OutlinedIcon />} title="Product" value={selectedProduct?.productName || "-"} subtitle={selectedProject?.clientName || "Select Product"} accent="#22c55e" />
                <BuilderMiniStat icon={<AccountTreeOutlinedIcon />} title="Drawing" value={selectedProduct?.drawingNo || "-"} subtitle={`Revision ${selectedProduct?.drawingRevision || "0"}`} accent="#a78bfa" />
                <BuilderMiniStat icon={<CheckCircleOutlineIcon />} title="Approval" value="Not Required" subtitle="Project/Product are immediately usable" accent="#f59e0b" />
            </Box>

            <Box sx={builderMainGridSx}>
                <Box sx={builderLeftColumnSx}>
                    <Card sx={builderToolbarSx}>
                        <Box>
                            <Typography sx={builderToolbarTitleSx}>BOM Context</Typography>
                            <Typography sx={builderToolbarSubSx}>Choose the owning PD No. and Product / Drawing before material authoring.</Typography>
                        </Box>
                    </Card>

                    <Card sx={{ ...panelSx, m: 0 }}>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
                            <TextField
                                select
                                label="PD No. / Project *"
                                value={form.projectId}
                                onChange={(event) => setForm((current) => ({
                                    ...current,
                                    projectId: event.target.value,
                                    projectDrawingId: "",
                                }))}
                                sx={fieldSx}
                            >
                                {projects.map((project) => (
                                    <MenuItem key={project.id} value={project.id}>
                                        {project.projectCode} · {project.projectName} · {project.clientName}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select
                                label="Product / Drawing *"
                                value={form.projectDrawingId}
                                disabled={!selectedProject}
                                onChange={(event) => setForm((current) => ({ ...current, projectDrawingId: event.target.value }))}
                                sx={fieldSx}
                            >
                                {products.map((product) => (
                                    <MenuItem key={product.id} value={product.id}>
                                        {product.productName} · {product.drawingNo} · Rev {product.drawingRevision || "0"}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                multiline
                                minRows={4}
                                label="Engineering Remarks"
                                value={form.remarks}
                                onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))}
                                sx={{ ...fieldSx, gridColumn: "1 / -1" }}
                                placeholder="Optional scope / engineering notes for this BOM family"
                            />
                        </Box>
                    </Card>
                </Box>

                <Box sx={builderRightColumnSx}>
                    <ProductReferencePanel
                        project={selectedProject}
                        product={selectedProduct}
                        files={productFiles}
                        canManage={canManageProductFiles}
                    />

                    <Card sx={builderSidePanelSx}>
                        <Typography sx={builderSideTitleSx}>After Draft Creation</Typography>
                        <Box sx={{ mt: 1 }}>
                            <BuilderWorkflowItem number="1" title="Engineering" subtitle="Add material lines from Material Inventory." active />
                            <BuilderWorkflowItem number="2" title="Processing Route" subtitle="Define the one Processing Unit for a material; leave empty for direct Production." />
                            <BuilderWorkflowItem number="3" title="Production Review" subtitle="Production reviews or returns the submitted BOM on the same page." />
                        </Box>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
}

export function MatFlowBomDetailPage() {
    const { bomId } = useParams();
    const navigate = useNavigate();
    const { hasRole } = useMatFlow();

    const [bom, setBom] = useState(null);
    const [routes, setRoutes] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [processingUnits, setProcessingUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [openSections, setOpenSections] = useState({});
    const [lineDialog, setLineDialog] = useState(null);
    const [lineForm, setLineForm] = useState({ materialId: "", requiredQty: "", wastagePercent: "0", remarks: "" });
    const [routeDialog, setRouteDialog] = useState(null);
    const [routeForm, setRouteForm] = useState({
        sequenceNo: "1",
        processingUnitId: "",
        processCode: "",
        expectedYieldPercent: "100",
        remarks: "",
    });
    const [action, setAction] = useState(null);
    const [actionRemarks, setActionRemarks] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [productOwnerProjectId, setProductOwnerProjectId] = useState("");
    const [productOwnerLookupDone, setProductOwnerLookupDone] = useState(false);

    const load = useCallback(async () => {
        if (!bomId) return;
        setLoading(true);
        setError("");
        try {
            const [bomResponse, routeResponse] = await Promise.all([
                matflowApi.getBom(bomId),
                matflowApi.listBomRoutes(bomId),
            ]);
            const nextBom = bomResponse?.data || null;
            setBom(nextBom);
            setRoutes(extractMatFlowPage(routeResponse?.data).rows);

            const nextSections = {};
            const seen = [];
            linesOf(nextBom).forEach((line) => {
                const key = categoryKey(line);
                if (!seen.includes(key)) seen.push(key);
                nextSections[key] = false;
            });
            // Keep the page readable: open only the first material category.
            // Users expand the category they need instead of loading every BOM
            // section into one long wall of rows.
            if (seen.length) nextSections[seen[0]] = true;
            setOpenSections(nextSections);
        } catch (requestError) {
            setBom(null);
            setRoutes([]);
            setError(readMatFlowError(requestError, "Unable to load the Operational BOM."));
        } finally {
            setLoading(false);
        }
    }, [bomId]);

    useEffect(() => { load(); }, [load]);

    const status = normalize(bom?.status);
    const project = projectOf(bom);
    const lines = linesOf(bom);

    useEffect(() => {
        let active = true;

        const productId = project?.id || bom?.projectDrawingId || "";
        const directProjectId = project?.parentProjectId || project?.projectId || "";

        setProductOwnerLookupDone(false);

        if (!productId) {
            setProductOwnerProjectId("");
            setProductOwnerLookupDone(true);
            return () => { active = false; };
        }

        if (directProjectId) {
            setProductOwnerProjectId(String(directProjectId));
            setProductOwnerLookupDone(true);
            return () => { active = false; };
        }

        (async () => {
            try {
                const response = await matflowApi.listProjects({
                    search: clean(project?.projectCode) || undefined,
                    plantCode: clean(project?.plantCode) || undefined,
                });

                if (!active) return;

                const portfolios = Array.isArray(response?.data) ? response.data : [];
                const owner = portfolios.find((portfolio) =>
                    (Array.isArray(portfolio?.products) ? portfolio.products : [])
                        .some((productRow) => String(productRow?.id) === String(productId))
                );

                setProductOwnerProjectId(owner?.id ? String(owner.id) : "");
            } catch {
                if (active) setProductOwnerProjectId("");
            } finally {
                if (active) setProductOwnerLookupDone(true);
            }
        })();

        return () => { active = false; };
    }, [
        bom?.projectDrawingId,
        project?.id,
        project?.parentProjectId,
        project?.projectId,
        project?.projectCode,
        project?.plantCode,
    ]);

    const canManageProductFiles = hasRole(EDIT_ROLES);
    const resolvedProductId = project?.id || bom?.projectDrawingId || "";
    const productFiles = useProductReferenceFiles({
        projectId: productOwnerProjectId,
        productId: resolvedProductId,
        enabled: Boolean(productOwnerProjectId && resolvedProductId),
        canManage: canManageProductFiles,
        setError,
    });

    const canEdit = hasRole(EDIT_ROLES) && bom?.latestRevision === true && ["DRAFT", "RETURNED"].includes(status);
    const canReview = hasRole(REVIEW_ROLES) && status === "SUBMITTED" && bom?.rowVersion != null;
    const canRevision = hasRole(EDIT_ROLES) && status === "APPROVED" && bom?.effective && bom?.latestRevision;
    const canRequisition = hasRole(REQUISITION_ROLES) && status === "APPROVED" && bom?.effective;

    useEffect(() => {
        if (!canEdit) {
            setMaterials([]);
            setProcessingUnits([]);
            return;
        }

        let active = true;
        (async () => {
            try {
                const [materialResponse, processingUnitResponse] = await Promise.all([
                    matflowApi.listMaterials({ active: true }),
                    matflowApi.listProcessingUnits({ active: true }),
                ]);
                if (!active) return;
                setMaterials(extractMatFlowPage(materialResponse?.data).rows.filter((row) => row?.active !== false));
                setProcessingUnits(
                    extractMatFlowPage(processingUnitResponse?.data).rows.filter((unit) =>
                        unit?.active !== false &&
                        (!project?.plantCode || upperCode(unit?.plantCode) === upperCode(project.plantCode))
                    )
                );
            } catch (requestError) {
                if (active) setError(readMatFlowError(requestError, "Unable to load Material / Processing masters."));
            }
        })();
        return () => { active = false; };
    }, [canEdit, project?.plantCode]);

    const processingByLine = useMemo(() => {
        const map = new Map();
        lines.forEach((line) => map.set(String(line.id), routesForLine(routes, line.id)));
        return map;
    }, [lines, routes]);

    const materialSections = useMemo(() => {
        const grouped = new Map();
        lines.forEach((line) => {
            const key = categoryKey(line);
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    title: sectionTitle(key),
                    accent: categoryAccent(key),
                    rows: [],
                    processingCount: 0,
                });
            }
            const section = grouped.get(key);
            section.rows.push(line);
            section.processingCount += (processingByLine.get(String(line.id)) || []).length;
        });
        return Array.from(grouped.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [lines, processingByLine]);

    const validQtyCount = lines.filter((line) => numeric(line.requiredQty) > 0 && numeric(line.netRequiredQty) > 0).length;
    const specifiedCount = lines.filter((line) => Boolean(clean(line.specification) || clean(line.materialName))).length;
    const categorizedCount = lines.filter((line) => Boolean(clean(line.materialCategorySnapshot))).length;
    const readiness = lines.length === 0
        ? 0
        : Math.round(((validQtyCount + specifiedCount + categorizedCount) / (lines.length * 3)) * 100);
    const processingOptionCount = routes.filter((step) => normalize(step?.stepType) === "PROCESSING").length;

    const workflow = bomWorkflow(bom);

    const openLine = (line = null) => {
        setLineDialog({ line });
        setLineForm({
            materialId: line?.materialId || "",
            requiredQty: line?.requiredQty != null ? String(line.requiredQty) : "",
            wastagePercent: line?.wastagePercent != null ? String(line.wastagePercent) : "0",
            remarks: line?.remarks || "",
        });
        setError("");
    };

    const saveLine = async () => {
        const requiredQty = Number(lineForm.requiredQty);
        const wastagePercent = Number(lineForm.wastagePercent || 0);
        if (!lineForm.materialId || !Number.isFinite(requiredQty) || requiredQty <= 0 || !Number.isFinite(wastagePercent) || wastagePercent < 0) {
            setError("Material, positive quantity and non-negative wastage percent are required.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                materialId: lineForm.materialId,
                requiredQty,
                wastagePercent,
                remarks: clean(lineForm.remarks) || null,
                rowVersion: lineDialog?.line?.rowVersion ?? null,
            };
            if (lineDialog?.line?.id) await matflowApi.updateBomLine(bom.id, lineDialog.line.id, body);
            else await matflowApi.addBomLine(bom.id, body);
            setLineDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save BOM material line."));
        } finally {
            setWorking(false);
        }
    };

    const deleteLine = async (line) => {
        if (!line?.id || line.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteBomLine(bom.id, line.id, line.rowVersion);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to remove BOM material line."));
        } finally {
            setWorking(false);
        }
    };

    const openRoute = (line, step = null) => {
        const current = processingByLine.get(String(line.id)) || [];
        /*
         * One authoritative Processing Unit per BOM material line.
         * Clicking Processing again edits the existing route instead of creating
         * a competing Store-selectable option.
         */
        const effectiveStep = step || current[0] || null;
        if (!step && current.length > 1) {
            setError("This BOM material line has multiple Processing routes. Remove the extra routes before continuing.");
            return;
        }
        setRouteDialog({ line, step: effectiveStep });
        setRouteForm({
            sequenceNo: String(effectiveStep?.sequenceNo ?? 1),
            processingUnitId: effectiveStep?.processingUnitId || "",
            processCode: effectiveStep?.processCode || "",
            expectedYieldPercent: String(effectiveStep?.expectedYieldPercent ?? 100),
            remarks: effectiveStep?.remarks || "",
        });
        setError("");
    };

    const saveRoute = async () => {
        const sequenceNo = 1;
        const expectedYieldPercent = Number(routeForm.expectedYieldPercent);
        if (!routeForm.processingUnitId || !clean(routeForm.processCode)) {
            setError("Processing Unit and process code are required.");
            return;
        }
        if (!Number.isFinite(expectedYieldPercent) || expectedYieldPercent <= 0 || expectedYieldPercent > 100) {
            setError("Expected yield must be greater than 0 and not more than 100.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = {
                sequenceNo,
                stepType: "PROCESSING",
                processingUnitId: routeForm.processingUnitId,
                processCode: clean(routeForm.processCode).toUpperCase(),
                expectedYieldPercent,
                remarks: clean(routeForm.remarks) || null,
                rowVersion: routeDialog?.step?.rowVersion ?? null,
            };
            if (routeDialog?.step?.id) {
                await matflowApi.updateBomRouteStep(bom.id, routeDialog.line.id, routeDialog.step.id, body);
            } else {
                await matflowApi.addBomRouteStep(bom.id, routeDialog.line.id, body);
            }
            setRouteDialog(null);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to save Processing route."));
        } finally {
            setWorking(false);
        }
    };

    const deleteRoute = async (line, step) => {
        if (!step?.id || step.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteBomRouteStep(bom.id, line.id, step.id, step.rowVersion);
            await load();
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to remove Processing route."));
        } finally {
            setWorking(false);
        }
    };

    const executeAction = async () => {
        if (!action || !bom?.id || bom.rowVersion == null) return;
        const remarks = clean(actionRemarks);
        if (action === "RETURN" && !remarks) {
            setError("Return remarks are required.");
            return;
        }
        if (action === "SUBMIT" && lines.length === 0) {
            setError("Add at least one material line before submitting.");
            return;
        }

        setWorking(true);
        setError("");
        try {
            const body = { rowVersion: bom.rowVersion, remarks: remarks || null };
            let response;
            if (action === "SUBMIT") response = await matflowApi.submitBom(bom.id, body);
            if (action === "REVIEW") response = await matflowApi.productionReviewBom(bom.id, body);
            if (action === "RETURN") response = await matflowApi.productionReturnBom(bom.id, body);
            if (action === "REVISION") response = await matflowApi.createBomRevision(bom.id, body);

            const completedAction = action;
            setAction(null);
            setActionRemarks("");
            if (completedAction === "REVISION" && response?.data?.id) {
                navigate(`/matflow/boms/${response.data.id}`, { replace: true });
            } else {
                await load();
            }
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to complete BOM action."));
        } finally {
            setWorking(false);
        }
    };

    const confirmDeleteDraft = async () => {
        if (!bom?.id || bom.rowVersion == null) return;
        setWorking(true);
        setError("");
        try {
            await matflowApi.deleteDraftBom(bom.id, bom.rowVersion);
            navigate("/matflow/boms", { replace: true });
        } catch (requestError) {
            setError(readMatFlowError(requestError, "Unable to delete Draft BOM."));
        } finally {
            setWorking(false);
            setDeleteTarget(null);
        }
    };

    if (loading) return <LoadingBlock />;
    if (!bom) {
        return (
            <Box sx={pageSx}>
                <ErrorBox>{error || "Operational BOM was not found."}</ErrorBox>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back to BOMs</Button>
            </Box>
        );
    }

    const currentStep = status === "SUBMITTED" ? 2 : status === "APPROVED" ? 3 : 1;
    const quickActions = [
        { title: "Material Inventory", subtitle: "Open the source material master.", icon: <Inventory2OutlinedIcon />, path: "/matflow/materials" },
        { title: "Projects & Products", subtitle: "Open the owning PD / Product portfolio.", icon: <RuleOutlinedIcon />, path: "/matflow/projects" },
        { title: "Project Tracker", subtitle: "Trace material execution after MR submission.", icon: <AccountTreeOutlinedIcon />, path: "/matflow/tracker" },
        { title: "Material Requisitions", subtitle: "Open Production material demand.", icon: <SpeedOutlinedIcon />, path: "/matflow/production" },
    ];

    return (
        <Box sx={pageSx}>
            <Box sx={builderHeroSx}>
                <Box sx={builderHeroLeftSx}>
                    <Box sx={builderChipRowSx}>
                        <Chip label="MATFLOW BOM BUILDER" sx={builderLabelChipSx} />
                        <Chip label={project?.projectCode || "NO PD"} sx={builderProjectChipSx} />
                        <Chip label={`● ${readable(status || "UNKNOWN")}`} sx={builderStatusChipSx(status)} />
                        {bom?.effective && <Chip label="EFFECTIVE" sx={builderEffectiveChipSx} />}
                    </Box>

                    <Typography sx={builderPageTitleSx}>{project?.productName || bom?.bomNumber || "Operational BOM"}</Typography>
                    <Typography sx={builderPageSubSx}>
                        Section-wise operational material BOM for {project?.projectCode || "the selected PD"}. Engineering owns material structure and the Processing route on this same page. If a material has one Processing Unit here, every available MR lot follows that unit automatically; if none is defined, it routes directly to Production. Store only confirms availability and the QC check.
                    </Typography>

                    <Box sx={builderMetaRowSx}>
                        <BuilderMetaPill label="BOM" value={bom?.bomNumber || "-"} accent="#60a5fa" />
                        <BuilderMetaPill label="Revision" value={`Rev ${bom?.revisionNo ?? "-"}`} accent="#a78bfa" />
                        <BuilderMetaPill label="Drawing" value={project?.drawingNo || "-"} accent="#f59e0b" />
                        <BuilderMetaPill label="Client" value={project?.clientName || "-"} accent="#22c55e" />
                    </Box>
                </Box>

                <Box sx={builderHeroRightSx}>
                    <Card sx={builderReadinessCardSx}>
                        <Box sx={builderReadinessTopSx}>
                            <Box>
                                <Typography sx={builderReadinessLabelSx}>BOM Structure Health</Typography>
                                <Typography sx={builderReadinessValueSx}>{readiness}%</Typography>
                            </Box>
                            <Box sx={builderReadinessIconSx}><CheckCircleOutlineIcon /></Box>
                        </Box>
                        <LinearProgress variant="determinate" value={readiness} sx={builderProgressSx(readiness === 100 ? "#22c55e" : "#60a5fa")} />
                        <Typography sx={builderReadinessHintSx}>
                            {lines.length === 0 ? "Add at least one material to begin." : `${lines.length} material line${lines.length === 1 ? "" : "s"} across ${materialSections.length} categor${materialSections.length === 1 ? "y" : "ies"}.`}
                        </Typography>
                    </Card>

                    <Box sx={builderHeroActionRowSx}>
                        <Button startIcon={<RefreshIcon />} onClick={load} disabled={working} sx={secondaryBtnSx}>Refresh</Button>
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/matflow/boms")} sx={secondaryBtnSx}>Back</Button>
                        {canEdit && (
                            <Button startIcon={<AddIcon />} onClick={() => openLine()} disabled={working} sx={primaryBtnSx}>Add Material</Button>
                        )}
                    </Box>
                </Box>
            </Box>

            <ErrorBox>{error}</ErrorBox>

            {status === "RETURNED" && clean(bom?.returnRemarks) && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    Production returned this BOM: {bom.returnRemarks}
                </Alert>
            )}

            <Box sx={builderSummaryGridSx}>
                <BuilderMiniStat icon={<Inventory2OutlinedIcon />} title="Material Lines" value={lines.length} subtitle="Across operational sections" accent="#60a5fa" />
                <BuilderMiniStat icon={<RuleOutlinedIcon />} title="Categories" value={materialSections.length} subtitle="Material structure groups" accent="#22c55e" />
                <BuilderMiniStat icon={<AccountTreeOutlinedIcon />} title="Processing Routes" value={processingOptionCount} subtitle="BOM-defined automatic routes" accent="#a78bfa" />
                <BuilderMiniStat icon={<CheckCircleOutlineIcon />} title="Current Owner" value={workflow[0]} subtitle={readable(status)} accent="#f59e0b" />
            </Box>

            <Box sx={builderMainGridSx}>
                <Box sx={builderLeftColumnSx}>
                    <Card sx={builderToolbarSx}>
                        <Box>
                            <Typography sx={builderToolbarTitleSx}>BOM Sections</Typography>
                            <Typography sx={builderToolbarSubSx}>Material Inventory rows grouped automatically by operational category.</Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: .8, flexWrap: "wrap" }}>
                            <Button
                                startIcon={<FileDownloadOutlinedIcon />}
                                onClick={() => downloadMatFlowBomExcel({ bom, routes })}
                                sx={secondaryBtnSx}
                            >
                                Download BOM
                            </Button>
                            {canEdit && <Button startIcon={<AddIcon />} onClick={() => openLine()} sx={primaryBtnSx}>Add Material</Button>}
                        </Box>
                    </Card>

                    {materialSections.length === 0 ? (
                        <Card sx={{ ...panelSx, m: 0 }}>
                            <EmptyState>No BOM materials yet. Engineering can add materials from Material Inventory.</EmptyState>
                        </Card>
                    ) : materialSections.map((section) => {
                        const isOpen = openSections[section.key] !== false;
                        return (
                            <Card key={section.key} sx={builderSectionCardSx(section.accent, isOpen)}>
                                <Box sx={builderSectionHeaderSx}>
                                    <Box sx={builderSectionLeftSx}>
                                        <IconButton size="small" onClick={() => setOpenSections((current) => ({ ...current, [section.key]: !isOpen }))} sx={builderSectionIconBtnSx}>
                                            {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                        <Box>
                                            <Box sx={builderSectionTitleRowSx}>
                                                <Typography sx={builderSectionTitleSx}>{section.title}</Typography>
                                                <Chip label={`${section.rows.length} ${section.rows.length === 1 ? "Item" : "Items"}`} size="small" sx={builderCountChipSx} />
                                            </Box>
                                            <Typography sx={builderSectionSubSx}>
                                                {section.processingCount ? `${section.processingCount} Processing route` : "Direct to Production"}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={builderSectionRightSx}>
                                        <Typography sx={builderSectionRightValueSx}>{section.rows.length}</Typography>
                                        <Typography sx={builderSectionRightLabelSx}>Material lines</Typography>
                                    </Box>
                                </Box>

                                <Collapse in={isOpen}>
                                    <Box sx={builderSectionTableShellSx}>
                                        <Box sx={{ ...builderSectionTableHeaderSx, gridTemplateColumns: "54px minmax(190px,1.1fr) minmax(150px,.9fr) 70px 90px 82px 95px minmax(210px,1.2fr) 150px" }}>
                                            {[
                                                "Line", "Material", "Specification", "UOM", "Required", "Waste %", "Net Qty", "Processing Route", "Action",
                                            ].map((heading) => <Box key={heading} sx={builderSectionCellSx}>{heading}</Box>)}
                                        </Box>

                                        {section.rows.map((line) => {
                                            const steps = processingByLine.get(String(line.id)) || [];
                                            return (
                                                <Box key={line.id} sx={{ ...builderSectionTableRowSx, gridTemplateColumns: "54px minmax(190px,1.1fr) minmax(150px,.9fr) 70px 90px 82px 95px minmax(210px,1.2fr) 150px" }}>
                                                    <Box sx={builderSectionCellSx}>{line.lineNo ?? "-"}</Box>
                                                    <Box sx={builderSectionCellSx}>
                                                        <Typography sx={mainTextSx}>{line.materialName || "-"}</Typography>
                                                        <Typography sx={subTextSx}>{line.materialCode || "-"}</Typography>
                                                    </Box>
                                                    <Box sx={builderSectionCellSx}><Typography sx={subTextSx}>{line.specification || "-"}</Typography></Box>
                                                    <Box sx={builderSectionCellSx}>{line.uom || "-"}</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.requiredQty)}</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.wastagePercent)}%</Box>
                                                    <Box sx={builderSectionCellSx}>{formatQty(line.netRequiredQty)}</Box>
                                                    <Box sx={builderSectionCellSx}>
                                                        {steps.length === 0 ? (
                                                            <Typography sx={subTextSx}>Direct to Production</Typography>
                                                        ) : (
                                                            <Box sx={{ display: "flex", gap: .45, flexWrap: "wrap" }}>
                                                                {steps.map((step) => (
                                                                    <Chip
                                                                        key={step.id}
                                                                        size="small"
                                                                        label={`${step.processCode || "PROCESS"} · ${step.processingUnitCode || step.processingUnitName || "UNIT"}`}
                                                                        onClick={canEdit ? () => openRoute(line, step) : undefined}
                                                                        sx={builderProcessingChipSx}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ ...builderSectionCellSx, display: "flex", gap: .45, flexWrap: "wrap" }}>
                                                        {canEdit ? (
                                                            <>
                                                                <Button onClick={() => openLine(line)} sx={secondaryBtnSx}>Edit</Button>
                                                                <Button onClick={() => openRoute(line)} sx={secondaryBtnSx}>{steps.length ? "Edit Processing" : "Set Processing"}</Button>
                                                                <IconButton onClick={() => deleteLine(line)} disabled={working} sx={builderDeleteIconSx}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                                            </>
                                                        ) : <Typography sx={subTextSx}>Read only</Typography>}
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Collapse>
                            </Card>
                        );
                    })}

                    <Card sx={{ ...panelSx, m: 0 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                            <Box>
                                <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Workflow Action</Typography>
                                <Typography sx={subTextSx}>{workflow[1]}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: .7, flexWrap: "wrap" }}>
                                {canEdit && ["DRAFT", "RETURNED"].includes(status) && (
                                    <Button startIcon={<SendOutlinedIcon />} onClick={() => { setAction("SUBMIT"); setActionRemarks(""); }} sx={primaryBtnSx}>Submit to Production</Button>
                                )}
                                {canReview && (
                                    <>
                                        <Button startIcon={<UndoOutlinedIcon />} onClick={() => { setAction("RETURN"); setActionRemarks(""); }} sx={secondaryBtnSx}>Return to Engineering</Button>
                                        <Button startIcon={<CheckCircleOutlineIcon />} onClick={() => { setAction("REVIEW"); setActionRemarks(""); }} sx={primaryBtnSx}>Mark Reviewed</Button>
                                    </>
                                )}
                                {canRequisition && (
                                    <Button endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/matflow/requisitions/new?bomId=${encodeURIComponent(bom.id)}`)} sx={primaryBtnSx}>Raise MR</Button>
                                )}
                                {canRevision && (
                                    <Button startIcon={<EditOutlinedIcon />} onClick={() => { setAction("REVISION"); setActionRemarks(""); }} sx={secondaryBtnSx}>Create Revision</Button>
                                )}
                                {canEdit && status === "DRAFT" && bom.latestRevision && !bom.effective && (
                                    <Button startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteTarget(bom)} sx={dangerBtnSx}>Delete Draft</Button>
                                )}
                            </Box>
                        </Box>
                    </Card>

                    {Array.isArray(bom.history) && bom.history.length > 0 && (
                        <Card sx={{ ...panelSx, m: 0 }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 16, mb: 1 }}>BOM History</Typography>
                            <Box sx={tableShellSx}>
                                <Box sx={{ ...tableHeaderSx, gridTemplateColumns: "160px 150px 150px minmax(220px,1fr)" }}>
                                    {["Action", "Actor", "Time", "Remarks"].map((heading) => <Box key={heading} sx={tableCellSx}>{heading}</Box>)}
                                </Box>
                                {bom.history.map((row) => (
                                    <Box key={row.id} sx={{ ...tableRowSx, gridTemplateColumns: "160px 150px 150px minmax(220px,1fr)" }}>
                                        <Box sx={tableCellSx}>{readable(row.action)}</Box>
                                        <Box sx={tableCellSx}>{row.actionBy || "-"}</Box>
                                        <Box sx={tableCellSx}>{formatDate(row.actionAt)}</Box>
                                        <Box sx={tableCellSx}>{row.remarks || "-"}</Box>
                                    </Box>
                                ))}
                            </Box>
                        </Card>
                    )}
                </Box>

                <Box sx={builderRightColumnSx}>
                    <ProductReferencePanel
                        project={productOwnerProjectId ? {
                            id: productOwnerProjectId,
                            projectCode: project?.projectCode,
                            projectName: project?.projectName,
                            clientName: project?.clientName,
                            plantCode: project?.plantCode,
                        } : null}
                        product={{
                            id: resolvedProductId,
                            productName: project?.productName,
                            drawingNo: project?.drawingNo,
                            drawingRevision: project?.drawingRevision,
                        }}
                        files={productFiles}
                        canManage={canManageProductFiles}
                        contextUnavailable={productOwnerLookupDone && !productOwnerProjectId}
                    />

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Workflow</Typography>
                                <Typography sx={builderAssistantSubSx}>No separate review page or Director gate.</Typography>
                            </Box>
                            <RuleOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1 }}>
                            <BuilderWorkflowItem number="1" title="Engineering BOM" subtitle="Create/edit lines and optional Processing Unit choices." active={currentStep === 1} done={currentStep > 1} />
                            <BuilderWorkflowItem number="2" title="Production Review" subtitle="Mark Reviewed or return to Engineering on this BOM page." active={currentStep === 2} done={currentStep > 2} />
                            <BuilderWorkflowItem number="3" title="MR Ready" subtitle="Effective BOM can be requested by Production." active={currentStep === 3} done={status === "APPROVED" && bom?.effective} />
                        </Box>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Routing Rule</Typography>
                                <Typography sx={builderAssistantSubSx}>Keep BOM routing simple and optional.</Typography>
                            </Box>
                            <AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                            Processing is defined once here on the BOM material line. Store does not choose it again. A configured Processing Unit becomes the automatic route for every available lot; no configured unit means direct Production. Store only decides the QC check.
                        </Alert>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Section Split</Typography>
                                <Typography sx={builderAssistantSubSx}>Line distribution by material category.</Typography>
                            </Box>
                            <AccountTreeOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1, display: "grid", gap: 1 }}>
                            {materialSections.length === 0 ? (
                                <Typography sx={builderAssistantSubSx}>Add materials to generate the section distribution.</Typography>
                            ) : materialSections.map((section) => {
                                const percent = lines.length ? Math.round((section.rows.length / lines.length) * 100) : 0;
                                return (
                                    <Box key={section.key}>
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: .4 }}>
                                            <Typography sx={builderQuickTitleSx}>{section.title}</Typography>
                                            <Typography sx={builderAssistantSubSx}>{percent}%</Typography>
                                        </Box>
                                        <LinearProgress variant="determinate" value={percent} sx={builderProgressSx(section.accent)} />
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    <Card sx={builderSidePanelSx}>
                        <Box sx={builderSideTitleRowSx}>
                            <Box>
                                <Typography sx={builderSideTitleSx}>Quick Actions</Typography>
                                <Typography sx={builderAssistantSubSx}>Related MatFlow workspaces.</Typography>
                            </Box>
                            <SpeedOutlinedIcon sx={{ color: "#93c5fd" }} />
                        </Box>
                        <Box sx={{ mt: 1, display: "grid", gap: .8 }}>
                            {quickActions.map((item) => <BuilderQuickAction key={item.title} {...item} onClick={() => navigate(item.path)} />)}
                        </Box>
                    </Card>
                </Box>
            </Box>

            <Dialog open={Boolean(lineDialog)} onClose={() => !working && setLineDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{lineDialog?.line ? "Edit BOM Material" : "Add BOM Material"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        <TextField
                            select
                            label="Material *"
                            value={lineForm.materialId}
                            disabled={Boolean(lineDialog?.line)}
                            onChange={(event) => setLineForm((current) => ({ ...current, materialId: event.target.value }))}
                            sx={fieldSx}
                        >
                            {materials.map((material) => (
                                <MenuItem key={material.id} value={material.id}>
                                    {material.materialName} · {material.materialCode} · {readable(material.category)} · {material.uom}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField type="number" label="Required Qty *" value={lineForm.requiredQty} onChange={(event) => setLineForm((current) => ({ ...current, requiredQty: event.target.value }))} sx={fieldSx} />
                        <TextField type="number" label="Wastage %" value={lineForm.wastagePercent} onChange={(event) => setLineForm((current) => ({ ...current, wastagePercent: event.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={3} label="Remarks" value={lineForm.remarks} onChange={(event) => setLineForm((current) => ({ ...current, remarks: event.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setLineDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveLine} disabled={working} sx={primaryBtnSx}>{working ? "Saving..." : "Save Material"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(routeDialog)} onClose={() => !working && setRouteDialog(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>{routeDialog?.step ? "Edit Processing Route" : "Set Processing Route"}</DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
                        This Processing Unit is the authoritative route for this BOM material line. Store will not select it again. Leave the material without a Processing route when it should go directly to Production.
                    </Alert>
                    <Box sx={{ display: "grid", gap: 1.5 }}>

                        <TextField select label="Processing Unit *" value={routeForm.processingUnitId} onChange={(event) => setRouteForm((current) => ({ ...current, processingUnitId: event.target.value }))} sx={fieldSx}>
                            {processingUnits.map((unit) => (
                                <MenuItem key={unit.id} value={unit.id}>
                                    {unit.processingUnitCode} · {unit.processingUnitName} · {unit.external ? "External" : "Internal"}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField label="Process Code *" value={routeForm.processCode} onChange={(event) => setRouteForm((current) => ({ ...current, processCode: event.target.value }))} sx={fieldSx} />
                        <TextField type="number" label="Expected Yield %" value={routeForm.expectedYieldPercent} onChange={(event) => setRouteForm((current) => ({ ...current, expectedYieldPercent: event.target.value }))} sx={fieldSx} />
                        <TextField multiline minRows={2} label="Remarks" value={routeForm.remarks} onChange={(event) => setRouteForm((current) => ({ ...current, remarks: event.target.value }))} sx={fieldSx} />
                    </Box>
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    {routeDialog?.step && (
                        <Button onClick={async () => { const line = routeDialog.line; const step = routeDialog.step; setRouteDialog(null); await deleteRoute(line, step); }} disabled={working} sx={dangerBtnSx}>Delete Route</Button>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button onClick={() => setRouteDialog(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={saveRoute} disabled={working || processingUnits.length === 0} sx={primaryBtnSx}>{working ? "Saving..." : "Save Route"}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(action)} onClose={() => !working && setAction(null)} fullWidth maxWidth="sm" PaperProps={{ sx: dialogPaperSx }}>
                <DialogTitle sx={dialogTitleSx}>
                    {action === "SUBMIT" ? "Submit BOM to Production"
                        : action === "REVIEW" ? "Mark BOM Reviewed"
                            : action === "RETURN" ? "Return BOM to Engineering"
                                : "Create BOM Revision"}
                </DialogTitle>
                <DialogContent sx={dialogContentSx}>
                    <TextField multiline minRows={3} label={action === "RETURN" ? "Return Remarks *" : "Remarks"} value={actionRemarks} onChange={(event) => setActionRemarks(event.target.value)} sx={fieldSx} fullWidth />
                </DialogContent>
                <DialogActions sx={dialogActionsSx}>
                    <Button onClick={() => setAction(null)} disabled={working} sx={secondaryBtnSx}>Cancel</Button>
                    <Button onClick={executeAction} disabled={working} sx={primaryBtnSx}>{working ? "Working..." : "Confirm"}</Button>
                </DialogActions>
            </Dialog>

            <MatFlowDeleteDialog
                open={Boolean(deleteTarget)}
                title="Delete Draft BOM?"
                subject={bom?.bomNumber || "Draft BOM"}
                description="This is allowed only while the latest revision is a non-effective Draft. Submitted/reviewed BOM history remains immutable."
                working={working}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeleteDraft}
            />
        </Box>
    );
}

/* BOMFlow-inspired MatFlow builder chrome. Uses MatFlow theme variables only. */
const builderHeroSx = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 2,
    p: { xs: 2, md: 2.4 },
    border: "1px solid var(--mf-border)",
    borderRadius: 3,
    background: "var(--mf-hero-bg)",
    boxShadow: "var(--mf-card-shadow)",
    flexWrap: { xs: "wrap", lg: "nowrap" },
};
const builderHeroLeftSx = { flex: "1 1 640px", minWidth: 0 };
const builderHeroRightSx = { flex: "0 1 330px", minWidth: { xs: "100%", lg: 310 }, display: "grid", gap: 1 };
const builderChipRowSx = { display: "flex", gap: .7, flexWrap: "wrap", mb: 1 };
const builderLabelChipSx = { height: 24, fontSize: 10.5, fontWeight: 950, letterSpacing: .8, color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)", border: "1px solid var(--mf-primary-border)" };
const builderProjectChipSx = { height: 24, fontSize: 10.5, fontWeight: 900, color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", border: "1px solid var(--mf-purple-border)" };
const builderStatusChipSx = (status) => {
    const value = normalize(status);
    const success = ["APPROVED", "EFFECTIVE"].includes(value);
    const warning = ["SUBMITTED", "RETURNED"].includes(value);
    return { height: 24, fontSize: 10.5, fontWeight: 900, color: success ? "var(--mf-success-text)" : warning ? "var(--mf-warning-text)" : "var(--mf-text-secondary)", background: success ? "var(--mf-success-soft)" : warning ? "var(--mf-warning-soft)" : "var(--mf-surface-strong)", border: `1px solid ${success ? "var(--mf-success-border)" : warning ? "var(--mf-warning-border)" : "var(--mf-border)"}` };
};
const builderEffectiveChipSx = { height: 24, fontSize: 10.5, fontWeight: 950, color: "var(--mf-success-text)", background: "var(--mf-success-soft)", border: "1px solid var(--mf-success-border)" };
const builderPageTitleSx = { color: "var(--mf-text)", fontWeight: 980, fontSize: { xs: 25, md: 31 }, lineHeight: 1.13, letterSpacing: -.6 };
const builderPageSubSx = { mt: .7, color: "var(--mf-text-secondary)", fontSize: 12.5, lineHeight: 1.65, maxWidth: 880 };
const builderMetaRowSx = { display: "flex", flexWrap: "wrap", gap: .8, mt: 1.4 };
const builderMetaPillSx = (accent) => ({ minWidth: 110, maxWidth: 230, px: 1.05, py: .72, borderRadius: 1.8, background: "var(--mf-surface)", border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}` });
const builderMetaLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: .55 };
const builderMetaValueSx = { color: "var(--mf-text)", fontSize: 11.8, fontWeight: 900, mt: .15 };
const builderReadinessCardSx = { m: 0, p: 1.5, boxShadow: "none", background: "var(--mf-card-bg-elevated)" };
const builderReadinessTopSx = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderReadinessLabelSx = { color: "var(--mf-text-secondary)", fontSize: 10.5, fontWeight: 850, textTransform: "uppercase", letterSpacing: .45 };
const builderReadinessValueSx = { color: "var(--mf-text)", fontSize: 26, lineHeight: 1.1, fontWeight: 980, mt: .25 };
const builderReadinessIconSx = { width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)" };
const builderReadinessHintSx = { mt: .75, color: "var(--mf-text-muted)", fontSize: 10.7, lineHeight: 1.45 };
const builderProgressSx = (accent) => ({ mt: 1, height: 6, borderRadius: 9, backgroundColor: "var(--mf-surface-strong)", "& .MuiLinearProgress-bar": { borderRadius: 9, backgroundColor: accent } });
const builderHeroActionRowSx = { display: "flex", gap: .7, flexWrap: "wrap", justifyContent: "flex-end" };
const builderSummaryGridSx = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(4,minmax(0,1fr))" }, gap: 1 };
const builderMiniStatSx = (accent) => ({ m: 0, p: 1.35, display: "flex", gap: 1.05, alignItems: "center", borderTop: `2px solid ${accent}`, boxShadow: "none" });
const builderMiniIconSx = (accent) => ({ flex: "0 0 auto", width: 34, height: 34, borderRadius: 2, display: "grid", placeItems: "center", color: accent, background: `${accent}18` });
const builderMiniTitleSx = { color: "var(--mf-text-muted)", fontSize: 9.8, fontWeight: 800, textTransform: "uppercase", letterSpacing: .45 };
const builderMiniValueSx = { color: "var(--mf-text)", fontSize: 16.5, fontWeight: 950, lineHeight: 1.2, mt: .1, overflow: "hidden", textOverflow: "ellipsis" };
const builderMiniSubSx = { color: "var(--mf-text-muted)", fontSize: 9.8, mt: .2, lineHeight: 1.35 };
const builderMainGridSx = { display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0,1fr) 310px" }, gap: 1.25, alignItems: "start" };
const builderLeftColumnSx = { display: "grid", gap: 1.05, minWidth: 0 };
const builderRightColumnSx = { display: "grid", gap: 1.05, minWidth: 0 };
const builderToolbarSx = { ...panelSx, m: 0, p: 1.35, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap", boxShadow: "none" };
const builderToolbarTitleSx = { color: "var(--mf-text)", fontSize: 15.5, fontWeight: 950 };
const builderToolbarSubSx = { color: "var(--mf-text-muted)", fontSize: 10.8, mt: .15 };
const builderSectionCardSx = (accent, open) => ({ m: 0, overflow: "hidden", borderLeft: `3px solid ${accent}`, boxShadow: open ? "var(--mf-card-shadow)" : "none" });
const builderSectionHeaderSx = { p: 1.15, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderSectionLeftSx = { display: "flex", alignItems: "center", gap: .8, minWidth: 0 };
const builderSectionIconBtnSx = { color: "var(--mf-text-secondary)", border: "1px solid var(--mf-border)", borderRadius: 1.5, width: 30, height: 30 };
const builderSectionTitleRowSx = { display: "flex", alignItems: "center", gap: .6, flexWrap: "wrap" };
const builderSectionTitleSx = { color: "var(--mf-text)", fontSize: 14, fontWeight: 950 };
const builderCountChipSx = { height: 20, fontSize: 9.5, fontWeight: 850, color: "var(--mf-text-secondary)", background: "var(--mf-surface-strong)", border: "1px solid var(--mf-border)" };
const builderSectionSubSx = { color: "var(--mf-text-muted)", fontSize: 10.2, mt: .15 };
const builderSectionRightSx = { textAlign: "right", minWidth: 74 };
const builderSectionRightLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.4 };
const builderSectionRightValueSx = { color: "var(--mf-text)", fontSize: 14.2, fontWeight: 950 };
const builderSectionTableShellSx = { overflowX: "auto", borderTop: "1px solid var(--mf-border)" };
const builderSectionTableHeaderSx = { minWidth: 1230, display: "grid", alignItems: "center", background: "var(--mf-table-head)", borderBottom: "1px solid var(--mf-border)", color: "var(--mf-text-secondary)", fontSize: 9.6, fontWeight: 900, textTransform: "uppercase", letterSpacing: .35 };
const builderSectionTableRowSx = { minWidth: 1230, display: "grid", alignItems: "center", background: "var(--mf-table-row)", borderBottom: "1px solid var(--mf-border)", "&:hover": { background: "var(--mf-table-hover)" } };
const builderSectionCellSx = { p: .8, minWidth: 0, fontSize: 11, color: "var(--mf-text-secondary)", overflowWrap: "anywhere" };
const builderProcessingChipSx = { height: 22, fontSize: 9.4, fontWeight: 800, color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", border: "1px solid var(--mf-purple-border)", cursor: "pointer" };
const builderDeleteIconSx = { width: 30, height: 30, color: "var(--mf-danger-text)", border: "1px solid var(--mf-danger-border)", borderRadius: 1.5 };
const builderSidePanelSx = { ...panelSx, m: 0, p: 1.3, boxShadow: "none" };
const builderAttachmentIdentitySx = { p: .85, borderRadius: 1.7, border: "1px solid var(--mf-border)", background: "var(--mf-surface)" };
const builderAttachmentLabelRowSx = { display: "flex", justifyContent: "space-between", gap: .6, alignItems: "center" };
const builderAttachmentLabelSx = { color: "var(--mf-text-muted)", fontSize: 9.4, fontWeight: 900, letterSpacing: .55 };
const builderAttachmentAttachedChipSx = { height: 19, fontSize: 8.8, fontWeight: 900, color: "var(--mf-success-text)", background: "var(--mf-success-soft)", border: "1px solid var(--mf-success-border)" };
const builderAttachmentOptionalChipSx = { height: 19, fontSize: 8.8, fontWeight: 900, color: "var(--mf-text-muted)", background: "var(--mf-surface-strong)", border: "1px solid var(--mf-border)" };
const builderAttachmentEmptySx = { minHeight: 105, mt: .7, borderRadius: 1.8, border: "1px dashed var(--mf-border)", background: "var(--mf-surface)", display: "grid", placeItems: "center", alignContent: "center", p: 1.15, color: "var(--mf-text-muted)" };
const builderProductImageButtonSx = { width: "100%", p: 0, mt: .7, display: "block", overflow: "hidden", borderRadius: 1.8, border: "1px solid var(--mf-border)", background: "var(--mf-surface)", cursor: "pointer", "&:disabled": { cursor: "default", opacity: .75 } };
const builderProductImageSx = { width: "100%", height: 150, display: "block", objectFit: "contain", background: "var(--mf-surface)" };
const builderAttachmentActionRowSx = { display: "flex", gap: .55, alignItems: "center", flexWrap: "wrap", mt: .75 };
const builderAttachmentDeleteSx = { width: 32, height: 32, color: "var(--mf-danger-text)", border: "1px solid var(--mf-danger-border)", borderRadius: 1.5 };
const builderDrawingTileSx = { p: .9, borderRadius: 1.8, border: "1px solid var(--mf-border)", background: "var(--mf-surface)" };
const builderDrawingPreviewButtonSx = { width: "100%", p: 0, mt: .75, display: "block", overflow: "hidden", borderRadius: 1.6, border: "1px solid var(--mf-border)", background: "var(--mf-card-bg)", cursor: "pointer", "&:disabled": { cursor: "default", opacity: .75 } };
const builderDrawingPreviewSx = { width: "100%", height: 122, display: "block", objectFit: "contain", background: "var(--mf-surface)" };
const builderDrawingIconSx = { flex: "0 0 auto", width: 34, height: 34, borderRadius: 1.7, display: "grid", placeItems: "center", color: "var(--mf-purple-text)", background: "var(--mf-purple-soft)", "& svg": { fontSize: 19 } };
const builderSideTitleRowSx = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 };
const builderSideTitleSx = { color: "var(--mf-text)", fontSize: 14.2, fontWeight: 950 };
const builderAssistantSubSx = { color: "var(--mf-text-muted)", fontSize: 9.9, lineHeight: 1.45, mt: .15 };
const builderWorkflowItemSx = (active, done) => ({ display: "flex", gap: .75, p: .8, borderRadius: 1.6, border: `1px solid ${active ? "var(--mf-primary-border)" : "var(--mf-border)"}`, background: active ? "var(--mf-primary-soft)" : done ? "var(--mf-success-soft)" : "var(--mf-surface)", mb: .65 });
const builderWorkflowNumberSx = (active, done) => ({ flex: "0 0 auto", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 10.5, fontWeight: 950, color: done ? "var(--mf-success-text)" : active ? "var(--mf-primary-text)" : "var(--mf-text-muted)", background: done ? "var(--mf-success-soft)" : active ? "var(--mf-primary-soft)" : "var(--mf-surface-strong)", border: `1px solid ${done ? "var(--mf-success-border)" : active ? "var(--mf-primary-border)" : "var(--mf-border)"}` });
const builderWorkflowTitleSx = { color: "var(--mf-text)", fontSize: 11.2, fontWeight: 900 };
const builderQuickActionSx = { width: "100%", justifyContent: "flex-start", gap: .75, px: .8, py: .75, color: "var(--mf-text)", border: "1px solid var(--mf-border)", borderRadius: 1.6, background: "var(--mf-surface)", "&:hover": { background: "var(--mf-hover)" } };
const builderQuickIconSx = { width: 28, height: 28, borderRadius: 1.5, display: "grid", placeItems: "center", color: "var(--mf-primary-text)", background: "var(--mf-primary-soft)", "& svg": { fontSize: 17 } };
const builderQuickTitleSx = { color: "var(--mf-text)", fontSize: 10.7, fontWeight: 900 };