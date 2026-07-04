import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    fetchMasterItemReport,
    fetchMasterItemDetail,
    openProtectedDashboardPdf,
    downloadProtectedDashboardPdf,
} from "../../api/dashboardApi";

const IST_OFFSET_MINUTES = 330;

const pad = (value) =>
    String(value).padStart(2, "0");

const toStartDateTime = (date) =>
    date ? `${date}T00:00:00` : undefined;

const toEndDateTime = (date) =>
    date ? `${date}T23:59:59` : undefined;

const safe = (value, fallback = "—") => {
    const text =
        String(value ?? "").trim();

    return text || fallback;
};

const toNumber = (value) =>
    Number(value || 0);

const percent = (value) =>
    Math.max(
        0,
        Math.min(
            100,
            Math.round(toNumber(value))
        )
    );

const getMasterId = (row) =>
    row?.masterItemId ||
    row?.id ||
    row?.master_item_id ||
    "";

const getProgress = (row) =>
    percent(
        row?.packingProgress ??
        row?.completionPercent ??
        row?.completion_percent ??
        0
    );

const normalizeStatus = (status) =>
    String(status || "")
        .trim()
        .toUpperCase();

const statusLabel = (status) => {
    const value = normalizeStatus(status);

    if (value === "FULLY_PACKED") return "Fully Packed";
    if (value === "PARTIALLY_PACKED") return "Partially Packed";
    if (value === "NO_PACKETS") return "No Packets";
    if (value === "UNPACKED") return "Unpacked";
    if (value === "DISPATCHED") return "Dispatched";

    return value || "Unknown";
};

const statusColor = (status) => {
    const text = normalizeStatus(status);

    if (text === "FULLY_PACKED") return "#22c55e";
    if (text === "PARTIALLY_PACKED") return "#f59e0b";
    if (text === "DISPATCHED") return "#8b5cf6";
    if (text === "NO_PACKETS") return "#ef4444";
    if (text === "UNPACKED") return "#f97316";

    return "#38bdf8";
};

function parseAppDateTime(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : value;
    }

    const raw =
        String(value)
            .trim()
            .replace(" ", "T");

    if (!raw) {
        return null;
    }

    const hasTimezone =
        /[zZ]$/.test(raw) ||
        /[+-]\d{2}:?\d{2}$/.test(raw);

    if (hasTimezone) {
        const date = new Date(raw);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    const match =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?$/
        );

    if (!match) {
        const fallback = new Date(raw);

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
}

const formatDateTime = (value) => {
    const date =
        parseAppDateTime(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    }).format(date);
};

const filenameSafe = (value) =>
    String(value || "document")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_");

const getLogicalPacketItemId = (packet) =>
    packet?.packetItemId ||
    packet?.packetId ||
    packet?.packet_item_id ||
    "";

const getPacketStickerPreviewUrl = (packet) => {
    const packetItemId =
        getLogicalPacketItemId(packet);

    const hasSticker =
        Boolean(packet?.stickerNumber) ||
        Number(packet?.packedItems || 0) > 0;

    if (!packetItemId || !hasSticker) {
        return "";
    }

    return (
        packet?.stickerPreviewUrl ||
        `/api/inventory/stickers/packet-items/${encodeURIComponent(
            packetItemId
        )}/latest?download=false`
    );
};

const getPacketStickerDownloadUrl = (packet) => {
    const packetItemId =
        getLogicalPacketItemId(packet);

    const hasSticker =
        Boolean(packet?.stickerNumber) ||
        Number(packet?.packedItems || 0) > 0;

    if (!packetItemId || !hasSticker) {
        return "";
    }

    return (
        packet?.stickerDownloadUrl ||
        `/api/inventory/stickers/packet-items/${encodeURIComponent(
            packetItemId
        )}/latest?download=true`
    );
};

const getChallanPreviewUrl = (challan) =>
    challan?.challanPreviewUrl ||
    (challan?.challanNumber
        ? `/api/reports/dashboard/challan/preview?challanNumber=${encodeURIComponent(
            challan.challanNumber
        )}`
        : "");

const getChallanDownloadUrl = (challan) =>
    challan?.challanDownloadUrl ||
    (challan?.challanNumber
        ? `/api/reports/dashboard/challan/download?challanNumber=${encodeURIComponent(
            challan.challanNumber
        )}`
        : "");
