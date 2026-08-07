import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./logisticsScrollbars.css";

import {
  formatShiftDate,
  formatShiftTimeRange,
  isShiftOverSixPm,
  getDefaultShiftStartLocal,
  getDefaultShiftEndLocal,
} from "./logisticsDateTimeUtils";

import {
  fetchDrivers,
  fetchVehicles,
  fetchShifts,
  fetchDispatchChallans,
  fetchLogisticsTrips,
  fetchDispatchChallanPdf,
  downloadTripChallan,
  endDispatchChallanTrip,
  updateDispatchChallanHelpers,
  createShift,
  updateShift,
} from "../../api/logisticsApi";

import {
  getBackendMessage,
} from "./logisticsAlertUtils";

import LogisticsPagination from "./LogisticsPagination";

const SOURCE = Object.freeze({
  CHALLAN: "CHALLAN",
  MANUAL: "MANUAL",
  LEGACY_TRIP: "LEGACY_TRIP",
});

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeStatus = (value) =>
  normalizeText(value || "UNKNOWN");

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseBusinessDateTime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getTime());
  }

  const raw = String(value)
    .trim()
    .replace(" ", "T");

  if (!raw) return null;

  const hasTimezone =
    /[zZ]$/.test(raw) ||
    /[+-]\d{2}:?\d{2}$/.test(raw);

  if (hasTimezone) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?$/
  );

  if (match) {
    const milliseconds = Number(
      String(match[7] || "0")
        .slice(0, 3)
        .padEnd(3, "0")
    );

    const parsed = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
      milliseconds
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime())
    ? null
    : fallback;
}

