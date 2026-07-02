import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    View,
    Text,
    FlatList,
    ActivityIndicator,
    Alert,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Modal,
    ScrollView,
} from "react-native";

import {
    safeOpenChallanPdf,
} from "../api/challanDownloadApi";

import {
    useFocusEffect,
} from "@react-navigation/native";

import {
    fetchTripItems,
} from "../api/logisticsApi";

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function normalizeStatus(value) {
    return String(value || "")
        .trim()
        .toUpperCase();
}

function formatStatus(value) {
    const text =
        String(value || "").trim();

    if (!text || text === "ALL") {
        return "All";
    }

    return text.replace(/_/g, " ");
}

function cleanValue(value) {
    const text =
        String(value || "").trim();

    return text || "—";
}

function getItemName(item) {
    return (
        item.name ||
        item.itemName ||
        item.item_name ||
        "Unnamed Item"
    );
}

function getItemStatus(item) {
    return normalizeStatus(
        item.status ||
        item.dispatchStatus ||
        "DISPATCHED"
    );
}

function getItemPlant(item) {
    return String(
        item.plantCode ||
        item.plant ||
        ""
    ).trim();
}

function getItemLocation(item) {
    return (
        item.currentLocationCode ||
        item.location ||
        item.warehouseCode ||
        item.fgZoneCode ||
        "—"
    );
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const raw =
        String(value).trim();

    if (!raw) {
        return "—";
    }

    try {
        const hasTimezone =
            /z$/i.test(raw) ||
            /[+-]\d{2}:\d{2}$/.test(raw);

        let date;

        if (!hasTimezone && raw.includes("T")) {
            const match =
                raw.match(
                    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
                );

            if (!match) {
                return raw;
            }

            date =
                new Date(
                    Number(match[1]),
                    Number(match[2]) - 1,
                    Number(match[3]),
                    Number(match[4]),
                    Number(match[5]),
                    Number(match[6] || 0)
                );
        } else {
            date =
                new Date(raw);
        }

        if (Number.isNaN(date.getTime())) {
            return raw;
        }

        return new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        }).format(date);
    } catch {
        return raw;
    }
}

function getSearchBlob(item) {
    return [
        item.name,
        item.itemName,
        item.sku,
        item.pdNo,
        item.drawingNo,
        item.dwgNo,
        item.clientName,
        item.clientAddress,
        item.description,
        item.remarks,
        item.packetItemId,
        item.zohoItemId,
        item.plantCode,
        item.currentLocationCode,
        item.location,
        item.status,
    ]
        .map(normalizeText)
        .join(" ");
}

