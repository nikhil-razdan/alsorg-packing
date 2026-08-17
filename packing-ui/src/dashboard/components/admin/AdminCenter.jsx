import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    publishPackFlowDataChanged,
} from "../../../utils/packFlowDataEvents";

import { API_BASE_URL } from "../../../config";

import {
    executeAdminMasterDeletion,
    executeAdminPacketDeletion,
    executeAdminPacketRollback,
    fetchAdminDeletionHistory,
    fetchAdminPacketRollbackHistory,
    previewAdminMasterDeletion,
    previewAdminPacketDeletion,
    previewAdminPacketRollback,
    searchAdminMasterItems,
    searchAdminPacketItems,
} from "../../api/dashboardApi";

async function requestAdminWarehouseDeletion(
    path,
    options = {}
) {
    const response = await fetch(
        `${API_BASE_URL}${path}`,
        {
            credentials: "include",
            ...options,
            headers: {
                ...(options.body
                    ? {
                        "Content-Type":
                            "application/json",
                    }
                    : {}),
                ...(options.headers || {}),
            },
        }
    );

    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const message =
            typeof data === "object" && data
                ? data.message ||
                data.error ||
                text
                : text;

        throw new Error(
            message ||
            "Warehouse deletion request failed"
        );
    }

    return data;
}

const searchAdminWarehouseItems = ({
    query,
    page = 0,
    size = 20,
}) =>
    requestAdminWarehouseDeletion(
        `/api/admin/deletions/warehouse-items/search?query=${encodeURIComponent(
            query || ""
        )}&page=${Math.max(
            0,
            Number(page) || 0
        )}&size=${Math.max(
            1,
            Number(size) || 20
        )}`
    );

const previewAdminWarehouseDeletion = (
    itemId
) =>
    requestAdminWarehouseDeletion(
        `/api/admin/deletions/warehouse-items/${encodeURIComponent(
            itemId
        )}/preview`
    );

const executeAdminWarehouseDeletion = (
    itemId,
    payload
) =>
    requestAdminWarehouseDeletion(
        `/api/admin/deletions/warehouse-items/${encodeURIComponent(
            itemId
        )}/execute`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );

const previewAdminWarehouseBulkDeletion = (
    itemIds
) =>
    requestAdminWarehouseDeletion(
        "/api/admin/deletions/warehouse-items/bulk/preview",
        {
            method: "POST",
            body: JSON.stringify(
                Array.isArray(itemIds)
                    ? itemIds
                    : []
            ),
        }
    );

const executeAdminWarehouseBulkDeletion = (
    payload
) =>
    requestAdminWarehouseDeletion(
        "/api/admin/deletions/warehouse-items/bulk/execute",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );

const EMPTY_PAGE = {
    content: [],
    number: 0,
    size: 20,
    totalPages: 0,
    totalElements: 0,
    first: true,
    last: true,
};

const normalizePageResponse = (
    data,
    fallbackPage = 0,
    fallbackSize = 20
) => {
    if (Array.isArray(data)) {
        return {
            ...EMPTY_PAGE,
            content: data,
            number: fallbackPage,
            size: fallbackSize,
            totalPages: data.length > 0 ? 1 : 0,
            totalElements: data.length,
            first: true,
            last: true,
        };
    }

    const content =
        Array.isArray(data?.content)
            ? data.content
            : [];

    return {
        content,

        number:
            Number.isFinite(Number(data?.number))
                ? Number(data.number)
                : fallbackPage,

        size:
            Number.isFinite(Number(data?.size))
                ? Number(data.size)
                : fallbackSize,

        totalPages:
            Number.isFinite(
                Number(data?.totalPages)
            )
                ? Number(data.totalPages)
                : content.length > 0
                    ? 1
                    : 0,

        totalElements:
            Number.isFinite(
                Number(data?.totalElements)
            )
                ? Number(data.totalElements)
                : content.length,

        first:
            Boolean(
                data?.first ??
                fallbackPage === 0
            ),

        last:
            Boolean(
                data?.last ??
                true
            ),
    };
};

const resolveTargetType = (
    target,
    fallbackType = "PACKET_ITEM"
) =>
    String(
        target?.targetType ||
        target?.type ||
        fallbackType
    )
        .trim()
        .toUpperCase();

const normalizeTargetPage = (
    data,
    fallbackType,
    fallbackPage = 0,
    fallbackSize = 20
) => {
    const normalizedPage =
        normalizePageResponse(
            data,
            fallbackPage,
            fallbackSize
        );

    return {
        ...normalizedPage,

        content:
            normalizedPage.content.map(
                (row) => {
                    const resolvedType =
                        resolveTargetType(
                            row,
                            fallbackType
                        );

                    return {
                        ...row,

                        type:
                            resolvedType,

                        targetType:
                            resolvedType,

                        description:
                            row?.description ??
                            row?.itemDescription ??
                            "",

                        drawingNo:
                            row?.drawingNo ??
                            row?.drawingName ??
                            "",

                        id:
                            row?.id ??
                            row?.targetId,
                    };
                }
            ),
    };
};

const formatLabel = (value) =>
    String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) =>
            char.toUpperCase()
        );

const formatDateTime = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};


const getCreatedBy = (row) =>
    row?.createdBy ||
    row?.generatedBy ||
    row?.raisedBy ||
    row?.addedBy ||
    "-";

const getPackedBy = (row) =>
    row?.packedBy ||
    row?.stickerGeneratedBy ||
    row?.generatedBy ||
    "-";

const getDispatchedBy = (row) =>
    row?.dispatchedBy ||
    row?.dispatchBy ||
    row?.tripStartedBy ||
    "-";

const getCreatedAt = (row) =>
    row?.createdAt ||
    row?.generatedAt ||
    row?.addedAt ||
    null;

const getPackedAt = (row) =>
    row?.packedAt ||
    row?.stickerGeneratedAt ||
    row?.packingDate ||
    null;

const getDispatchedAt = (row) =>
    row?.dispatchedAt ||
    row?.tripStartedAt ||
    row?.dispatchDate ||
    null;

const hasPackedLifecycle = (row) =>
    Boolean(
        row?.packedBy ||
        row?.packedAt ||
        row?.stickerNumber ||
        String(row?.status || "")
            .toUpperCase()
            .includes("PACK")
    );

const hasDispatchedLifecycle = (row) =>
    Boolean(
        row?.dispatchedBy ||
        row?.dispatchedAt ||
        row?.challanNumber ||
        row?.chalaanNumber ||
        String(row?.status || "")
            .toUpperCase()
            .includes("DISPATCH")
    );

