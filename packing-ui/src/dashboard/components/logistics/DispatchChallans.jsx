import {
    useEffect,
    useMemo,
    useRef,
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
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";

import {
    endDispatchChallanTrip,
    fetchDispatchChallanPdf,
    updateDispatchChallanHelpers,
} from "../../api/logisticsApi";

import {
    getCachedDispatchChallanPage,
    invalidateLogisticsResources,
} from "./logisticsReadCache";

import useLogisticsLiveRefresh from "./useLogisticsLiveRefresh";


function hasChallanEndTime(
    challan
) {
    const normalizedValue =
        String(
            challan?.tripEndedAt ?? ""
        )
            .trim()
            .toLowerCase();

    return (
        normalizedValue !== "" &&
        normalizedValue !== "null" &&
        normalizedValue !== "undefined"
    );
}

function hasHelpersLoaders(
    challan
) {
    const count =
        Number(
            challan
                ?.helperLoaderCount ?? 0
        );

    return (
        Number.isFinite(count) &&
        count > 0
    );
}


const CHALLAN_DATE_FILTER_MODES = [
    {
        value: "ACTIVITY",
        label: "Relevant Activity",
        description:
            "Uses trip end when available, otherwise the challan or trip-start time.",
    },
    {
        value: "CHALLAN",
        label: "Challan Date / Time",
        description:
            "Filters by the challan dispatch or generation timestamp.",
    },
    {
        value: "TRIP_START",
        label: "Trip Start",
        description:
            "Filters by the recorded trip-start timestamp.",
    },
    {
        value: "TRIP_END",
        label: "Trip End",
        description:
            "Filters only challans having a recorded trip-end timestamp.",
    },
];

function parseChallanDateTime(
    value
) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(
            value.getTime()
        )
            ? null
            : new Date(
                value.getTime()
            );
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
        /[+-]\d{2}:?\d{2}$/.test(
            raw
        );

    if (hasTimezone) {
        const parsed =
            new Date(raw);

        return Number.isNaN(
            parsed.getTime()
        )
            ? null
            : parsed;
    }

    /*
     * Spring LocalDateTime values represent local business time.
     * Construct them using local date parts so the browser does not
     * shift the value as UTC.
     */
    const localMatch =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
        );

    if (localMatch) {
        const milliseconds =
            Number(
                String(
                    localMatch[7] || "0"
                )
                    .slice(0, 3)
                    .padEnd(3, "0")
            );

        const parsed =
            new Date(
                Number(localMatch[1]),
                Number(localMatch[2]) - 1,
                Number(localMatch[3]),
                Number(localMatch[4] || 0),
                Number(localMatch[5] || 0),
                Number(localMatch[6] || 0),
                milliseconds
            );

        return Number.isNaN(
            parsed.getTime()
        )
            ? null
            : parsed;
    }

    const fallback =
        new Date(raw);

    return Number.isNaN(
        fallback.getTime()
    )
        ? null
        : fallback;
}

function getChallanDateInfo(
    challan,
    mode = "ACTIVITY"
) {
    const cleanMode =
        String(mode || "ACTIVITY")
            .trim()
            .toUpperCase();

    const candidatesByMode = {
        CHALLAN: [
            ["dispatchedAt", "Challan / Dispatch"],
            ["dispatchDate", "Challan / Dispatch"],
            ["generatedAt", "Generated"],
            ["tripStartedAt", "Trip Started"],
            ["createdAt", "Created"],
        ],

        TRIP_START: [
            ["tripStartedAt", "Trip Started"],
            ["dispatchedAt", "Challan / Dispatch"],
        ],

        TRIP_END: [
            ["tripEndedAt", "Trip Ended"],
        ],
    };

    let candidates;

    if (cleanMode === "ACTIVITY") {
        const hasEndTime =
            Boolean(
                parseChallanDateTime(
                    challan?.tripEndedAt
                )
            );

        candidates =
            hasEndTime
                ? [
                    ["tripEndedAt", "Trip Ended"],
                    ["dispatchedAt", "Challan / Dispatch"],
                    ["tripStartedAt", "Trip Started"],
                    ["generatedAt", "Generated"],
                    ["createdAt", "Created"],
                ]
                : [
                    ["dispatchedAt", "Challan / Dispatch"],
                    ["tripStartedAt", "Trip Started"],
                    ["generatedAt", "Generated"],
                    ["createdAt", "Created"],
                    ["updatedAt", "Updated"],
                ];
    } else {
        candidates =
            candidatesByMode[
            cleanMode
            ] ||
            candidatesByMode.CHALLAN;
    }

    for (
        const [
            field,
            label,
        ] of candidates
    ) {
        const rawValue =
            challan?.[field];

        const date =
            parseChallanDateTime(
                rawValue
            );

        if (date) {
            return {
                field,
                label,
                rawValue,
                date,
            };
        }
    }

    return {
        field: "",
        label:
            cleanMode === "TRIP_END"
                ? "No Trip End"
                : cleanMode === "TRIP_START"
                    ? "No Trip Start"
                    : "No Date",
        rawValue: null,
        date: null,
    };
}

function toChallanDateInputValue(
    value
) {
    const date =
        value instanceof Date
            ? value
            : parseChallanDateTime(
                value
            );

    if (!date) {
        return "";
    }

    const pad = (number) =>
        String(number)
            .padStart(2, "0");

    return [
        date.getFullYear(),
        "-",
        pad(
            date.getMonth() + 1
        ),
        "-",
        pad(date.getDate()),
    ].join("");
}

function getChallanTimeMinutes(
    value
) {
    if (!value) {
        return null;
    }

    const [
        hour,
        minute,
    ] =
        String(value)
            .split(":")
            .map(Number);

    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute)
    ) {
        return null;
    }

    return (
        hour * 60 +
        minute
    );
}

function hasChallanDateFilter({
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
}) {
    return Boolean(
        dateFrom ||
        dateTo ||
        timeFrom ||
        timeTo
    );
}

function challanMatchesDateFilter(
    challan,
    {
        mode,
        dateFrom,
        dateTo,
        timeFrom,
        timeTo,
    }
) {
    if (
        !hasChallanDateFilter({
            dateFrom,
            dateTo,
            timeFrom,
            timeTo,
        })
    ) {
        return true;
    }

    const dateInfo =
        getChallanDateInfo(
            challan,
            mode
        );

    if (!dateInfo.date) {
        return false;
    }

    const rowDateKey =
        toChallanDateInputValue(
            dateInfo.date
        );

    if (
        dateFrom &&
        rowDateKey < dateFrom
    ) {
        return false;
    }

    if (
        dateTo &&
        rowDateKey > dateTo
    ) {
        return false;
    }

    const rowMinutes =
        dateInfo.date.getHours() *
        60 +
        dateInfo.date.getMinutes();

    const fromMinutes =
        getChallanTimeMinutes(
            timeFrom
        );

    const toMinutes =
        getChallanTimeMinutes(
            timeTo
        );

    if (
        fromMinutes !== null &&
        toMinutes !== null &&
        fromMinutes > toMinutes
    ) {
        /*
         * Overnight range, for example 10:00 PM to 06:00 AM.
         */
        return (
            rowMinutes >=
            fromMinutes ||
            rowMinutes <=
            toMinutes
        );
    }

    if (
        fromMinutes !== null &&
        rowMinutes < fromMinutes
    ) {
        return false;
    }

    if (
        toMinutes !== null &&
        rowMinutes > toMinutes
    ) {
        return false;
    }

    return true;
}

function getChallanDateFilterModeLabel(
    mode
) {
    return (
        CHALLAN_DATE_FILTER_MODES
            .find(
                (option) =>
                    option.value ===
                    mode
            )
            ?.label ||
        "Relevant Activity"
    );
}