export default function TripItemScreen({
    route,
}) {
    const trip =
        route?.params?.trip || null;

    const challanNumber =
        trip?.challanNumber || "";

    const [loading, setLoading] =
        useState(false);

    const [refreshing, setRefreshing] =
        useState(false);

    const [items, setItems] =
        useState([]);

    const [search, setSearch] =
        useState("");

    const [filterOpen, setFilterOpen] =
        useState(false);

    const [itemNameFilter, setItemNameFilter] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("ALL");

    const [plantFilter, setPlantFilter] =
        useState("ALL");

    const [locationFilter, setLocationFilter] =
        useState("ALL");

    const [pageNo, setPageNo] =
        useState(1);

    const [pageSize, setPageSize] =
        useState(10);

    const loadItems = async () => {
        if (!challanNumber) {
            Alert.alert(
                "Dispatch missing",
                "Dispatch challan number not found"
            );

            return;
        }

        try {
            setLoading(true);

            const data =
                await fetchTripItems(challanNumber);

            setItems(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (e) {
            console.error(e);

            Alert.alert(
                "Items failed",
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Failed to load dispatch items"
            );
        } finally {
            setLoading(false);
        }
    };

    const refresh = async () => {
        if (!challanNumber) {
            return;
        }

        try {
            setRefreshing(true);

            const data =
                await fetchTripItems(challanNumber);

            setItems(
                Array.isArray(data)
                    ? data
                    : []
            );
        } catch (e) {
            Alert.alert(
                "Refresh failed",
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Failed to refresh items"
            );
        } finally {
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadItems();
        }, [challanNumber])
    );

    const statusOptions =
        useMemo(() => {
            const values =
                items
                    .map(getItemStatus)
                    .filter(Boolean);

            return [
                "ALL",
                ...Array.from(new Set(values)).sort(),
            ];
        }, [items]);

    const plantOptions =
        useMemo(() => {
            const values =
                items
                    .map(getItemPlant)
                    .filter(Boolean);

            return [
                "ALL",
                ...Array.from(new Set(values)).sort(),
            ];
        }, [items]);

    const locationOptions =
        useMemo(() => {
            const values =
                items
                    .map(getItemLocation)
                    .filter((x) => x && x !== "—");

            return [
                "ALL",
                ...Array.from(new Set(values)).sort(),
            ];
        }, [items]);

    const filteredItems =
        useMemo(() => {
            const query =
                normalizeText(search);

            const nameQuery =
                normalizeText(itemNameFilter);

            return items.filter((item) => {
                const itemName =
                    normalizeText(
                        getItemName(item)
                    );

                const clientName =
                    normalizeText(
                        item.clientName
                    );

                const itemStatus =
                    getItemStatus(item);

                const itemPlant =
                    getItemPlant(item);

                const itemLocation =
                    getItemLocation(item);

                const matchesSearch =
                    !query ||
                    getSearchBlob(item).includes(query);

                const matchesName =
                    !nameQuery ||
                    itemName.includes(nameQuery) ||
                    clientName.includes(nameQuery);

                const matchesStatus =
                    statusFilter === "ALL" ||
                    itemStatus === statusFilter;

                const matchesPlant =
                    plantFilter === "ALL" ||
                    itemPlant === plantFilter;

                const matchesLocation =
                    locationFilter === "ALL" ||
                    itemLocation === locationFilter;

                return (
                    matchesSearch &&
                    matchesName &&
                    matchesStatus &&
                    matchesPlant &&
                    matchesLocation
                );
            });
        }, [
            items,
            search,
            itemNameFilter,
            statusFilter,
            plantFilter,
            locationFilter,
        ]);

    const totalPages =
        useMemo(
            () =>
                Math.max(
                    1,
                    Math.ceil(filteredItems.length / pageSize)
                ),
            [filteredItems.length, pageSize]
        );

    const currentPage =
        Math.min(pageNo, totalPages);

    const paginatedItems =
        useMemo(
            () =>
                filteredItems.slice(
                    (currentPage - 1) * pageSize,
                    currentPage * pageSize
                ),
            [filteredItems, currentPage, pageSize]
        );

    useEffect(() => {
        setPageNo(1);
    }, [
        search,
        itemNameFilter,
        statusFilter,
        plantFilter,
        locationFilter,
        pageSize,
    ]);

    useEffect(() => {
        if (pageNo > totalPages) {
            setPageNo(totalPages);
        }
    }, [pageNo, totalPages]);

    const uniqueClients =
        useMemo(() => {
            const values =
                filteredItems
                    .map((item) =>
                        String(item.clientName || "").trim()
                    )
                    .filter(Boolean);

            return Array.from(new Set(values)).length;
        }, [filteredItems]);

    const uniquePlants =
        useMemo(() => {
            const values =
                filteredItems
                    .map(getItemPlant)
                    .filter(Boolean);

            return Array.from(new Set(values)).length;
        }, [filteredItems]);

    const filterCount =
        [
            itemNameFilter.trim(),
            statusFilter !== "ALL",
            plantFilter !== "ALL",
            locationFilter !== "ALL",
        ].filter(Boolean).length;

    const hasAnyFilter =
        Boolean(search.trim()) ||
        filterCount > 0;

    const clearFilters = () => {
        setSearch("");
        setItemNameFilter("");
        setStatusFilter("ALL");
        setPlantFilter("ALL");
        setLocationFilter("ALL");
    };

    const driverName =
        trip?.driver?.name ||
        trip?.driverName ||
        "—";

    const vehicleNo =
        trip?.vehicle?.vehicleNumber ||
        trip?.vehicleNumber ||
        "—";

    if (loading && items.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />

                <Text style={styles.loadingText}>
                    Loading dispatch items...
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.page}>
            <FlatList
                data={paginatedItems}
                keyExtractor={(item, index) =>
                    item.id ||
                    item.zohoItemId ||
                    item.packetItemId ||
                    String(index)
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refresh}
                        tintColor="#fff"
                    />
                }
                ListHeaderComponent={
                    <View>
                        <View style={styles.tripCard}>
                            <View style={styles.tripHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.challan}>
                                        {challanNumber || "—"}
                                    </Text>

                                    <Text style={styles.meta}>
                                        {driverName} • {vehicleNo}
                                    </Text>
                                </View>

                                <View style={styles.doneBadge}>
                                    <Text style={styles.doneText}>
                                        DISPATCHED
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.summaryRow}>
                                <Info
                                    label="Items"
                                    value={String(
                                        trip?.totalItems ||
                                        items.length ||
                                        0
                                    )}
                                />

                                <Info
                                    label="Dispatch"
                                    value={formatDateTime(
                                        trip?.dispatchedAt
                                    )}
                                />

                                <Info
                                    label="Trip Status"
                                    value={
                                        trip?.tripStatus ||
                                        "RUNNING"
                                    }
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.openChallanBtn}
                                onPress={() =>
                                    safeOpenChallanPdf(
                                        challanNumber
                                    )
                                }
                            >
                                <Text style={styles.openChallanText}>
                                    Open Challan PDF
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>
                            Dispatch Items
                        </Text>

                        <View style={styles.searchBox}>
                            <Text style={styles.searchIcon}>
                                🔍
                            </Text>

                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search item, client, SKU, PD, DWG..."
                                placeholderTextColor="#64748b"
                                style={styles.searchInput}
                                autoCapitalize="none"
                            />

                            {search ? (
                                <TouchableOpacity
                                    onPress={() =>
                                        setSearch("")
                                    }
                                    style={styles.searchClear}
                                >
                                    <Text style={styles.searchClearText}>
                                        ×
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity
                                style={[
                                    styles.filterOpenBtn,
                                    filterCount > 0
                                        ? styles.filterOpenBtnActive
                                        : null,
                                ]}
                                onPress={() =>
                                    setFilterOpen(true)
                                }
                            >
                                <Text
                                    style={[
                                        styles.filterOpenText,
                                        filterCount > 0
                                            ? styles.filterOpenTextActive
                                            : null,
                                    ]}
                                >
                                    ⚙
                                </Text>

                                {filterCount > 0 ? (
                                    <View style={styles.filterCountBadge}>
                                        <Text style={styles.filterCountText}>
                                            {filterCount}
                                        </Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        </View>

                        <ActiveFilterStrip
                            search={search}
                            itemNameFilter={itemNameFilter}
                            statusFilter={statusFilter}
                            plantFilter={plantFilter}
                            locationFilter={locationFilter}
                            hasAnyFilter={hasAnyFilter}
                            onClear={clearFilters}
                        />

                        <CompactStats
                            showing={filteredItems.length}
                            total={items.length}
                            clients={uniqueClients}
                            plants={uniquePlants}
                            filtersOn={hasAnyFilter}
                        />

                        <PaginationBar
                            pageNo={currentPage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            setPageNo={setPageNo}
                            setPageSize={setPageSize}
                            totalItems={filteredItems.length}
                        />
                    </View>
                }
                contentContainerStyle={{
                    paddingBottom: 28,
                }}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            No items found for this dispatch.
                        </Text>
                    </View>
                }
                renderItem={({ item, index }) => (
                    <ItemCard
                        item={item}
                        index={
                            (currentPage - 1) * pageSize + index
                        }
                    />
                )}
            />

            <FilterSheet
                visible={filterOpen}
                onClose={() =>
                    setFilterOpen(false)
                }
                itemNameFilter={itemNameFilter}
                setItemNameFilter={setItemNameFilter}
                statusOptions={statusOptions}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                plantOptions={plantOptions}
                plantFilter={plantFilter}
                setPlantFilter={setPlantFilter}
                locationOptions={locationOptions}
                locationFilter={locationFilter}
                setLocationFilter={setLocationFilter}
                clearFilters={clearFilters}
            />
        </View>
    );
}

function ActiveFilterStrip({
    search,
    itemNameFilter,
    statusFilter,
    plantFilter,
    locationFilter,
    hasAnyFilter,
    onClear,
}) {
    if (!hasAnyFilter) {
        return null;
    }

    const chips = [];

    if (search.trim()) {
        chips.push(`Search: ${search.trim()}`);
    }

    if (itemNameFilter.trim()) {
        chips.push(`Name: ${itemNameFilter.trim()}`);
    }

    if (statusFilter !== "ALL") {
        chips.push(formatStatus(statusFilter));
    }

    if (plantFilter !== "ALL") {
        chips.push(`Plant: ${plantFilter}`);
    }

    if (locationFilter !== "ALL") {
        chips.push(`Location: ${locationFilter}`);
    }

    return (
        <View style={styles.activeStripWrap}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeStrip}
            >
                {chips.map((chip, index) => (
                    <View
                        key={`${chip}-${index}`}
                        style={styles.activeChip}
                    >
                        <Text
                            style={styles.activeChipText}
                            numberOfLines={1}
                        >
                            {chip}
                        </Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.activeClearBtn}
                    onPress={onClear}
                >
                    <Text style={styles.activeClearText}>
                        Clear
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

function CompactStats({
    showing,
    total,
    clients,
    plants,
    filtersOn,
}) {
    return (
        <View style={styles.statsGrid}>
            <MiniStat
                label="Showing"
                value={showing}
            />

            <MiniStat
                label="Total"
                value={total}
            />

            <MiniStat
                label="Clients"
                value={clients}
            />

            <MiniStat
                label="Plants"
                value={plants}
            />

            <MiniStat
                label="Filters"
                value={filtersOn ? "ON" : "OFF"}
                active={filtersOn}
            />
        </View>
    );
}

function MiniStat({
    label,
    value,
    active,
}) {
    return (
        <View
            style={[
                styles.miniStat,
                active
                    ? styles.miniStatActive
                    : null,
            ]}
        >
            <Text style={styles.miniStatValue}>
                {value}
            </Text>

            <Text style={styles.miniStatLabel}>
                {label}
            </Text>
        </View>
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
    return (
        <View style={styles.paginationBox}>
            <View style={styles.paginationTop}>
                <Text style={styles.paginationText}>
                    Page {pageNo}/{totalPages}
                </Text>

                <Text style={styles.paginationSubText}>
                    {totalItems} items
                </Text>
            </View>

            <View style={styles.paginationRow}>
                <View style={styles.pageSizes}>
                    {[10, 25, 50].map((size) => (
                        <TouchableOpacity
                            key={size}
                            style={[
                                styles.pageSizeBtn,
                                pageSize === size
                                    ? styles.pageSizeBtnActive
                                    : null,
                            ]}
                            onPress={() => {
                                setPageSize(size);
                                setPageNo(1);
                            }}
                        >
                            <Text
                                style={[
                                    styles.pageSizeText,
                                    pageSize === size
                                        ? styles.pageSizeTextActive
                                        : null,
                                ]}
                            >
                                {size}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.pageNav}>
                    <TouchableOpacity
                        disabled={pageNo <= 1}
                        style={[
                            styles.pageBtn,
                            pageNo <= 1
                                ? styles.pageBtnDisabled
                                : null,
                        ]}
                        onPress={() =>
                            setPageNo((prev) =>
                                Math.max(1, prev - 1)
                            )
                        }
                    >
                        <Text style={styles.pageBtnText}>
                            ‹
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        disabled={pageNo >= totalPages}
                        style={[
                            styles.pageBtn,
                            pageNo >= totalPages
                                ? styles.pageBtnDisabled
                                : null,
                        ]}
                        onPress={() =>
                            setPageNo((prev) =>
                                Math.min(totalPages, prev + 1)
                            )
                        }
                    >
                        <Text style={styles.pageBtnText}>
                            ›
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

function FilterSheet({
    visible,
    onClose,
    itemNameFilter,
    setItemNameFilter,
    statusOptions,
    statusFilter,
    setStatusFilter,
    plantOptions,
    plantFilter,
    setPlantFilter,
    locationOptions,
    locationFilter,
    setLocationFilter,
    clearFilters,
}) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <View style={styles.filterSheet}>
                    <View style={styles.filterHeader}>
                        <View>
                            <Text style={styles.filterSheetTitle}>
                                Item Filters
                            </Text>

                            <Text style={styles.filterSheetSub}>
                                Filter dispatch items by name, status, plant and location
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={onClose}
                        >
                            <Text style={styles.modalCloseText}>
                                ×
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingBottom: 12,
                        }}
                    >
                        <View style={styles.sheetField}>
                            <Text style={styles.sheetLabel}>
                                Item / Client Name
                            </Text>

                            <TextInput
                                value={itemNameFilter}
                                onChangeText={setItemNameFilter}
                                placeholder="Type item or client name..."
                                placeholderTextColor="#64748b"
                                style={styles.sheetInput}
                                autoCapitalize="none"
                            />
                        </View>

                        <FilterGroup
                            title="Status"
                            options={statusOptions}
                            selected={statusFilter}
                            onSelect={setStatusFilter}
                        />

                        <FilterGroup
                            title="Plant"
                            options={plantOptions}
                            selected={plantFilter}
                            onSelect={setPlantFilter}
                        />

                        <FilterGroup
                            title="Location"
                            options={locationOptions}
                            selected={locationFilter}
                            onSelect={setLocationFilter}
                        />
                    </ScrollView>

                    <View style={styles.sheetActions}>
                        <TouchableOpacity
                            style={styles.sheetClearBtn}
                            onPress={clearFilters}
                        >
                            <Text style={styles.sheetClearText}>
                                Clear All
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sheetApplyBtn}
                            onPress={onClose}
                        >
                            <Text style={styles.sheetApplyText}>
                                Apply Filters
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function FilterGroup({
    title,
    options,
    selected,
    onSelect,
}) {
    return (
        <View style={styles.filterGroup}>
            <Text style={styles.sheetLabel}>
                {title}
            </Text>

            <View style={styles.filterChipWrap}>
                {options.map((option) => {
                    const active =
                        selected === option;

                    return (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.filterChip,
                                active
                                    ? styles.filterChipActive
                                    : null,
                            ]}
                            onPress={() =>
                                onSelect(option)
                            }
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    active
                                        ? styles.filterChipTextActive
                                        : null,
                                ]}
                                numberOfLines={1}
                            >
                                {formatStatus(option)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

function ItemCard({
    item,
    index,
}) {
    const status =
        getItemStatus(item);

    return (
        <View style={styles.itemCard}>
            <View style={styles.itemTop}>
                <View style={styles.itemNo}>
                    <Text style={styles.itemNoText}>
                        {index + 1}
                    </Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text
                        style={styles.itemName}
                        numberOfLines={2}
                    >
                        {getItemName(item)}
                    </Text>

                    <Text
                        style={styles.itemSub}
                        numberOfLines={1}
                    >
                        SKU: {cleanValue(item.sku)}
                    </Text>
                </View>

                <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>
                        {formatStatus(status)}
                    </Text>
                </View>
            </View>

            <View style={styles.detailGrid}>
                <Detail
                    label="PD No"
                    value={item.pdNo || "—"}
                />

                <Detail
                    label="DWG No"
                    value={
                        item.drawingNo ||
                        item.dwgNo ||
                        "—"
                    }
                />

                <Detail
                    label="Client"
                    value={item.clientName || "—"}
                />

                <Detail
                    label="Plant"
                    value={getItemPlant(item) || "—"}
                />

                <Detail
                    label="Location"
                    value={getItemLocation(item)}
                />

                <Detail
                    label="Packet Item ID"
                    value={
                        item.packetItemId ||
                        item.zohoItemId ||
                        "—"
                    }
                />
            </View>

            <View style={styles.longBox}>
                <Text style={styles.longLabel}>
                    Description
                </Text>

                <Text style={styles.longValue}>
                    {item.description || "—"}
                </Text>
            </View>

            {item.remarks ? (
                <View style={styles.longBox}>
                    <Text style={styles.longLabel}>
                        Remarks
                    </Text>

                    <Text style={styles.longValue}>
                        {item.remarks}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = {
    page: {
        flex: 1,
        backgroundColor: "#020617",
        padding: 16,
    },

    center: {
        flex: 1,
        backgroundColor: "#020617",
        alignItems: "center",
        justifyContent: "center",
    },

    loadingText: {
        color: "#94a3b8",
        marginTop: 12,
        fontWeight: "700",
    },

    tripCard: {
        backgroundColor: "#0f172a",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        marginBottom: 14,
    },

    tripHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 14,
    },

    challan: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "900",
    },

    meta: {
        color: "#94a3b8",
        marginTop: 5,
        fontWeight: "700",
    },

    doneBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(16,185,129,.14)",
    },

    doneText: {
        color: "#6ee7b7",
        fontSize: 10,
        fontWeight: "900",
    },

    summaryRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -4,
    },

    info: {
        width: "33.33%",
        padding: 4,
    },

    infoLabel: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "900",
    },

    infoValue: {
        color: "#e5e7eb",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 3,
    },

    openChallanBtn: {
        minHeight: 42,
        borderRadius: 12,
        backgroundColor: "rgba(251,191,36,.12)",
        borderWidth: 1,
        borderColor: "rgba(251,191,36,.28)",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
    },

    openChallanText: {
        color: "#facc15",
        fontWeight: "900",
        fontSize: 12,
    },

    sectionTitle: {
        color: "#fff",
        fontSize: 19,
        fontWeight: "900",
        marginBottom: 10,
    },

    searchBox: {
        minHeight: 50,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.10)",
        backgroundColor: "rgba(255,255,255,.05)",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        marginBottom: 8,
    },

    searchIcon: {
        fontSize: 17,
        marginRight: 8,
    },

    searchInput: {
        flex: 1,
        color: "#fff",
        fontWeight: "800",
        fontSize: 12,
        minHeight: 48,
    },

    searchClear: {
        width: 27,
        height: 27,
        borderRadius: 999,
        backgroundColor: "rgba(148,163,184,.18)",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 6,
    },

    searchClearText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 18,
        lineHeight: 20,
    },

    filterOpenBtn: {
        width: 38,
        height: 38,
        borderRadius: 13,
        backgroundColor: "rgba(59,130,246,.12)",
        borderWidth: 1,
        borderColor: "rgba(59,130,246,.25)",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
        position: "relative",
    },

    filterOpenBtnActive: {
        backgroundColor: "rgba(16,185,129,.16)",
        borderColor: "rgba(16,185,129,.35)",
    },

    filterOpenText: {
        color: "#93c5fd",
        fontWeight: "900",
        fontSize: 17,
    },

    filterOpenTextActive: {
        color: "#6ee7b7",
    },

    filterCountBadge: {
        position: "absolute",
        top: -6,
        right: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#ef4444",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#020617",
    },

    filterCountText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 10,
    },

    activeStripWrap: {
        marginBottom: 9,
    },

    activeStrip: {
        gap: 7,
        paddingRight: 10,
    },

    activeChip: {
        maxWidth: 180,
        minHeight: 28,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "rgba(16,185,129,.12)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.22)",
        justifyContent: "center",
    },

    activeChipText: {
        color: "#6ee7b7",
        fontWeight: "900",
        fontSize: 10,
    },

    activeClearBtn: {
        minHeight: 28,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: "rgba(239,68,68,.12)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,.24)",
        justifyContent: "center",
    },

    activeClearText: {
        color: "#fca5a5",
        fontWeight: "900",
        fontSize: 10,
    },

    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 10,
    },

    miniStat: {
        width: "31.6%",
        minHeight: 54,
        borderRadius: 14,
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        paddingHorizontal: 10,
        paddingVertical: 8,
        justifyContent: "center",
    },

    miniStatActive: {
        borderColor: "rgba(16,185,129,.32)",
        backgroundColor: "rgba(16,185,129,.08)",
    },

    miniStatValue: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 16,
    },

    miniStatLabel: {
        color: "#94a3b8",
        fontWeight: "800",
        fontSize: 10,
        marginTop: 2,
    },

    paginationBox: {
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        borderRadius: 15,
        padding: 10,
        marginBottom: 12,
    },

    paginationTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },

    paginationText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 12,
    },

    paginationSubText: {
        color: "#94a3b8",
        fontWeight: "800",
        fontSize: 11,
    },

    paginationRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    pageSizes: {
        flexDirection: "row",
        gap: 7,
    },

    pageSizeBtn: {
        minWidth: 38,
        height: 30,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        alignItems: "center",
        justifyContent: "center",
    },

    pageSizeBtnActive: {
        backgroundColor: "rgba(37,99,235,.22)",
        borderColor: "rgba(37,99,235,.48)",
    },

    pageSizeText: {
        color: "#94a3b8",
        fontWeight: "900",
        fontSize: 11,
    },

    pageSizeTextActive: {
        color: "#93c5fd",
    },

    pageNav: {
        flexDirection: "row",
        gap: 8,
    },

    pageBtn: {
        width: 36,
        height: 30,
        borderRadius: 10,
        backgroundColor: "rgba(59,130,246,.18)",
        borderWidth: 1,
        borderColor: "rgba(59,130,246,.28)",
        alignItems: "center",
        justifyContent: "center",
    },

    pageBtnDisabled: {
        opacity: 0.35,
    },

    pageBtnText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 18,
        lineHeight: 20,
    },

    modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,.55)",
    },

    modalBackdrop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },

    filterSheet: {
        maxHeight: "86%",
        backgroundColor: "#020617",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.10)",
        padding: 16,
    },

    filterHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 14,
    },

    filterSheetTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
    },

    filterSheetSub: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 3,
        maxWidth: 285,
        lineHeight: 17,
    },

    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,.07)",
        alignItems: "center",
        justifyContent: "center",
    },

    modalCloseText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 24,
        lineHeight: 26,
    },

    sheetField: {
        marginBottom: 15,
    },

    sheetLabel: {
        color: "#94a3b8",
        fontSize: 11,
        fontWeight: "900",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },

    sheetInput: {
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.10)",
        backgroundColor: "rgba(255,255,255,.05)",
        color: "#fff",
        paddingHorizontal: 13,
        fontWeight: "800",
        fontSize: 13,
    },

    filterGroup: {
        marginBottom: 15,
    },

    filterChipWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },

    filterChip: {
        minHeight: 34,
        maxWidth: "100%",
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        backgroundColor: "rgba(15,23,42,.88)",
        alignItems: "center",
        justifyContent: "center",
    },

    filterChipActive: {
        borderColor: "rgba(37,99,235,.55)",
        backgroundColor: "rgba(37,99,235,.22)",
    },

    filterChipText: {
        color: "#94a3b8",
        fontSize: 10.5,
        fontWeight: "900",
        maxWidth: 220,
    },

    filterChipTextActive: {
        color: "#93c5fd",
    },

    sheetActions: {
        flexDirection: "row",
        gap: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,.08)",
    },

    sheetClearBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: "rgba(239,68,68,.12)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,.28)",
        alignItems: "center",
        justifyContent: "center",
    },

    sheetClearText: {
        color: "#fca5a5",
        fontWeight: "900",
    },

    sheetApplyBtn: {
        flex: 1,
        height: 46,
        borderRadius: 14,
        backgroundColor: "#2563eb",
        alignItems: "center",
        justifyContent: "center",
    },

    sheetApplyText: {
        color: "#fff",
        fontWeight: "900",
    },

    emptyBox: {
        padding: 24,
        borderRadius: 16,
        backgroundColor: "#0f172a",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        alignItems: "center",
    },

    emptyText: {
        color: "#94a3b8",
        fontWeight: "700",
        textAlign: "center",
    },

    itemCard: {
        backgroundColor: "#0f172a",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
    },

    itemTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 14,
    },

    itemNo: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "rgba(59,130,246,.16)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },

    itemNoText: {
        color: "#93c5fd",
        fontWeight: "900",
    },

    itemName: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "900",
    },

    itemSub: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 4,
    },

    statusBadge: {
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "rgba(16,185,129,.14)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.22)",
        marginLeft: 8,
        maxWidth: 130,
    },

    statusBadgeText: {
        color: "#6ee7b7",
        fontSize: 9.5,
        fontWeight: "900",
    },

    detailGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -4,
    },

    detail: {
        width: "50%",
        padding: 4,
    },

    detailLabel: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "900",
    },

    detailValue: {
        color: "#e5e7eb",
        fontSize: 12,
        fontWeight: "700",
        marginTop: 3,
    },

    longBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,.035)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.06)",
    },

    longLabel: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "900",
        marginBottom: 5,
    },

    longValue: {
        color: "#e5e7eb",
        fontSize: 12,
        fontWeight: "700",
        lineHeight: 18,
    },
};