const parseJsonObject = (value) => {
    if (!value) return {};

    if (
        typeof value === "object" &&
        !Array.isArray(value)
    ) {
        return value;
    }

    try {
        const parsed =
            JSON.parse(value);

        return parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
};

const getTargetLabel = (target) => {
    if (!target) return "";

    const type =
        resolveTargetType(target);

    if (type === "MASTER_ITEM") {
        return (
            target.itemName ||
            target.pdNo ||
            target.displayName ||
            target.id ||
            target.targetId
        );
    }

    return (
        target.itemName ||
        target.packetNumber ||
        target.sku ||
        target.displayName ||
        target.id ||
        target.targetId
    );
};

function ResultPagination({
    page,
    onPageChange,
    disabled,
}) {
    if (!page) {
        return null;
    }

    const currentPage =
        Number(page.number || 0);

    const totalPages =
        Math.max(
            1,
            Number(page.totalPages || 0)
        );

    const totalElements =
        Number(page.totalElements || 0);

    const pageSize =
        Math.max(
            1,
            Number(page.size || 20)
        );

    const startRecord =
        totalElements === 0
            ? 0
            : currentPage * pageSize + 1;

    const endRecord =
        Math.min(
            (currentPage + 1) * pageSize,
            totalElements
        );

    const pageWindow = [];

    const firstVisible =
        Math.max(
            0,
            Math.min(
                currentPage - 2,
                totalPages - 5
            )
        );

    const lastVisible =
        Math.min(
            totalPages - 1,
            firstVisible + 4
        );

    for (
        let index = firstVisible;
        index <= lastVisible;
        index += 1
    ) {
        pageWindow.push(index);
    }

    return (
        <div style={paginationShell}>
            <div style={paginationRecordMeta}>
                {totalElements > 0
                    ? `Showing ${startRecord}–${endRecord} of ${totalElements}`
                    : "No records"}
            </div>

            <div style={paginationRow}>
                <button
                    type="button"
                    disabled={
                        disabled ||
                        currentPage <= 0
                    }
                    onClick={() =>
                        onPageChange(0)
                    }
                    style={paginationIconButton(
                        disabled ||
                        currentPage <= 0
                    )}
                    title="First page"
                >
                    «
                </button>

                <button
                    type="button"
                    disabled={
                        disabled ||
                        currentPage <= 0
                    }
                    onClick={() =>
                        onPageChange(
                            currentPage - 1
                        )
                    }
                    style={paginationButton(
                        disabled ||
                        currentPage <= 0
                    )}
                >
                    ← Previous
                </button>

                <div style={paginationNumberRow}>
                    {pageWindow.map(
                        (pageNumber) => (
                            <button
                                type="button"
                                key={pageNumber}
                                disabled={disabled}
                                onClick={() =>
                                    onPageChange(
                                        pageNumber
                                    )
                                }
                                style={paginationNumberButton(
                                    pageNumber ===
                                    currentPage,
                                    disabled
                                )}
                            >
                                {pageNumber + 1}
                            </button>
                        )
                    )}
                </div>

                <div style={paginationText}>
                    Page {currentPage + 1} of{" "}
                    {totalPages}
                </div>

                <button
                    type="button"
                    disabled={
                        disabled ||
                        currentPage >=
                        totalPages - 1
                    }
                    onClick={() =>
                        onPageChange(
                            currentPage + 1
                        )
                    }
                    style={paginationButton(
                        disabled ||
                        currentPage >=
                        totalPages - 1
                    )}
                >
                    Next →
                </button>

                <button
                    type="button"
                    disabled={
                        disabled ||
                        currentPage >=
                        totalPages - 1
                    }
                    onClick={() =>
                        onPageChange(
                            totalPages - 1
                        )
                    }
                    style={paginationIconButton(
                        disabled ||
                        currentPage >=
                        totalPages - 1
                    )}
                    title="Last page"
                >
                    »
                </button>
            </div>
        </div>
    );
}

function ImpactGrid({
    rows,
    title = "Affected Records",
}) {
    const entries =
        Object.entries(rows || {});

    if (entries.length === 0) {
        return null;
    }

    return (
        <div>
            <div style={sectionHeading}>
                {title}
            </div>

            <div style={impactGrid}>
                {entries.map(
                    ([key, value]) => (
                        <div
                            key={key}
                            style={impactItem}
                        >
                            <div style={impactLabel}>
                                {formatLabel(key)}
                            </div>

                            <div style={impactValue}>
                                {Number(value || 0)}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

function SearchResultCard({
    target,
    selected,
    onSelect,
    disabled,
}) {
    const resolvedTargetType =
        resolveTargetType(target);

    const isMaster =
        resolvedTargetType ===
        "MASTER_ITEM";

    const isWarehouse =
        resolvedTargetType ===
        "WAREHOUSE_ITEM";

    const description =
        target.description ||
        target.itemDescription ||
        "";

    const createdBy =
        getCreatedBy(target);

    const packedBy =
        getPackedBy(target);

    const dispatchedBy =
        getDispatchedBy(target);

    const createdAt =
        getCreatedAt(target);

    const packedAt =
        getPackedAt(target);

    const dispatchedAt =
        getDispatchedAt(target);

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(target)}
            style={searchResultCard(
                selected,
                disabled
            )}
        >
            <div style={searchResultTop}>
                <div style={resultIdentity}>
                    <div style={resultBadgeRow}>
                        <div
                            style={resultTypeBadge(
                                isMaster
                                    ? "#a78bfa"
                                    : isWarehouse
                                        ? "#f59e0b"
                                        : "#38bdf8"
                            )}
                        >
                            {isMaster
                                ? "Master Item"
                                : isWarehouse
                                    ? "Warehouse Item"
                                    : "Packet Item"}
                        </div>

                        <div style={resultStatusBadge}>
                            {target.status || "UNKNOWN"}
                        </div>
                    </div>

                    <div style={resultTitle}>
                        {getTargetLabel(target)}
                    </div>

                    {!isMaster && (
                        <div style={resultDescription}>
                            <div style={resultDescriptionLabel}>
                                Description
                            </div>

                            <div style={resultDescriptionText}>
                                {description ||
                                    "No description available"}
                            </div>
                        </div>
                    )}
                </div>

                <div
                    style={selectIndicator(
                        selected
                    )}
                >
                    {selected ? "✓" : "→"}
                </div>
            </div>

            <div style={resultMetaGrid}>
                <div>
                    <span>PD No.</span>
                    <strong>
                        {target.pdNo || "-"}
                    </strong>
                </div>

                <div>
                    <span>Drawing</span>
                    <strong>
                        {target.drawingNo || "-"}
                    </strong>
                </div>

                <div>
                    <span>
                        {isMaster
                            ? "Total Packets"
                            : isWarehouse
                                ? "Warehouse Record"
                                : "Packet No."}
                    </span>

                    <strong>
                        {isMaster
                            ? Number(
                                target.totalPackets || 0
                            )
                            : isWarehouse
                                ? target.location ||
                                target.plantCode ||
                                "Warehouse"
                                : target.packetNumber || "-"}
                    </strong>
                </div>

                {!isMaster && (
                    <>
                        <div>
                            <span>SKU</span>
                            <strong>
                                {target.sku || "-"}
                            </strong>
                        </div>

                        <div>
                            <span>Sticker</span>
                            <strong>
                                {target.stickerNumber || "-"}
                            </strong>
                        </div>

                        <div>
                            <span>Challan</span>
                            <strong>
                                {target.challanNumber ||
                                    target.chalaanNumber ||
                                    "-"}
                            </strong>
                        </div>
                    </>
                )}
            </div>

            <div style={resultLifecycleGrid}>
                <div style={lifecycleMetaCard}>
                    <span>Created By</span>
                    <strong>
                        {createdBy}
                    </strong>
                    <small>
                        {formatDateTime(
                            createdAt
                        )}
                    </small>
                </div>

                {!isMaster &&
                    hasPackedLifecycle(target) && (
                        <div style={lifecycleMetaCard}>
                            <span>Packed By</span>
                            <strong>
                                {packedBy}
                            </strong>
                            <small>
                                {formatDateTime(
                                    packedAt
                                )}
                            </small>
                        </div>
                    )}

                {!isMaster &&
                    hasDispatchedLifecycle(target) && (
                        <div style={lifecycleMetaCard}>
                            <span>Dispatched By</span>
                            <strong>
                                {dispatchedBy}
                            </strong>
                            <small>
                                {formatDateTime(
                                    dispatchedAt
                                )}
                            </small>
                        </div>
                    )}
            </div>

            <div style={resultFooterRow}>
                <div style={resultId}>
                    ID: {target.id}
                </div>

                <div style={resultOpenHint}>
                    Open complete details →
                </div>
            </div>
        </button>
    );
}


function LifecycleMetaPanel({
    row,
}) {
    if (!row) return null;

    const createdAt =
        getCreatedAt(row);

    const packedAt =
        getPackedAt(row);

    const dispatchedAt =
        getDispatchedAt(row);

    return (
        <div>
            <div style={sectionHeading}>
                Lifecycle & Responsibility
            </div>

            <div style={lifecyclePanelGrid}>
                <div style={lifecyclePanelCard}>
                    <span>Created By</span>
                    <strong>
                        {getCreatedBy(row)}
                    </strong>
                    <small>
                        {formatDateTime(
                            createdAt
                        )}
                    </small>
                </div>

                {hasPackedLifecycle(row) && (
                    <div style={lifecyclePanelCard}>
                        <span>Packed By</span>
                        <strong>
                            {getPackedBy(row)}
                        </strong>
                        <small>
                            {formatDateTime(
                                packedAt
                            )}
                        </small>
                    </div>
                )}

                {hasDispatchedLifecycle(row) && (
                    <div style={lifecyclePanelCard}>
                        <span>Dispatched By</span>
                        <strong>
                            {getDispatchedBy(row)}
                        </strong>
                        <small>
                            {formatDateTime(
                                dispatchedAt
                            )}
                        </small>
                    </div>
                )}

                <div style={lifecyclePanelCard}>
                    <span>Last Updated</span>
                    <strong>
                        {row.updatedBy ||
                            row.modifiedBy ||
                            "-"}
                    </strong>
                    <small>
                        {formatDateTime(
                            row.updatedAt ||
                            row.modifiedAt
                        )}
                    </small>
                </div>
            </div>
        </div>
    );
}

function DeletionHistory({
    page,
    loading,
    error,
    onPageChange,
}) {
    return (
        <div>
            <div style={historyHeader}>
                <div>
                    <div style={sectionHeading}>
                        Permanent Deletion History
                    </div>

                    <div style={sectionDescription}>
                        This history remains even after
                        the operational records are
                        deleted.
                    </div>
                </div>

                <div style={historyTotal}>
                    {Number(
                        page.totalElements || 0
                    )}{" "}
                    records
                </div>
            </div>

            {loading && (
                <div style={emptyState}>
                    Loading deletion history...
                </div>
            )}

            {!loading && error && (
                <div style={errorBox}>
                    {error}
                </div>
            )}

            {!loading &&
                !error &&
                page.content.length === 0 && (
                    <div style={emptyState}>
                        No permanent deletions have
                        been recorded.
                    </div>
                )}

            {!loading &&
                !error &&
                page.content.length > 0 && (
                    <div style={historyList}
                        className="admin-center-scroll">
                        {page.content.map(
                            (row) => {
                                const affectedRows =
                                    parseJsonObject(
                                        row.affectedRowsJson
                                    );

                                const deletedCount =
                                    Object.values(
                                        affectedRows
                                    ).reduce(
                                        (sum, value) =>
                                            sum +
                                            Number(
                                                value || 0
                                            ),
                                        0
                                    );

                                return (
                                    <div
                                        key={row.id}
                                        style={historyCard}
                                    >
                                        <div
                                            style={
                                                historyCardHeader
                                            }
                                        >
                                            <div>
                                                <div
                                                    style={resultTypeBadge(
                                                        row.targetType ===
                                                            "MASTER_ITEM"
                                                            ? "#a78bfa"
                                                            : String(row.targetType || "").startsWith(
                                                                "WAREHOUSE"
                                                            )
                                                                ? "#f59e0b"
                                                                : "#38bdf8"
                                                    )}
                                                >
                                                    {formatLabel(
                                                        row.targetType
                                                    )}
                                                </div>

                                                <div
                                                    style={
                                                        historyTitle
                                                    }
                                                >
                                                    {row.displayName ||
                                                        row.targetId}
                                                </div>
                                            </div>

                                            <div
                                                style={
                                                    historyDeletedCount
                                                }
                                            >
                                                {deletedCount} rows
                                            </div>
                                        </div>

                                        <div
                                            style={
                                                historyDetails
                                            }
                                        >
                                            <div>
                                                <span>
                                                    Deleted By
                                                </span>
                                                <strong>
                                                    {row.deletedBy ||
                                                        "-"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Deleted At
                                                </span>
                                                <strong>
                                                    {formatDateTime(
                                                        row.deletedAt
                                                    )}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Reason</span>
                                                <strong>
                                                    {row.reason ||
                                                        "-"}
                                                </strong>
                                            </div>
                                        </div>

                                        <div style={historyTargetId}>
                                            Target ID:{" "}
                                            {row.targetId}
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>
                )}

            <ResultPagination
                page={page}
                onPageChange={onPageChange}
                disabled={loading}
            />
        </div>
    );
}

function AdminPacketRollbackPanel({
    onChanged,
}) {
    const [query, setQuery] =
        useState("");

    const [page, setPage] =
        useState(EMPTY_PAGE);

    const [searching, setSearching] =
        useState(false);

    const [selected, setSelected] =
        useState(null);

    const [preview, setPreview] =
        useState(null);

    const [previewing, setPreviewing] =
        useState(false);

    const [reason, setReason] =
        useState("");

    const [confirmation, setConfirmation] =
        useState("");

    const [executing, setExecuting] =
        useState(false);

    const [error, setError] =
        useState("");

    const [result, setResult] =
        useState(null);

    const warehouseBulkIds =
        useMemo(
            () =>
                warehouseBulkTargets
                    .map((target) =>
                        String(
                            target?.id || ""
                        ).trim()
                    )
                    .filter(Boolean),
            [warehouseBulkTargets]
        );

    const warehouseBulkIdSet =
        useMemo(
            () =>
                new Set(
                    warehouseBulkIds
                ),
            [warehouseBulkIds]
        );

    const requiredConfirmation =
        preview?.requiredConfirmation || "";

    const reasonValid =
        reason.trim().length >= 5 &&
        reason.trim().length <= 1000;

    const confirmationValid =
        Boolean(requiredConfirmation) &&
        confirmation.trim() ===
        requiredConfirmation;

    const canExecute =
        Boolean(preview?.rollbackAllowed) &&
        reasonValid &&
        confirmationValid &&
        !executing;

    const performSearch = async (
        requestedPage = 0
    ) => {
        const cleanQuery =
            query.trim();

        if (!cleanQuery) {
            setError(
                "Enter an item, packet, SKU, sticker, PD number or UUID."
            );

            return;
        }

        setSearching(true);
        setError("");
        setSelected(null);
        setPreview(null);
        setResult(null);

        try {
            const data =
                await searchAdminPacketItems({
                    query: cleanQuery,
                    page: requestedPage,
                    size: 20,
                });

            setPage(
                normalizeTargetPage(
                    data,
                    "PACKET_ITEM",
                    requestedPage,
                    20
                )
            );
        } catch (searchError) {
            console.error(searchError);

            setError(
                searchError?.message ||
                "Unable to search packet items."
            );

            setPage(EMPTY_PAGE);
        } finally {
            setSearching(false);
        }
    };

    const loadRollbackPreview = async (
        target
    ) => {
        if (!target?.id) return;

        setSelected(target);
        setPreview(null);
        setResult(null);
        setReason("");
        setConfirmation("");
        setError("");
        setPreviewing(true);

        try {
            const data =
                await previewAdminPacketRollback(
                    target.id
                );

            setPreview(data);
        } catch (previewError) {
            console.error(previewError);

            setError(
                previewError?.message ||
                "Unable to calculate previous packet state."
            );
        } finally {
            setPreviewing(false);
        }
    };

    const executeRollback = async () => {
        if (
            !canExecute ||
            !selected?.id
        ) {
            return;
        }

        setExecuting(true);
        setError("");

        try {
            const data =
                await executeAdminPacketRollback(
                    selected.id,
                    {
                        reason:
                            reason.trim(),

                        confirmationText:
                            confirmation.trim(),
                    }
                );

            setResult(data);
            setPreview(null);
            setSelected(null);
            setReason("");
            setConfirmation("");

            setPage((current) => ({
                ...current,

                content:
                    current.content.map(
                        (item) => {
                            const sameItem =
                                String(item.id) ===
                                String(
                                    data.packetItemId
                                );

                            if (!sameItem) {
                                return item;
                            }

                            return {
                                ...item,

                                status:
                                    data.currentStatus ??
                                    item.status,

                                location:
                                    data.currentLocation ??
                                    item.location,

                                currentLocation:
                                    data.currentLocation ??
                                    item.currentLocation,

                                currentLocationCode:
                                    data.currentLocation ??
                                    item.currentLocationCode,

                                gatePassNumber:
                                    Object.prototype.hasOwnProperty.call(
                                        data,
                                        "gatePassNumber"
                                    )
                                        ? data.gatePassNumber
                                        : item.gatePassNumber,

                                challanNumber:
                                    Object.prototype.hasOwnProperty.call(
                                        data,
                                        "challanNumber"
                                    )
                                        ? data.challanNumber
                                        : item.challanNumber,

                                stickerNumber:
                                    Object.prototype.hasOwnProperty.call(
                                        data,
                                        "stickerNumber"
                                    )
                                        ? data.stickerNumber
                                        : item.stickerNumber,
                            };
                        }
                    ),
            }));

            await Promise.resolve(
                onChanged?.({
                    action:
                        "PACKET_STATE_ROLLBACK",

                    ...data,
                })
            );
        } catch (executeError) {
            console.error(executeError);

            setError(
                executeError?.message ||
                "Unable to move packet to previous state."
            );
        } finally {
            setExecuting(false);
        }
    };

    return (
        <div style={deleteLayout}>
            <div style={searchColumn}>
                <div style={rollbackIntro}>
                    <div style={rollbackIntroTitle}>
                        Move Packet to Previous State
                    </div>

                    <div style={rollbackIntroText}>
                        This reverses exactly one lifecycle
                        step and clears the operational
                        data created by that step.
                    </div>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        performSearch(0);
                    }}
                    style={searchForm}
                >
                    <input
                        value={query}
                        onChange={(event) =>
                            setQuery(
                                event.target.value
                            )
                        }
                        disabled={
                            searching ||
                            executing
                        }
                        placeholder="Search item, description, packet no., SKU, sticker, PD no. or UUID"
                        style={searchInput}
                    />

                    <button
                        type="submit"
                        disabled={
                            searching ||
                            executing ||
                            !query.trim()
                        }
                        style={searchButton(
                            searching ||
                            executing ||
                            !query.trim()
                        )}
                    >
                        {searching
                            ? "Searching..."
                            : "Search"}
                    </button>
                </form>

                <div style={searchSummary}>
                    <span>Packet Results</span>

                    <strong>
                        {Number(
                            page.totalElements || 0
                        )}
                    </strong>
                </div>

                {searching && (
                    <div style={emptyState}>
                        Searching packet items...
                    </div>
                )}

                {!searching &&
                    page.content.length === 0 && (
                        <div style={emptyState}>
                            Search for a packet to begin.
                        </div>
                    )}

                {!searching &&
                    page.content.length > 0 && (
                        <div style={searchResults}
                            className="admin-center-scroll">
                            {page.content.map(
                                (target) => (
                                    <SearchResultCard
                                        key={target.id}
                                        target={target}
                                        selected={
                                            selected?.id ===
                                            target.id
                                        }
                                        disabled={
                                            executing
                                        }
                                        onSelect={
                                            loadRollbackPreview
                                        }
                                    />
                                )
                            )}
                        </div>
                    )}

                <ResultPagination
                    page={page}
                    disabled={
                        searching ||
                        executing
                    }
                    onPageChange={
                        performSearch
                    }
                />
            </div>

            <div style={previewColumn}>
                {result && (
                    <div style={successBox}>
                        <div style={successTitle}>
                            ✓ Packet moved back
                        </div>

                        <div style={successMessage}>
                            {result.message}
                        </div>

                        <div style={stateTransitionRow}>
                            <div style={stateBox}>
                                <span>From</span>
                                <strong>
                                    {result.previousStateLabel}
                                </strong>
                            </div>

                            <div style={stateArrow}>
                                →
                            </div>

                            <div style={stateBox}>
                                <span>Now</span>
                                <strong>
                                    {result.currentStateLabel}
                                </strong>
                            </div>
                        </div>

                        <div style={successMeta}>
                            <div>
                                <span>Changed By</span>
                                <strong>
                                    {result.changedBy}
                                </strong>
                            </div>

                            <div>
                                <span>Audit ID</span>
                                <strong>
                                    {result.auditId}
                                </strong>
                            </div>
                        </div>
                    </div>
                )}

                {!selected &&
                    !result && (
                        <div style={previewPlaceholder}>
                            <div
                                style={
                                    previewPlaceholderIcon
                                }
                            >
                                ↶
                            </div>

                            <div
                                style={
                                    previewPlaceholderTitle
                                }
                            >
                                Select a packet
                            </div>

                            <div
                                style={
                                    previewPlaceholderText
                                }
                            >
                                The backend will calculate
                                the current and previous
                                lifecycle states and show
                                every field that will change.
                            </div>
                        </div>
                    )}

                {previewing && (
                    <div style={emptyState}>
                        Calculating previous state...
                    </div>
                )}

                {error && (
                    <div style={errorBox}>
                        {error}
                    </div>
                )}

                {preview && (
                    <div style={previewContent}
                        className="admin-center-scroll">
                        <div style={previewHeader}>
                            <div>
                                <div
                                    style={resultTypeBadge(
                                        "#38bdf8"
                                    )}
                                >
                                    Packet Lifecycle
                                </div>

                                <div style={previewTitle}>
                                    {preview.itemName ||
                                        preview.packetNumber}
                                </div>
                            </div>

                            <div style={permanentBadge}>
                                Admin Only
                            </div>
                        </div>

                        <div style={previewDescription}>
                            <div
                                style={
                                    previewDescriptionLabel
                                }
                            >
                                Packet Description
                            </div>

                            <div
                                style={
                                    previewDescriptionText
                                }
                            >
                                {preview.description ||
                                    "No description available"}
                            </div>
                        </div>

                        <div style={stateTransitionRow}>
                            <div style={stateBox}>
                                <span>Current State</span>
                                <strong>
                                    {preview.currentLifecycleLabel}
                                </strong>
                            </div>

                            <div style={stateArrow}>
                                ←
                            </div>

                            <div style={stateBox}>
                                <span>Previous State</span>
                                <strong>
                                    {preview.previousLifecycleLabel ||
                                        "No earlier state"}
                                </strong>
                            </div>
                        </div>

                        <div style={previewMetaGrid}>
                            <div>
                                <span>Packet</span>
                                <strong>
                                    {preview.packetNumber ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>PD No.</span>
                                <strong>
                                    {preview.pdNo ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Status</span>
                                <strong>
                                    {preview.persistedDispatchStatus ||
                                        preview.persistedPacketStatus}
                                </strong>
                            </div>

                            <div>
                                <span>Current Location</span>
                                <strong>
                                    {preview.currentLocation ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Previous Location</span>
                                <strong>
                                    {preview.previousLocation ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Sticker</span>
                                <strong>
                                    {preview.stickerNumber ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Gate Pass</span>
                                <strong>
                                    {preview.gatePassNumber ||
                                        "-"}
                                </strong>
                            </div>

                            <div>
                                <span>Challan</span>
                                <strong>
                                    {preview.challanNumber ||
                                        "-"}
                                </strong>
                            </div>
                        </div>

                        <LifecycleMetaPanel
                            row={preview}
                        />

                        {preview.warning && (
                            <div style={impactWarning}>
                                {preview.warning}
                            </div>
                        )}

                        <div>
                            <div style={sectionHeading}>
                                Changes to be applied
                            </div>

                            <div style={changeList}>
                                {preview.changes?.map(
                                    (change, index) => (
                                        <div
                                            key={`${change}-${index}`}
                                            style={changeItem}
                                        >
                                            <span>✓</span>
                                            {change}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        <ImpactGrid
                            rows={
                                preview.affectedRecords
                            }
                        />

                        <div style={confirmationSection}>
                            <label style={fieldLabel}>
                                Administrative Reason
                            </label>

                            <textarea
                                value={reason}
                                onChange={(event) =>
                                    setReason(
                                        event.target.value
                                    )
                                }
                                maxLength={1000}
                                disabled={executing}
                                placeholder="Explain why this packet must be moved to its previous state..."
                                style={reasonInput}
                            />

                            <div style={fieldHelper}>
                                Minimum 5 characters •{" "}
                                {reason.length}/1000
                            </div>

                            <label style={fieldLabel}>
                                Type the exact confirmation
                            </label>

                            <div
                                style={
                                    requiredConfirmationBox
                                }
                            >
                                {requiredConfirmation}
                            </div>

                            <input
                                value={confirmation}
                                onChange={(event) =>
                                    setConfirmation(
                                        event.target.value
                                    )
                                }
                                disabled={executing}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder="Type the confirmation shown above"
                                style={confirmationInput(
                                    confirmation.length >
                                    0 &&
                                    !confirmationValid
                                )}
                            />

                            <button
                                type="button"
                                disabled={!canExecute}
                                onClick={executeRollback}
                                style={rollbackButton(
                                    !canExecute
                                )}
                            >
                                {executing
                                    ? "Moving packet back..."
                                    : `Move Back to ${preview.previousLifecycleLabel ||
                                    "Previous State"
                                    }`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AdminRollbackHistory({
    page,
    loading,
    error,
    onPageChange,
}) {
    return (
        <div>
            <div style={historyHeader}>
                <div>
                    <div style={sectionHeading}>
                        Packet State-Change History
                    </div>

                    <div style={sectionDescription}>
                        Permanent record of every packet
                        moved to a previous lifecycle state.
                    </div>
                </div>

                <div style={historyTotal}>
                    {Number(
                        page.totalElements || 0
                    )}{" "}
                    records
                </div>
            </div>

            {loading && (
                <div style={emptyState}>
                    Loading state-change history...
                </div>
            )}

            {!loading && error && (
                <div style={errorBox}>
                    {error}
                </div>
            )}

            {!loading &&
                !error &&
                page.content.length === 0 && (
                    <div style={emptyState}>
                        No packet state corrections
                        have been recorded.
                    </div>
                )}

            {!loading &&
                !error &&
                page.content.length > 0 && (
                    <div style={historyList}
                        className="admin-center-scroll">
                        {page.content.map(
                            (row) => (
                                <div
                                    key={row.id}
                                    style={historyCard}
                                >
                                    <div
                                        style={
                                            historyCardHeader
                                        }
                                    >
                                        <div>
                                            <div
                                                style={resultTypeBadge(
                                                    "#60a5fa"
                                                )}
                                            >
                                                State Correction
                                            </div>

                                            <div
                                                style={
                                                    historyTitle
                                                }
                                            >
                                                {row.displayName ||
                                                    row.packetItemId}
                                            </div>
                                        </div>

                                        <div
                                            style={
                                                historyDeletedCount
                                            }
                                        >
                                            {formatLabel(
                                                row.fromState
                                            )}
                                            {" → "}
                                            {formatLabel(
                                                row.toState
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        style={
                                            historyDetails
                                        }
                                    >
                                        <div>
                                            <span>
                                                Changed By
                                            </span>

                                            <strong>
                                                {row.changedBy ||
                                                    "-"}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Changed At
                                            </span>

                                            <strong>
                                                {formatDateTime(
                                                    row.changedAt
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Reason
                                            </span>

                                            <strong>
                                                {row.reason ||
                                                    "-"}
                                            </strong>
                                        </div>
                                    </div>

                                    <div
                                        style={
                                            historyTargetId
                                        }
                                    >
                                        Packet Item ID:{" "}
                                        {row.packetItemId}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}

            <ResultPagination
                page={page}
                onPageChange={onPageChange}
                disabled={loading}
            />
        </div>
    );
}

function AdminCenter({
    open,
    onClose,
    onChanged,
    onDeleted,
}) {

    const notifyChanged =
        onChanged || onDeleted;

    const [workspaceTab, setWorkspaceTab] =
        useState("rollback");

    const [targetType, setTargetType] =
        useState("PACKET_ITEM");

    const [
        warehouseBulkMode,
        setWarehouseBulkMode,
    ] = useState(false);

    const [
        warehouseBulkTargets,
        setWarehouseBulkTargets,
    ] = useState([]);

    const [query, setQuery] =
        useState("");

    const [searchPage, setSearchPage] =
        useState(EMPTY_PAGE);

    const [searchLoading, setSearchLoading] =
        useState(false);

    const [searchError, setSearchError] =
        useState("");

    const [selectedTarget, setSelectedTarget] =
        useState(null);

    const [preview, setPreview] =
        useState(null);

    const [previewLoading, setPreviewLoading] =
        useState(false);

    const [previewError, setPreviewError] =
        useState("");

    const [reason, setReason] =
        useState("");

    const [confirmation, setConfirmation] =
        useState("");

    const [deleting, setDeleting] =
        useState(false);

    const [deleteError, setDeleteError] =
        useState("");

    const [deleteResult, setDeleteResult] =
        useState(null);

    const [historyPage, setHistoryPage] =
        useState(EMPTY_PAGE);

    const [historyLoading, setHistoryLoading] =
        useState(false);

    const [historyError, setHistoryError] =
        useState("");

    const [rollbackHistoryPage, setRollbackHistoryPage] =
        useState(EMPTY_PAGE);

    const [rollbackHistoryLoading, setRollbackHistoryLoading] =
        useState(false);

    const [rollbackHistoryError, setRollbackHistoryError] =
        useState("");

    const pageSize = 20;

    const requiredConfirmation =
        preview?.requiredConfirmation || "";

    const reasonValid =
        reason.trim().length >= 5 &&
        reason.trim().length <= 1000;

    const confirmationValid =
        Boolean(requiredConfirmation) &&
        confirmation.trim() ===
        requiredConfirmation;

    const canDelete =
        Boolean(preview) &&
        reasonValid &&
        confirmationValid &&
        !deleting;

    const targetTypeDescription =
        targetType === "MASTER_ITEM"
            ? "Deletes the selected master and all child packets."
            : targetType === "WAREHOUSE_ITEM"
                ? warehouseBulkMode
                    ? "Bulk mode: select multiple Warehouse-visible rows from the search results, preview the complete combined impact, then permanently delete them in one audited transaction."
                    : "Deletes one Warehouse-visible row and every linked operational record. Excel-imported rows are supported even when no PacketItem exists."
                : "Deletes one packet and its linked operational history.";

    const selectedTargetId =
        selectedTarget?.id || null;

    const sortedAffectedRows =
        useMemo(() => {
            const source =
                preview?.affectedRows || {};

            return Object.fromEntries(
                Object.entries(source).sort(
                    ([firstKey], [secondKey]) =>
                        firstKey.localeCompare(
                            secondKey
                        )
                )
            );
        }, [preview]);

    const notifyAdminDataChanged = async (
        payload
    ) => {
        const detail = {
            ...payload,

            scopes: [
                "inventory",
                "warehouse",
                "dispatch",
                "dashboard",
            ],
        };

        publishPackFlowDataChanged(
            detail
        );

        /*
         * onDeleted remains supported for old parent code.
         * onChanged is the preferred callback because rollback
         * is not a deletion.
         */
        const callback =
            onChanged ||
            onDeleted;

        await Promise.resolve(
            callback?.(detail)
        );
    };

    const resetSelection = () => {
        setSelectedTarget(null);
        setPreview(null);
        setPreviewError("");
        setReason("");
        setConfirmation("");
        setDeleteError("");
        setDeleteResult(null);
    };

    const resetWarehouseBulkSelection = () => {
        setWarehouseBulkTargets([]);
        setWarehouseBulkMode(false);
    };

    const resetSearch = () => {
        setSearchPage(EMPTY_PAGE);
        setSearchError("");
        resetSelection();
        resetWarehouseBulkSelection();
    };

    const closeModal =
        useCallback(() => {
            if (deleting) return;

            onClose?.();
        }, [
            deleting,
            onClose,
        ]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                closeModal();
            }
        };

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow =
            "hidden";

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            document.body.style.overflow =
                previousOverflow;

            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        open,
        closeModal,
    ]);

    useEffect(() => {
        if (open) {
            return;
        }

        setWorkspaceTab("rollback");
        setTargetType("PACKET_ITEM");
        setWarehouseBulkMode(false);
        setWarehouseBulkTargets([]);
        setQuery("");

        setSearchPage(EMPTY_PAGE);
        setSearchError("");
        setSearchLoading(false);

        setSelectedTarget(null);
        setPreview(null);
        setPreviewError("");
        setPreviewLoading(false);

        setReason("");
        setConfirmation("");

        setDeleteError("");
        setDeleteResult(null);

        setHistoryPage(EMPTY_PAGE);
        setHistoryError("");
        setHistoryLoading(false);

        setRollbackHistoryPage(
            EMPTY_PAGE
        );

        setRollbackHistoryError("");
        setRollbackHistoryLoading(
            false
        );
    }, [open]);

    const loadRollbackHistory =
        useCallback(
            async (requestedPage = 0) => {
                setRollbackHistoryLoading(true);
                setRollbackHistoryError("");

                try {
                    const data =
                        await fetchAdminPacketRollbackHistory({
                            page:
                                requestedPage,

                            size:
                                pageSize,
                        });

                    setRollbackHistoryPage(
                        normalizePageResponse(
                            data,
                            requestedPage,
                            pageSize
                        )
                    );
                } catch (error) {
                    console.error(error);

                    setRollbackHistoryPage(
                        EMPTY_PAGE
                    );

                    setRollbackHistoryError(
                        error?.message ||
                        "Unable to load packet state-change history."
                    );
                } finally {
                    setRollbackHistoryLoading(
                        false
                    );
                }
            },
            [pageSize]
        );

    const loadHistory =
        useCallback(
            async (requestedPage = 0) => {
                setHistoryLoading(true);
                setHistoryError("");

                try {
                    const data =
                        await fetchAdminDeletionHistory({
                            page:
                                requestedPage,

                            size:
                                pageSize,
                        });

                    setHistoryPage(
                        normalizePageResponse(
                            data,
                            requestedPage,
                            pageSize
                        )
                    );
                } catch (error) {
                    console.error(error);

                    setHistoryPage(
                        EMPTY_PAGE
                    );

                    setHistoryError(
                        error?.message ||
                        "Unable to load deletion history."
                    );
                } finally {
                    setHistoryLoading(false);
                }
            },
            [pageSize]
        );

    useEffect(() => {
        if (
            open &&
            workspaceTab ===
            "rollbackHistory"
        ) {
            loadRollbackHistory(0);
        }
    }, [
        open,
        workspaceTab,
        loadRollbackHistory,
    ]);

    useEffect(() => {
        if (
            open &&
            workspaceTab ===
            "deletionHistory"
        ) {
            loadHistory(0);
        }
    }, [
        open,
        workspaceTab,
    ]);

    const handleTargetTypeChange = (
        nextType
    ) => {
        if (
            nextType === targetType ||
            deleting
        ) {
            return;
        }

        setTargetType(nextType);
        setQuery("");
        resetSearch();
    };

    const performSearch = async (
        requestedPage = 0
    ) => {
        const cleanQuery =
            query.trim();

        if (!cleanQuery) {
            setSearchError(
                "Enter a search value before continuing."
            );

            return;
        }

        setSearchLoading(true);
        setSearchError("");
        resetSelection();

        try {
            const data =
                targetType === "MASTER_ITEM"
                    ? await searchAdminMasterItems({
                        query: cleanQuery,
                        page: requestedPage,
                        size: pageSize,
                    })
                    : targetType === "WAREHOUSE_ITEM"
                        ? await searchAdminWarehouseItems({
                            query: cleanQuery,
                            page: requestedPage,
                            size: pageSize,
                        })
                        : await searchAdminPacketItems({
                            query: cleanQuery,
                            page: requestedPage,
                            size: pageSize,
                        });

            setSearchPage(
                normalizeTargetPage(
                    data,
                    targetType,
                    requestedPage,
                    pageSize
                )
            );
        } catch (error) {
            console.error(error);

            setSearchPage(EMPTY_PAGE);

            setSearchError(
                error?.message ||
                "Unable to search deletion targets."
            );
        } finally {
            setSearchLoading(false);
        }
    };

    const toggleWarehouseBulkMode = () => {
        if (
            targetType !== "WAREHOUSE_ITEM" ||
            deleting
        ) {
            return;
        }

        setWarehouseBulkMode(
            (current) => !current
        );

        setWarehouseBulkTargets([]);
        resetSelection();
    };

    const toggleWarehouseBulkTarget = (
        target
    ) => {
        if (
            !warehouseBulkMode ||
            targetType !== "WAREHOUSE_ITEM" ||
            !target?.id ||
            deleting
        ) {
            return;
        }

        const cleanId =
            String(target.id).trim();

        setWarehouseBulkTargets(
            (current) => {
                const exists =
                    current.some(
                        (item) =>
                            String(
                                item?.id || ""
                            ).trim() === cleanId
                    );

                if (exists) {
                    return current.filter(
                        (item) =>
                            String(
                                item?.id || ""
                            ).trim() !== cleanId
                    );
                }

                return [
                    ...current,
                    {
                        ...target,
                        type: "WAREHOUSE_ITEM",
                        targetType: "WAREHOUSE_ITEM",
                    },
                ];
            }
        );

        setPreview(null);
        setSelectedTarget(null);
        setPreviewError("");
        setDeleteError("");
        setDeleteResult(null);
        setReason("");
        setConfirmation("");
    };

    const loadWarehouseBulkPreview =
        async () => {
            if (
                targetType !== "WAREHOUSE_ITEM" ||
                !warehouseBulkMode ||
                warehouseBulkIds.length === 0
            ) {
                return;
            }

            setPreview(null);
            setPreviewError("");
            setDeleteError("");
            setDeleteResult(null);
            setReason("");
            setConfirmation("");
            setPreviewLoading(true);

            setSelectedTarget({
                id: "__WAREHOUSE_BULK__",
                type: "WAREHOUSE_BULK",
                targetType: "WAREHOUSE_BULK",
                itemName:
                    `${warehouseBulkIds.length} Warehouse items`,
            });

            try {
                const data =
                    await previewAdminWarehouseBulkDeletion(
                        warehouseBulkIds
                    );

                setPreview({
                    ...data,
                    targetType:
                        "WAREHOUSE_BULK",
                });
            } catch (error) {
                console.error(error);

                setSelectedTarget(null);

                setPreviewError(
                    error?.message ||
                    "Unable to calculate bulk Warehouse deletion impact."
                );
            } finally {
                setPreviewLoading(false);
            }
        };

    const loadPreview = async (
        target
    ) => {
        if (!target?.id) return;

        if (
            targetType === "WAREHOUSE_ITEM" &&
            warehouseBulkMode
        ) {
            toggleWarehouseBulkTarget(
                target
            );
            return;
        }

        const resolvedType =
            resolveTargetType(
                target,
                targetType
            );

        const normalizedTarget = {
            ...target,

            type:
                resolvedType,

            targetType:
                resolvedType,
        };

        setSelectedTarget(
            normalizedTarget
        );

        setPreview(null);
        setPreviewError("");
        setDeleteError("");
        setDeleteResult(null);
        setReason("");
        setConfirmation("");
        setPreviewLoading(true);

        try {
            const data =
                resolvedType === "MASTER_ITEM"
                    ? await previewAdminMasterDeletion(
                        normalizedTarget.id
                    )
                    : resolvedType === "WAREHOUSE_ITEM"
                        ? await previewAdminWarehouseDeletion(
                            normalizedTarget.id
                        )
                        : await previewAdminPacketDeletion(
                            normalizedTarget.id
                        );

            setPreview({
                ...data,

                targetType:
                    resolveTargetType(
                        data,
                        resolvedType
                    ),

                description:
                    data?.description ??
                    data?.itemDescription ??
                    normalizedTarget.description ??
                    "",

                drawingNo:
                    data?.drawingNo ??
                    data?.drawingName ??
                    normalizedTarget.drawingNo ??
                    "",
            });
        } catch (error) {
            console.error(error);

            setPreviewError(
                error?.message ||
                "Unable to calculate deletion impact."
            );
        } finally {
            setPreviewLoading(false);
        }
    };

    const executeDeletion = async () => {
        const previewDeleteType =
            resolveTargetType(
                preview,
                targetType
            );

        const deletingWarehouseBulk =
            previewDeleteType ===
            "WAREHOUSE_BULK";

        if (
            !canDelete ||
            (
                !deletingWarehouseBulk &&
                !selectedTargetId
            ) ||
            (
                deletingWarehouseBulk &&
                warehouseBulkIds.length === 0
            )
        ) {
            return;
        }

        setDeleting(true);
        setDeleteError("");
        setDeleteResult(null);

        try {
            const payload = {
                confirmationText:
                    confirmation.trim(),

                reason:
                    reason.trim(),
            };

            const resolvedDeleteType =
                previewDeleteType;

            const deletingMaster =
                resolvedDeleteType ===
                "MASTER_ITEM";

            const deletingWarehouse =
                resolvedDeleteType ===
                "WAREHOUSE_ITEM";

            const deletingWarehouseBulk =
                resolvedDeleteType ===
                "WAREHOUSE_BULK";

            const deletedWarehouseIds =
                deletingWarehouseBulk
                    ? [...warehouseBulkIds]
                    : [];

            const result =
                deletingMaster
                    ? await executeAdminMasterDeletion(
                        selectedTargetId,
                        payload
                    )
                    : deletingWarehouseBulk
                        ? await executeAdminWarehouseBulkDeletion({
                            itemIds:
                                deletedWarehouseIds,
                            ...payload,
                        })
                        : deletingWarehouse
                            ? await executeAdminWarehouseDeletion(
                                selectedTargetId,
                                payload
                            )
                            : await executeAdminPacketDeletion(
                                selectedTargetId,
                                payload
                            );

            setDeleteResult(result);

            const removedIds =
                deletingWarehouseBulk
                    ? new Set(
                        deletedWarehouseIds
                    )
                    : new Set([
                        String(
                            selectedTargetId ||
                            ""
                        ),
                    ]);

            const removedCount =
                deletingWarehouseBulk
                    ? deletedWarehouseIds.length
                    : 1;

            setSearchPage((current) => ({
                ...current,

                content:
                    current.content.filter(
                        (item) =>
                            !removedIds.has(
                                String(
                                    item?.id ||
                                    ""
                                )
                            )
                    ),

                totalElements:
                    Math.max(
                        0,
                        Number(
                            current.totalElements ||
                            0
                        ) - removedCount
                    ),
            }));

            setPreview(null);
            setSelectedTarget(null);
            setReason("");
            setConfirmation("");

            if (deletingWarehouseBulk) {
                setWarehouseBulkTargets([]);
                setWarehouseBulkMode(false);
            }

            await notifyAdminDataChanged({
                action:
                    deletingMaster
                        ? "MASTER_ITEM_DELETION"
                        : deletingWarehouseBulk
                            ? "WAREHOUSE_BULK_DELETION"
                            : deletingWarehouse
                                ? "WAREHOUSE_ITEM_DELETION"
                                : "PERMANENT_DELETION",

                targetType:
                    deletingMaster
                        ? "MASTER_ITEM"
                        : deletingWarehouseBulk
                            ? "WAREHOUSE_BULK"
                            : deletingWarehouse
                                ? "WAREHOUSE_ITEM"
                                : "PACKET_ITEM",

                targetId:
                    deletingWarehouseBulk
                        ? result?.targetId
                        : selectedTargetId,

                deletedTargetIds:
                    deletingWarehouseBulk
                        ? deletedWarehouseIds
                        : undefined,

                ...result,
            });
        } catch (error) {
            console.error(error);

            setDeleteError(
                error?.message ||
                "Permanent deletion failed."
            );
        } finally {
            setDeleting(false);
        }
    };

    const handleSearchSubmit = (
        event
    ) => {
        event.preventDefault();
        performSearch(0);
    };

    if (!open) return null;

    return (
        <div
            style={overlay}
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    closeModal();
                }
            }}
        >
            <style>{`
                .admin-center-scroll::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                .admin-center-scroll::-webkit-scrollbar-track {
                    background: rgba(15,23,42,.88);
                    border-radius: 999px;
                }
                .admin-center-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg,#2563eb,#60a5fa);
                    border-radius: 999px;
                    border: 2px solid rgba(15,23,42,.95);
                }
                .admin-center-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg,#3b82f6,#93c5fd);
                }
            `}</style>

            <div style={modal}>
                <div style={modalHeader}>
                    <div style={headerIdentity}>
                        <div style={dangerIcon}>
                            🗑️
                        </div>

                        <div>
                            <div style={modalTitle}>
                                Admin Center
                            </div>

                            <div style={modalSubtitle}>
                                Manage packet lifecycle corrections and permanent administrative deletion
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={deleting}
                        onClick={closeModal}
                        style={closeButton(
                            deleting
                        )}
                    >
                        ×
                    </button>
                </div>

                {workspaceTab === "delete" && (
                    <div style={permanentWarning}>
                        <strong>
                            Permanent action:
                        </strong>{" "}
                        this is different from the normal
                        Inventory delete option. Records
                        removed here cannot be restored from
                        the application.
                    </div>
                )}
                <div style={workspaceTabs}>
                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab("rollback")
                        }
                        style={workspaceTabButton(
                            workspaceTab === "rollback"
                        )}
                    >
                        Move Packet Back
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab("delete")
                        }
                        style={workspaceTabButton(
                            workspaceTab === "delete"
                        )}
                    >
                        Delete Records
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab("rollbackHistory")
                        }
                        style={workspaceTabButton(
                            workspaceTab === "rollbackHistory"
                        )}
                    >
                        State History
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab("deletionHistory")
                        }
                        style={workspaceTabButton(
                            workspaceTab === "deletionHistory"
                        )}
                    >
                        Deletion History
                    </button>
                </div>

                <div style={modalBody} className="admin-center-scroll">
                    {workspaceTab ===
                        "deletionHistory" && (
                            <DeletionHistory
                                page={historyPage}
                                loading={
                                    historyLoading
                                }
                                error={historyError}
                                onPageChange={
                                    loadHistory
                                }
                            />
                        )}

                    {workspaceTab === "rollback" && (
                        <AdminPacketRollbackPanel
                            onChanged={notifyAdminDataChanged}
                        />
                    )}

                    {workspaceTab === "rollbackHistory" && (
                        <AdminRollbackHistory
                            page={rollbackHistoryPage}
                            loading={rollbackHistoryLoading}
                            error={rollbackHistoryError}
                            onPageChange={loadRollbackHistory}
                        />
                    )}

                    {workspaceTab ===
                        "delete" && (
                            <div style={deleteLayout}>
                                <div style={searchColumn}>
                                    <div style={typeTabs}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleTargetTypeChange(
                                                    "PACKET_ITEM"
                                                )
                                            }
                                            style={typeTabButton(
                                                targetType ===
                                                "PACKET_ITEM"
                                            )}
                                        >
                                            Packet Items
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleTargetTypeChange(
                                                    "MASTER_ITEM"
                                                )
                                            }
                                            style={typeTabButton(
                                                targetType ===
                                                "MASTER_ITEM"
                                            )}
                                        >
                                            Master Items
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleTargetTypeChange(
                                                    "WAREHOUSE_ITEM"
                                                )
                                            }
                                            style={typeTabButton(
                                                targetType ===
                                                "WAREHOUSE_ITEM"
                                            )}
                                        >
                                            Warehouse Items
                                        </button>
                                    </div>

                                    <div style={typeDescription}>
                                        {targetTypeDescription}
                                    </div>

                                    {targetType ===
                                        "WAREHOUSE_ITEM" && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 10,
                                                    flexWrap: "wrap",
                                                    marginBottom: 12,
                                                    padding: 10,
                                                    borderRadius: 12,
                                                    background:
                                                        "rgba(245,158,11,.07)",
                                                    border:
                                                        "1px solid rgba(245,158,11,.17)",
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    disabled={
                                                        deleting ||
                                                        previewLoading
                                                    }
                                                    onClick={
                                                        toggleWarehouseBulkMode
                                                    }
                                                    style={typeTabButton(
                                                        warehouseBulkMode
                                                    )}
                                                >
                                                    {warehouseBulkMode
                                                        ? "✓ Bulk Selection On"
                                                        : "Bulk Select Warehouse Items"}
                                                </button>

                                                {warehouseBulkMode && (
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 8,
                                                            flexWrap: "wrap",
                                                        }}
                                                    >
                                                        <strong
                                                            style={{
                                                                color: "#fbbf24",
                                                                fontSize: 11,
                                                            }}
                                                        >
                                                            {warehouseBulkIds.length} selected
                                                        </strong>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                warehouseBulkIds.length === 0 ||
                                                                deleting ||
                                                                previewLoading
                                                            }
                                                            onClick={
                                                                loadWarehouseBulkPreview
                                                            }
                                                            style={searchButton(
                                                                warehouseBulkIds.length === 0 ||
                                                                deleting ||
                                                                previewLoading
                                                            )}
                                                        >
                                                            {previewLoading
                                                                ? "Calculating..."
                                                                : "Preview Bulk Delete"}
                                                        </button>

                                                        {warehouseBulkIds.length > 0 && (
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    deleting
                                                                }
                                                                onClick={() => {
                                                                    setWarehouseBulkTargets([]);
                                                                    resetSelection();
                                                                }}
                                                                style={paginationButton(
                                                                    deleting
                                                                )}
                                                            >
                                                                Clear
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    <form
                                        onSubmit={
                                            handleSearchSubmit
                                        }
                                        style={searchForm}
                                    >
                                        <input
                                            value={query}
                                            onChange={(event) =>
                                                setQuery(
                                                    event.target
                                                        .value
                                                )
                                            }
                                            disabled={
                                                searchLoading ||
                                                deleting
                                            }
                                            placeholder={
                                                targetType ===
                                                    "MASTER_ITEM"
                                                    ? "Search master name, PD no., drawing, client or UUID"
                                                    : targetType ===
                                                        "WAREHOUSE_ITEM"
                                                        ? "Search warehouse item, SKU, PD, DWG, location, gate pass or ID"
                                                        : "Search item, packet no., SKU, sticker, PD no. or UUID"
                                            }
                                            style={searchInput}
                                        />

                                        <button
                                            type="submit"
                                            disabled={
                                                searchLoading ||
                                                deleting ||
                                                !query.trim()
                                            }
                                            style={searchButton(
                                                searchLoading ||
                                                deleting ||
                                                !query.trim()
                                            )}
                                        >
                                            {searchLoading
                                                ? "Searching..."
                                                : "Search"}
                                        </button>
                                    </form>

                                    {searchError && (
                                        <div style={errorBox}>
                                            {searchError}
                                        </div>
                                    )}

                                    <div style={searchSummary}>
                                        <span>
                                            Search Results
                                        </span>

                                        <strong>
                                            {Number(
                                                searchPage.totalElements ||
                                                0
                                            )}
                                        </strong>
                                    </div>

                                    {searchLoading && (
                                        <div style={emptyState}>
                                            Searching records...
                                        </div>
                                    )}

                                    {!searchLoading &&
                                        !searchError &&
                                        searchPage.content
                                            .length === 0 && (
                                            <div
                                                style={
                                                    emptyState
                                                }
                                            >
                                                Search for a record
                                                to begin.
                                            </div>
                                        )}

                                    {!searchLoading &&
                                        searchPage.content
                                            .length > 0 && (
                                            <div
                                                style={
                                                    searchResults
                                                }
                                            >
                                                {searchPage.content.map(
                                                    (target) => (
                                                        <SearchResultCard
                                                            key={`${resolveTargetType(target)}-${target.id}`}
                                                            target={
                                                                target
                                                            }
                                                            selected={
                                                                targetType ===
                                                                    "WAREHOUSE_ITEM" &&
                                                                    warehouseBulkMode
                                                                    ? warehouseBulkIdSet.has(
                                                                        String(
                                                                            target.id
                                                                        )
                                                                    )
                                                                    : selectedTarget?.id ===
                                                                    target.id
                                                            }
                                                            disabled={
                                                                deleting
                                                            }
                                                            onSelect={
                                                                loadPreview
                                                            }
                                                        />
                                                    )
                                                )}
                                            </div>
                                        )}

                                    <ResultPagination
                                        page={searchPage}
                                        disabled={
                                            searchLoading ||
                                            deleting
                                        }
                                        onPageChange={
                                            performSearch
                                        }
                                    />
                                </div>

                                <div style={previewColumn}>
                                    {deleteResult && (
                                        <div style={successBox}>
                                            <div
                                                style={
                                                    successTitle
                                                }
                                            >
                                                ✓ Permanent deletion
                                                completed
                                            </div>

                                            <div
                                                style={
                                                    successMessage
                                                }
                                            >
                                                {deleteResult.message ||
                                                    "The selected record was deleted."}
                                            </div>

                                            <div
                                                style={
                                                    successMeta
                                                }
                                            >
                                                <div>
                                                    <span>
                                                        Deleted By
                                                    </span>
                                                    <strong>
                                                        {deleteResult.deletedBy ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Audit ID
                                                    </span>
                                                    <strong>
                                                        {deleteResult.deletionAuditId ||
                                                            "-"}
                                                    </strong>
                                                </div>
                                            </div>

                                            <ImpactGrid
                                                title="Deleted Rows"
                                                rows={
                                                    deleteResult.deletedRows
                                                }
                                            />
                                        </div>
                                    )}

                                    {!selectedTarget &&
                                        !deleteResult && (
                                            <div
                                                style={
                                                    previewPlaceholder
                                                }
                                            >
                                                <div
                                                    style={
                                                        previewPlaceholderIcon
                                                    }
                                                >
                                                    ⚠
                                                </div>

                                                <div
                                                    style={
                                                        previewPlaceholderTitle
                                                    }
                                                >
                                                    {targetType ===
                                                        "WAREHOUSE_ITEM" &&
                                                        warehouseBulkMode
                                                        ? "Select Warehouse records"
                                                        : "Select a record"}
                                                </div>

                                                <div
                                                    style={
                                                        previewPlaceholderText
                                                    }
                                                >
                                                    {targetType ===
                                                        "WAREHOUSE_ITEM" &&
                                                        warehouseBulkMode
                                                        ? "Click Warehouse search results to build the bulk selection, then preview the combined deletion impact."
                                                        : "The backend will calculate every linked row before the delete button is enabled."}
                                                </div>
                                            </div>
                                        )}

                                    {previewLoading && (
                                        <div style={emptyState}>
                                            Calculating deletion
                                            impact...
                                        </div>
                                    )}

                                    {previewError && (
                                        <div style={errorBox}>
                                            {previewError}
                                        </div>
                                    )}

                                    {preview && (
                                        <div style={previewContent}
                                            className="admin-center-scroll">
                                            <div
                                                style={
                                                    previewHeader
                                                }
                                            >
                                                <div>
                                                    <div
                                                        style={resultTypeBadge(
                                                            resolveTargetType(
                                                                preview,
                                                                targetType
                                                            ) === "MASTER_ITEM"
                                                                ? "#a78bfa"
                                                                : resolveTargetType(
                                                                    preview,
                                                                    targetType
                                                                ).startsWith(
                                                                    "WAREHOUSE_"
                                                                )
                                                                    ? "#f59e0b"
                                                                    : "#38bdf8"
                                                        )}
                                                    >
                                                        {formatLabel(
                                                            resolveTargetType(
                                                                preview,
                                                                targetType
                                                            )
                                                        )}
                                                    </div>

                                                    <div
                                                        style={
                                                            previewTitle
                                                        }
                                                    >
                                                        {preview.displayName ||
                                                            preview.targetId}
                                                    </div>
                                                    {[
                                                        "PACKET_ITEM",
                                                        "WAREHOUSE_ITEM",
                                                    ].includes(
                                                        resolveTargetType(
                                                            preview,
                                                            targetType
                                                        )
                                                    ) && (
                                                            <div style={previewDescription}>
                                                                <div style={previewDescriptionLabel}>
                                                                    {resolveTargetType(
                                                                        preview,
                                                                        targetType
                                                                    ) === "WAREHOUSE_ITEM"
                                                                        ? "Warehouse Item Description"
                                                                        : "Packet Description"}
                                                                </div>

                                                                <div style={previewDescriptionText}>
                                                                    {preview.description ||
                                                                        preview.itemDescription ||
                                                                        "No description available for this record."}
                                                                </div>
                                                            </div>
                                                        )}
                                                </div>

                                                <div
                                                    style={
                                                        permanentBadge
                                                    }
                                                >
                                                    Permanent
                                                </div>
                                            </div>

                                            <div
                                                style={
                                                    previewMetaGrid
                                                }
                                            >
                                                <div>
                                                    <span>
                                                        PD No.
                                                    </span>
                                                    <strong>
                                                        {preview.pdNo ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Drawing
                                                    </span>
                                                    <strong>
                                                        {preview.drawingNo ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Packet
                                                    </span>
                                                    <strong>
                                                        {preview.packetNumber ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Status
                                                    </span>
                                                    <strong>
                                                        {preview.currentStatus ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Location
                                                    </span>
                                                    <strong>
                                                        {preview.currentLocation ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Deletes Master
                                                    </span>
                                                    <strong>
                                                        {preview.deletesMasterItem
                                                            ? "Yes"
                                                            : "No"}
                                                    </strong>
                                                </div>
                                            </div>

                                            {resolveTargetType(
                                                preview,
                                                targetType
                                            ) !==
                                                "WAREHOUSE_BULK" && (
                                                    <LifecycleMetaPanel
                                                        row={preview}
                                                    />
                                                )}

                                            {preview.warning && (
                                                <div
                                                    style={
                                                        impactWarning
                                                    }
                                                >
                                                    {preview.warning}
                                                </div>
                                            )}

                                            <ImpactGrid
                                                rows={
                                                    sortedAffectedRows
                                                }
                                            />

                                            <div
                                                style={
                                                    confirmationSection
                                                }
                                            >
                                                <label
                                                    style={
                                                        fieldLabel
                                                    }
                                                >
                                                    Deletion Reason
                                                </label>

                                                <textarea
                                                    value={reason}
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        setReason(
                                                            event.target
                                                                .value
                                                        )
                                                    }
                                                    disabled={
                                                        deleting
                                                    }
                                                    maxLength={1000}
                                                    placeholder="Explain why this permanent deletion is required..."
                                                    style={reasonInput}
                                                />

                                                <div
                                                    style={
                                                        fieldHelper
                                                    }
                                                >
                                                    Minimum 5 characters
                                                    • {reason.length}/1000
                                                </div>

                                                <label
                                                    style={
                                                        fieldLabel
                                                    }
                                                >
                                                    Type the exact
                                                    confirmation
                                                </label>

                                                <div
                                                    style={
                                                        requiredConfirmationBox
                                                    }
                                                >
                                                    {requiredConfirmation}
                                                </div>

                                                <input
                                                    value={
                                                        confirmation
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        setConfirmation(
                                                            event.target
                                                                .value
                                                        )
                                                    }
                                                    disabled={
                                                        deleting
                                                    }
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    placeholder="Type the confirmation shown above"
                                                    style={confirmationInput(
                                                        confirmation.length >
                                                        0 &&
                                                        !confirmationValid
                                                    )}
                                                />

                                                {confirmation.length >
                                                    0 &&
                                                    !confirmationValid && (
                                                        <div
                                                            style={
                                                                validationError
                                                            }
                                                        >
                                                            Confirmation
                                                            text does not
                                                            match exactly.
                                                        </div>
                                                    )}

                                                {deleteError && (
                                                    <div
                                                        style={
                                                            errorBox
                                                        }
                                                    >
                                                        {deleteError}
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={
                                                        !canDelete
                                                    }
                                                    onClick={
                                                        executeDeletion
                                                    }
                                                    style={deleteButton(
                                                        !canDelete
                                                    )}
                                                >
                                                    {deleting
                                                        ? "Deleting permanently..."
                                                        : resolveTargetType(
                                                            preview,
                                                            targetType
                                                        ) === "MASTER_ITEM"
                                                            ? "Delete Master and All Packets"
                                                            : resolveTargetType(
                                                                preview,
                                                                targetType
                                                            ) === "WAREHOUSE_BULK"
                                                                ? `Delete ${warehouseBulkIds.length} Warehouse Items Permanently`
                                                                : resolveTargetType(
                                                                    preview,
                                                                    targetType
                                                                ) === "WAREHOUSE_ITEM"
                                                                    ? "Delete Warehouse Item Permanently"
                                                                    : "Delete Packet Permanently"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 12000,
    padding: 20,

    background:
        "rgba(2,6,23,.84)",

    backdropFilter: "blur(14px)",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const modal = {
    width: "min(1280px, 100%)",
    height: "min(850px, calc(100vh - 40px))",
    minHeight: 580,

    display: "flex",
    flexDirection: "column",

    borderRadius: 28,

    background:
        "radial-gradient(circle at top right, rgba(239,68,68,.10), transparent 28%), linear-gradient(180deg, rgba(15,23,42,.99), rgba(2,6,23,.98))",

    border:
        "1px solid rgba(248,113,113,.20)",

    boxShadow:
        "0 40px 110px rgba(0,0,0,.72)",

    color: "#fff",
    overflow: "hidden",
};

const modalHeader = {
    padding: "20px 22px 16px",

    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,

    borderBottom:
        "1px solid rgba(255,255,255,.07)",
};

const headerIdentity = {
    display: "flex",
    alignItems: "center",
    gap: 14,
};

const dangerIcon = {
    width: 46,
    height: 46,
    borderRadius: 16,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background:
        "rgba(239,68,68,.14)",

    border:
        "1px solid rgba(248,113,113,.28)",

    fontSize: 21,
};

const modalTitle = {
    fontSize: 23,
    fontWeight: 950,
    letterSpacing: "-.02em",
};

const modalSubtitle = {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "rgba(255,255,255,.58)",
};

const closeButton = (disabled) => ({
    width: 38,
    height: 38,
    borderRadius: 999,

    border:
        "1px solid rgba(255,255,255,.10)",

    background:
        "rgba(255,255,255,.055)",

    color: "#fff",
    fontSize: 24,
    cursor: disabled
        ? "not-allowed"
        : "pointer",

    opacity: disabled ? 0.5 : 1,
});

const permanentWarning = {
    margin: "14px 22px 0",
    padding: "11px 14px",
    borderRadius: 14,

    background:
        "rgba(239,68,68,.10)",

    border:
        "1px solid rgba(248,113,113,.20)",

    color: "#fca5a5",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.55,
};

const workspaceTabs = {
    margin: "14px 22px 0",
    padding: 4,
    width: "fit-content",

    display: "flex",
    alignItems: "center",
    gap: 4,

    borderRadius: 14,

    background:
        "rgba(255,255,255,.045)",

    border:
        "1px solid rgba(255,255,255,.07)",
};

const workspaceTabButton = (active) => ({
    minHeight: 34,
    padding: "0 15px",
    borderRadius: 10,
    border: "none",

    background: active
        ? "linear-gradient(135deg,#b91c1c,#ef4444)"
        : "transparent",

    color: active
        ? "#fff"
        : "rgba(255,255,255,.62)",

    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",

    boxShadow: active
        ? "0 10px 24px rgba(239,68,68,.22)"
        : "none",
});

const modalBody = {
    flex: 1,
    minHeight: 0,
    padding: 22,
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "thin",
    scrollbarColor: "#3b82f6 rgba(15,23,42,.88)",
};

const deleteLayout = {
    display: "grid",
    gridTemplateColumns:
        "minmax(350px,.85fr) minmax(480px,1.15fr)",
    gap: 18,
    minHeight: "100%",
};

const searchColumn = {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
};

const previewColumn = {
    minWidth: 0,
    padding: 18,
    borderRadius: 22,

    background:
        "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.018))",

    border:
        "1px solid rgba(255,255,255,.07)",
};

const typeTabs = {
    padding: 4,

    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,

    borderRadius: 14,

    background:
        "rgba(255,255,255,.04)",

    border:
        "1px solid rgba(255,255,255,.07)",
};

const typeTabButton = (active) => ({
    minHeight: 38,
    borderRadius: 10,

    border: active
        ? "1px solid rgba(96,165,250,.25)"
        : "1px solid transparent",

    background: active
        ? "rgba(59,130,246,.16)"
        : "transparent",

    color: active
        ? "#bfdbfe"
        : "rgba(255,255,255,.58)",

    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
});

const typeDescription = {
    margin: "9px 2px 14px",
    color: "rgba(255,255,255,.48)",
    fontSize: 11.5,
    lineHeight: 1.5,
};

const searchForm = {
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) auto",
    gap: 9,
};

const searchInput = {
    width: "100%",
    minWidth: 0,
    height: 44,
    padding: "0 13px",

    borderRadius: 13,

    border:
        "1px solid rgba(255,255,255,.10)",

    background:
        "rgba(2,6,23,.54)",

    color: "#fff",
    outline: "none",
    fontFamily: "inherit",
    fontSize: 12.5,
};

const searchButton = (disabled) => ({
    height: 44,
    padding: "0 17px",
    borderRadius: 13,
    border: "none",

    background: disabled
        ? "rgba(148,163,184,.16)"
        : "linear-gradient(135deg,#2563eb,#3b82f6)",

    color: disabled
        ? "rgba(255,255,255,.42)"
        : "#fff",

    fontWeight: 900,
    fontFamily: "inherit",

    cursor: disabled
        ? "not-allowed"
        : "pointer",
});

const searchSummary = {
    marginTop: 17,
    marginBottom: 9,

    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",

    color: "rgba(255,255,255,.60)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const searchResults = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: 500,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 6,
    scrollbarWidth: "thin",
    scrollbarColor: "#3b82f6 rgba(15,23,42,.88)",
};

const searchResultCard = (
    selected,
    disabled
) => ({
    width: "100%",
    padding: 14,
    borderRadius: 17,

    border: selected
        ? "1px solid rgba(96,165,250,.52)"
        : "1px solid rgba(255,255,255,.065)",

    background: selected
        ? "linear-gradient(135deg, rgba(37,99,235,.16), rgba(255,255,255,.035))"
        : "rgba(255,255,255,.032)",

    color: "#fff",
    textAlign: "left",
    fontFamily: "inherit",

    cursor: disabled
        ? "not-allowed"
        : "pointer",

    opacity: disabled ? 0.65 : 1,
});

const searchResultTop = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
};

const resultDescriptionLabel = {
    marginBottom: 5,

    color: "rgba(255,255,255,.42)",

    fontSize: 9,
    fontWeight: 900,

    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const resultDescriptionText = {
    color: "rgba(255,255,255,.72)",

    fontSize: 11.5,
    fontWeight: 650,

    lineHeight: 1.5,

    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",

    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
};

const resultTypeBadge = (accent) => ({
    display: "inline-flex",
    minHeight: 22,
    padding: "0 8px",
    borderRadius: 999,

    alignItems: "center",

    background: `${accent}1F`,
    border: `1px solid ${accent}3D`,
    color: accent,

    fontSize: 9.5,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".06em",
});

const resultTitle = {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 900,
    color: "#fff",
};

const selectIndicator = (selected) => ({
    width: 28,
    height: 28,
    borderRadius: 999,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background: selected
        ? "rgba(34,197,94,.14)"
        : "rgba(255,255,255,.06)",

    border: selected
        ? "1px solid rgba(74,222,128,.28)"
        : "1px solid rgba(255,255,255,.08)",

    color: selected
        ? "#86efac"
        : "rgba(255,255,255,.68)",

    fontWeight: 950,
});

const resultMetaGrid = {
    marginTop: 12,

    display: "grid",
    gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",
    gap: 8,
};

const resultId = {
    marginTop: 10,
    color: "rgba(255,255,255,.34)",
    fontSize: 9.5,
    wordBreak: "break-all",
};

const previewPlaceholder = {
    minHeight: 430,

    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",

    textAlign: "center",
    padding: 30,
};

const previewPlaceholderIcon = {
    width: 64,
    height: 64,
    borderRadius: 22,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background:
        "rgba(245,158,11,.12)",

    border:
        "1px solid rgba(251,191,36,.22)",

    fontSize: 27,
};

const previewPlaceholderTitle = {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 950,
};

const previewPlaceholderText = {
    marginTop: 7,
    maxWidth: 360,

    color: "rgba(255,255,255,.48)",
    fontSize: 12.5,
    lineHeight: 1.6,
};

const previewContent = {
    display: "flex",
    flexDirection: "column",
    gap: 17,
    maxHeight: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 5,
    scrollbarWidth: "thin",
    scrollbarColor: "#3b82f6 rgba(15,23,42,.88)",
};

const previewHeader = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
};

const previewTitle = {
    marginTop: 9,
    fontSize: 19,
    fontWeight: 950,
    color: "#fff",
};

const permanentBadge = {
    padding: "6px 10px",
    borderRadius: 999,

    background:
        "rgba(239,68,68,.13)",

    border:
        "1px solid rgba(248,113,113,.27)",

    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".05em",
};

const previewMetaGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",
    gap: 9,
};

const impactWarning = {
    padding: "11px 13px",
    borderRadius: 14,

    background:
        "rgba(245,158,11,.10)",

    border:
        "1px solid rgba(251,191,36,.20)",

    color: "#fde68a",
    fontSize: 11.5,
    fontWeight: 700,
    lineHeight: 1.55,
};

const sectionHeading = {
    marginBottom: 9,

    color: "rgba(255,255,255,.72)",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const sectionDescription = {
    marginTop: 5,
    color: "rgba(255,255,255,.46)",
    fontSize: 11.5,
};

const impactGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(125px,1fr))",
    gap: 8,
};

const impactItem = {
    padding: 11,
    borderRadius: 13,

    background:
        "rgba(255,255,255,.035)",

    border:
        "1px solid rgba(255,255,255,.06)",
};

const impactLabel = {
    color: "rgba(255,255,255,.50)",
    fontSize: 9.5,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: ".04em",
};

const impactValue = {
    marginTop: 6,
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
};

const confirmationSection = {
    paddingTop: 16,

    borderTop:
        "1px solid rgba(255,255,255,.07)",
};

const fieldLabel = {
    display: "block",
    marginBottom: 7,

    color: "rgba(255,255,255,.68)",
    fontSize: 11,
    fontWeight: 900,
};

const reasonInput = {
    width: "100%",
    minHeight: 82,
    padding: 12,
    resize: "vertical",

    borderRadius: 13,

    border:
        "1px solid rgba(255,255,255,.10)",

    background:
        "rgba(2,6,23,.52)",

    color: "#fff",
    outline: "none",

    fontFamily: "inherit",
    fontSize: 12.5,
    lineHeight: 1.5,
    boxSizing: "border-box",
};

const fieldHelper = {
    marginTop: 5,
    marginBottom: 15,

    color: "rgba(255,255,255,.38)",
    fontSize: 10,
};

const requiredConfirmationBox = {
    padding: "10px 12px",
    marginBottom: 8,

    borderRadius: 12,

    background:
        "rgba(239,68,68,.10)",

    border:
        "1px dashed rgba(248,113,113,.32)",

    color: "#fecaca",

    fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, monospace",

    fontSize: 11,
    fontWeight: 850,
    wordBreak: "break-all",
    userSelect: "all",
};

const rollbackIntro = {
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,

    background:
        "linear-gradient(135deg, rgba(59,130,246,.12), rgba(255,255,255,.025))",

    border:
        "1px solid rgba(96,165,250,.20)",
};

const rollbackIntroTitle = {
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 950,
};

const rollbackIntroText = {
    marginTop: 6,
    color: "rgba(255,255,255,.56)",
    fontSize: 11.5,
    lineHeight: 1.55,
};

const stateTransitionRow = {
    display: "grid",
    gridTemplateColumns:
        "minmax(0,1fr) auto minmax(0,1fr)",
    alignItems: "center",
    gap: 10,
};

const metadataCellStyles = {
    minWidth: 0,
};

const metadataLabelStyles = {
    display: "block",
    marginBottom: 5,
    color: "rgba(255,255,255,.40)",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".05em",
};

const metadataValueStyles = {
    display: "block",
    color: "rgba(255,255,255,.82)",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
};

const stateBox = {
    padding: 13,
    borderRadius: 14,

    background:
        "rgba(255,255,255,.04)",

    border:
        "1px solid rgba(255,255,255,.07)",

    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const stateArrow = {
    color: "#93c5fd",
    fontSize: 22,
    fontWeight: 950,
};

const changeList = {
    display: "flex",
    flexDirection: "column",
    gap: 7,
};

const changeItem = {
    padding: "9px 11px",
    borderRadius: 12,

    background:
        "rgba(59,130,246,.07)",

    border:
        "1px solid rgba(96,165,250,.13)",

    color: "rgba(255,255,255,.72)",
    fontSize: 11.5,
    fontWeight: 650,

    display: "flex",
    alignItems: "flex-start",
    gap: 8,
};

const rollbackButton = (disabled) => ({
    width: "100%",
    minHeight: 46,
    marginTop: 15,

    borderRadius: 14,
    border: "none",

    background: disabled
        ? "rgba(148,163,184,.14)"
        : "linear-gradient(135deg,#1d4ed8,#3b82f6)",

    color: disabled
        ? "rgba(255,255,255,.36)"
        : "#fff",

    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 950,

    cursor: disabled
        ? "not-allowed"
        : "pointer",

    boxShadow: disabled
        ? "none"
        : "0 16px 34px rgba(37,99,235,.28)",
});

const confirmationInput = (invalid) => ({
    width: "100%",
    height: 43,
    padding: "0 12px",

    borderRadius: 12,

    border: invalid
        ? "1px solid rgba(248,113,113,.58)"
        : "1px solid rgba(255,255,255,.10)",

    background:
        "rgba(2,6,23,.52)",

    color: "#fff",
    outline: "none",

    fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, monospace",

    fontSize: 11.5,
    boxSizing: "border-box",
});

const validationError = {
    marginTop: 6,
    color: "#fca5a5",
    fontSize: 10.5,
    fontWeight: 700,
};

const resultIdentity = {
    minWidth: 0,
    flex: 1,
};

const resultDescription = {
    marginTop: 9,
    padding: "9px 10px",

    borderRadius: 11,

    background:
        "rgba(255,255,255,.035)",

    border:
        "1px solid rgba(255,255,255,.055)",
};

const previewDescription = {
    padding: "13px 14px",

    borderRadius: 15,

    background:
        "linear-gradient(135deg, rgba(56,189,248,.08), rgba(255,255,255,.025))",

    border:
        "1px solid rgba(56,189,248,.17)",
};

const previewDescriptionLabel = {
    marginBottom: 7,

    color: "#7dd3fc",

    fontSize: 10,
    fontWeight: 950,

    textTransform: "uppercase",
    letterSpacing: ".07em",
};

const previewDescriptionText = {
    color: "rgba(255,255,255,.80)",

    fontSize: 12.5,
    fontWeight: 650,

    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
};

const deleteButton = (disabled) => ({
    width: "100%",
    minHeight: 46,
    marginTop: 15,

    borderRadius: 14,
    border: "none",

    background: disabled
        ? "rgba(148,163,184,.14)"
        : "linear-gradient(135deg,#b91c1c,#ef4444)",

    color: disabled
        ? "rgba(255,255,255,.36)"
        : "#fff",

    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 950,

    cursor: disabled
        ? "not-allowed"
        : "pointer",

    boxShadow: disabled
        ? "none"
        : "0 16px 34px rgba(239,68,68,.25)",
});

const errorBox = {
    marginTop: 10,
    padding: "11px 13px",
    borderRadius: 13,

    background:
        "rgba(239,68,68,.10)",

    border:
        "1px solid rgba(248,113,113,.21)",

    color: "#fca5a5",
    fontSize: 11.5,
    fontWeight: 750,
    lineHeight: 1.5,
};

const emptyState = {
    padding: 18,
    borderRadius: 15,

    background:
        "rgba(255,255,255,.03)",

    border:
        "1px solid rgba(255,255,255,.055)",

    color: "rgba(255,255,255,.48)",
    fontSize: 12,
    textAlign: "center",
};

const paginationRow = {
    marginTop: 13,

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
};

const paginationButton = (disabled) => ({
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 10,

    border:
        "1px solid rgba(255,255,255,.08)",

    background: disabled
        ? "rgba(255,255,255,.025)"
        : "rgba(255,255,255,.06)",

    color: disabled
        ? "rgba(255,255,255,.28)"
        : "#fff",

    fontFamily: "inherit",
    fontSize: 10.5,
    fontWeight: 850,

    cursor: disabled
        ? "not-allowed"
        : "pointer",
});

const paginationText = {
    color: "rgba(255,255,255,.48)",
    fontSize: 10.5,
    fontWeight: 750,
};

const successBox = {
    display: "flex",
    flexDirection: "column",
    gap: 14,

    padding: 17,
    borderRadius: 18,

    background:
        "rgba(34,197,94,.08)",

    border:
        "1px solid rgba(74,222,128,.20)",
};

const successTitle = {
    color: "#86efac",
    fontSize: 17,
    fontWeight: 950,
};

const successMessage = {
    color: "rgba(255,255,255,.72)",
    fontSize: 12,
    lineHeight: 1.55,
};

const successMeta = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: 8,
};

const historyHeader = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 14,
};

const historyTotal = {
    padding: "7px 10px",
    borderRadius: 999,

    background:
        "rgba(255,255,255,.055)",

    border:
        "1px solid rgba(255,255,255,.08)",

    color: "rgba(255,255,255,.66)",
    fontSize: 10.5,
    fontWeight: 850,
};

const historyList = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxHeight: "58vh",
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 6,
    scrollbarWidth: "thin",
    scrollbarColor: "#3b82f6 rgba(15,23,42,.88)",
};

const historyCard = {
    padding: 15,
    borderRadius: 17,

    background:
        "rgba(255,255,255,.035)",

    border:
        "1px solid rgba(255,255,255,.065)",
};

const historyCardHeader = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
};

const historyTitle = {
    marginTop: 8,
    fontSize: 14,
    fontWeight: 900,
};

const historyDeletedCount = {
    padding: "6px 9px",
    borderRadius: 999,

    background:
        "rgba(239,68,68,.10)",

    border:
        "1px solid rgba(248,113,113,.18)",

    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 900,
};

const historyDetails = {
    marginTop: 12,

    display: "grid",
    gridTemplateColumns:
        "repeat(3,minmax(0,1fr))",
    gap: 9,
};

const historyTargetId = {
    marginTop: 10,
    color: "rgba(255,255,255,.32)",
    fontSize: 9.5,
    wordBreak: "break-all",
};


const resultBadgeRow = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
};

const resultStatusBadge = {
    minHeight: 22,
    padding: "0 8px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    color: "#cbd5e1",
    background: "rgba(148,163,184,.07)",
    border: "1px solid rgba(148,163,184,.11)",
    fontSize: 9,
    fontWeight: 900,
};

const resultLifecycleGrid = {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 8,
};

const lifecycleMetaCard = {
    minWidth: 0,
    padding: 10,
    borderRadius: 13,
    background: "rgba(2,6,23,.28)",
    border: "1px solid rgba(148,163,184,.06)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    textAlign: "left",
};

const resultFooterRow = {
    marginTop: 10,
    paddingTop: 9,
    borderTop: "1px solid rgba(148,163,184,.055)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
};

const resultOpenHint = {
    color: "#60a5fa",
    fontSize: 9.5,
    fontWeight: 900,
    whiteSpace: "nowrap",
};

const lifecyclePanelGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 8,
};

const lifecyclePanelCard = {
    minWidth: 0,
    padding: 11,
    borderRadius: 13,
    background: "rgba(59,130,246,.055)",
    border: "1px solid rgba(96,165,250,.11)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
};

const paginationShell = {
    marginTop: 13,
    padding: 10,
    borderRadius: 14,
    background: "rgba(2,6,23,.26)",
    border: "1px solid rgba(148,163,184,.06)",
};

const paginationRecordMeta = {
    marginBottom: 8,
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: 800,
};

const paginationNumberRow = {
    display: "flex",
    alignItems: "center",
    gap: 4,
};

const paginationNumberButton = (
    active,
    disabled
) => ({
    minWidth: 31,
    height: 31,
    padding: "0 8px",
    borderRadius: 9,
    border: active
        ? "1px solid rgba(96,165,250,.34)"
        : "1px solid rgba(148,163,184,.07)",
    background: active
        ? "linear-gradient(135deg,#2563eb,#3b82f6)"
        : "rgba(255,255,255,.035)",
    color: active ? "#fff" : "#cbd5e1",
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: 9.5,
    fontWeight: 900,
});

const paginationIconButton = (
    disabled
) => ({
    width: 31,
    height: 31,
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,.10)",
    background: "rgba(59,130,246,.05)",
    color: "#93c5fd",
    opacity: disabled ? 0.35 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 950,
});

export default AdminCenter;