function MasterItemsModal({
    open,
    onClose,
}) {
    const [rows, setRows] =
        useState([]);

    const [total, setTotal] =
        useState(0);

    const [loading, setLoading] =
        useState(false);

    const [detailLoading, setDetailLoading] =
        useState(false);

    const [detailError, setDetailError] =
        useState("");

    const [error, setError] =
        useState("");

    const [status, setStatus] =
        useState("ALL");

    const [fromDate, setFromDate] =
        useState("");

    const [toDate, setToDate] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [plantCode, setPlantCode] =
        useState("");

    const [client, setClient] =
        useState("");

    const [selectedId, setSelectedId] =
        useState("");

    const [selectedFallback, setSelectedFallback] =
        useState(null);

    const [detail, setDetail] =
        useState(null);

    const [expandedPacket, setExpandedPacket] =
        useState("");

    const [activeTab, setActiveTab] =
        useState("overview");

    const loadData = async () => {
        try {
            setLoading(true);
            setError("");

            const data =
                await fetchMasterItemReport({
                    status,
                    search: search.trim(),
                    plantCode: plantCode.trim(),
                    client: client.trim(),
                    from: toStartDateTime(fromDate),
                    to: toEndDateTime(toDate),
                    limit: 700,
                    offset: 0,
                });

            const nextRows =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data?.rows)
                        ? data.rows
                        : Array.isArray(data?.content)
                            ? data.content
                            : [];

            setRows(nextRows);
            setTotal(
                Number(
                    data?.total ??
                    data?.totalElements ??
                    nextRows.length
                )
            );

            if (
                nextRows.length > 0 &&
                !selectedId
            ) {
                handleSelectMaster(nextRows[0]);
            }

            if (nextRows.length === 0) {
                setSelectedId("");
                setSelectedFallback(null);
                setDetail(null);
            }
        } catch (e) {
            console.error(e);

            setRows([]);
            setTotal(0);
            setDetail(null);
            setSelectedId("");
            setSelectedFallback(null);

            setError(
                e.message ||
                "Unable to load master items"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMaster = async (row) => {
        const id =
            getMasterId(row);

        if (!id) {
            return;
        }

        try {
            setSelectedId(id);
            setSelectedFallback(row);
            setDetail(null);
            setDetailError("");
            setDetailLoading(true);
            setExpandedPacket("");
            setActiveTab("overview");

            const data =
                await fetchMasterItemDetail(id);

            setDetail(data || null);

            const firstPacketId =
                data?.packets?.[0]?.packetId ||
                data?.packets?.[0]?.packetItemId ||
                data?.packets?.[0]?.id ||
                "";

            if (firstPacketId) {
                setExpandedPacket(firstPacketId);
            }
        } catch (e) {
            console.error(e);

            setDetail({
                master: row,
                packets: [],
                packetItems: [],
                challans: [],
            });

            setDetailError(
                e.message ||
                "Failed to load packets, stickers and challans for this master item"
            );
        } finally {
            setDetailLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, status]);

    const summary =
        useMemo(() => {
            const totalRows = rows.length;

            const fully =
                rows.filter(
                    (row) =>
                        normalizeStatus(row.packingStatus) ===
                        "FULLY_PACKED"
                ).length;

            const partial =
                rows.filter(
                    (row) =>
                        normalizeStatus(row.packingStatus) ===
                        "PARTIALLY_PACKED"
                ).length;

            const unpacked =
                rows.filter(
                    (row) =>
                        normalizeStatus(row.packingStatus) ===
                        "UNPACKED"
                ).length;

            const noPackets =
                rows.filter(
                    (row) =>
                        normalizeStatus(row.packingStatus) ===
                        "NO_PACKETS"
                ).length;

            const dispatched =
                rows.filter(
                    (row) =>
                        toNumber(row.dispatchedPacketItems) > 0 ||
                        toNumber(row.challanCount) > 0 ||
                        normalizeStatus(row.packingStatus) ===
                        "DISPATCHED"
                ).length;

            const exceptions =
                rows.filter(
                    (row) =>
                        Boolean(row.exceptionReason) ||
                        normalizeStatus(row.packingStatus) ===
                        "NO_PACKETS"
                ).length;

            return {
                total: totalRows,
                fully,
                partial,
                unpacked,
                noPackets,
                dispatched,
                exceptions,
            };
        }, [rows]);

    const clearFilters = () => {
        setStatus("ALL");
        setFromDate("");
        setToDate("");
        setSearch("");
        setPlantCode("");
        setClient("");
    };

    const master =
        detail?.master ||
        selectedFallback ||
        null;

    const packets =
        Array.isArray(detail?.packets)
            ? detail.packets
            : [];

    const packetItems =
        Array.isArray(detail?.packetItems)
            ? detail.packetItems
            : [];

    const challans =
        Array.isArray(detail?.challans)
            ? detail.challans
            : [];

    const packetItemsByPacketId =
        useMemo(() => {
            const map = {};

            packetItems.forEach((item) => {
                const packetId =
                    item.packetId ||
                    item.packet_id ||
                    "NO_PACKET";

                if (!map[packetId]) {
                    map[packetId] = [];
                }

                map[packetId].push(item);
            });

            return map;
        }, [packetItems]);

    if (!open) {
        return null;
    }

    return (
        <div style={overlay}>
            <div style={modal}>
                <div style={header}>
                    <div>
                        <div style={eyebrow}>
                            MASTER ITEM CONTROL CENTER
                        </div>

                        <div style={title}>
                            Master Item Register & Traceability
                        </div>

                        <div style={subtitle}>
                            Click any master item to inspect packets, packet items,
                            stickers, users, challans, driver, vehicle and trip movement.
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        style={closeBtn}
                    >
                        ×
                    </button>
                </div>

                <div style={summaryGrid}>
                    <SummaryBox
                        label="Total"
                        value={summary.total}
                        accent="#60a5fa"
                    />

                    <SummaryBox
                        label="Fully Packed"
                        value={summary.fully}
                        accent="#22c55e"
                    />

                    <SummaryBox
                        label="Partial"
                        value={summary.partial}
                        accent="#f59e0b"
                    />

                    <SummaryBox
                        label="Unpacked"
                        value={summary.unpacked}
                        accent="#f97316"
                    />

                    <SummaryBox
                        label="No Packets"
                        value={summary.noPackets}
                        accent="#ef4444"
                    />

                    <SummaryBox
                        label="With Dispatch"
                        value={summary.dispatched}
                        accent="#8b5cf6"
                    />

                    <SummaryBox
                        label="Exceptions"
                        value={summary.exceptions}
                        accent="#fb7185"
                    />
                </div>

                <div style={filters}>
                    <select
                        value={status}
                        onChange={(e) =>
                            setStatus(e.target.value)
                        }
                        style={input}
                    >
                        <option value="ALL">
                            All Master Items
                        </option>

                        <option value="FULLY_PACKED">
                            Fully Packed
                        </option>

                        <option value="PARTIALLY_PACKED">
                            Partially Packed
                        </option>

                        <option value="UNPACKED">
                            Unpacked
                        </option>

                        <option value="NO_PACKETS">
                            No Packets
                        </option>

                        <option value="DISPATCHED">
                            Dispatched
                        </option>

                        <option value="EXCEPTIONS">
                            Exceptions
                        </option>
                    </select>

                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) =>
                            setFromDate(e.target.value)
                        }
                        style={input}
                    />

                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) =>
                            setToDate(e.target.value)
                        }
                        style={input}
                    />

                    <input
                        value={plantCode}
                        onChange={(e) =>
                            setPlantCode(e.target.value)
                        }
                        placeholder="Plant"
                        style={smallInput}
                    />

                    <input
                        value={client}
                        onChange={(e) =>
                            setClient(e.target.value)
                        }
                        placeholder="Client"
                        style={smallInput}
                    />

                    <input
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                loadData();
                            }
                        }}
                        placeholder="Search item, PD, DWG, client, floor, user..."
                        style={searchInput}
                    />

                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        style={primaryBtn}
                    >
                        {loading ? "Loading..." : "Apply"}
                    </button>

                    <button
                        type="button"
                        onClick={clearFilters}
                        style={ghostBtn}
                    >
                        Clear
                    </button>
                </div>

                {error && (
                    <div style={errorBox}>
                        {error}
                    </div>
                )}

                <div style={mainGrid}>
                    <div style={registerPanel}>
                        <div style={panelHead}>
                            <div>
                                <div style={panelTitle}>
                                    Master Items
                                </div>

                                <div style={panelSub}>
                                    Showing {rows.length} of {total || rows.length}
                                </div>
                            </div>

                            <div style={hintPill}>
                                Click row
                            </div>
                        </div>

                        <div style={tableWrap}>
                            <table style={table}>
                                <thead>
                                    <tr>
                                        <th style={th}>Master Item</th>
                                        <th style={th}>Client</th>
                                        <th style={th}>PD / DWG</th>
                                        <th style={th}>Progress</th>
                                        <th style={th}>Challan</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                style={empty}
                                            >
                                                Loading master items...
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && rows.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                style={empty}
                                            >
                                                No master item found.
                                            </td>
                                        </tr>
                                    )}

                                    {!loading &&
                                        rows.map((row) => {
                                            const rowId =
                                                getMasterId(row);

                                            const accent =
                                                statusColor(
                                                    row.packingStatus
                                                );

                                            const progress =
                                                getProgress(row);

                                            const selected =
                                                selectedId === rowId;

                                            return (
                                                <tr
                                                    key={rowId}
                                                    onClick={() =>
                                                        handleSelectMaster(row)
                                                    }
                                                    style={tableRow(selected)}
                                                >
                                                    <td style={tdStrong}>
                                                        <div style={itemNameText}>
                                                            {safe(
                                                                row.itemName
                                                            )}
                                                        </div>

                                                        <div style={muted}>
                                                            {safe(rowId)}
                                                        </div>

                                                        <div style={miniStatus(accent)}>
                                                            {statusLabel(
                                                                row.packingStatus
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td style={td}>
                                                        <div>
                                                            {safe(
                                                                row.clientName
                                                            )}
                                                        </div>

                                                        <div style={muted}>
                                                            {safe(
                                                                row.clientAddress
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td style={td}>
                                                        <div>
                                                            PD:{" "}
                                                            <b>
                                                                {safe(
                                                                    row.pdNo
                                                                )}
                                                            </b>
                                                        </div>

                                                        <div style={muted}>
                                                            DWG:{" "}
                                                            {safe(
                                                                row.drawingName
                                                            )}
                                                        </div>

                                                        <div style={muted}>
                                                            Plant:{" "}
                                                            {safe(
                                                                row.plantCode
                                                            )}
                                                            {" • Floor: "}
                                                            {safe(row.floor)}
                                                        </div>
                                                    </td>

                                                    <td style={td}>
                                                        <div style={progressLine}>
                                                            <div style={progressTrack}>
                                                                <div
                                                                    style={progressFill(
                                                                        accent,
                                                                        progress
                                                                    )}
                                                                />
                                                            </div>

                                                            <strong>
                                                                {progress}%
                                                            </strong>
                                                        </div>

                                                        <div style={muted}>
                                                            Packets:{" "}
                                                            {safe(
                                                                row.actualPackets
                                                            )}
                                                            {" • Items: "}
                                                            {safe(
                                                                row.packetItems
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td style={td}>
                                                        <div>
                                                            Stickers:{" "}
                                                            <b>
                                                                {safe(
                                                                    row.stickerCount
                                                                )}
                                                            </b>
                                                        </div>

                                                        <div style={muted}>
                                                            Challans:{" "}
                                                            {safe(
                                                                row.challanCount
                                                            )}
                                                        </div>

                                                        <div style={muted}>
                                                            Last:{" "}
                                                            {formatDateTime(
                                                                row.lastDispatchedAt
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={detailPanel}>
                        {detailLoading && (
                            <div style={emptyDetail}>
                                Loading selected master item details...
                            </div>
                        )}

                        {!detailLoading && !master && (
                            <div style={emptyDetail}>
                                Select a master item to view packet, sticker and challan history.
                            </div>
                        )}

                        {!detailLoading && master && (
                            <>
                                <DetailHeader
                                    master={master}
                                    challanCount={challans.length}
                                />

                                <div style={tabBar}>
                                    <TabButton
                                        label="Overview"
                                        active={activeTab === "overview"}
                                        onClick={() => setActiveTab("overview")}
                                    />

                                    <TabButton
                                        label={`Packets (${packets.length})`}
                                        active={activeTab === "packets"}
                                        onClick={() => setActiveTab("packets")}
                                    />

                                    <TabButton
                                        label={`Challans (${challans.length})`}
                                        active={activeTab === "challans"}
                                        onClick={() => setActiveTab("challans")}
                                    />
                                </div>

                                {activeTab === "overview" && (
                                    <OverviewPanel
                                        master={master}
                                        packets={packets}
                                        packetItems={packetItems}
                                        challans={challans}
                                    />
                                )}

                                {activeTab === "packets" && (
                                    <PacketsPanel
                                        packets={packets}
                                        packetItemsByPacketId={packetItemsByPacketId}
                                        expandedPacket={expandedPacket}
                                        setExpandedPacket={setExpandedPacket}
                                    />
                                )}

                                {activeTab === "challans" && (
                                    <ChallansPanel
                                        challans={challans}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailHeader({
    master,
    challanCount,
}) {
    const accent =
        statusColor(master.packingStatus);

    const progress =
        getProgress(master);

    return (
        <div style={detailHero}>
            <div>
                <div style={detailEyebrow}>
                    SELECTED MASTER ITEM
                </div>

                <div style={detailTitle}>
                    {safe(master.itemName)}
                </div>

                <div style={detailMeta}>
                    PD: <b>{safe(master.pdNo)}</b>
                    {"  •  "}
                    DWG: <b>{safe(master.drawingName)}</b>
                    {"  •  "}
                    Plant: <b>{safe(master.plantCode)}</b>
                    {"  •  "}
                    Floor: <b>{safe(master.floor)}</b>
                </div>

                <div style={detailMeta}>
                    Client: <b>{safe(master.clientName)}</b>
                </div>
            </div>

            <div style={detailRight}>
                <div style={statusBadge(accent)}>
                    {statusLabel(master.packingStatus)}
                </div>

                <div style={bigPercent}>
                    {progress}%
                </div>

                <div style={detailMeta}>
                    {challanCount} challan(s)
                </div>
            </div>
        </div>
    );
}

function OverviewPanel({
    master,
    packets,
    packetItems,
    challans,
}) {
    return (
        <>
            <div style={detailSummaryGrid}>
                <MetricBox
                    label="Expected Packets"
                    value={safe(master.expectedPackets)}
                    accent="#60a5fa"
                />

                <MetricBox
                    label="Actual Packets"
                    value={safe(master.actualPackets ?? packets.length)}
                    accent="#38bdf8"
                />

                <MetricBox
                    label="Packet Items"
                    value={safe(master.packetItems ?? packetItems.length)}
                    accent="#a78bfa"
                />

                <MetricBox
                    label="Packed Items"
                    value={safe(master.packedPacketItems)}
                    accent="#22c55e"
                />

                <MetricBox
                    label="Pending Items"
                    value={safe(master.pendingPacketItems)}
                    accent="#f59e0b"
                />

                <MetricBox
                    label="Dispatched Items"
                    value={safe(master.dispatchedPacketItems)}
                    accent="#8b5cf6"
                />

                <MetricBox
                    label="Stickers"
                    value={safe(master.stickerCount)}
                    accent="#f472b6"
                />

                <MetricBox
                    label="Challans"
                    value={safe(master.challanCount ?? challans.length)}
                    accent="#ec4899"
                />
            </div>

            <div style={timelineGrid}>
                <InfoLine
                    label="Created At"
                    value={formatDateTime(master.createdAt)}
                />

                <InfoLine
                    label="First Packed"
                    value={formatDateTime(master.firstPackedAt)}
                />

                <InfoLine
                    label="Last Packed"
                    value={formatDateTime(master.lastPackedAt)}
                />

                <InfoLine
                    label="Last Packed By"
                    value={safe(master.lastPackedBy)}
                />

                <InfoLine
                    label="First Dispatch"
                    value={formatDateTime(master.firstDispatchedAt)}
                />

                <InfoLine
                    label="Last Dispatch"
                    value={formatDateTime(master.lastDispatchedAt)}
                />

                <InfoLine
                    label="Last Dispatch By"
                    value={safe(master.lastDispatchedBy)}
                />
            </div>

            <div style={overviewDocsGrid}>
                {packets.length > 0 && (
                    <div style={overviewDocPanel}>
                        <div style={overviewDocTitle}>
                            Packet Stickers
                        </div>

                        <div style={overviewDocScroll}>
                            {packets.map((packet) => {
                                const packetItemId =
                                    getLogicalPacketItemId(packet);

                                const previewUrl =
                                    getPacketStickerPreviewUrl(packet);

                                const downloadUrl =
                                    getPacketStickerDownloadUrl(packet);

                                return (
                                    <div
                                        key={packetItemId || packet.packetId}
                                        style={overviewDocRow}
                                    >
                                        <div style={overviewDocInfo}>
                                            <div style={overviewDocNo}>
                                                Packet {safe(packet.packetNumber)}
                                            </div>

                                            <div style={overviewDocMeta}>
                                                Sticker: {safe(packet.stickerNumber)} •{" "}
                                                Items: {safe(packet.packetItems)}
                                            </div>
                                        </div>

                                        <div style={docActions}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openProtectedDashboardPdf(previewUrl)
                                                }
                                                style={docBtn("#38bdf8")}
                                                disabled={!previewUrl}
                                            >
                                                Preview
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    downloadProtectedDashboardPdf(
                                                        downloadUrl,
                                                        `Sticker_${filenameSafe(
                                                            packet.stickerNumber ||
                                                            packet.packetNumber ||
                                                            packetItemId
                                                        )}.pdf`
                                                    )
                                                }
                                                style={docBtn("#22c55e")}
                                                disabled={!downloadUrl}
                                            >
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {challans.length > 0 && (
                    <div style={overviewDocPanel}>
                        <div style={overviewDocTitle}>
                            Master Item Challans
                        </div>

                        <div style={overviewDocScroll}>
                            {challans.map((challan) => {
                                const previewUrl =
                                    getChallanPreviewUrl(challan);

                                const downloadUrl =
                                    getChallanDownloadUrl(challan);

                                return (
                                    <div
                                        key={challan.challanNumber}
                                        style={overviewDocRow}
                                    >
                                        <div style={overviewDocInfo}>
                                            <div style={overviewDocNo}>
                                                {safe(challan.challanNumber)}
                                            </div>

                                            <div style={overviewDocMeta}>
                                                Items: {safe(challan.itemCount)} •{" "}
                                                {formatDateTime(challan.lastDispatchedAt)}
                                            </div>
                                        </div>

                                        <div style={docActions}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openProtectedDashboardPdf(previewUrl)
                                                }
                                                style={docBtn("#8b5cf6")}
                                                disabled={!previewUrl}
                                            >
                                                Preview
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    downloadProtectedDashboardPdf(
                                                        downloadUrl,
                                                        `Challan_${filenameSafe(
                                                            challan.challanNumber
                                                        )}.pdf`
                                                    )
                                                }
                                                style={docBtn("#22c55e")}
                                                disabled={!downloadUrl}
                                            >
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {master.exceptionReason && (
                <div style={exceptionBanner}>
                    <b>Exception:</b>{" "}
                    {master.exceptionReason}
                </div>
            )}
        </>
    );
}

function PacketsPanel({
    packets,
    packetItemsByPacketId,
    expandedPacket,
    setExpandedPacket,
}) {
    if (!packets.length) {
        return (
            <div style={emptyDetail}>
                No packets found for this master item.
            </div>
        );
    }

    return (
        <div>
            {packets.map((packet) => {
                const packetId =
                    packet.packetId ||
                    packet.id;

                const rows =
                    packetItemsByPacketId[packetId] ||
                    [];

                const isOpen =
                    expandedPacket === packetId;

                return (
                    <div
                        key={packetId}
                        style={packetCard}
                    >
                        <button
                            type="button"
                            onClick={() =>
                                setExpandedPacket(
                                    isOpen
                                        ? ""
                                        : packetId
                                )
                            }
                            style={packetHeader}
                        >
                            <div>
                                <div style={packetTitle}>
                                    Packet{" "}
                                    {safe(packet.packetNumber)}
                                </div>

                                <div style={packetMeta}>
                                    Status:{" "}
                                    <b>
                                        {safe(packet.status)}
                                    </b>
                                    {"  •  "}
                                    Sticker:{" "}
                                    <b>
                                        {safe(packet.stickerNumber)}
                                    </b>
                                    {"  •  "}
                                    Warehouse:{" "}
                                    <b>
                                        {safe(packet.warehouseCode)}
                                    </b>
                                </div>

                                <div style={packetMeta}>
                                    Created:{" "}
                                    <b>
                                        {formatDateTime(packet.createdAt)}
                                    </b>
                                    {"  •  "}
                                    By:{" "}
                                    <b>
                                        {safe(packet.createdBy)}
                                    </b>
                                </div>
                            </div>

                            <div style={packetStats}>
                                <span>
                                    Items{" "}
                                    <b>{safe(packet.packetItems)}</b>
                                </span>

                                <span>
                                    Packed{" "}
                                    <b>{safe(packet.packedItems)}</b>
                                </span>

                                <span>
                                    Dispatch{" "}
                                    <b>{safe(packet.dispatchedItems)}</b>
                                </span>

                                <div style={docActions}>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();

                                            openProtectedDashboardPdf(
                                                getPacketStickerPreviewUrl(packet)
                                            );
                                        }}
                                        style={docBtn("#38bdf8")}
                                        disabled={!getPacketStickerPreviewUrl(packet)}
                                    >
                                        Preview Sticker
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();

                                            downloadProtectedDashboardPdf(
                                                getPacketStickerDownloadUrl(packet),
                                                `Sticker_${filenameSafe(
                                                    packet.stickerNumber ||
                                                    packet.packetNumber ||
                                                    getLogicalPacketItemId(packet)
                                                )}.pdf`
                                            );
                                        }}
                                        style={docBtn("#22c55e")}
                                        disabled={!getPacketStickerDownloadUrl(packet)}
                                    >
                                        Download
                                    </button>
                                </div>

                                <span>
                                    {isOpen ? "Hide" : "Open"}
                                </span>
                            </div>
                        </button>

                        {isOpen && (
                            <div style={packetTableWrap}>
                                <table style={packetTable}>
                                    <thead>
                                        <tr>
                                            <th style={packetTh}>Item</th>
                                            <th style={packetTh}>PD / DWG</th>
                                            <th style={packetTh}>Sticker</th>
                                            <th style={packetTh}>Packed</th>
                                            <th style={packetTh}>Challan / Dispatch</th>
                                            <th style={packetTh}>Location</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {rows.map((item) => (
                                            <tr key={item.packetItemId}>
                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(item.itemName)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        SKU: {safe(item.sku)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        Qty: {safe(item.quantity, "1")}
                                                    </div>
                                                </td>

                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(item.pdNo)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        {safe(item.drawingNo)}
                                                    </div>
                                                </td>

                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(item.stickerNumber)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        Print: {safe(item.printIteration, "1")}
                                                    </div>

                                                    <div style={cellSub}>
                                                        History: {safe(item.stickerHistoryCount, "0")}
                                                    </div>

                                                    <div style={cellSub}>
                                                        By: {safe(item.lastStickerGeneratedBy)}
                                                    </div>
                                                </td>

                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(item.status)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        {formatDateTime(
                                                            item.packedAt ||
                                                            item.lastStickerGeneratedAt
                                                        )}
                                                    </div>

                                                    <div style={cellSub}>
                                                        By: {safe(item.createdBy)}
                                                    </div>
                                                </td>

                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(
                                                            item.challanNumber ||
                                                            item.chalaanNumber
                                                        )}
                                                    </div>

                                                    <div style={cellSub}>
                                                        {safe(item.dispatchStatus)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        {formatDateTime(item.dispatchedAt)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        {safe(item.vehicleNumber)}
                                                        {" / "}
                                                        {safe(item.driverName)}
                                                    </div>

                                                    <div style={cellSub}>
                                                        Trip:{" "}
                                                        {formatDateTime(item.tripStartedAt)}
                                                        {" → "}
                                                        {formatDateTime(item.tripEndedAt)}
                                                    </div>
                                                </td>

                                                <td style={packetTd}>
                                                    <div style={cellMain}>
                                                        {safe(
                                                            item.currentLocationCode ||
                                                            item.warehouseCode
                                                        )}
                                                    </div>

                                                    <div style={cellSub}>
                                                        Plant: {safe(item.plantCode)}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {rows.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    style={empty}
                                                >
                                                    No packet items found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ChallansPanel({
    challans,
}) {
    if (!challans.length) {
        return (
            <div style={emptyDetail}>
                No challan generated for this master item yet.
            </div>
        );
    }

    return (
        <div style={challanGrid}>
            {challans.map((challan) => (
                <div
                    key={challan.challanNumber}
                    style={challanCard}
                >
                    <div style={challanNo}>
                        {safe(challan.challanNumber)}
                    </div>

                    <div style={challanActions}>
                        <button
                            type="button"
                            onClick={() =>
                                openProtectedDashboardPdf(
                                    getChallanPreviewUrl(challan)
                                )
                            }
                            style={docBtn("#8b5cf6")}
                            disabled={!getChallanPreviewUrl(challan)}
                        >
                            Preview Challan
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                downloadProtectedDashboardPdf(
                                    getChallanDownloadUrl(challan),
                                    `Challan_${filenameSafe(
                                        challan.challanNumber
                                    )}.pdf`
                                )
                            }
                            style={docBtn("#22c55e")}
                            disabled={!getChallanDownloadUrl(challan)}
                        >
                            Download
                        </button>
                    </div>

                    <div style={challanMeta}>
                        Items:{" "}
                        <b>
                            {safe(challan.itemCount)}
                        </b>
                        {"  •  "}
                        By:{" "}
                        <b>
                            {safe(challan.dispatchedBy)}
                        </b>
                    </div>

                    <div style={challanMeta}>
                        Driver:{" "}
                        <b>
                            {safe(challan.driverName)}
                        </b>
                        {"  •  "}
                        Vehicle:{" "}
                        <b>
                            {safe(challan.vehicleNumber)}
                        </b>
                    </div>

                    <div style={challanMeta}>
                        First Dispatch:{" "}
                        <b>
                            {formatDateTime(challan.firstDispatchedAt)}
                        </b>
                    </div>

                    <div style={challanMeta}>
                        Last Dispatch:{" "}
                        <b>
                            {formatDateTime(challan.lastDispatchedAt)}
                        </b>
                    </div>

                    <div style={challanMeta}>
                        Trip:{" "}
                        <b>
                            {formatDateTime(challan.tripStartedAt)}
                        </b>
                        {" → "}
                        <b>
                            {formatDateTime(challan.tripEndedAt)}
                        </b>
                    </div>
                </div>
            ))}
        </div>
    );
}

function TabButton({
    label,
    active,
    onClick,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={tabBtn(active)}
        >
            {label}
        </button>
    );
}

function InfoLine({
    label,
    value,
}) {
    return (
        <div style={infoLine}>
            <span>{label}</span>
            <strong>{value || "—"}</strong>
        </div>
    );
}

function MetricBox({
    label,
    value,
    accent,
}) {
    return (
        <div style={metricBox(accent)}>
            <div style={metricLabel}>
                {label}
            </div>

            <div style={metricValue}>
                {value}
            </div>
        </div>
    );
}

function SummaryBox({
    label,
    value,
    accent,
}) {
    return (
        <div style={summaryBox(accent)}>
            <div style={summaryLabel}>
                {label}
            </div>

            <div style={summaryValue}>
                {value}
            </div>
        </div>
    );
}

const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(2,6,23,.78)",
    backdropFilter: "blur(16px)",
    padding: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const modal = {
    width: "min(1760px, 100%)",
    height: "min(94vh, 980px)",
    overflow: "hidden",
    borderRadius: 32,
    background:
        "radial-gradient(circle at top left, rgba(59,130,246,.16), transparent 34%), linear-gradient(180deg, rgba(15,23,42,.98), rgba(8,17,31,.96))",
    border: "1px solid rgba(255,255,255,.10)",
    boxShadow: "0 34px 90px rgba(0,0,0,.58)",
    color: "#fff",
    padding: 22,
    display: "flex",
    flexDirection: "column",
};

const header = {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 16,
};

const eyebrow = {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: ".16em",
};

const title = {
    marginTop: 6,
    color: "#fff",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-.03em",
};

const subtitle = {
    marginTop: 6,
    color: "rgba(255,255,255,.58)",
    fontSize: 13,
    fontWeight: 650,
    maxWidth: 920,
    lineHeight: 1.6,
};

const closeBtn = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.06)",
    color: "#fff",
    fontSize: 25,
    cursor: "pointer",
};

const summaryGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(140px,1fr))",
    gap: 12,
    marginBottom: 14,
};

const summaryBox = (accent) => ({
    padding: 14,
    borderRadius: 18,
    background:
        `radial-gradient(circle at top right, ${accent}22, transparent 44%), rgba(255,255,255,.035)`,
    border: `1px solid ${accent}33`,
});

const summaryLabel = {
    color: "rgba(255,255,255,.55)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".08em",
};

const summaryValue = {
    marginTop: 7,
    color: "#fff",
    fontSize: 26,
    fontWeight: 950,
};

const filters = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 20,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.07)",
    marginBottom: 14,
};

const input = {
    height: 40,
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,.10)",
    background: "#0f172a",
    color: "#fff",
    padding: "0 12px",
    outline: "none",
    fontWeight: 800,
    colorScheme: "dark",
};

const smallInput = {
    ...input,
    width: 120,
};

const searchInput = {
    ...input,
    flex: 1,
    minWidth: 320,
};

const primaryBtn = {
    height: 40,
    borderRadius: 13,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    color: "#fff",
    fontWeight: 950,
    padding: "0 18px",
    cursor: "pointer",
};

const ghostBtn = {
    ...primaryBtn,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
};

const errorBox = {
    padding: 12,
    borderRadius: 14,
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.25)",
    color: "#fecaca",
    fontWeight: 800,
    marginBottom: 12,
};

const mainGrid = {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(650px, .95fr) minmax(520px, 1.05fr)",
    gap: 14,
};

const registerPanel = {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRadius: 24,
    background: "rgba(15,23,42,.70)",
    border: "1px solid rgba(255,255,255,.08)",
    overflow: "hidden",
};

const detailPanel = {
    minHeight: 0,
    overflow: "auto",
    borderRadius: 24,
    background:
        "linear-gradient(180deg, rgba(255,255,255,.050), rgba(255,255,255,.025))",
    border: "1px solid rgba(255,255,255,.08)",
    padding: 16,
};

const panelHead = {
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const panelTitle = {
    fontSize: 16,
    fontWeight: 950,
};

const panelSub = {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,.50)",
    fontWeight: 750,
};

const hintPill = {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(96,165,250,.12)",
    border: "1px solid rgba(96,165,250,.25)",
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 950,
};

const tableWrap = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
};

const table = {
    width: "100%",
    minWidth: 900,
    borderCollapse: "collapse",
    fontSize: 12,
};

const th = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    padding: "13px 12px",
    textAlign: "left",
    background: "#0b1220",
    color: "#94a3b8",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    borderBottom: "1px solid rgba(255,255,255,.08)",
};

const tableRow = (active) => ({
    cursor: "pointer",
    background: active
        ? "linear-gradient(90deg, rgba(37,99,235,.18), rgba(255,255,255,.025))"
        : "transparent",
});

const td = {
    padding: "13px 12px",
    color: "rgba(255,255,255,.82)",
    borderBottom: "1px solid rgba(255,255,255,.045)",
    verticalAlign: "top",
};

const tdStrong = {
    ...td,
    color: "#fff",
    fontWeight: 850,
};

const itemNameText = {
    maxWidth: 230,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const muted = {
    marginTop: 4,
    color: "rgba(255,255,255,.45)",
    fontSize: 11,
    fontWeight: 650,
    maxWidth: 230,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const miniStatus = (accent) => ({
    display: "inline-flex",
    marginTop: 8,
    padding: "4px 8px",
    borderRadius: 999,
    background: `${accent}1F`,
    border: `1px solid ${accent}44`,
    color: accent,
    fontSize: 10,
    fontWeight: 950,
});

const statusBadge = (accent) => ({
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: `${accent}1F`,
    border: `1px solid ${accent}44`,
    color: accent,
    fontSize: 11,
    fontWeight: 950,
});

const progressLine = {
    display: "flex",
    alignItems: "center",
    gap: 8,
};

const progressTrack = {
    width: 100,
    height: 7,
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    overflow: "hidden",
};

const progressFill = (accent, value) => ({
    height: "100%",
    width: `${Math.max(0, Math.min(100, value))}%`,
    background: accent,
    borderRadius: 999,
});

const empty = {
    padding: 28,
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
};

const emptyDetail = {
    padding: 28,
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 800,
    borderRadius: 20,
    background: "rgba(255,255,255,.035)",
    border: "1px dashed rgba(255,255,255,.12)",
};

const detailHero = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: 16,
    borderRadius: 22,
    background:
        "radial-gradient(circle at top right, rgba(59,130,246,.16), transparent 38%), rgba(15,23,42,.72)",
    border: "1px solid rgba(255,255,255,.08)",
    marginBottom: 14,
};

const detailEyebrow = {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".14em",
};

const detailTitle = {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-.03em",
};

const detailMeta = {
    marginTop: 7,
    fontSize: 12,
    color: "rgba(255,255,255,.60)",
    fontWeight: 700,
};

const detailRight = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
};

const bigPercent = {
    fontSize: 34,
    fontWeight: 950,
    lineHeight: 1,
};

const tabBar = {
    display: "flex",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
};

const tabBtn = (active) => ({
    height: 36,
    padding: "0 14px",
    borderRadius: 999,
    border: active
        ? "1px solid rgba(96,165,250,.44)"
        : "1px solid rgba(255,255,255,.08)",
    background: active
        ? "linear-gradient(135deg,#2563eb,#3b82f6)"
        : "rgba(255,255,255,.045)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
});

const detailSummaryGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(135px,1fr))",
    gap: 10,
    marginBottom: 14,
};

const metricBox = (accent) => ({
    padding: 13,
    borderRadius: 17,
    background:
        `radial-gradient(circle at top right, ${accent}20, transparent 42%), rgba(255,255,255,.035)`,
    border: `1px solid ${accent}30`,
});

const metricLabel = {
    color: "rgba(255,255,255,.50)",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: ".06em",
};

const metricValue = {
    marginTop: 7,
    color: "#fff",
    fontSize: 23,
    fontWeight: 950,
};

const timelineGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
};

const infoLine = {
    padding: 12,
    borderRadius: 15,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.06)",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 11,
    color: "rgba(255,255,255,.50)",
    fontWeight: 800,
};

const exceptionBanner = {
    marginTop: 14,
    padding: 13,
    borderRadius: 16,
    background: "rgba(249,115,22,.11)",
    border: "1px solid rgba(249,115,22,.25)",
    color: "#fdba74",
    fontWeight: 800,
};

const packetCard = {
    marginBottom: 12,
    borderRadius: 20,
    background: "rgba(255,255,255,.035)",
    border: "1px solid rgba(255,255,255,.08)",
    overflow: "hidden",
};

const packetHeader = {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 14,
    border: "none",
    background: "transparent",
    color: "#fff",
    textAlign: "left",
    cursor: "pointer",
};

const packetTitle = {
    fontSize: 15,
    fontWeight: 950,
};

const packetMeta = {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(255,255,255,.58)",
    fontWeight: 750,
};

const packetStats = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    fontSize: 11,
    color: "rgba(255,255,255,.62)",
    fontWeight: 850,
};

const packetTableWrap = {
    overflow: "auto",
    borderTop: "1px solid rgba(255,255,255,.08)",
};

const packetTable = {
    width: "100%",
    minWidth: 1050,
    borderCollapse: "collapse",
    fontSize: 12,
};

const packetTh = {
    textAlign: "left",
    padding: "11px 12px",
    background: "rgba(2,6,23,.55)",
    color: "#94a3b8",
    fontWeight: 950,
    borderBottom: "1px solid rgba(255,255,255,.07)",
};

const packetTd = {
    padding: "11px 12px",
    borderBottom: "1px solid rgba(255,255,255,.05)",
    verticalAlign: "top",
    color: "rgba(255,255,255,.82)",
};

const cellMain = {
    fontWeight: 900,
    color: "#fff",
};

const cellSub = {
    marginTop: 4,
    fontSize: 10,
    color: "rgba(255,255,255,.48)",
    fontWeight: 700,
};

const challanGrid = {
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(280px,1fr))",
    gap: 12,
};

const challanCard = {
    padding: 14,
    borderRadius: 18,
    background: "rgba(139,92,246,.09)",
    border: "1px solid rgba(139,92,246,.25)",
};

const challanNo = {
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: 950,
    color: "#ddd6fe",
};

const challanMeta = {
    marginTop: 7,
    fontSize: 11,
    color: "rgba(255,255,255,.62)",
    fontWeight: 700,
};

const docBtn = (accent) => ({
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${accent}55`,
    background: `${accent}1F`,
    color: accent,
    fontSize: 10,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",

    "&:disabled": {
        opacity: 0.4,
        cursor: "not-allowed",
    },
});
const challanActions = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 8,
};

const overviewDocPanel = {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    background: "rgba(139,92,246,.08)",
    border: "1px solid rgba(139,92,246,.22)",
};

const overviewDocList = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
};

const overviewDocRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 15,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(255,255,255,.07)",
};

const overviewDocsGrid = {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns:
        "repeat(auto-fit,minmax(280px,1fr))",
    gap: 12,
    alignItems: "start",
};


const overviewDocTitle = {
    fontSize: 14,
    fontWeight: 950,
    color: "#fff",
    marginBottom: 10,
};

const overviewDocScroll = {
    maxHeight: 230,
    overflowY: "auto",
    paddingRight: 4,
    display: "flex",
    flexDirection: "column",
    gap: 10,
};

const overviewDocInfo = {
    minWidth: 0,
};

const overviewDocNo = {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: 950,
    color: "#ddd6fe",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const overviewDocMeta = {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,.58)",
    fontWeight: 750,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const docActions = {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    justifyContent: "flex-end",
};

export default MasterItemsModal;