const toDateTimeLocal = (value) => {
  const date = parseBusinessDateTime(value);
  if (!date) return "";

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const toDateOnly = (value) => {
  const date = parseBusinessDateTime(value);
  if (!date) return "";

  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
};

const formatDateTime = (value) => {
  const date = parseBusinessDateTime(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const formatDuration = (minutes) => {
  const total = safeNumber(minutes);
  if (total <= 0) return "—";

  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);

  if (hours <= 0) return `${mins} min`;
  if (mins <= 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

const getDurationMinutes = (startValue, endValue, explicit) => {
  const explicitNumber = Number(explicit);
  if (Number.isFinite(explicitNumber) && explicitNumber > 0) {
    return explicitNumber;
  }

  const start = parseBusinessDateTime(startValue);
  const end = parseBusinessDateTime(endValue);

  if (!start || !end) return 0;

  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000)
  );
};

const getChallanStart = (challan) =>
  challan?.tripStartedAt ||
  challan?.dispatchedAt ||
  challan?.generatedAt ||
  challan?.createdAt ||
  null;

const getChallanStatus = (challan) => {
  const status = normalizeStatus(challan?.tripStatus);

  if (status === "CANCELLED") return "CANCELLED";

  if (
    challan?.tripEndedAt ||
    ["ENDED", "COMPLETED", "DELIVERED"].includes(status)
  ) {
    return "COMPLETED";
  }

  return status && status !== "UNKNOWN"
    ? status
    : "RUNNING";
};

const getLegacyTripStart = (trip) =>
  trip?.tripStart ||
  trip?.tripStartedAt ||
  trip?.createdAt ||
  null;

const getLegacyTripEnd = (trip) =>
  trip?.tripEnd ||
  trip?.tripEndedAt ||
  trip?.deliveredAt ||
  null;

const buildInitialForm = ({
  initialDriverId,
  shift,
}) => {
  if (shift) {
    return {
      driverId:
        shift.driver?.id ||
        shift.driverId ||
        "",
      vehicleId:
        shift.vehicle?.id ||
        shift.vehicleId ||
        "",
      shiftStart: toDateTimeLocal(
        shift.shiftStart
      ),
      shiftEnd: toDateTimeLocal(
        shift.shiftEnd
      ),
      overtimeHours:
        shift.overtimeHours ?? 0,
      totalTrips:
        shift.totalTrips ?? 0,
      totalHelpers:
        shift.totalHelpers ??
        shift.totalLoaders ??
        0,
      fuelUsed:
        shift.fuelUsed ?? 0,
      totalDistance:
        shift.totalDistance ?? 0,
      routeCategory:
        shift.routeCategory || "Factory",
      remarks:
        shift.remarks || "",
      status:
        shift.status || "WORKING",
    };
  }

  return {
    driverId: initialDriverId || "",
    vehicleId: "",
    shiftStart: getDefaultShiftStartLocal(),
    shiftEnd: getDefaultShiftEndLocal(),
    overtimeHours: 0,
    totalTrips: 0,
    totalHelpers: 0,
    fuelUsed: 0,
    totalDistance: 0,
    routeCategory: "Factory",
    remarks: "",
    status: "WORKING",
  };
};

function LogisticsShiftModal({
  open,
  onClose,
  onCreated,
  onSaved,
  showAlert = () => { },
  mode = "create",
  shift = null,
  initialDriverId = "",
  lockDriver = false,
  showDriverHistory = false,
  driverName = "",
}) {
  const isEdit = mode === "edit";

  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [allChallans, setAllChallans] = useState([]);
  const [legacyTrips, setLegacyTrips] = useState([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);
  const [historyLoadWarning, setHistoryLoadWarning] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [historyPageNo, setHistoryPageNo] =
    useState(1);
  const [historyPageSize, setHistoryPageSize] =
    useState(10);
  const [historyFromDate, setHistoryFromDate] =
    useState("");
  const [historyToDate, setHistoryToDate] =
    useState("");
  const [historySource, setHistorySource] =
    useState("ALL");
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState("ALL");
  const [historySearch, setHistorySearch] =
    useState("");
  const [expandedActivityKey, setExpandedActivityKey] =
    useState("");
  const [downloadingKey, setDownloadingKey] =
    useState("");

  const [pdfPreview, setPdfPreview] = useState({
    open: false,
    url: "",
    challanNumber: "",
  });

  const [endTripDialog, setEndTripDialog] = useState({
    open: false,
    challanNumber: "",
    endTime: "",
  });

  const [helperDialog, setHelperDialog] = useState({
    open: false,
    challanNumber: "",
    helperLoaderCount: "",
  });

  const [challanActionSaving, setChallanActionSaving] =
    useState(false);

  const [form, setForm] = useState(() =>
    buildInitialForm({
      initialDriverId,
      shift,
    })
  );

  useEffect(() => {
    if (!open) return;

    setForm(
      buildInitialForm({
        initialDriverId,
        shift,
      })
    );

    setHistoryPageNo(1);
    setHistoryFromDate("");
    setHistoryToDate("");
    setHistorySource("ALL");
    setHistoryStatusFilter("ALL");
    setHistorySearch("");
    setExpandedActivityKey("");
    setEndTripDialog({
      open: false,
      challanNumber: "",
      endTime: "",
    });
    setHelperDialog({
      open: false,
      challanNumber: "",
      helperLoaderCount: "",
    });
  }, [open, initialDriverId, shift]);

  useEffect(() => {
    return () => {
      if (pdfPreview.url) {
        URL.revokeObjectURL(
          pdfPreview.url
        );
      }
    };
  }, [pdfPreview.url]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadModalData() {
      try {
        setHistoryLoading(true);
        setHistoryLoadWarning("");

        const results = await Promise.allSettled([
          fetchDrivers(),
          fetchVehicles(),
          fetchShifts(),
          fetchDispatchChallans(),
          fetchLogisticsTrips(),
        ]);

        if (!active) return;

        const [
          driverResult,
          vehicleResult,
          shiftResult,
          challanResult,
          legacyTripResult,
        ] = results;

        const failed = [];

        if (driverResult.status === "fulfilled") {
          setDrivers(
            Array.isArray(driverResult.value)
              ? driverResult.value
              : []
          );
        } else {
          failed.push("drivers");
        }

        if (vehicleResult.status === "fulfilled") {
          setVehicles(
            Array.isArray(vehicleResult.value)
              ? vehicleResult.value
              : []
          );
        } else {
          failed.push("vehicles");
        }

        if (shiftResult.status === "fulfilled") {
          setAllShifts(
            Array.isArray(shiftResult.value)
              ? shiftResult.value
              : []
          );
        } else {
          setAllShifts([]);
          failed.push("manual operations");
        }

        if (challanResult.status === "fulfilled") {
          setAllChallans(
            Array.isArray(challanResult.value)
              ? challanResult.value
              : []
          );
        } else {
          setAllChallans([]);
          failed.push("dispatch challans");
        }

        if (legacyTripResult.status === "fulfilled") {
          setLegacyTrips(
            Array.isArray(legacyTripResult.value)
              ? legacyTripResult.value
              : []
          );
        } else {
          setLegacyTrips([]);
          failed.push("legacy trips");
        }

        if (failed.length > 0) {
          setHistoryLoadWarning(
            `Some history could not be loaded: ${failed.join(
              ", "
            )}. Available data is still shown.`
          );
        }
      } catch (error) {
        if (!active) return;

        console.error(error);
        showAlert(
          getBackendMessage(
            error,
            "Failed to load logistics data"
          ),
          "error"
        );
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    loadModalData();

    return () => {
      active = false;
    };
  }, [open, showAlert]);

  const selectedDriver = useMemo(
    () =>
      drivers.find(
        (driver) =>
          String(driver.id) ===
          String(form.driverId)
      ) || null,
    [drivers, form.driverId]
  );

  const selectedDriverName =
    driverName ||
    selectedDriver?.name ||
    "Selected Driver";

  const driverMatches = (
    recordDriverId,
    recordDriverName
  ) => {
    const selectedId = String(
      form.driverId || ""
    ).trim();

    const recordId = String(
      recordDriverId || ""
    ).trim();

    if (selectedId && recordId) {
      return selectedId === recordId;
    }

    const selectedName = normalizeText(
      selectedDriverName
    );

    const candidateName = normalizeText(
      recordDriverName
    );

    return Boolean(
      selectedName &&
      candidateName &&
      selectedName === candidateName
    );
  };

  const unifiedDriverActivities = useMemo(() => {
    if (
      !showDriverHistory ||
      !form.driverId
    ) {
      return [];
    }

    const rows = [];
    const currentChallanNumbers =
      new Set();

    allChallans.forEach((challan) => {
      if (
        !driverMatches(
          challan?.driverId ||
          challan?.driver?.id,
          challan?.driverName ||
          challan?.driver?.name
        )
      ) {
        return;
      }

      const challanNumber = String(
        challan?.challanNumber || ""
      ).trim();

      if (challanNumber) {
        currentChallanNumbers.add(
          normalizeText(challanNumber)
        );
      }

      const startAt =
        getChallanStart(challan);
      const endAt =
        challan?.tripEndedAt || null;
      const status =
        getChallanStatus(challan);

      const clients = Array.from(
        new Set(
          (Array.isArray(challan?.items)
            ? challan.items
            : []
          )
            .map((item) =>
              String(
                item?.clientName || ""
              ).trim()
            )
            .filter(Boolean)
        )
      );

      const pdNos = Array.from(
        new Set(
          (Array.isArray(challan?.items)
            ? challan.items
            : []
          )
            .map((item) =>
              String(item?.pdNo || "").trim()
            )
            .filter(Boolean)
        )
      );

      rows.push({
        key: `CHALLAN:${challanNumber || startAt || rows.length}`,
        source: SOURCE.CHALLAN,
        sourceLabel: "Dispatch Challan",
        challanNumber:
          challanNumber || "—",
        startAt,
        endAt,
        vehicleNumber:
          challan?.vehicleNumber ||
          challan?.vehicle?.vehicleNumber ||
          "—",
        status,
        itemCount:
          safeNumber(
            challan?.totalItems
          ) ||
          (Array.isArray(challan?.items)
            ? challan.items.length
            : 0),
        tripCount: 1,
        helperCount:
          safeNumber(
            challan?.helperLoaderCount
          ),
        durationMinutes:
          getDurationMinutes(
            startAt,
            endAt,
            challan?.tripDurationMinutes
          ),
        clients,
        pdNos,
        routeCategory: "Item Dispatch",
        raw: challan,
      });
    });

    allShifts.forEach((manualShift) => {
      if (
        !driverMatches(
          manualShift?.driver?.id ||
          manualShift?.driverId,
          manualShift?.driver?.name ||
          manualShift?.driverName
        )
      ) {
        return;
      }

      const startAt =
        manualShift?.shiftStart ||
        manualShift?.date ||
        manualShift?.createdAt ||
        null;
      const endAt =
        manualShift?.shiftEnd || null;

      rows.push({
        key: `MANUAL:${manualShift?.id || startAt || rows.length}`,
        source: SOURCE.MANUAL,
        sourceLabel: "Manual / Legacy",
        challanNumber: "Manual Operation",
        startAt,
        endAt,
        vehicleNumber:
          manualShift?.vehicle?.vehicleNumber ||
          manualShift?.vehicleNumber ||
          "—",
        status:
          normalizeStatus(
            manualShift?.status || "WORKING"
          ),
        itemCount: 0,
        tripCount:
          safeNumber(
            manualShift?.totalTrips
          ),
        helperCount:
          safeNumber(
            manualShift?.totalLoaders ??
            manualShift?.totalHelpers
          ),
        durationMinutes:
          getDurationMinutes(
            startAt,
            endAt
          ),
        routeCategory:
          manualShift?.routeCategory ||
          "—",
        fuelUsed:
          safeNumber(
            manualShift?.fuelUsed
          ),
        totalDistance:
          safeNumber(
            manualShift?.totalDistance
          ),
        remarks:
          manualShift?.remarks || "",
        raw: manualShift,
      });
    });

    legacyTrips.forEach((trip) => {
      if (
        !driverMatches(
          trip?.driver?.id ||
          trip?.driverId,
          trip?.driver?.name ||
          trip?.driverName
        )
      ) {
        return;
      }

      const challanNumber = String(
        trip?.challanNumber || ""
      ).trim();

      if (
        challanNumber &&
        currentChallanNumbers.has(
          normalizeText(challanNumber)
        )
      ) {
        return;
      }

      const startAt =
        getLegacyTripStart(trip);
      const endAt =
        getLegacyTripEnd(trip);

      rows.push({
        key: `LEGACY_TRIP:${trip?.id || challanNumber || startAt || rows.length}`,
        source: SOURCE.LEGACY_TRIP,
        sourceLabel: "Legacy Trip",
        challanNumber:
          challanNumber || "Legacy Trip",
        startAt,
        endAt,
        vehicleNumber:
          trip?.vehicle?.vehicleNumber ||
          trip?.vehicleNumber ||
          "—",
        status:
          normalizeStatus(
            trip?.status || "UNKNOWN"
          ),
        itemCount:
          safeNumber(trip?.totalItems),
        tripCount: 1,
        helperCount:
          safeNumber(
            trip?.helperLoaderCount
          ),
        durationMinutes:
          getDurationMinutes(
            startAt,
            endAt,
            trip?.tripDurationMinutes
          ),
        routeCategory: "Legacy Trip",
        raw: trip,
      });
    });

    return rows.sort((a, b) => {
      const aTime =
        parseBusinessDateTime(a.startAt)
          ?.getTime() || 0;
      const bTime =
        parseBusinessDateTime(b.startAt)
          ?.getTime() || 0;
      return bTime - aTime;
    });
  }, [
    allChallans,
    allShifts,
    legacyTrips,
    showDriverHistory,
    form.driverId,
    selectedDriverName,
  ]);

  const filteredActivities = useMemo(() => {
    const query = normalizeText(
      historySearch
    );

    return unifiedDriverActivities.filter(
      (activity) => {
        if (
          historySource !== "ALL" &&
          activity.source !== historySource
        ) {
          return false;
        }

        const status = normalizeStatus(
          activity.status
        );

        if (
          historyStatusFilter === "ACTIVE" &&
          ![
            "RUNNING",
            "WORKING",
            "OUT_FOR_DELIVERY",
            "ACTIVE",
          ].includes(status)
        ) {
          return false;
        }

        if (
          historyStatusFilter === "COMPLETED" &&
          ![
            "COMPLETED",
            "ENDED",
            "DELIVERED",
          ].includes(status)
        ) {
          return false;
        }

        if (
          historyStatusFilter === "CANCELLED" &&
          status !== "CANCELLED"
        ) {
          return false;
        }

        const dateKey = toDateOnly(
          activity.startAt
        );

        if (
          historyFromDate &&
          (!dateKey ||
            dateKey < historyFromDate)
        ) {
          return false;
        }

        if (
          historyToDate &&
          (!dateKey ||
            dateKey > historyToDate)
        ) {
          return false;
        }

        if (query) {
          const searchable = normalizeText(
            [
              activity.sourceLabel,
              activity.challanNumber,
              activity.vehicleNumber,
              activity.status,
              activity.routeCategory,
              ...(activity.clients || []),
              ...(activity.pdNos || []),
            ]
              .filter(Boolean)
              .join(" ")
          );

          if (!searchable.includes(query)) {
            return false;
          }
        }

        return true;
      }
    );
  }, [
    unifiedDriverActivities,
    historySource,
    historyStatusFilter,
    historyFromDate,
    historyToDate,
    historySearch,
  ]);

  const activitySummary = useMemo(() => {
    return unifiedDriverActivities.reduce(
      (summary, activity) => {
        summary.totalActivities += 1;

        if (activity.source === SOURCE.CHALLAN) {
          summary.currentChallans += 1;
          summary.dispatchedItems +=
            safeNumber(activity.itemCount);

          const status = normalizeStatus(
            activity.status
          );

          if (
            [
              "RUNNING",
              "OUT_FOR_DELIVERY",
              "ACTIVE",
            ].includes(status)
          ) {
            summary.activeChallans += 1;
          }

          if (
            [
              "COMPLETED",
              "ENDED",
              "DELIVERED",
            ].includes(status)
          ) {
            summary.completedChallans += 1;
          }
        }

        if (activity.source === SOURCE.MANUAL) {
          summary.manualRecords += 1;
          summary.manualTrips +=
            safeNumber(activity.tripCount);
        }

        if (
          activity.source === SOURCE.LEGACY_TRIP
        ) {
          summary.legacyTrips += 1;
          summary.dispatchedItems +=
            safeNumber(activity.itemCount);
        }

        return summary;
      },
      {
        totalActivities: 0,
        currentChallans: 0,
        activeChallans: 0,
        completedChallans: 0,
        manualRecords: 0,
        legacyTrips: 0,
        manualTrips: 0,
        dispatchedItems: 0,
      }
    );
  }, [unifiedDriverActivities]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(
      filteredActivities.length /
      historyPageSize
    )
  );

  const historyCurrentPage = Math.min(
    historyPageNo,
    historyTotalPages
  );

  const paginatedHistoryRows =
    filteredActivities.slice(
      (historyCurrentPage - 1) *
      historyPageSize,
      historyCurrentPage *
      historyPageSize
    );

  useEffect(() => {
    if (historyPageNo > historyTotalPages) {
      setHistoryPageNo(historyTotalPages);
    }
  }, [historyPageNo, historyTotalPages]);

  if (!open) return null;

  const update = (key, value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const buildPayload = () => ({
    driverId: form.driverId,
    vehicleId: form.vehicleId,
    shiftStart: form.shiftStart,
    shiftEnd: form.shiftEnd,
    overtimeHours: Number(
      form.overtimeHours || 0
    ),
    totalTrips: Number(
      form.totalTrips || 0
    ),
    totalLoaders: Number(
      form.totalHelpers || 0
    ),
    fuelUsed: Number(
      form.fuelUsed || 0
    ),
    totalDistance: Number(
      form.totalDistance || 0
    ),
    routeCategory:
      form.routeCategory || "Factory",
    remarks: form.remarks || "",
    status: form.status || "WORKING",
  });

  async function reloadOperationalHistory() {
    const results = await Promise.allSettled([
      fetchShifts(),
      fetchDispatchChallans(),
      fetchLogisticsTrips(),
    ]);

    const [
      shiftResult,
      challanResult,
      tripResult,
    ] = results;

    if (shiftResult.status === "fulfilled") {
      setAllShifts(
        Array.isArray(shiftResult.value)
          ? shiftResult.value
          : []
      );
    }

    if (challanResult.status === "fulfilled") {
      setAllChallans(
        Array.isArray(challanResult.value)
          ? challanResult.value
          : []
      );
    }

    if (tripResult.status === "fulfilled") {
      setLegacyTrips(
        Array.isArray(tripResult.value)
          ? tripResult.value
          : []
      );
    }
  }

  async function submit() {
    if (saving) return;

    try {
      setSaving(true);

      if (!form.driverId) {
        throw new Error(
          "Please select a driver"
        );
      }

      if (!form.vehicleId) {
        throw new Error(
          "Please select a vehicle"
        );
      }

      if (!form.shiftStart) {
        throw new Error(
          "Shift start is required"
        );
      }

      if (!form.shiftEnd) {
        throw new Error(
          "Shift end is required"
        );
      }

      const payload = buildPayload();

      if (isEdit) {
        await updateShift(
          shift.id,
          payload
        );

        showAlert(
          "Shift updated successfully",
          "success"
        );
      } else {
        await createShift(payload);

        showAlert(
          "Manual operation created successfully",
          "success"
        );
      }

      await reloadOperationalHistory();

      const refreshFn =
        onSaved || onCreated;

      await refreshFn?.();

      if (!showDriverHistory) {
        onClose();
      } else {
        setForm(
          buildInitialForm({
            initialDriverId:
              form.driverId,
            shift: null,
          })
        );
      }
    } catch (error) {
      console.error(error);

      showAlert(
        getBackendMessage(
          error,
          isEdit
            ? "Failed to update shift"
            : "Failed to create manual operation"
        ),
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadActivityChallan(activity) {
    if (!activity) return;

    try {
      setDownloadingKey(activity.key);

      if (
        activity.source === SOURCE.CHALLAN
      ) {
        if (
          !activity.challanNumber ||
          activity.challanNumber === "—"
        ) {
          throw new Error(
            "Challan number missing"
          );
        }

        const blob =
          await fetchDispatchChallanPdf(
            activity.challanNumber
          );

        const url =
          URL.createObjectURL(blob);
        const anchor =
          document.createElement("a");

        anchor.href = url;
        anchor.download = `${String(
          activity.challanNumber
        ).replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )}.pdf`;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return;
      }

      if (
        activity.source ===
        SOURCE.LEGACY_TRIP
      ) {
        if (!activity.raw?.id) {
          throw new Error(
            "Legacy trip id missing"
          );
        }

        await downloadTripChallan(
          activity.raw.id
        );
      }
    } catch (error) {
      console.error(error);
      showAlert(
        getBackendMessage(
          error,
          "Unable to download challan"
        ),
        "error"
      );
    } finally {
      setDownloadingKey("");
    }
  }


  async function previewActivityChallan(activity) {
    if (
      !activity ||
      activity.source !== SOURCE.CHALLAN
    ) {
      return;
    }

    try {
      if (
        !activity.challanNumber ||
        activity.challanNumber === "—"
      ) {
        throw new Error(
          "Challan number missing"
        );
      }

      setDownloadingKey(
        `PREVIEW:${activity.key}`
      );

      const blob =
        await fetchDispatchChallanPdf(
          activity.challanNumber
        );

      const url = URL.createObjectURL(blob);

      setPdfPreview((previous) => {
        if (previous.url) {
          URL.revokeObjectURL(
            previous.url
          );
        }

        return {
          open: true,
          url,
          challanNumber:
            activity.challanNumber,
        };
      });
    } catch (error) {
      console.error(error);
      showAlert(
        getBackendMessage(
          error,
          "Unable to preview challan"
        ),
        "error"
      );
    } finally {
      setDownloadingKey("");
    }
  }

  function closePdfPreview() {
    setPdfPreview((previous) => {
      if (previous.url) {
        URL.revokeObjectURL(
          previous.url
        );
      }

      return {
        open: false,
        url: "",
        challanNumber: "",
      };
    });
  }

  function openActivityEndTrip(activity) {
    if (
      !activity ||
      activity.source !== SOURCE.CHALLAN
    ) {
      return;
    }

    setEndTripDialog({
      open: true,
      challanNumber:
        activity.challanNumber || "",
      endTime:
        toDateTimeLocal(
          activity.endAt || new Date()
        ) || toDateTimeLocal(new Date()),
    });
  }

  async function submitActivityEndTrip() {
    if (
      !endTripDialog.challanNumber ||
      !endTripDialog.endTime
    ) {
      showAlert(
        "Challan number and end time are required",
        "error"
      );
      return;
    }

    try {
      setChallanActionSaving(true);

      await endDispatchChallanTrip(
        endTripDialog.challanNumber,
        endTripDialog.endTime
      );

      showAlert(
        "Trip end time saved successfully",
        "success"
      );

      setEndTripDialog({
        open: false,
        challanNumber: "",
        endTime: "",
      });

      await reloadOperationalHistory();
      await onSaved?.();
    } catch (error) {
      console.error(error);
      showAlert(
        getBackendMessage(
          error,
          "Failed to save trip end time"
        ),
        "error"
      );
    } finally {
      setChallanActionSaving(false);
    }
  }

  function openActivityHelpers(activity) {
    if (
      !activity ||
      activity.source !== SOURCE.CHALLAN
    ) {
      return;
    }

    const count =
      activity.raw?.helperLoaderCount ??
      activity.helperCount ??
      "";

    setHelperDialog({
      open: true,
      challanNumber:
        activity.challanNumber || "",
      helperLoaderCount:
        count === null ||
          count === undefined ||
          Number(count) <= 0
          ? ""
          : String(count),
    });
  }

  async function submitActivityHelpers() {
    if (!helperDialog.challanNumber) {
      showAlert(
        "Challan number is required",
        "error"
      );
      return;
    }

    try {
      setChallanActionSaving(true);

      await updateDispatchChallanHelpers(
        helperDialog.challanNumber,
        helperDialog.helperLoaderCount
      );

      showAlert(
        String(
          helperDialog.helperLoaderCount || ""
        ).trim()
          ? "Helpers / loaders updated successfully"
          : "Helpers / loaders cleared successfully",
        "success"
      );

      setHelperDialog({
        open: false,
        challanNumber: "",
        helperLoaderCount: "",
      });

      await reloadOperationalHistory();
      await onSaved?.();
    } catch (error) {
      console.error(error);
      showAlert(
        getBackendMessage(
          error,
          "Failed to update helpers / loaders"
        ),
        "error"
      );
    } finally {
      setChallanActionSaving(false);
    }
  }

  return (
    <div
      className="logistics-scroll-scope"
      style={overlay}
      onClick={onClose}
    >
      <div
        className="logistics-scrollbar logistics-scrollbar-y logistics-scrollbar-stable logistics-modal-scroll"
        style={modal}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div style={header}>
          <div>
            <div style={title}>
              {showDriverHistory
                ? `${selectedDriverName} • Driver Operations`
                : isEdit
                  ? "Edit Logistics Shift"
                  : "Manual Logistics Operation"}
            </div>

            <div style={subtitle}>
              {showDriverHistory
                ? "Unified driver view: dispatch challans, active/completed trips and manual/legacy operations"
                : isEdit
                  ? "Update shift details and status"
                  : "Create a movement that does not have an item dispatch challan"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={closeBtn}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        {showDriverHistory && (
          <section style={historySection}>
            <div style={historyHeroRow}>
              <div>
                <div style={sectionEyebrow}>
                  DRIVER 360° ACTIVITY
                </div>
                <div style={sectionTitle}>
                  Unified Trip & Challan History
                </div>
                <div style={sectionSub}>
                  Current dispatch challans are the primary item-trip source. Manual records and older logistics trips remain visible without double-counting matching challans.
                </div>
              </div>

              {historyLoading && (
                <div style={loadingPill}>
                  Loading activity…
                </div>
              )}
            </div>

            {historyLoadWarning && (
              <div style={warningBox}>
                {historyLoadWarning}
              </div>
            )}

            <div style={activitySummaryGrid}>
              <ActivitySummaryCard
                label="All Activities"
                value={
                  activitySummary.totalActivities
                }
                detail="Unified records"
                accent="#60a5fa"
              />
              <ActivitySummaryCard
                label="Dispatch Challans"
                value={
                  activitySummary.currentChallans
                }
                detail={`${activitySummary.activeChallans} active`}
                accent="#22c55e"
              />
              <ActivitySummaryCard
                label="Items Dispatched"
                value={
                  activitySummary.dispatchedItems
                }
                detail="Current + non-duplicate legacy"
                accent="#8b5cf6"
              />
              <ActivitySummaryCard
                label="Manual Records"
                value={
                  activitySummary.manualRecords
                }
                detail={`${activitySummary.manualTrips} recorded trips`}
                accent="#f59e0b"
              />
            </div>

            <div style={historyFilters}>
              <input
                value={historySearch}
                onChange={(event) => {
                  setHistorySearch(
                    event.target.value
                  );
                  setHistoryPageNo(1);
                }}
                placeholder="Search challan, vehicle, client, PD, route or status…"
                style={historySearchInput}
              />

              <select
                value={historySource}
                onChange={(event) => {
                  setHistorySource(
                    event.target.value
                  );
                  setHistoryPageNo(1);
                }}
                style={historySelect}
              >
                <option value="ALL">
                  All Sources
                </option>
                <option value={SOURCE.CHALLAN}>
                  Dispatch Challans
                </option>
                <option value={SOURCE.MANUAL}>
                  Manual / Legacy
                </option>
                <option value={SOURCE.LEGACY_TRIP}>
                  Older Trip Records
                </option>
              </select>

              <select
                value={historyStatusFilter}
                onChange={(event) => {
                  setHistoryStatusFilter(
                    event.target.value
                  );
                  setHistoryPageNo(1);
                }}
                style={historySelect}
              >
                <option value="ALL">
                  All Statuses
                </option>
                <option value="ACTIVE">
                  Active / Running
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <label style={dateLabel}>
                From
                <input
                  type="date"
                  value={historyFromDate}
                  onChange={(event) => {
                    setHistoryFromDate(
                      event.target.value
                    );
                    setHistoryPageNo(1);
                  }}
                  style={dateInput}
                />
              </label>

              <label style={dateLabel}>
                To
                <input
                  type="date"
                  value={historyToDate}
                  onChange={(event) => {
                    setHistoryToDate(
                      event.target.value
                    );
                    setHistoryPageNo(1);
                  }}
                  style={dateInput}
                />
              </label>

              <button
                type="button"
                style={clearDateBtn}
                onClick={() => {
                  setHistorySearch("");
                  setHistorySource("ALL");
                  setHistoryStatusFilter("ALL");
                  setHistoryFromDate("");
                  setHistoryToDate("");
                  setHistoryPageNo(1);
                }}
              >
                Clear
              </button>
            </div>

            <div className="logistics-scrollbar logistics-scrollbar-x logistics-table-scroll" style={historyTable}>
              <div style={historyHead}>
                <div>Date / Time</div>
                <div>Source</div>
                <div>Challan / Operation</div>
                <div>Vehicle</div>
                <div>Load</div>
                <div>Status</div>
                <div>Action</div>
              </div>

              {!historyLoading &&
                paginatedHistoryRows.length === 0 && (
                  <div style={historyEmpty}>
                    No driver activity matched the selected filters.
                  </div>
                )}

              {paginatedHistoryRows.map(
                (activity) => {
                  const expanded =
                    expandedActivityKey ===
                    activity.key;

                  return (
                    <div key={activity.key}>
                      <div style={historyRow}>
                        <div>
                          <div style={historyDateText}>
                            {formatDateTime(
                              activity.startAt
                            )}
                          </div>
                          <div style={historyTimeText}>
                            {activity.endAt
                              ? `End: ${formatDateTime(
                                activity.endAt
                              )}`
                              : "End: Running / not recorded"}
                          </div>
                          {activity.durationMinutes >
                            0 && (
                              <div style={durationText}>
                                {formatDuration(
                                  activity.durationMinutes
                                )}
                              </div>
                            )}
                        </div>

                        <div>
                          <span
                            style={sourcePill(
                              activity.source
                            )}
                          >
                            {activity.sourceLabel}
                          </span>
                        </div>

                        <div>
                          <div style={challanText}>
                            {activity.challanNumber}
                          </div>
                          <div style={miniMeta}>
                            {activity.routeCategory ||
                              "—"}
                          </div>
                        </div>

                        <div>
                          {activity.vehicleNumber ||
                            "—"}
                        </div>

                        <div>
                          {activity.source ===
                            SOURCE.MANUAL
                            ? `${activity.tripCount} trip${activity.tripCount === 1
                              ? ""
                              : "s"
                            }`
                            : `${activity.itemCount} item${activity.itemCount === 1
                              ? ""
                              : "s"
                            }`}
                        </div>

                        <div>
                          <span
                            style={historyStatus(
                              activity.status
                            )}
                          >
                            {activity.status || "—"}
                          </span>
                        </div>

                        <div style={rowActions}>
                          <button
                            type="button"
                            style={detailsBtn}
                            onClick={() =>
                              setExpandedActivityKey(
                                expanded
                                  ? ""
                                  : activity.key
                              )
                            }
                          >
                            {expanded
                              ? "Hide"
                              : "Details"}
                          </button>

                          {activity.source ===
                            SOURCE.CHALLAN && (
                              <>
                                <button
                                  type="button"
                                  style={previewBtn}
                                  disabled={
                                    downloadingKey ===
                                    `PREVIEW:${activity.key}`
                                  }
                                  onClick={() =>
                                    previewActivityChallan(
                                      activity
                                    )
                                  }
                                >
                                  {downloadingKey ===
                                    `PREVIEW:${activity.key}`
                                    ? "Opening…"
                                    : "Preview"}
                                </button>

                                <button
                                  type="button"
                                  style={pdfBtn}
                                  disabled={
                                    downloadingKey ===
                                    activity.key
                                  }
                                  onClick={() =>
                                    downloadActivityChallan(
                                      activity
                                    )
                                  }
                                >
                                  {downloadingKey ===
                                    activity.key
                                    ? "PDF…"
                                    : "Download"}
                                </button>

                                <button
                                  type="button"
                                  style={endTimeActionBtn}
                                  onClick={() =>
                                    openActivityEndTrip(
                                      activity
                                    )
                                  }
                                >
                                  {activity.endAt
                                    ? "Edit End"
                                    : "Enter End"}
                                </button>

                                <button
                                  type="button"
                                  style={helperActionBtn}
                                  onClick={() =>
                                    openActivityHelpers(
                                      activity
                                    )
                                  }
                                >
                                  {activity.helperCount > 0
                                    ? "Edit Helpers"
                                    : "Enter Helpers"}
                                </button>
                              </>
                            )}

                          {activity.source ===
                            SOURCE.LEGACY_TRIP && (
                              <button
                                type="button"
                                style={pdfBtn}
                                disabled={
                                  downloadingKey ===
                                  activity.key
                                }
                                onClick={() =>
                                  downloadActivityChallan(
                                    activity
                                  )
                                }
                              >
                                {downloadingKey ===
                                  activity.key
                                  ? "PDF…"
                                  : "Download"}
                              </button>
                            )}
                        </div>
                      </div>

                      {expanded && (
                        <ActivityDetails
                          activity={activity}
                        />
                      )}
                    </div>
                  );
                }
              )}
            </div>

            {filteredActivities.length > 0 && (
              <div style={historyPaginationWrap}>
                <div style={historyResultNote}>
                  <span style={historyResultDot} />

                  <span>
                    {filteredActivities.length} matching of{" "}
                    {activitySummary.totalActivities} unified driver activities
                  </span>
                </div>

                <LogisticsPagination
                  pageNo={historyCurrentPage}
                  setPageNo={setHistoryPageNo}
                  pageSize={historyPageSize}
                  setPageSize={setHistoryPageSize}
                  totalItems={filteredActivities.length}
                  label="activities"
                  pageSizeOptions={[5, 10, 25, 50]}
                  compact
                />
              </div>
            )}
          </section>
        )}

        <section style={createSection}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionTitle}>
                {isEdit
                  ? "Edit Shift Details"
                  : "Create Manual Operation"}
              </div>

              <div style={sectionSub}>
                Use manual operations only for non-challan movements. General shift timing is 09:00 AM - 06:00 PM.
              </div>
            </div>
          </div>

          <div style={grid}>
            <Field label="Driver">
              <select
                value={form.driverId}
                disabled={lockDriver}
                onChange={(event) =>
                  update(
                    "driverId",
                    event.target.value
                  )
                }
                style={{
                  ...input,
                  opacity: lockDriver
                    ? 0.75
                    : 1,
                  cursor: lockDriver
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                <option value="">
                  Select Driver
                </option>
                {drivers.map((driver) => (
                  <option
                    key={driver.id}
                    value={driver.id}
                  >
                    {driver.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Vehicle">
              <select
                value={form.vehicleId}
                onChange={(event) =>
                  update(
                    "vehicleId",
                    event.target.value
                  )
                }
                style={input}
              >
                <option value="">
                  Select Vehicle
                </option>
                {vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.vehicleNumber}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Shift Start">
              <input
                type="datetime-local"
                style={input}
                value={form.shiftStart}
                onChange={(event) =>
                  update(
                    "shiftStart",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field label="Shift End">
              <input
                type="datetime-local"
                style={input}
                value={form.shiftEnd}
                onChange={(event) =>
                  update(
                    "shiftEnd",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field label="Trips">
              <input
                type="number"
                min="0"
                style={input}
                value={form.totalTrips}
                onChange={(event) =>
                  update(
                    "totalTrips",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="Helpers">
              <input
                type="number"
                min="0"
                style={input}
                value={form.totalHelpers}
                onChange={(event) =>
                  update(
                    "totalHelpers",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="Fuel Used">
              <input
                type="number"
                min="0"
                step="0.01"
                style={input}
                value={form.fuelUsed}
                onChange={(event) =>
                  update(
                    "fuelUsed",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="Distance">
              <input
                type="number"
                min="0"
                step="0.01"
                style={input}
                value={form.totalDistance}
                onChange={(event) =>
                  update(
                    "totalDistance",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="Overtime">
              <input
                type="number"
                min="0"
                step="0.25"
                style={input}
                value={form.overtimeHours}
                onChange={(event) =>
                  update(
                    "overtimeHours",
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="Route">
              <select
                style={input}
                value={form.routeCategory}
                onChange={(event) =>
                  update(
                    "routeCategory",
                    event.target.value
                  )
                }
              >
                <option value="Factory">
                  Factory
                </option>
                <option value="Residential">
                  Residential
                </option>
                <option value="Mall">
                  Mall
                </option>
                <option value="Warehouse">
                  Warehouse
                </option>
              </select>
            </Field>

            <Field label="Status">
              <select
                style={input}
                value={form.status}
                onChange={(event) =>
                  update(
                    "status",
                    event.target.value
                  )
                }
              >
                <option value="WORKING">
                  WORKING
                </option>
                <option value="COMPLETED">
                  COMPLETED
                </option>
                <option value="OFF">
                  OFF
                </option>
                <option value="ON_LEAVE">
                  ON_LEAVE
                </option>
                <option value="CANCELLED">
                  CANCELLED
                </option>
              </select>
            </Field>

            <Field label="Remarks">
              <textarea
                rows={3}
                style={textarea}
                value={form.remarks}
                onChange={(event) =>
                  update(
                    "remarks",
                    event.target.value
                  )
                }
              />
            </Field>
          </div>
        </section>


        {pdfPreview.open && (
          <div
            style={actionOverlay}
            onClick={closePdfPreview}
          >
            <div
              style={pdfPreviewModal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div style={actionModalHeader}>
                <div>
                  <div style={actionModalTitle}>
                    Challan PDF Preview
                  </div>
                  <div style={actionModalSub}>
                    {pdfPreview.challanNumber}
                  </div>
                </div>
                <button
                  type="button"
                  style={actionModalClose}
                  onClick={closePdfPreview}
                >
                  ✕
                </button>
              </div>

              <iframe
                title="Dispatch Challan PDF Preview"
                src={pdfPreview.url}
                style={pdfFrame}
              />
            </div>
          </div>
        )}

        {endTripDialog.open && (
          <div
            style={actionOverlay}
            onClick={() =>
              setEndTripDialog({
                open: false,
                challanNumber: "",
                endTime: "",
              })
            }
          >
            <div
              style={actionFormModal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div style={actionModalHeader}>
                <div>
                  <div style={actionModalTitle}>
                    Trip End Time
                  </div>
                  <div style={actionModalSub}>
                    {endTripDialog.challanNumber}
                  </div>
                </div>
              </div>

              <label style={actionField}>
                End Date / Time
                <input
                  type="datetime-local"
                  value={endTripDialog.endTime}
                  onChange={(event) =>
                    setEndTripDialog(
                      (previous) => ({
                        ...previous,
                        endTime:
                          event.target.value,
                      })
                    )
                  }
                  style={actionInput}
                />
              </label>

              <div style={actionModalFooter}>
                <button
                  type="button"
                  style={actionCancelBtn}
                  onClick={() =>
                    setEndTripDialog({
                      open: false,
                      challanNumber: "",
                      endTime: "",
                    })
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={actionSaveBtn}
                  disabled={challanActionSaving}
                  onClick={submitActivityEndTrip}
                >
                  {challanActionSaving
                    ? "Saving..."
                    : "Save End Time"}
                </button>
              </div>
            </div>
          </div>
        )}

        {helperDialog.open && (
          <div
            style={actionOverlay}
            onClick={() =>
              setHelperDialog({
                open: false,
                challanNumber: "",
                helperLoaderCount: "",
              })
            }
          >
            <div
              style={actionFormModal}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div style={actionModalHeader}>
                <div>
                  <div style={actionModalTitle}>
                    Helpers / Loaders
                  </div>
                  <div style={actionModalSub}>
                    {helperDialog.challanNumber}
                  </div>
                </div>
              </div>

              <label style={actionField}>
                Number of Helpers / Loaders
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="1"
                  value={
                    helperDialog.helperLoaderCount
                  }
                  onChange={(event) =>
                    setHelperDialog(
                      (previous) => ({
                        ...previous,
                        helperLoaderCount:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Leave blank / 0 to clear"
                  style={actionInput}
                />
              </label>

              <div style={actionModalHint}>
                Leave blank or enter 0 to clear helpers / loaders for this challan.
              </div>

              <div style={actionModalFooter}>
                <button
                  type="button"
                  style={actionCancelBtn}
                  onClick={() =>
                    setHelperDialog({
                      open: false,
                      challanNumber: "",
                      helperLoaderCount: "",
                    })
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={helperSaveBtn}
                  disabled={challanActionSaving}
                  onClick={submitActivityHelpers}
                >
                  {challanActionSaving
                    ? "Saving..."
                    : "Save Helpers"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={footer}>
          <button
            type="button"
            style={cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>

          <button
            type="button"
            style={{
              ...saveBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={submit}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isEdit
                ? "Update Shift"
                : "Create Operation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivitySummaryCard({
  label,
  value,
  detail,
  accent,
}) {
  return (
    <div
      style={{
        ...activitySummaryCard,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div style={activitySummaryLabel}>
        {label}
      </div>
      <div style={activitySummaryValue}>
        {value}
      </div>
      <div style={activitySummaryDetail}>
        {detail}
      </div>
    </div>
  );
}

function ActivityDetails({
  activity,
}) {
  if (activity.source === SOURCE.CHALLAN) {
    const items = Array.isArray(
      activity.raw?.items
    )
      ? activity.raw.items
      : [];

    return (
      <div style={detailsPanel}>
        <div style={detailsGrid}>
          <DetailValue
            label="Helpers / Loaders"
            value={
              activity.helperCount || "—"
            }
          />
          <DetailValue
            label="Clients"
            value={
              activity.clients?.join(", ") ||
              "—"
            }
          />
          <DetailValue
            label="PD Numbers"
            value={
              activity.pdNos?.join(", ") ||
              "—"
            }
          />
          <DetailValue
            label="Duration"
            value={formatDuration(
              activity.durationMinutes
            )}
          />
        </div>

        {items.length > 0 && (
          <div style={itemPreviewWrap}>
            <div style={itemPreviewTitle}>
              Dispatched Items
            </div>
            {items.slice(0, 6).map((item, index) => (
              <div
                key={
                  item?.zohoItemId ||
                  item?.id ||
                  index
                }
                style={itemPreviewRow}
              >
                <span>
                  {item?.name ||
                    item?.itemName ||
                    "Item"}
                </span>
                <span>
                  PD: {item?.pdNo || "—"}
                </span>
                <span>
                  {item?.clientName || "—"}
                </span>
              </div>
            ))}
            {items.length > 6 && (
              <div style={moreItemsText}>
                + {items.length - 6} more item(s)
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (activity.source === SOURCE.MANUAL) {
    return (
      <div style={detailsPanel}>
        <div style={detailsGrid}>
          <DetailValue
            label="Trips"
            value={activity.tripCount}
          />
          <DetailValue
            label="Helpers"
            value={activity.helperCount}
          />
          <DetailValue
            label="Fuel"
            value={activity.fuelUsed}
          />
          <DetailValue
            label="Distance"
            value={activity.totalDistance}
          />
          <DetailValue
            label="Route"
            value={activity.routeCategory}
          />
          <DetailValue
            label="Remarks"
            value={activity.remarks || "—"}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={detailsPanel}>
      <div style={detailsGrid}>
        <DetailValue
          label="Items"
          value={activity.itemCount}
        />
        <DetailValue
          label="Duration"
          value={formatDuration(
            activity.durationMinutes
          )}
        />
        <DetailValue
          label="Vehicle"
          value={activity.vehicleNumber}
        />
        <DetailValue
          label="Status"
          value={activity.status}
        />
      </div>
    </div>
  );
}

function DetailValue({
  label,
  value,
}) {
  return (
    <div style={detailValueBox}>
      <div style={detailValueLabel}>
        {label}
      </div>
      <div style={detailValueText}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}) {
  return (
    <div style={field}>
      <div style={fieldLabel}>
        {label}
      </div>
      {children}
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.60)",
  backdropFilter: "blur(8px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const modal = {
  width: "95%",
  maxWidth: 1220,
  borderRadius: 24,
  padding: 24,
  background:
    "linear-gradient(180deg,#020617,#0f172a)",
  border:
    "1px solid rgba(255,255,255,0.08)",
  boxShadow:
    "0 28px 80px rgba(0,0,0,0.55)",
  maxHeight: "92vh",
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarGutter: "stable",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 22,
};

const title = {
  color: "#fff",
  fontSize: 24,
  fontWeight: 900,
};

const subtitle = {
  color: "#94a3b8",
  marginTop: 6,
  lineHeight: 1.5,
};

const closeBtn = {
  background: "rgba(255,255,255,.04)",
  border:
    "1px solid rgba(255,255,255,.08)",
  color: "#fff",
  width: 38,
  height: 38,
  borderRadius: 12,
  fontSize: 18,
  cursor: "pointer",
};

const historySection = {
  borderRadius: 20,
  padding: 18,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.52),rgba(15,23,42,.48))",
  border:
    "1px solid rgba(255,255,255,.08)",
  marginBottom: 20,
};

const historyHeroRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 15,
};

const sectionEyebrow = {
  color: "#60a5fa",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: ".12em",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
};

const sectionTitle = {
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
};

const sectionSub = {
  color: "#94a3b8",
  fontSize: 12,
  marginTop: 5,
  lineHeight: 1.5,
};

const loadingPill = {
  padding: "8px 12px",
  borderRadius: 999,
  color: "#93c5fd",
  background:
    "rgba(59,130,246,.10)",
  border:
    "1px solid rgba(59,130,246,.18)",
  fontSize: 11,
  fontWeight: 850,
};

const warningBox = {
  padding: "10px 12px",
  marginBottom: 14,
  borderRadius: 12,
  color: "#fbbf24",
  background:
    "rgba(245,158,11,.08)",
  border:
    "1px solid rgba(245,158,11,.16)",
  fontSize: 11,
  fontWeight: 750,
};

const activitySummaryGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const activitySummaryCard = {
  padding: 13,
  minHeight: 86,
  borderRadius: 14,
  background:
    "rgba(2,6,23,.42)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const activitySummaryLabel = {
  color: "#94a3b8",
  fontSize: 10.5,
  fontWeight: 850,
};

const activitySummaryValue = {
  marginTop: 6,
  color: "#fff",
  fontSize: 24,
  fontWeight: 950,
};

const activitySummaryDetail = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
};

const historyFilters = {
  display: "grid",
  gridTemplateColumns:
    "minmax(230px,1.4fr) minmax(150px,.8fr) minmax(150px,.8fr) auto auto auto",
  gap: 9,
  alignItems: "end",
  marginBottom: 14,
};

const historySearchInput = {
  height: 38,
  minWidth: 0,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 11px",
  outline: "none",
  fontWeight: 700,
};

const historySelect = {
  height: 38,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 9px",
  outline: "none",
  fontWeight: 750,
};

const dateLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
};

const dateInput = {
  height: 38,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 9px",
  outline: "none",
  colorScheme: "dark",
};

const clearDateBtn = {
  height: 38,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  background:
    "rgba(255,255,255,.04)",
  color: "#fff",
  fontWeight: 800,
  padding: "0 12px",
  cursor: "pointer",
};

const historyTable = {
  borderRadius: 16,
  overflowX: "auto",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const historyHead = {
  minWidth: 1260,
  display: "grid",
  gridTemplateColumns:
    "1.35fr .85fr 1.1fr .85fr .6fr .72fr 1.65fr",
  padding: 13,
  background: "#111827",
  color: "#94a3b8",
  fontWeight: 850,
  fontSize: 11,
};

const historyRow = {
  minWidth: 1260,
  display: "grid",
  gridTemplateColumns:
    "1.35fr .85fr 1.1fr .85fr .6fr .72fr 1.65fr",
  padding: 13,
  color: "#fff",
  borderTop:
    "1px solid rgba(255,255,255,.06)",
  alignItems: "center",
  fontSize: 12,
};

const historyEmpty = {
  padding: 28,
  color: "#94a3b8",
  textAlign: "center",
};

const historyDateText = {
  color: "#fff",
  fontWeight: 850,
  fontSize: 12,
};

const historyTimeText = {
  color: "#64748b",
  fontSize: 10,
  marginTop: 3,
};

const durationText = {
  color: "#93c5fd",
  fontSize: 9.5,
  marginTop: 4,
  fontWeight: 800,
};

const challanText = {
  color: "#fff",
  fontWeight: 900,
  fontFamily: "monospace",
};

const miniMeta = {
  color: "#64748b",
  fontSize: 10,
  marginTop: 4,
};

const sourcePill = (source) => ({
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 9.5,
  fontWeight: 900,
  background:
    source === SOURCE.CHALLAN
      ? "rgba(34,197,94,.13)"
      : source === SOURCE.MANUAL
        ? "rgba(139,92,246,.13)"
        : "rgba(245,158,11,.13)",
  color:
    source === SOURCE.CHALLAN
      ? "#4ade80"
      : source === SOURCE.MANUAL
        ? "#c4b5fd"
        : "#fbbf24",
  border:
    source === SOURCE.CHALLAN
      ? "1px solid rgba(34,197,94,.22)"
      : source === SOURCE.MANUAL
        ? "1px solid rgba(139,92,246,.22)"
        : "1px solid rgba(245,158,11,.22)",
});

const historyStatus = (value) => {
  const status = normalizeStatus(value);

  const completed = [
    "COMPLETED",
    "ENDED",
    "DELIVERED",
  ].includes(status);
  const active = [
    "RUNNING",
    "WORKING",
    "OUT_FOR_DELIVERY",
    "ACTIVE",
  ].includes(status);
  const cancelled =
    status === "CANCELLED";

  return {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 9.5,
    fontWeight: 900,
    background: cancelled
      ? "rgba(239,68,68,.13)"
      : completed
        ? "rgba(59,130,246,.13)"
        : active
          ? "rgba(34,197,94,.13)"
          : "rgba(148,163,184,.13)",
    color: cancelled
      ? "#f87171"
      : completed
        ? "#60a5fa"
        : active
          ? "#4ade80"
          : "#cbd5e1",
  };
};

const rowActions = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const detailsBtn = {
  height: 29,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(96,165,250,.20)",
  background:
    "rgba(59,130,246,.10)",
  color: "#93c5fd",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const pdfBtn = {
  height: 29,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(251,191,36,.20)",
  background:
    "rgba(251,191,36,.10)",
  color: "#facc15",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};


const previewBtn = {
  height: 29,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(34,211,238,.20)",
  background:
    "rgba(34,211,238,.09)",
  color: "#67e8f9",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const endTimeActionBtn = {
  height: 29,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(239,68,68,.22)",
  background:
    "rgba(239,68,68,.10)",
  color: "#fca5a5",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const helperActionBtn = {
  height: 29,
  padding: "0 9px",
  borderRadius: 9,
  border:
    "1px solid rgba(167,139,250,.22)",
  background:
    "rgba(139,92,246,.10)",
  color: "#c4b5fd",
  fontSize: 10,
  fontWeight: 850,
  cursor: "pointer",
};

const detailsPanel = {
  padding: "13px 15px",
  background:
    "rgba(2,6,23,.55)",
  borderTop:
    "1px solid rgba(255,255,255,.05)",
};

const detailsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(160px,1fr))",
  gap: 8,
};

const detailValueBox = {
  padding: 10,
  borderRadius: 10,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px solid rgba(255,255,255,.05)",
};

const detailValueLabel = {
  color: "#64748b",
  fontSize: 9,
  fontWeight: 900,
  textTransform: "uppercase",
};

const detailValueText = {
  marginTop: 4,
  color: "#e2e8f0",
  fontSize: 11,
  fontWeight: 750,
  wordBreak: "break-word",
};

const itemPreviewWrap = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  background:
    "rgba(59,130,246,.045)",
  border:
    "1px solid rgba(59,130,246,.09)",
};

const itemPreviewTitle = {
  color: "#93c5fd",
  fontSize: 10,
  fontWeight: 900,
  marginBottom: 6,
};

const itemPreviewRow = {
  display: "grid",
  gridTemplateColumns:
    "1.4fr .7fr 1fr",
  gap: 8,
  padding: "6px 0",
  color: "#cbd5e1",
  fontSize: 10,
  borderTop:
    "1px solid rgba(255,255,255,.04)",
};

const moreItemsText = {
  marginTop: 7,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 750,
};

const historyPaginationWrap = {
  marginTop: 14,
  paddingTop: 12,
  borderTop:
    "1px solid rgba(255,255,255,.055)",
};

const historyResultNote = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#7f8ea3",
  fontSize: 9.5,
  fontWeight: 750,
  lineHeight: 1.4,
};

const historyResultDot = {
  width: 6,
  height: 6,
  flexShrink: 0,
  borderRadius: "50%",
  background: "#60a5fa",
  boxShadow:
    "0 0 10px rgba(96,165,250,.55)",
};

const createSection = {
  borderRadius: 20,
  padding: 18,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0,1fr))",
  gap: 18,
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldLabel = {
  color: "#cbd5e1",
  fontSize: 13,
  fontWeight: 700,
};

const input = {
  height: 46,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: "0 14px",
  outline: "none",
  colorScheme: "dark",
};

const textarea = {
  minHeight: 88,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#111827",
  color: "#fff",
  padding: 14,
  outline: "none",
  resize: "vertical",
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 24,
};

const cancelBtn = {
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,0.08)",
  background: "#1e293b",
  color: "#fff",
  cursor: "pointer",
};

const saveBtn = {
  height: 44,
  padding: "0 22px",
  borderRadius: 12,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  color: "#fff",
  fontWeight: 800,
};


const actionOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 11000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(2,6,23,.78)",
  backdropFilter: "blur(10px)",
};

const pdfPreviewModal = {
  width: "min(1100px,96vw)",
  height: "min(820px,90vh)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 22,
  background: "#020617",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "0 30px 90px rgba(0,0,0,.55)",
};

const actionFormModal = {
  width: "min(440px,94vw)",
  padding: 20,
  borderRadius: 20,
  background:
    "linear-gradient(180deg,#0f172a,#111827)",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "0 30px 80px rgba(0,0,0,.48)",
};

const actionModalHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid rgba(255,255,255,.07)",
};

const actionModalTitle = {
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
};

const actionModalSub = {
  marginTop: 4,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 750,
  fontFamily: "monospace",
};

const actionModalClose = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  cursor: "pointer",
};

const pdfFrame = {
  flex: 1,
  width: "100%",
  border: "none",
  background: "#fff",
};

const actionField = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginTop: 16,
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 850,
};

const actionInput = {
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(255,255,255,.04)",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
  colorScheme: "dark",
};

const actionModalHint = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 10,
  lineHeight: 1.45,
};

const actionModalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 9,
  marginTop: 18,
};

const actionCancelBtn = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.04)",
  color: "#cbd5e1",
  fontWeight: 800,
  cursor: "pointer",
};

const actionSaveBtn = {
  height: 38,
  padding: "0 15px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const helperSaveBtn = {
  ...actionSaveBtn,
  background: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
};

export default LogisticsShiftModal;
