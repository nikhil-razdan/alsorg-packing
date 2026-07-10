import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    executeAdminMasterDeletion,
    executeAdminPacketDeletion,
    fetchAdminDeletionHistory,
    previewAdminMasterDeletion,
    previewAdminPacketDeletion,
    searchAdminMasterItems,
    searchAdminPacketItems,
} from "../../api/dashboardApi";

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

    if (target.type === "MASTER_ITEM") {
        return (
            target.itemName ||
            target.pdNo ||
            target.id
        );
    }

    return (
        target.itemName ||
        target.packetNumber ||
        target.sku ||
        target.id
    );
};

function ResultPagination({
    page,
    onPageChange,
    disabled,
}) {
    if (
        !page ||
        Number(page.totalPages || 0) <= 1
    ) {
        return null;
    }

    const currentPage =
        Number(page.number || 0);

    const totalPages =
        Number(page.totalPages || 0);

    return (
        <div style={paginationRow}>
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
    const isMaster =
        target.type === "MASTER_ITEM";

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
                <div>
                    <div style={resultTypeBadge(
                        isMaster
                            ? "#a78bfa"
                            : "#38bdf8"
                    )}>
                        {isMaster
                            ? "Master Item"
                            : "Packet Item"}
                    </div>

                    <div style={resultTitle}>
                        {getTargetLabel(target)}
                    </div>
                </div>

                <div style={selectIndicator(
                    selected
                )}>
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
                        {target.drawingNo ||
                            "-"}
                    </strong>
                </div>

                <div>
                    <span>
                        {isMaster
                            ? "Total Packets"
                            : "Packet No."}
                    </span>

                    <strong>
                        {isMaster
                            ? Number(
                                target.totalPackets ||
                                0
                            )
                            : target.packetNumber ||
                            "-"}
                    </strong>
                </div>

                <div>
                    <span>Status</span>
                    <strong>
                        {target.status || "-"}
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
                                {target.stickerNumber ||
                                    "-"}
                            </strong>
                        </div>
                    </>
                )}
            </div>

            <div style={resultId}>
                ID: {target.id}
            </div>
        </button>
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
                    <div style={historyList}>
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

function AdminDeleteCenter({
    open,
    onClose,
    onDeleted,
}) {
    const [workspaceTab, setWorkspaceTab] =
        useState("delete");

    const [targetType, setTargetType] =
        useState("PACKET_ITEM");

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

    const resetSelection = () => {
        setSelectedTarget(null);
        setPreview(null);
        setPreviewError("");
        setReason("");
        setConfirmation("");
        setDeleteError("");
        setDeleteResult(null);
    };

    const resetSearch = () => {
        setSearchPage(EMPTY_PAGE);
        setSearchError("");
        resetSelection();
    };

    const closeModal = () => {
        if (deleting) return;
        onClose?.();
    };

    useEffect(() => {
        if (!open) return undefined;

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
    }, [open, deleting]);

    useEffect(() => {
        if (!open) {
            setWorkspaceTab("delete");
            setTargetType("PACKET_ITEM");
            setQuery("");
            setSearchPage(EMPTY_PAGE);
            resetSelection();
        }
    }, [open]);

    const loadHistory = async (
        page = 0
    ) => {
        setHistoryLoading(true);
        setHistoryError("");

        try {
            const data =
                await fetchAdminDeletionHistory({
                    page,
                    size: pageSize,
                });

            setHistoryPage(
                normalizePageResponse(
                    data,
                    page,
                    pageSize
                )
            );
        } catch (error) {
            console.error(error);

            setHistoryError(
                error?.message ||
                "Unable to load deletion history."
            );
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (
            open &&
            workspaceTab === "history"
        ) {
            loadHistory(0);
        }
    }, [open, workspaceTab]);

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
                    : await searchAdminPacketItems({
                        query: cleanQuery,
                        page: requestedPage,
                        size: pageSize,
                    });

            setSearchPage(
                normalizePageResponse(
                    data,
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

    const loadPreview = async (
        target
    ) => {
        if (!target?.id) return;

        setSelectedTarget(target);
        setPreview(null);
        setPreviewError("");
        setDeleteError("");
        setDeleteResult(null);
        setReason("");
        setConfirmation("");
        setPreviewLoading(true);

        try {
            const data =
                target.type === "MASTER_ITEM"
                    ? await previewAdminMasterDeletion(
                        target.id
                    )
                    : await previewAdminPacketDeletion(
                        target.id
                    );

            setPreview(data);
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
        if (
            !canDelete ||
            !selectedTargetId
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

            const deletingMaster =
                preview?.targetType === "MASTER_ITEM";

            const result =
                deletingMaster
                    ? await executeAdminMasterDeletion(
                        selectedTargetId,
                        payload
                    )
                    : await executeAdminPacketDeletion(
                        selectedTargetId,
                        payload
                    );

            setDeleteResult(result);

            setSearchPage((current) => ({
                ...current,

                content:
                    current.content.filter(
                        (item) =>
                            item.id !==
                            selectedTargetId
                    ),

                totalElements:
                    Math.max(
                        0,
                        Number(
                            current.totalElements ||
                            0
                        ) - 1
                    ),
            }));

            setPreview(null);
            setSelectedTarget(null);
            setReason("");
            setConfirmation("");

            await Promise.resolve(
                onDeleted?.(result)
            );
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
            <div style={modal}>
                <div style={modalHeader}>
                    <div style={headerIdentity}>
                        <div style={dangerIcon}>
                            🗑️
                        </div>

                        <div>
                            <div style={modalTitle}>
                                Admin Delete Center
                            </div>

                            <div style={modalSubtitle}>
                                Permanently remove packets,
                                masters and their linked
                                operational records.
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

                <div style={permanentWarning}>
                    <strong>
                        Permanent action:
                    </strong>{" "}
                    this is different from the normal
                    Inventory delete option. Records
                    removed here cannot be restored from
                    the application.
                </div>

                <div style={workspaceTabs}>
                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab(
                                "delete"
                            )
                        }
                        style={workspaceTabButton(
                            workspaceTab ===
                            "delete"
                        )}
                    >
                        Delete Records
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setWorkspaceTab(
                                "history"
                            )
                        }
                        style={workspaceTabButton(
                            workspaceTab ===
                            "history"
                        )}
                    >
                        Deletion History
                    </button>
                </div>

                <div style={modalBody}>
                    {workspaceTab ===
                        "history" && (
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
                                    </div>

                                    <div style={typeDescription}>
                                        {targetTypeDescription}
                                    </div>

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
                                                            key={`${target.type}-${target.id}`}
                                                            target={
                                                                target
                                                            }
                                                            selected={
                                                                selectedTarget?.id ===
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
                                                    Select a record
                                                </div>

                                                <div
                                                    style={
                                                        previewPlaceholderText
                                                    }
                                                >
                                                    The backend will
                                                    calculate every
                                                    linked row before
                                                    the delete button
                                                    is enabled.
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
                                        <div style={previewContent}>
                                            <div
                                                style={
                                                    previewHeader
                                                }
                                            >
                                                <div>
                                                    <div
                                                        style={resultTypeBadge(
                                                            preview.targetType ===
                                                                "MASTER_ITEM"
                                                                ? "#a78bfa"
                                                                : "#38bdf8"
                                                        )}
                                                    >
                                                        {formatLabel(
                                                            preview.targetType
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
                                                        : preview.targetType ===
                                                            "MASTER_ITEM"
                                                            ? "Delete Master and All Packets"
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
    gap: 9,

    maxHeight: 485,
    overflowY: "auto",
    paddingRight: 3,
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

export default AdminDeleteCenter;