function getChallanDateFilterSummary({
    mode,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
}) {
    if (
        !hasChallanDateFilter({
            dateFrom,
            dateTo,
            timeFrom,
            timeTo,
        })
    ) {
        return "Date / Time";
    }

    const modeLabel =
        getChallanDateFilterModeLabel(
            mode
        );

    const dateText =
        dateFrom && dateTo
            ? dateFrom === dateTo
                ? dateFrom
                : `${dateFrom} → ${dateTo}`
            : dateFrom
                ? `From ${dateFrom}`
                : dateTo
                    ? `Until ${dateTo}`
                    : "All Dates";

    const timeText =
        timeFrom || timeTo
            ? `${timeFrom || "00:00"} – ${timeTo || "23:59"}`
            : "";

    return [
        modeLabel,
        dateText,
        timeText,
    ]
        .filter(Boolean)
        .join(" • ");
}

const SERVER_CHALLAN_PAGE_SIZE = 50;

function DispatchChallans({
    showAlert,
    liveRefreshToken = null,
    cacheScope = "",
}) {
    const [rows, setRows] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [loadingOlder, setLoadingOlder] =
        useState(false);

    const [serverPage, setServerPage] =
        useState(0);

    const [serverTotal, setServerTotal] =
        useState(0);

    const [serverHasNext, setServerHasNext] =
        useState(false);

    const [search, setSearch] =
        useState("");

    const [dateFilterOpen, setDateFilterOpen] =
        useState(false);

    const [dateFilterMode, setDateFilterMode] =
        useState("ACTIVITY");

    const [dateFilterFrom, setDateFilterFrom] =
        useState("");

    const [dateFilterTo, setDateFilterTo] =
        useState("");

    const [dateFilterTimeFrom, setDateFilterTimeFrom] =
        useState("");

    const [dateFilterTimeTo, setDateFilterTimeTo] =
        useState("");

    const [endTimeFilter, setEndTimeFilter] =
        useState("ALL");

    const [expanded, setExpanded] =
        useState("");

    const [pageNo, setPageNo] =
        useState(1);

    const [pageSize, setPageSize] =
        useState(10);

    const [endTripDialog, setEndTripDialog] =
        useState({
            open: false,
            challanNumber: "",
            endTime: getNowDateTimeLocal(),
        });

    const [
        helperFilter,
        setHelperFilter,
    ] = useState("ALL");

    const [
        helperDialog,
        setHelperDialog,
    ] = useState({
        open: false,
        challanNumber: "",
        helperLoaderCount: "",
    });

    const [
        savingHelpers,
        setSavingHelpers,
    ] = useState(false);

    const [endingTrip, setEndingTrip] =
        useState(false);

    const [pdfPreview, setPdfPreview] =
        useState({
            open: false,
            url: "",
            challanNumber: "",
        });

    const firstPageKeysRef =
        useRef(new Set());

    const canManageTripEnd =
        true;

    async function loadData({
        background = false,
        force = false,
    } = {}) {
        try {
            if (!background) {
                setLoading(true);
            }

            const result =
                await getCachedDispatchChallanPage(cacheScope, {
                    page: 0,
                    size: SERVER_CHALLAN_PAGE_SIZE,
                    force,
                });

            const freshRows =
                Array.isArray(result?.rows)
                    ? result.rows
                    : [];

            const rowKey = (row) =>
                String(
                    row?.challanNumber ||
                    row?.chalaanNumber ||
                    ""
                ).trim();

            const freshKeys =
                new Set(
                    freshRows
                        .map(rowKey)
                        .filter(Boolean)
                );

            setRows((current) => {
                if (!background || serverPage <= 0) {
                    return freshRows;
                }

                const previousFirstPageKeys =
                    firstPageKeysRef.current;

                const olderRows =
                    (current || []).filter((row) => {
                        const key = rowKey(row);

                        if (!key) return false;

                        return (
                            !freshKeys.has(key) &&
                            !previousFirstPageKeys.has(key)
                        );
                    });

                return [
                    ...freshRows,
                    ...olderRows,
                ];
            });

            firstPageKeysRef.current =
                freshKeys;

            if (!background) {
                setServerPage(
                    Number(result?.pageNumber || 0)
                );
            }

            setServerTotal(
                Number(result?.totalElements || 0)
            );

            if (!background || serverPage <= 0) {
                setServerHasNext(
                    result?.hasNext === true
                );
            }

            if (!background) {
                setPageNo(1);
            }
        } catch (error) {
            if (!background) {
                setRows([]);
                setServerPage(0);
                setServerTotal(0);
                setServerHasNext(false);

                const message =
                    error?.message ||
                    "Failed to load dispatched challans";

                if (showAlert) {
                    showAlert(
                        message,
                        "error"
                    );
                } else {
                    alert(message);
                }
            }
        } finally {
            if (!background) {
                setLoading(false);
            }
        }
    }

    useLogisticsLiveRefresh(
        liveRefreshToken,
        async () => {
            await loadData({
                background: true,
                force: false,
            });
        }
    );

    async function loadOlderHistory() {
        if (
            loadingOlder ||
            !serverHasNext
        ) {
            return;
        }

        try {
            setLoadingOlder(true);

            const result =
                await getCachedDispatchChallanPage(cacheScope, {
                    page: serverPage + 1,
                    size: SERVER_CHALLAN_PAGE_SIZE,
                    force: false,
                });

            setRows((current) => {
                const merged =
                    new Map();

                (current || []).forEach(
                    (row) => {
                        const key =
                            String(
                                row?.challanNumber ||
                                row?.chalaanNumber ||
                                ""
                            ).trim();

                        if (key) {
                            merged.set(key, row);
                        }
                    }
                );

                (result?.rows || []).forEach(
                    (row) => {
                        const key =
                            String(
                                row?.challanNumber ||
                                row?.chalaanNumber ||
                                ""
                            ).trim();

                        if (key) {
                            merged.set(key, row);
                        }
                    }
                );

                return Array.from(
                    merged.values()
                );
            });

            setServerPage(
                Number(
                    result?.pageNumber ??
                    serverPage + 1
                )
            );

            setServerTotal(
                Number(
                    result?.totalElements ??
                    serverTotal
                )
            );

            setServerHasNext(
                result?.hasNext === true
            );
        } catch (error) {
            console.error(error);

            showAlert?.(
                error?.message ||
                "Unable to load older challan history",
                "error"
            );
        } finally {
            setLoadingOlder(false);
        }
    }

    const openHelperDialog =
        (challan) => {
            setHelperDialog({
                open: true,

                challanNumber:
                    challan
                        ?.challanNumber || "",

                helperLoaderCount:
                    hasHelpersLoaders(challan)
                        ? String(
                            challan
                                .helperLoaderCount
                        )
                        : "",
            });
        };

    const closeHelperDialog =
        () => {
            setHelperDialog({
                open: false,
                challanNumber: "",
                helperLoaderCount: "",
            });
        };

    const submitHelpers =
        async () => {
            if (
                !helperDialog.challanNumber
            ) {
                showAlert?.(
                    "Challan number missing",
                    "error"
                );

                return;
            }

            let helperLoaderCount =
                null;

            if (
                String(
                    helperDialog
                        .helperLoaderCount
                ).trim() !== ""
            ) {
                const parsed =
                    Number(
                        helperDialog
                            .helperLoaderCount
                    );

                if (
                    !Number.isInteger(parsed) ||
                    parsed < 0
                ) {
                    showAlert?.(
                        "Helpers/loaders must be a whole number",
                        "error"
                    );

                    return;
                }

                helperLoaderCount =
                    parsed === 0
                        ? null
                        : parsed;
            }

            try {
                setSavingHelpers(true);

                await updateDispatchChallanHelpers(
                    helperDialog.challanNumber,
                    helperLoaderCount
                );

                showAlert?.(
                    helperLoaderCount
                        ? "Helpers/loaders updated successfully"
                        : "Helpers/loaders cleared successfully",
                    "success"
                );

                closeHelperDialog();

                invalidateLogisticsResources(cacheScope, ["challan-page", "challan-full"]);
            await loadData({ force: true });
            } catch (error) {
                console.error(error);

                showAlert?.(
                    error.message ||
                    "Failed to save helpers/loaders",
                    "error"
                );
            } finally {
                setSavingHelpers(false);
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

    const dateFilterActive =
        hasChallanDateFilter({
            dateFrom:
                dateFilterFrom,
            dateTo:
                dateFilterTo,
            timeFrom:
                dateFilterTimeFrom,
            timeTo:
                dateFilterTimeTo,
        });

    const dateFilterSummary =
        getChallanDateFilterSummary({
            mode:
                dateFilterMode,
            dateFrom:
                dateFilterFrom,
            dateTo:
                dateFilterTo,
            timeFrom:
                dateFilterTimeFrom,
            timeTo:
                dateFilterTimeTo,
        });

    const clearChallanDateFilter =
        () => {
            setDateFilterFrom("");
            setDateFilterTo("");
            setDateFilterTimeFrom("");
            setDateFilterTimeTo("");
            setPageNo(1);
        };

    const applyChallanDatePreset =
        (preset) => {
            const now =
                new Date();

            const start =
                new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );

            const end =
                new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );

            if (
                preset ===
                "YESTERDAY"
            ) {
                start.setDate(
                    start.getDate() - 1
                );

                end.setDate(
                    end.getDate() - 1
                );
            }

            if (
                preset ===
                "LAST_7_DAYS"
            ) {
                start.setDate(
                    start.getDate() - 6
                );
            }

            if (
                preset ===
                "THIS_MONTH"
            ) {
                start.setDate(1);
            }

            setDateFilterFrom(
                toChallanDateInputValue(
                    start
                )
            );

            setDateFilterTo(
                toChallanDateInputValue(
                    end
                )
            );

            setDateFilterTimeFrom("");
            setDateFilterTimeTo("");
            setPageNo(1);
        };

    const updateDateFilterFrom =
        (value) => {
            setDateFilterFrom(value);

            if (
                value &&
                dateFilterTo &&
                value > dateFilterTo
            ) {
                setDateFilterTo(value);
            }

            setPageNo(1);
        };

    const updateDateFilterTo =
        (value) => {
            setDateFilterTo(value);

            if (
                value &&
                dateFilterFrom &&
                value < dateFilterFrom
            ) {
                setDateFilterFrom(value);
            }

            setPageNo(1);
        };

    const filteredRows =
        useMemo(() => {
            const q =
                search
                    .trim()
                    .toLowerCase();

            return rows.filter(
                (challan) => {
                    const hasHelpers =
                        hasHelpersLoaders(
                            challan
                        );

                    const matchesHelperFilter =
                        helperFilter ===
                            "ALL"
                            ? true
                            : helperFilter ===
                                "WITH_HELPERS"
                                ? hasHelpers
                                : !hasHelpers;

                    if (
                        !matchesHelperFilter
                    ) {
                        return false;
                    }

                    const hasEndTime =
                        hasChallanEndTime(
                            challan
                        );

                    const matchesEndTimeFilter =
                        endTimeFilter ===
                            "ALL"
                            ? true
                            : endTimeFilter ===
                                "WITH_END_TIME"
                                ? hasEndTime
                                : !hasEndTime;

                    if (
                        !matchesEndTimeFilter
                    ) {
                        return false;
                    }

                    if (
                        !challanMatchesDateFilter(
                            challan,
                            {
                                mode:
                                    dateFilterMode,
                                dateFrom:
                                    dateFilterFrom,
                                dateTo:
                                    dateFilterTo,
                                timeFrom:
                                    dateFilterTimeFrom,
                                timeTo:
                                    dateFilterTimeTo,
                            }
                        )
                    ) {
                        return false;
                    }

                    if (!q) {
                        return true;
                    }

                    const mainText = [
                        challan
                            .challanNumber,
                        challan
                            .driverName,
                        challan
                            .vehicleNumber,
                        challan
                            .dispatchedBy,
                        challan
                            .tripStatus,
                        challan
                            .tripEndedAt,
                        challan
                            .tripStartedAt,
                        challan
                            .dispatchedAt,
                        challan
                            .generatedAt,
                        challan
                            .helperLoaderCount,
                    ]
                        .filter(
                            (value) =>
                                value !==
                                null &&
                                value !==
                                undefined
                        )
                        .join(" ")
                        .toLowerCase();

                    const itemText =
                        (
                            Array.isArray(
                                challan
                                    .items
                            )
                                ? challan
                                    .items
                                : []
                        )
                            .map(
                                (item) =>
                                    [
                                        item
                                            .name,
                                        item
                                            .sku,
                                        item
                                            .pdNo,
                                        item
                                            .drawingNo,
                                        item
                                            .clientName,
                                        item
                                            .description,
                                        item
                                            .plantCode,
                                        item
                                            .status,
                                    ]
                                        .filter(
                                            Boolean
                                        )
                                        .join(
                                            " "
                                        )
                            )
                            .join(" ")
                            .toLowerCase();

                    return (
                        mainText.includes(
                            q
                        ) ||
                        itemText.includes(
                            q
                        )
                    );
                }
            );
        }, [
            rows,
            search,
            helperFilter,
            endTimeFilter,
            dateFilterMode,
            dateFilterFrom,
            dateFilterTo,
            dateFilterTimeFrom,
            dateFilterTimeTo,
        ]);

    useEffect(() => {
        setPageNo(1);
    }, [
        search,
        endTimeFilter,
        helperFilter,
        dateFilterMode,
        dateFilterFrom,
        dateFilterTo,
        dateFilterTimeFrom,
        dateFilterTimeTo,
        pageSize,
    ]);

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

    function formatDuration(minutes) {
        if (
            minutes === null ||
            minutes === undefined ||
            Number.isNaN(Number(minutes))
        ) {
            return "—";
        }

        const total =
            Math.max(0, Number(minutes));

        const hours =
            Math.floor(total / 60);

        const mins =
            total % 60;

        if (hours <= 0) {
            return `${mins} min`;
        }

        return `${hours} hr ${mins} min`;
    }

    const getChallanPdfBlob =
        async (challanNumber) => {
            if (!challanNumber) {
                throw new Error(
                    "Challan number missing"
                );
            }

            return await fetchDispatchChallanPdf(
                challanNumber
            );
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

    const openEndTripDialog =
        (challan) => {
            const existingEndTime =
                toDateTimeLocalInput(
                    challan.tripEndedAt
                );

            setEndTripDialog({
                open: true,
                challanNumber: challan.challanNumber || "",
                endTime:
                    existingEndTime ||
                    getNowDateTimeLocal(),
            });
        };

    const closeEndTripDialog =
        () => {
            setEndTripDialog({
                open: false,
                challanNumber: "",
                endTime: getNowDateTimeLocal(),
            });
        };

    const submitEndTrip =
        async () => {
            if (!endTripDialog.challanNumber) {
                showAlert?.(
                    "Challan number missing",
                    "error"
                );
                return;
            }

            const finalEndTime =
                toBackendLocalDateTime(
                    endTripDialog.endTime
                );

            if (!finalEndTime) {
                showAlert?.(
                    "Please select end time",
                    "error"
                );
                return;
            }

            try {
                setEndingTrip(true);

                await endDispatchChallanTrip(
                    endTripDialog.challanNumber,
                    finalEndTime
                );

                showAlert?.(
                    "Trip end time saved successfully",
                    "success"
                );

                closeEndTripDialog();

                invalidateLogisticsResources(cacheScope, ["challan-page", "challan-full"]);
            await loadData({ force: true });
            } catch (e) {
                console.error(e);

                showAlert?.(
                    e.message || "Failed to save trip end time",
                    "error"
                );
            } finally {
                setEndingTrip(false);
            }
        };

    return (
        <Box sx={wrap}>
            <Box sx={topRow}>
                <Box>
                    <Box sx={title}>
                        📄 Dispatch Challans
                    </Box>

                    <Box sx={subtitle}>
                        Challan-wise dispatched items with driver, vehicle, PDF access and trip end-time control
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
                    label="Loaded / Total Challans"
                    value={`${rows.length}/${Math.max(
                        serverTotal,
                        rows.length
                    )}`}
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
                        color:
                            "rgba(var(--pf-fg-rgb),.45)",
                        flexShrink: 0,
                    }}
                />

                <TextField
                    variant="standard"
                    placeholder="Search challan, driver, vehicle, item, client, PD no..."
                    value={search}
                    onChange={(e) =>
                        setSearch(
                            e.target.value
                        )
                    }
                    InputProps={{
                        disableUnderline: true,
                    }}
                    sx={{
                        flex: 1,
                        minWidth: 220,

                        "& .MuiInputBase-root": {
                            color: "var(--pf-text-strong)",
                            fontSize: 14,
                            fontWeight: 700,
                        },

                        "& input::placeholder": {
                            color:
                                "rgba(var(--pf-fg-rgb),.42)",
                            opacity: 1,
                        },
                    }}
                />

                <Box sx={searchFilterDivider} />

                <Button
                    startIcon={
                        <CalendarMonthOutlinedIcon />
                    }
                    onClick={() =>
                        setDateFilterOpen(true)
                    }
                    sx={dateFilterButtonSx(
                        dateFilterActive
                    )}
                >
                    <Box
                        sx={{
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            lineHeight: 1.1,
                        }}
                    >
                        <Box
                            sx={{
                                color: "var(--pf-text-strong)",
                                fontSize: 11,
                                fontWeight: 950,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {dateFilterActive
                                ? "Date Filter Active"
                                : "Date / Time"}
                        </Box>

                        <Box
                            sx={{
                                maxWidth: 210,
                                mt: 0.35,
                                color:
                                    dateFilterActive
                                        ? "#2563eb"
                                        : "var(--pf-text-muted)",
                                fontSize: 9.5,
                                fontWeight: 750,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                            title={
                                dateFilterSummary
                            }
                        >
                            {dateFilterSummary}
                        </Box>
                    </Box>
                </Button>

                <Select
                    size="small"
                    value={endTimeFilter}
                    onChange={(e) =>
                        setEndTimeFilter(
                            e.target.value
                        )
                    }
                    renderValue={(value) => {
                        if (value === "ALL") {
                            return "All Challans";
                        }

                        if (value === "WITH_END_TIME") {
                            return "Challans With End Time";
                        }

                        return "Challans Without End Time";
                    }}
                    sx={endTimeFilterSelect}
                    MenuProps={{
                        PaperProps: {
                            sx: {
                                mt: 1,
                                borderRadius: "10px",
                                color: "var(--pf-text-strong)",
                                background: "var(--pf-surface)",
                                border:
                                    "1px solid rgba(var(--pf-fg-rgb),.12)",

                                "& .MuiMenuItem-root": {
                                    fontSize: 13,
                                    fontWeight: 750,
                                },

                                "& .MuiMenuItem-root:hover": {
                                    background:
                                        "rgba(59,130,246,.15)",
                                },

                                "& .Mui-selected": {
                                    background:
                                        "rgba(59,130,246,.22) !important",
                                },
                            },
                        },
                    }}
                >
                    <MenuItem value="ALL">
                        All Challans
                    </MenuItem>

                    <MenuItem value="WITHOUT_END_TIME">
                        Challans Without End Time
                    </MenuItem>

                    <MenuItem value="WITH_END_TIME">
                        Challans With End Time
                    </MenuItem>
                </Select>

                <Select
                    size="small"
                    value={helperFilter}
                    onChange={(e) =>
                        setHelperFilter(
                            e.target.value
                        )
                    }
                    sx={endTimeFilterSelect}
                >
                    <MenuItem value="ALL">
                        All Helper Status
                    </MenuItem>

                    <MenuItem value="WITH_HELPERS">
                        With Helpers / Loaders
                    </MenuItem>

                    <MenuItem value="WITHOUT_HELPERS">
                        No Helpers / Loaders
                    </MenuItem>
                </Select>
            </Box>

            {loading && (
                <Box sx={emptyState}>
                    Loading dispatched challans...
                </Box>
            )}

            {!loading &&
                filteredRows.length === 0 && (
                    <Box sx={emptyState}>
                        {dateFilterActive
                            ? "No challans matched the selected date/time range."
                            : endTimeFilter === "ALL"
                                ? "No dispatched challans were found."
                                : endTimeFilter === "WITH_END_TIME"
                                    ? "No challans with an end time were found."
                                    : "No challans without an end time were found."}
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
                                        Helpers / Loaders:{" "}
                                        <b>
                                            {hasHelpersLoaders(challan)
                                                ? challan.helperLoaderCount
                                                : "—"}
                                        </b>
                                    </Box>

                                    <Box sx={challanMeta}>
                                        Dispatched By:{" "}
                                        <b>
                                            {challan.dispatchedBy || "—"}
                                        </b>
                                        {"  •  "}
                                        Challan Date/Time:{" "}
                                        <b>
                                            {formatDateTime(
                                                getChallanBusinessTime(challan)
                                            )}
                                        </b>
                                    </Box>

                                    <Box sx={challanMeta}>
                                        Trip Start:{" "}
                                        <b>
                                            {formatDateTime(
                                                getTripStartTime(challan)
                                            )}
                                        </b>
                                        {"  •  "}
                                        Trip End:{" "}
                                        <b>
                                            {formatDateTime(
                                                challan.tripEndedAt
                                            )}
                                        </b>
                                        {"  •  "}
                                        Duration:{" "}
                                        <b>
                                            {formatDuration(
                                                challan.tripDurationMinutes
                                            )}
                                        </b>
                                        {"  •  "}
                                        Status:{" "}
                                        <b>
                                            {challan.tripStatus || "RUNNING"}
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

                                    <Button
                                        onClick={() =>
                                            openEndTripDialog(challan)
                                        }
                                        sx={endTimeButton}
                                    >
                                        {challan.tripEndedAt
                                            ? "Edit End Time"
                                            : "Enter End Time"}
                                    </Button>

                                    <Button
                                        onClick={() =>
                                            openHelperDialog(
                                                challan
                                            )
                                        }
                                        sx={helperButton}
                                    >
                                        {hasHelpersLoaders(challan)
                                            ? "Edit Helpers"
                                            : "Enter Helpers"}
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

            {!loading && serverHasNext && (
                <Box sx={olderHistoryBarSx}>
                    <Box sx={olderHistoryTextSx}>
                        Loaded {rows.length} of {Math.max(
                            serverTotal,
                            rows.length
                        )} challans. Search and date filters apply to the history loaded so far.
                    </Box>

                    <Button
                        type="button"
                        onClick={loadOlderHistory}
                        disabled={loadingOlder}
                        sx={olderHistoryButtonSx}
                    >
                        {loadingOlder
                            ? "Loading Older..."
                            : "Load Older History"}
                    </Button>
                </Box>
            )}

            <Dialog
                open={dateFilterOpen}
                onClose={() =>
                    setDateFilterOpen(false)
                }
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: dateFilterDialogPaperSx,
                }}
            >
                <DialogTitle
                    sx={dateFilterDialogTitleSx}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.2,
                            minWidth: 0,
                        }}
                    >
                        <Box sx={dateFilterIconSx}>
                            <CalendarMonthOutlinedIcon />
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                            <Box sx={dateFilterTitleSx}>
                                Date & Time Filter
                            </Box>

                            <Box sx={dateFilterSubtitleSx}>
                                Filter challans by activity, challan, trip-start or trip-end time
                            </Box>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <Chip
                            size="small"
                            label={`${filteredRows.length} matching`}
                            sx={dateFilterCountChipSx}
                        />

                        <IconButton
                            onClick={() =>
                                setDateFilterOpen(false)
                            }
                            sx={dateFilterCloseButtonSx}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>

                <DialogContent sx={dateFilterContentSx}>
                    <Box sx={dateModeSectionSx}>
                        <Box sx={dateModeSectionLabelSx}>
                            Date Basis
                        </Box>

                        <Box sx={dateModeGridSx}>
                            {CHALLAN_DATE_FILTER_MODES.map(
                                (option) => {
                                    const activeMode =
                                        dateFilterMode ===
                                        option.value;

                                    return (
                                        <Button
                                            key={option.value}
                                            type="button"
                                            disableRipple
                                            onClick={() => {
                                                setDateFilterMode(
                                                    option.value
                                                );
                                                setPageNo(1);
                                            }}
                                            sx={dateModeCardSx(
                                                activeMode
                                            )}
                                        >
                                            <Box sx={dateModeCardTextSx}>
                                                <Box sx={dateModeCardTitleSx}>
                                                    {option.label}
                                                </Box>

                                                <Box sx={dateModeCardDescriptionSx}>
                                                    {option.description}
                                                </Box>
                                            </Box>

                                            <Box sx={dateModeCheckSx(activeMode)}>
                                                {activeMode ? "✓" : ""}
                                            </Box>
                                        </Button>
                                    );
                                }
                            )}
                        </Box>
                    </Box>

                    <Box sx={datePresetRowSx}>
                        <Button
                            onClick={() =>
                                applyChallanDatePreset(
                                    "TODAY"
                                )
                            }
                            sx={datePresetButtonSx}
                        >
                            Today
                        </Button>

                        <Button
                            onClick={() =>
                                applyChallanDatePreset(
                                    "YESTERDAY"
                                )
                            }
                            sx={datePresetButtonSx}
                        >
                            Yesterday
                        </Button>

                        <Button
                            onClick={() =>
                                applyChallanDatePreset(
                                    "LAST_7_DAYS"
                                )
                            }
                            sx={datePresetButtonSx}
                        >
                            Last 7 Days
                        </Button>

                        <Button
                            onClick={() =>
                                applyChallanDatePreset(
                                    "THIS_MONTH"
                                )
                            }
                            sx={datePresetButtonSx}
                        >
                            This Month
                        </Button>
                    </Box>

                    <Box sx={dateFilterGridSx}>
                        <TextField
                            label="From Date"
                            type="date"
                            value={dateFilterFrom}
                            onChange={(event) =>
                                updateDateFilterFrom(
                                    event.target.value
                                )
                            }
                            InputLabelProps={{
                                shrink: true,
                            }}
                            sx={dateFilterFieldSx}
                        />

                        <TextField
                            label="To Date"
                            type="date"
                            value={dateFilterTo}
                            onChange={(event) =>
                                updateDateFilterTo(
                                    event.target.value
                                )
                            }
                            InputLabelProps={{
                                shrink: true,
                            }}
                            sx={dateFilterFieldSx}
                        />
                    </Box>

                    <Box sx={dateFilterGridSx}>
                        <TextField
                            label="From Time"
                            type="time"
                            value={dateFilterTimeFrom}
                            onChange={(event) => {
                                setDateFilterTimeFrom(
                                    event.target.value
                                );
                                setPageNo(1);
                            }}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            InputProps={{
                                startAdornment: (
                                    <AccessTimeOutlinedIcon
                                        sx={dateTimeAdornmentSx}
                                    />
                                ),
                            }}
                            sx={dateFilterFieldSx}
                        />

                        <TextField
                            label="To Time"
                            type="time"
                            value={dateFilterTimeTo}
                            onChange={(event) => {
                                setDateFilterTimeTo(
                                    event.target.value
                                );
                                setPageNo(1);
                            }}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            InputProps={{
                                startAdornment: (
                                    <AccessTimeOutlinedIcon
                                        sx={dateTimeAdornmentSx}
                                    />
                                ),
                            }}
                            sx={dateFilterFieldSx}
                        />
                    </Box>

                    <Box sx={dateFilterHintSx}>
                        <EventAvailableOutlinedIcon
                            sx={{
                                fontSize: 18,
                                color: "#059669",
                                flexShrink: 0,
                            }}
                        />

                        <Box>
                            <Box
                                sx={{
                                    color: "#d1fae5",
                                    fontSize: 11,
                                    fontWeight: 900,
                                }}
                            >
                                {dateFilterActive
                                    ? dateFilterSummary
                                    : "No date restriction applied"}
                            </Box>

                            <Box
                                sx={{
                                    mt: 0.3,
                                    color: "var(--pf-text-muted)",
                                    fontSize: 10,
                                    fontWeight: 650,
                                }}
                            >
                                Time-only filters work across every date. Overnight ranges such as 10:00 PM to 06:00 AM are supported.
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={dateFilterFooterSx}>
                        <Button
                            startIcon={
                                <RestartAltOutlinedIcon />
                            }
                            disabled={!dateFilterActive}
                            onClick={clearChallanDateFilter}
                            sx={dateFilterClearButtonSx}
                        >
                            Clear
                        </Button>

                        <Button
                            onClick={() =>
                                setDateFilterOpen(false)
                            }
                            sx={dateFilterDoneButtonSx}
                        >
                            Done
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <Dialog
                open={endTripDialog.open}
                onClose={closeEndTripDialog}
                fullWidth
                maxWidth="xs"
                PaperProps={{
                    sx: {
                        borderRadius: "18px",
                        background: "var(--pf-surface)",
                        border: "1px solid var(--pf-border)",
                        color: "var(--pf-text-strong)",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        color: "var(--pf-text-strong)",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid rgba(var(--pf-fg-rgb),.08)",
                    }}
                >
                    Enter Trip End Time

                    <IconButton
                        onClick={closeEndTripDialog}
                        sx={{
                            color: "var(--pf-text-muted)",
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent
                    sx={{
                        p: 2.5,
                    }}
                >
                    <Box sx={endDialogLabel}>
                        Challan No.
                    </Box>

                    <Box sx={endDialogChallan}>
                        {endTripDialog.challanNumber || "—"}
                    </Box>

                    <TextField
                        fullWidth
                        label="Trip End Time"
                        type="datetime-local"
                        value={endTripDialog.endTime}
                        onChange={(e) =>
                            setEndTripDialog((prev) => ({
                                ...prev,
                                endTime: e.target.value,
                            }))
                        }
                        InputLabelProps={{
                            shrink: true,
                        }}
                        sx={endTimeInput}
                    />

                    <Box sx={endDialogActions}>
                        <Button
                            onClick={closeEndTripDialog}
                            sx={cancelEndButton}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={submitEndTrip}
                            disabled={endingTrip}
                            sx={saveEndButton}
                        >
                            {endingTrip
                                ? "Saving..."
                                : "Save End Time"}
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
            <Dialog
                open={helperDialog.open}
                onClose={closeHelperDialog}
                fullWidth
                maxWidth="xs"
                PaperProps={{
                    sx: {
                        borderRadius: "18px",
                        background: "var(--pf-surface)",
                        border: "1px solid var(--pf-border)",
                        color: "var(--pf-text-strong)",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        color: "var(--pf-text-strong)",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                            "space-between",
                        borderBottom:
                            "1px solid rgba(var(--pf-fg-rgb),.08)",
                    }}
                >
                    Helpers / Loaders

                    <IconButton
                        onClick={
                            closeHelperDialog
                        }
                        sx={{ color: "var(--pf-text-muted)" }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 2.5 }}>
                    <Box sx={endDialogLabel}>
                        Challan No.
                    </Box>

                    <Box sx={endDialogChallan}>
                        {helperDialog
                            .challanNumber || "—"}
                    </Box>

                    <TextField
                        fullWidth
                        label="Number of Helpers / Loaders"
                        type="number"
                        value={
                            helperDialog
                                .helperLoaderCount
                        }
                        onChange={(e) =>
                            setHelperDialog(
                                (previous) => ({
                                    ...previous,
                                    helperLoaderCount:
                                        e.target.value,
                                })
                            )
                        }
                        inputProps={{
                            min: 0,
                            max: 999,
                            step: 1,
                        }}
                        helperText="Leave empty or enter 0 for no helpers/loaders."
                        sx={endTimeInput}
                    />

                    <Box sx={endDialogActions}>
                        <Button
                            onClick={
                                closeHelperDialog
                            }
                            sx={cancelEndButton}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={
                                submitHelpers
                            }
                            disabled={
                                savingHelpers
                            }
                            sx={saveEndButton}
                        >
                            {savingHelpers
                                ? "Saving..."
                                : "Save Helpers"}
                        </Button>
                    </Box>
                </DialogContent>
            </Dialog>
            <Dialog
                open={pdfPreview.open}
                onClose={closePdfPreview}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        borderRadius: "18px",
                        background: "var(--pf-surface)",
                        border: "1px solid var(--pf-border)",
                        overflow: "hidden",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        color: "var(--pf-text-strong)",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom:
                            "1px solid rgba(var(--pf-fg-rgb),.08)",
                    }}
                >
                    Challan PDF • {pdfPreview.challanNumber}

                    <IconButton
                        onClick={closePdfPreview}
                        sx={{
                            color: "var(--pf-text-muted)",
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent
                    sx={{
                        p: 0,
                        height: "78vh",
                        background: "var(--pf-surface-alt)",
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


function getNowDateTimeLocal() {
    const d =
        new Date();

    d.setMinutes(
        d.getMinutes() - d.getTimezoneOffset()
    );

    return d.toISOString().slice(0, 16);
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

        /*
         * Backend LocalDateTime:
         * 2026-07-03T14:30:00
         *
         * Treat this as local business time.
         * Do not convert it as UTC.
         */
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

function toBackendLocalDateTime(value) {
    if (!value) {
        return null;
    }

    /*
     * IMPORTANT:
     * Do not do new Date(value).toISOString().
     * Backend expects LocalDateTime, not UTC.
     */
    const text =
        String(value)
            .trim()
            .replace(" ", "T");

    if (!text) {
        return null;
    }

    return text.length === 16
        ? `${text}:00`
        : text;
}

function toDateTimeLocalInput(value) {
    if (!value) {
        return "";
    }

    const raw =
        String(value).trim();

    if (!raw) {
        return "";
    }

    /*
     * Backend LocalDateTime:
     * 2026-07-03T14:30:00
     *
     * Return exactly for datetime-local input:
     * 2026-07-03T14:30
     */
    const localMatch =
        raw.match(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
        );

    if (
        localMatch &&
        !/z$/i.test(raw) &&
        !/[+-]\d{2}:\d{2}$/.test(raw)
    ) {
        return `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}T${localMatch[4]}:${localMatch[5]}`;
    }

    /*
     * Only timezone/UTC values are converted to browser local time.
     */
    try {
        const date =
            new Date(raw);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        date.setMinutes(
            date.getMinutes() - date.getTimezoneOffset()
        );

        return date.toISOString().slice(0, 16);
    } catch {
        return "";
    }
}

function getChallanBusinessTime(challan) {
    return (
        challan?.dispatchedAt ||
        challan?.tripStartedAt ||
        challan?.generatedAt ||
        null
    );
}

function getTripStartTime(challan) {
    return (
        challan?.tripStartedAt ||
        challan?.dispatchedAt ||
        null
    );
}

function sanitizeFilename(value) {
    return String(value || "challan")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
}

const olderHistoryBarSx = {
    mt: 1.4,
    p: 1.2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1.2,
    flexWrap: "wrap",
    borderRadius: "12px",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
};

const olderHistoryTextSx = {
    color: "var(--pf-text-muted)",
    fontSize: 10.5,
    fontWeight: 750,
    lineHeight: 1.45,
};

const olderHistoryButtonSx = {
    height: 34,
    px: 1.5,
    borderRadius: "9px",
    textTransform: "none",
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 900,
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    boxShadow: "0 7px 16px rgba(37,99,235,.15)",
    "&:hover": {
        background: "linear-gradient(135deg,#1d4ed8,#2563eb)",
    },
    "&.Mui-disabled": {
        color: "var(--pf-text-dim)",
        background: "var(--pf-surface)",
        boxShadow: "none",
    },
};

const wrap = {
    p: 2.5,
    borderRadius: "18px",
    background: "var(--pf-surface)",
    border: "1px solid var(--pf-border)",
    boxShadow: "var(--pf-card-shadow)",
    color: "var(--pf-text-strong)",
};

const topRow = {
    display: "flex",
    justifyContent: "space-between",
    gap: 2,
    alignItems: "center",
    mb: 2.5,
};

const title = {
    fontSize: 25,
    fontWeight: 950,
    color: "var(--pf-text-strong)",
};

const subtitle = {
    mt: 0.5,
    color: "rgba(var(--pf-fg-rgb),.58)",
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
    p: 1.8,
    borderRadius: "13px",
    background: "linear-gradient(180deg,var(--pf-surface-raised),var(--pf-surface-alt))",
    border: "1px solid var(--pf-border-soft)",
    boxShadow: "0 6px 16px rgba(var(--pf-shadow-rgb),.05)",
};

const summaryValue = {
    color: "#60a5fa",
    fontSize: 28,
    fontWeight: 900,
};

const summaryLabel = {
    color: "var(--pf-text-muted)",
    fontSize: 13,
    fontWeight: 700,
};

const searchPanel = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1.5,
    minHeight: 50,
    px: 2,
    py: 0.75,
    mb: 2,
    borderRadius: "14px",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
};

const searchFilterDivider = {
    width: "1px",
    height: 28,
    flexShrink: 0,
    background:
        "rgba(var(--pf-fg-rgb),.10)",

    "@media (max-width: 700px)": {
        display: "none",
    },
};

const endTimeFilterSelect = {
    minWidth: 230,
    height: 38,
    flexShrink: 0,
    color: "var(--pf-text-strong)",
    fontSize: 13,
    fontWeight: 850,
    borderRadius: "10px",
    background:
        "rgba(59,130,246,.10)",

    "& .MuiOutlinedInput-notchedOutline": {
        borderColor:
            "rgba(96,165,250,.24)",
    },

    "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor:
            "rgba(96,165,250,.48)",
    },

    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: "#60a5fa",
    },

    "& .MuiSvgIcon-root": {
        color: "#2563eb",
    },

    "@media (max-width: 700px)": {
        width: "100%",
        minWidth: 0,
    },
};


const dateFilterButtonSx = (
    active
) => ({
    minWidth: 205,
    height: 40,
    px: 1.4,
    borderRadius: "12px",
    textTransform: "none",
    justifyContent: "flex-start",
    color: active ? "#1d4ed8" : "var(--pf-text)",
    background: active
        ? "rgba(59,130,246,.10)"
        : "var(--pf-surface)",
    border: active
        ? "1px solid rgba(96,165,250,.42)"
        : "1px solid rgba(var(--pf-fg-rgb),.08)",
    boxShadow: active
        ? "0 12px 26px rgba(37,99,235,.18)"
        : "none",

    "& .MuiButton-startIcon": {
        color: active
            ? "#2563eb"
            : "var(--pf-text-dim)",
    },

    "&:hover": {
        background: active
            ? "linear-gradient(135deg,rgba(37,99,235,.42),rgba(59,130,246,.24))"
            : "rgba(var(--pf-fg-rgb),.075)",
        borderColor:
            "rgba(96,165,250,.34)",
    },

    "@media (max-width: 700px)": {
        width: "100%",
        minWidth: 0,
    },
});

const dateFilterDialogPaperSx = {
    borderRadius: "16px",
    overflow: "hidden",
    color: "var(--pf-text-strong)",
    background: "var(--pf-surface)",
    border: "1px solid var(--pf-border)",
    boxShadow: "0 28px 70px rgba(var(--pf-shadow-rgb),.18)",
};

const dateFilterDialogTitleSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1.5,
    px: 2.2,
    py: 1.8,
    color: "var(--pf-text-strong)",
    borderBottom: "1px solid var(--pf-border)",
    background: "var(--pf-surface-alt)",
};

const dateFilterContentSx = {
    p: 2.2,
    maxHeight: "min(72vh, 720px)",
    overflowY: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "#60a5fa var(--pf-scroll-track)",

    "&::-webkit-scrollbar": {
        width: 8,
    },

    "&::-webkit-scrollbar-track": {
        background: "var(--pf-scroll-track)",
        borderRadius: 999,
    },

    "&::-webkit-scrollbar-thumb": {
        background:
            "linear-gradient(180deg,#2563eb,#60a5fa)",
        borderRadius: 999,
    },
};

const dateFilterIconSx = {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2563eb",
    background:
        "linear-gradient(135deg,rgba(37,99,235,.34),rgba(59,130,246,.14))",
    border:
        "1px solid rgba(96,165,250,.26)",
    boxShadow:
        "0 12px 24px rgba(37,99,235,.18)",
};

const dateFilterTitleSx = {
    color: "var(--pf-text-strong)",
    fontSize: 16,
    fontWeight: 950,
};

const dateFilterSubtitleSx = {
    mt: 0.35,
    color: "var(--pf-text-muted)",
    fontSize: 10.5,
    fontWeight: 650,
};

const dateFilterCountChipSx = {
    height: 24,
    color: "#059669",
    fontSize: 10,
    fontWeight: 950,
    background:
        "rgba(16,185,129,.13)",
    border:
        "1px solid rgba(16,185,129,.24)",
};

const dateFilterCloseButtonSx = {
    width: 34,
    height: 34,
    color: "var(--pf-text-muted)",
    background:
        "rgba(var(--pf-fg-rgb),.04)",
    border:
        "1px solid rgba(var(--pf-fg-rgb),.08)",

    "&:hover": {
        color: "#dc2626",
        background:
            "rgba(239,68,68,.10)",
    },
};

const dateModeSectionSx = {
    mb: 1.5,
};

const dateModeSectionLabelSx = {
    mb: 0.8,
    color: "var(--pf-text-muted)",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: ".10em",
    textTransform: "uppercase",
};

const dateModeGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: 0.9,

    "@media (max-width: 560px)": {
        gridTemplateColumns:
            "minmax(0,1fr)",
    },
};

const dateModeCardSx = (
    active
) => ({
    minWidth: 0,
    minHeight: 72,
    p: 1.15,
    borderRadius: "13px",
    textTransform: "none",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 1,
    textAlign: "left",
    color: "var(--pf-text-strong)",
    background: active
        ? "rgba(59,130,246,.09)"
        : "var(--pf-surface-alt)",
    border: active
        ? "1px solid rgba(96,165,250,.48)"
        : "1px solid rgba(var(--pf-fg-rgb),.075)",
    boxShadow: active
        ? "0 12px 28px rgba(37,99,235,.16), inset 0 1px 0 rgba(var(--pf-fg-rgb),.04)"
        : "none",

    "&:hover": {
        transform: "translateY(-1px)",
        background: active
            ? "linear-gradient(135deg,rgba(37,99,235,.38),rgba(59,130,246,.20))"
            : "rgba(var(--pf-fg-rgb),.065)",
        borderColor:
            "rgba(96,165,250,.34)",
    },
});

const dateModeCardTextSx = {
    minWidth: 0,
    flex: 1,
};

const dateModeCardTitleSx = {
    color: "var(--pf-text-strong)",
    fontSize: 11.5,
    fontWeight: 950,
    lineHeight: 1.25,
};

const dateModeCardDescriptionSx = {
    mt: 0.35,
    color: "var(--pf-text-muted)",
    fontSize: 9.5,
    fontWeight: 650,
    lineHeight: 1.35,
};

const dateModeCheckSx = (
    active
) => ({
    width: 20,
    height: 20,
    flexShrink: 0,
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: active
        ? "#fff"
        : "transparent",
    fontSize: 11,
    fontWeight: 950,
    background: active
        ? "linear-gradient(135deg,#2563eb,#60a5fa)"
        : "rgba(var(--pf-fg-rgb),.035)",
    border: active
        ? "1px solid rgba(147,197,253,.48)"
        : "1px solid rgba(var(--pf-fg-rgb),.10)",
});

const datePresetRowSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(4,minmax(0,1fr))",
    gap: 0.8,
    mb: 1.4,

    "@media (max-width: 520px)": {
        gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
    },
};

const datePresetButtonSx = {
    minWidth: 0,
    height: 34,
    borderRadius: "11px",
    textTransform: "none",
    color: "#2563eb",
    fontSize: 10.5,
    fontWeight: 900,
    background:
        "rgba(59,130,246,.09)",
    border:
        "1px solid rgba(96,165,250,.18)",

    "&:hover": {
        color: "#fff",
        background:
            "rgba(59,130,246,.18)",
        borderColor:
            "rgba(96,165,250,.34)",
    },
};

const dateFilterGridSx = {
    display: "grid",
    gridTemplateColumns:
        "repeat(2,minmax(0,1fr))",
    gap: 1.2,
    mb: 1.2,

    "@media (max-width: 520px)": {
        gridTemplateColumns:
            "minmax(0,1fr)",
    },
};

const dateFilterFieldSx = {
    "& .MuiInputLabel-root": {
        color: "var(--pf-text-muted)",
        fontSize: 12,
        fontWeight: 800,
    },

    "& .MuiInputLabel-root.Mui-focused": {
        color: "#2563eb",
    },

    "& .MuiOutlinedInput-root": {
        minHeight: 46,
        borderRadius: "10px",
        color: "var(--pf-text-strong)",
        background: "var(--pf-input)",

        "& fieldset": {
            borderColor:
                "rgba(var(--pf-fg-rgb),.09)",
        },

        "&:hover fieldset": {
            borderColor:
                "rgba(96,165,250,.36)",
        },

        "&.Mui-focused fieldset": {
            borderColor: "#60a5fa",
            boxShadow:
                "0 0 0 3px rgba(96,165,250,.12)",
        },
    },

    "& input": {
        color: "var(--pf-text-strong)",
        fontSize: 12,
        fontWeight: 850,
        colorScheme: "var(--pf-color-scheme)",
    },

    "& input::-webkit-calendar-picker-indicator": {
        filter: "none",
        opacity: 0.88,
        cursor: "pointer",
    },
};

const dateTimeAdornmentSx = {
    mr: 0.8,
    color: "#60a5fa",
    fontSize: 18,
};

const dateFilterHintSx = {
    display: "flex",
    alignItems: "flex-start",
    gap: 1,
    p: 1.2,
    borderRadius: "13px",
    background:
        "rgba(16,185,129,.075)",
    border:
        "1px solid rgba(16,185,129,.16)",
};

const dateFilterFooterSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    mt: 1.5,
    pt: 1.4,
    borderTop:
        "1px solid rgba(var(--pf-fg-rgb),.07)",
};

const dateFilterClearButtonSx = {
    height: 36,
    borderRadius: "11px",
    textTransform: "none",
    color: "#dc2626",
    fontWeight: 900,
    background:
        "rgba(239,68,68,.08)",
    border:
        "1px solid rgba(239,68,68,.17)",

    "&:hover": {
        background:
            "rgba(239,68,68,.15)",
    },

    "&.Mui-disabled": {
        opacity: 0.35,
        color: "var(--pf-text-muted)",
    },
};

const dateFilterDoneButtonSx = {
    height: 36,
    px: 2.4,
    borderRadius: "11px",
    textTransform: "none",
    color: "#fff",
    fontWeight: 950,
    background:
        "linear-gradient(135deg,#2563eb,#3b82f6)",
    boxShadow:
        "0 10px 22px rgba(37,99,235,.25)",

    "&:hover": {
        background:
            "linear-gradient(135deg,#1d4ed8,#2563eb)",
    },
};

const emptyState = {
    p: 3,
    borderRadius: "16px",
    textAlign: "center",
    color: "var(--pf-text-muted)",
    background:
        "rgba(var(--pf-fg-rgb),.03)",
    border:
        "1px dashed rgba(var(--pf-fg-rgb),.12)",
    fontWeight: 700,
};

const challanCard = {
    mb: 1.6,
    borderRadius: "18px",
    overflow: "hidden",
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
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
    color: "var(--pf-text-strong)",
    fontSize: 17,
    fontWeight: 900,
    fontFamily: "monospace",
};

const challanMeta = {
    mt: 0.6,
    color: "var(--pf-text-muted)",
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
    color: "#059669",
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
    color: "#ca8a04",
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
    color: "#2563eb",
    background:
        "rgba(59,130,246,.12)",
    border:
        "1px solid rgba(59,130,246,.22)",

    "&:hover": {
        background:
            "rgba(59,130,246,.22)",
    },
};

const helperButton = {
    height: 34,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 900,
    color: "#fff",
    background:
        "linear-gradient(135deg,#7c3aed,#8b5cf6)",
    border:
        "1px solid rgba(167,139,250,.42)",
    boxShadow:
        "0 10px 22px rgba(124,58,237,.20)",

    "&:hover": {
        background:
            "linear-gradient(135deg,#6d28d9,#7c3aed)",
    },
};

const viewButton = {
    height: 34,
    borderRadius: "9px",
    textTransform: "none",
    fontWeight: 850,
    color: "#2563eb",
    background: "rgba(59,130,246,.09)",
    border:
        "1px solid rgba(59,130,246,.22)",

    "&:hover": {
        background:
            "rgba(59,130,246,.25)",
    },
};

const itemsBox = {
    borderTop:
        "1px solid rgba(var(--pf-fg-rgb),.07)",
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
    color: "var(--pf-text-muted)",
    fontSize: 12,
    fontWeight: 900,
    background: "var(--pf-surface-alt)",
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
        "1px solid rgba(var(--pf-fg-rgb),.05)",
};

const cellText = {
    color: "var(--pf-text)",
    fontSize: 13,
    fontWeight: 750,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const subText = {
    color: "var(--pf-text-muted)",
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
    color: "#16a34a",
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
    background: "var(--pf-surface-alt)",
    border: "1px solid var(--pf-border-soft)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    flexWrap: "wrap",
};

const paginationText = {
    color: "var(--pf-text-muted)",
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
    color: "var(--pf-text-strong)",
    borderRadius: "10px",
    background:
        "rgba(var(--pf-fg-rgb),.04)",

    ".MuiOutlinedInput-notchedOutline": {
        borderColor:
            "rgba(var(--pf-fg-rgb),.12)",
    },

    ".MuiSvgIcon-root": {
        color: "var(--pf-text-muted)",
    },
};

const pageButton = {
    height: 36,
    borderRadius: "9px",
    textTransform: "none",
    fontWeight: 850,
    color: "#2563eb",
    background: "rgba(59,130,246,.09)",
    border:
        "1px solid rgba(59,130,246,.22)",

    "&:disabled": {
        color: "rgba(var(--pf-fg-rgb),.3)",
        background:
            "rgba(var(--pf-fg-rgb),.04)",
    },
};

const pageBadge = {
    minWidth: 72,
    height: 36,
    px: 1.2,
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--pf-text-strong)",
    fontWeight: 900,
    background:
        "rgba(var(--pf-fg-rgb),.055)",
    border:
        "1px solid rgba(var(--pf-fg-rgb),.08)",
};


const endTimeButton = {
    height: 34,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(135deg,#dc2626,#ef4444)",
    border: "1px solid rgba(248,113,113,.45)",
    boxShadow: "0 10px 22px rgba(220,38,38,.22)",

    "&:hover": {
        background: "linear-gradient(135deg,#b91c1c,#dc2626)",
    },
};

const endDialogLabel = {
    color: "var(--pf-text-muted)",
    fontSize: 12,
    fontWeight: 900,
    mb: 0.7,
};

const endDialogChallan = {
    color: "var(--pf-text-strong)",
    fontWeight: 900,
    fontFamily: "monospace",
    mb: 2,
    p: 1.2,
    borderRadius: "12px",
    background: "rgba(var(--pf-fg-rgb),.045)",
    border: "1px solid rgba(var(--pf-fg-rgb),.08)",
};

const endTimeInput = {
    mt: 1,

    "& label": {
        color: "var(--pf-text-muted)",
        fontWeight: 800,
    },

    "& label.Mui-focused": {
        color: "#2563eb",
    },

    "& .MuiInputBase-root": {
        color: "var(--pf-text-strong)",
        borderRadius: "10px",
        background: "var(--pf-input)",
    },

    "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(var(--pf-fg-rgb),.12)",
    },

    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: "rgba(147,197,253,.35)",
    },

    "& input": {
        color: "var(--pf-text-strong)",
        colorScheme: "var(--pf-color-scheme)",
    },

    "& input::-webkit-calendar-picker-indicator": {
        filter: "none",
        opacity: 0.85,
        cursor: "pointer",
    },
};

const endDialogActions = {
    display: "flex",
    gap: 1.2,
    justifyContent: "flex-end",
    mt: 2.5,
};

const cancelEndButton = {
    height: 38,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 800,
    color: "var(--pf-text)",
    background: "rgba(var(--pf-fg-rgb),.05)",
};

const saveEndButton = {
    height: 38,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(135deg,#dc2626,#ef4444)",

    "&:hover": {
        background: "linear-gradient(135deg,#b91c1c,#dc2626)",
    },

    "&:disabled": {
        color: "rgba(var(--pf-fg-rgb),.45)",
        background: "rgba(var(--pf-fg-rgb),.08)",
    },
};

export default DispatchChallans;