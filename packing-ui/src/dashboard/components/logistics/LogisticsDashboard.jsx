import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import RefreshIcon from "@mui/icons-material/Refresh";

import ExecutiveSidebar from "./panels/ExecutiveSidebar";
import TripsLineChart from "./charts/TripsLineChart";
import StatusDistributionChart from "./charts/StatusDistributionChart";

import {
  fetchDispatchChallans,
  fetchDrivers,
  fetchShifts,
  fetchVehicles,
} from "../../api/logisticsApi";

import {
  parseBusinessDateTime,
} from "./logisticsUnifiedUtils";

import {
  isShiftOverSixPm,
} from "./logisticsDateTimeUtils";

const COMPLETED_CHALLAN_STATUSES = new Set([
  "ENDED",
  "COMPLETED",
  "DELIVERED",
]);

const PERIOD_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "Last 7 Days" },
  { value: "30D", label: "Last 30 Days" },
  { value: "ALL", label: "All Time" },
];

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isMissingValue = (value) => {
  const text = normalizeText(value);
  return (
    !text ||
    text === "-" ||
    text === "—" ||
    text === "NULL" ||
    text === "UNDEFINED"
  );
};

const getChallanLifecycleStatus = (challan) => {
  const status = normalizeStatus(
    challan?.tripStatus
  );

  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  if (
    challan?.tripEndedAt ||
    COMPLETED_CHALLAN_STATUSES.has(status)
  ) {
    return "COMPLETED";
  }

  return "RUNNING";
};

const getChallanStart = (challan) =>
  challan?.tripStartedAt ||
  challan?.dispatchedAt ||
  challan?.generatedAt ||
  challan?.createdAt ||
  null;

const getShiftStart = (shift) =>
  shift?.shiftStart ||
  shift?.date ||
  shift?.createdAt ||
  null;

const getDateKey = (value) => {
  const date = parseBusinessDateTime(value);
  if (!date) return "";

  const pad = (number) =>
    String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const formatChartDate = (dateKey) => {
  if (!dateKey) return "";
  const parts = dateKey.split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}`
    : dateKey;
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

const calculateRunningMinutes = (startValue) => {
  const start = parseBusinessDateTime(startValue);
  if (!start) return 0;

  return Math.max(
    0,
    Math.round(
      (Date.now() - start.getTime()) / 60000
    )
  );
};

const calculateDurationMinutes = (
  startValue,
  endValue,
  explicit
) => {
  const explicitNumber = Number(explicit);

  if (
    Number.isFinite(explicitNumber) &&
    explicitNumber > 0
  ) {
    return explicitNumber;
  }

  const start = parseBusinessDateTime(startValue);
  const end = parseBusinessDateTime(endValue);

  if (!start || !end) return 0;

  return Math.max(
    0,
    Math.round(
      (end.getTime() - start.getTime()) /
      60000
    )
  );
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

const periodStartDate = (period) => {
  if (period === "ALL") return null;

  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  if (period === "7D") {
    start.setDate(start.getDate() - 6);
  }

  if (period === "30D") {
    start.setDate(start.getDate() - 29);
  }

  return start;
};

const isInPeriod = (value, period) => {
  if (period === "ALL") return true;

  const date = parseBusinessDateTime(value);
  if (!date) return false;

  const start = periodStartDate(period);
  return !start || date.getTime() >= start.getTime();
};

const getPeriodLabel = (period) =>
  PERIOD_OPTIONS.find(
    (option) => option.value === period
  )?.label || "Selected Period";

const buildDriverLookup = (drivers) => {
  const byId = new Map();
  const byName = new Map();

  drivers.forEach((driver) => {
    if (driver?.id) {
      byId.set(String(driver.id), driver);
    }

    const nameKey = normalizeText(driver?.name);
    if (nameKey) {
      byName.set(nameKey, driver);
    }
  });

  return { byId, byName };
};

const buildVehicleLookup = (vehicles) => {
  const byId = new Map();
  const byNumber = new Map();

  vehicles.forEach((vehicle) => {
    if (vehicle?.id) {
      byId.set(String(vehicle.id), vehicle);
    }

    const numberKey = normalizeText(
      vehicle?.vehicleNumber
    );

    if (numberKey) {
      byNumber.set(numberKey, vehicle);
    }
  });

  return { byId, byNumber };
};

const getDriverIdentity = (
  driverId,
  driverName,
  lookup
) => {
  const idText = String(driverId || "").trim();
  const nameText = String(driverName || "").trim();

  const master =
    (idText && lookup.byId.get(idText)) ||
    (nameText &&
      lookup.byName.get(normalizeText(nameText))) ||
    null;

  if (master) {
    return {
      key: `DRIVER:${master.id}`,
      id: master.id,
      name: master.name || nameText || "Unknown Driver",
      master,
    };
  }

  if (idText) {
    return {
      key: `DRIVER:ID:${idText}`,
      id: idText,
      name: nameText || "Unknown Driver",
      master: null,
    };
  }

  if (nameText) {
    return {
      key: `DRIVER:NAME:${normalizeText(nameText)}`,
      id: "",
      name: nameText,
      master: null,
    };
  }

  return null;
};

const getVehicleIdentity = (
  vehicleId,
  vehicleNumber,
  lookup
) => {
  const idText = String(vehicleId || "").trim();
  const numberText = String(
    vehicleNumber || ""
  ).trim();

  const master =
    (idText && lookup.byId.get(idText)) ||
    (numberText &&
      lookup.byNumber.get(
        normalizeText(numberText)
      )) ||
    null;

  if (master) {
    return {
      key: `VEHICLE:${master.id}`,
      id: master.id,
      number:
        master.vehicleNumber ||
        numberText ||
        "Unknown Vehicle",
      master,
    };
  }

  if (idText) {
    return {
      key: `VEHICLE:ID:${idText}`,
      id: idText,
      number: numberText || "Unknown Vehicle",
      master: null,
    };
  }

  if (numberText) {
    return {
      key: `VEHICLE:NUMBER:${normalizeText(
        numberText
      )}`,
      id: "",
      number: numberText,
      master: null,
    };
  }

  return null;
};

function LogisticsDashboard({
  StatCard,
}) {
  const [section, setSection] =
    useState("summary");
  const [period, setPeriod] =
    useState("7D");
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [loadError, setLoadError] =
    useState("");
  const [challans, setChallans] =
    useState([]);
  const [shifts, setShifts] =
    useState([]);
  const [drivers, setDrivers] =
    useState([]);
  const [vehicles, setVehicles] =
    useState([]);

  const mountedRef = useRef(true);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(
    async ({ refresh = false } = {}) => {
      const requestId =
        latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setLoadError("");

        const results = await Promise.allSettled([
          fetchDispatchChallans(),
          fetchShifts(),
          fetchDrivers(),
          fetchVehicles(),
        ]);

        if (
          !mountedRef.current ||
          requestId !== latestRequestRef.current
        ) {
          return;
        }

        const [
          challanResult,
          shiftResult,
          driverResult,
          vehicleResult,
        ] = results;

        const failedSources = [];

        if (challanResult.status === "fulfilled") {
          setChallans(
            Array.isArray(challanResult.value)
              ? challanResult.value
              : []
          );
        } else {
          console.error(
            "Dispatch challan dashboard load failed",
            challanResult.reason
          );
          failedSources.push("dispatch challans");
        }

        if (shiftResult.status === "fulfilled") {
          setShifts(
            Array.isArray(shiftResult.value)
              ? shiftResult.value
              : []
          );
        } else {
          console.error(
            "Manual shift dashboard load failed",
            shiftResult.reason
          );
          failedSources.push("manual operations");
        }

        if (driverResult.status === "fulfilled") {
          setDrivers(
            Array.isArray(driverResult.value)
              ? driverResult.value
              : []
          );
        } else {
          console.error(
            "Driver dashboard load failed",
            driverResult.reason
          );
          failedSources.push("drivers");
        }

        if (vehicleResult.status === "fulfilled") {
          setVehicles(
            Array.isArray(vehicleResult.value)
              ? vehicleResult.value
              : []
          );
        } else {
          console.error(
            "Vehicle dashboard load failed",
            vehicleResult.reason
          );
          failedSources.push("vehicles");
        }

        if (
          failedSources.length ===
          results.length
        ) {
          throw new Error(
            "Unable to load logistics dashboard"
          );
        }

        if (failedSources.length > 0) {
          setLoadError(
            `Unable to refresh ${failedSources.join(
              ", "
            )}. Other available logistics data is still shown.`
          );
        }
      } catch (error) {
        console.error(error);

        if (
          mountedRef.current &&
          requestId === latestRequestRef.current
        ) {
          setLoadError(
            error?.message ||
            "Unable to load logistics dashboard"
          );
        }
      } finally {
        if (
          mountedRef.current &&
          requestId === latestRequestRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const driverLookup = useMemo(
    () => buildDriverLookup(drivers),
    [drivers]
  );

  const vehicleLookup = useMemo(
    () => buildVehicleLookup(vehicles),
    [vehicles]
  );

  const runningChallans = useMemo(
    () =>
      challans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "RUNNING"
      ),
    [challans]
  );

  const activeManualShifts = useMemo(
    () =>
      shifts.filter(
        (shift) =>
          normalizeStatus(shift?.status) ===
          "WORKING"
      ),
    [shifts]
  );

  const periodChallans = useMemo(
    () =>
      challans.filter((challan) =>
        isInPeriod(
          getChallanStart(challan),
          period
        )
      ),
    [challans, period]
  );

  const periodShifts = useMemo(
    () =>
      shifts.filter((shift) =>
        isInPeriod(getShiftStart(shift), period)
      ),
    [shifts, period]
  );

  const analytics = useMemo(() => {
    const completedPeriodChallans =
      periodChallans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "COMPLETED"
      );

    const cancelledPeriodChallans =
      periodChallans.filter(
        (challan) =>
          getChallanLifecycleStatus(challan) ===
          "CANCELLED"
      );

    const completedManual = periodShifts.filter(
      (shift) =>
        normalizeStatus(shift?.status) ===
        "COMPLETED"
    );

    const cancelledManual = periodShifts.filter(
      (shift) =>
        normalizeStatus(shift?.status) ===
        "CANCELLED"
    );

    const offManual = periodShifts.filter(
      (shift) =>
        ["OFF", "ON_LEAVE"].includes(
          normalizeStatus(shift?.status)
        )
    );

    const operationalManual = periodShifts.filter(
      (shift) =>
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
    );

    const totalDispatchedItems =
      periodChallans.reduce(
        (sum, challan) =>
          sum + safeNumber(challan?.totalItems),
        0
      );

    const activeDispatchedItems =
      runningChallans.reduce(
        (sum, challan) =>
          sum + safeNumber(challan?.totalItems),
        0
      );

    const totalHelpers = operationalManual.reduce(
      (sum, shift) =>
        sum +
        safeNumber(
          shift?.totalLoaders ??
          shift?.totalHelpers
        ),
      0
    );

    const totalFuel = operationalManual.reduce(
      (sum, shift) =>
        sum + safeNumber(shift?.fuelUsed),
      0
    );

    const totalDistance =
      operationalManual.reduce(
        (sum, shift) =>
          sum + safeNumber(shift?.totalDistance),
        0
      );

    const manualTripEntries =
      operationalManual.reduce(
        (sum, shift) =>
          sum + safeNumber(shift?.totalTrips),
        0
      );

    const activeDriverKeys = new Set();
    const activeVehicleKeys = new Set();

    runningChallans.forEach((challan) => {
      const driver = getDriverIdentity(
        challan?.driverId ||
        challan?.driver?.id,
        challan?.driverName ||
        challan?.driver?.name,
        driverLookup
      );

      const vehicle = getVehicleIdentity(
        challan?.vehicleId ||
        challan?.vehicle?.id,
        challan?.vehicleNumber ||
        challan?.vehicle?.vehicleNumber,
        vehicleLookup
      );

      if (driver) activeDriverKeys.add(driver.key);
      if (vehicle) activeVehicleKeys.add(vehicle.key);
    });

    activeManualShifts.forEach((shift) => {
      const driver = getDriverIdentity(
        shift?.driver?.id || shift?.driverId,
        shift?.driver?.name ||
        shift?.driverName,
        driverLookup
      );

      const vehicle = getVehicleIdentity(
        shift?.vehicle?.id ||
        shift?.vehicleId,
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber,
        vehicleLookup
      );

      if (driver) activeDriverKeys.add(driver.key);
      if (vehicle) activeVehicleKeys.add(vehicle.key);
    });

    const challansMissingDriver =
      runningChallans.filter(
        (challan) =>
          isMissingValue(challan?.driverName)
      ).length;

    const challansMissingVehicle =
      runningChallans.filter(
        (challan) =>
          isMissingValue(challan?.vehicleNumber)
      ).length;

    const longRunningChallans =
      runningChallans.filter(
        (challan) =>
          calculateRunningMinutes(
            getChallanStart(challan)
          ) >
          12 * 60
      ).length;

    const noStartTimeChallans =
      runningChallans.filter(
        (challan) =>
          !parseBusinessDateTime(
            getChallanStart(challan)
          )
      ).length;

    const completedDurations =
      completedPeriodChallans
        .map((challan) =>
          calculateDurationMinutes(
            getChallanStart(challan),
            challan?.tripEndedAt,
            challan?.tripDurationMinutes
          )
        )
        .filter((minutes) => minutes > 0);

    const avgTripDuration =
      completedDurations.length > 0
        ? completedDurations.reduce(
          (sum, value) => sum + value,
          0
        ) / completedDurations.length
        : 0;

    const completionRate =
      periodChallans.length > 0
        ? (completedPeriodChallans.length /
          periodChallans.length) *
        100
        : 0;

    const averageItemsPerChallan =
      periodChallans.length > 0
        ? totalDispatchedItems /
        periodChallans.length
        : 0;

    const activeDrivers = activeDriverKeys.size;
    const activeVehicles = activeVehicleKeys.size;

    const driverAssignmentRate =
      drivers.length > 0
        ? Math.min(
          100,
          (activeDrivers / drivers.length) *
          100
        )
        : 0;

    const vehicleUtilization =
      vehicles.length > 0
        ? Math.min(
          100,
          (activeVehicles / vehicles.length) *
          100
        )
        : 0;

    const routeCounts = {
      FACTORY: 0,
      RESIDENTIAL: 0,
      WAREHOUSE: 0,
      MALL: 0,
      OTHER: 0,
    };

    operationalManual.forEach((shift) => {
      const route = normalizeStatus(
        shift?.routeCategory
      );

      if (
        Object.prototype.hasOwnProperty.call(
          routeCounts,
          route
        )
      ) {
        routeCounts[route] += 1;
      } else {
        routeCounts.OTHER += 1;
      }
    });

    return {
      periodLabel: getPeriodLabel(period),
      totalChallans: periodChallans.length,
      runningChallans: runningChallans.length,
      completedChallans:
        completedPeriodChallans.length,
      cancelledChallans:
        cancelledPeriodChallans.length,
      totalDispatchedItems,
      activeDispatchedItems,
      averageItemsPerChallan,
      completionRate,
      avgTripDuration,
      totalManualRecords: periodShifts.length,
      activeManualOperations:
        activeManualShifts.length,
      completedManualOperations:
        completedManual.length,
      cancelledManualOperations:
        cancelledManual.length,
      availabilityRecords: offManual.length,
      manualTripEntries,
      totalHelpers,
      totalFuel,
      totalDistance,
      overShiftManualCount:
        operationalManual.filter(
          isShiftOverSixPm
        ).length,
      totalDrivers: drivers.length,
      activeDrivers,
      driverAssignmentRate,
      totalVehicles: vehicles.length,
      activeVehicles,
      vehicleUtilization,
      challansMissingDriver,
      challansMissingVehicle,
      longRunningChallans,
      noStartTimeChallans,
      attentionCount:
        challansMissingDriver +
        challansMissingVehicle +
        longRunningChallans +
        noStartTimeChallans,
      routeCounts,
    };
  }, [
    period,
    periodChallans,
    periodShifts,
    runningChallans,
    activeManualShifts,
    drivers,
    vehicles,
    driverLookup,
    vehicleLookup,
  ]);

  const driverPerformance = useMemo(() => {
    const map = new Map();

    const ensureDriver = (
      driverId,
      driverName
    ) => {
      const identity = getDriverIdentity(
        driverId,
        driverName,
        driverLookup
      );

      if (!identity) return null;

      if (!map.has(identity.key)) {
        map.set(identity.key, {
          key: identity.key,
          name: identity.name,
          challans: 0,
          completedChallans: 0,
          activeChallans: 0,
          dispatchedItems: 0,
          manualOperations: 0,
          manualTrips: 0,
          lastActivityAt: null,
        });
      }

      return map.get(identity.key);
    };

    periodChallans.forEach((challan) => {
      const row = ensureDriver(
        challan?.driverId ||
        challan?.driver?.id,
        challan?.driverName ||
        challan?.driver?.name
      );

      if (!row) return;

      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );

      const lifecycle =
        getChallanLifecycleStatus(challan);

      if (lifecycle === "COMPLETED") {
        row.completedChallans += 1;
      }

      if (lifecycle === "RUNNING") {
        row.activeChallans += 1;
      }

      const start = parseBusinessDateTime(
        getChallanStart(challan)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    periodShifts.forEach((shift) => {
      const row = ensureDriver(
        shift?.driver?.id || shift?.driverId,
        shift?.driver?.name ||
        shift?.driverName
      );

      if (!row) return;

      if (
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        row.manualOperations += 1;
        row.manualTrips += safeNumber(
          shift?.totalTrips
        );
      }

      const start = parseBusinessDateTime(
        getShiftStart(shift)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        activityCount:
          row.challans +
          row.manualOperations,
      }))
      .sort((a, b) =>
        b.activityCount - a.activityCount ||
        b.dispatchedItems -
        a.dispatchedItems ||
        a.name.localeCompare(b.name)
      );
  }, [
    periodChallans,
    periodShifts,
    driverLookup,
  ]);

  const vehiclePerformance = useMemo(() => {
    const map = new Map();

    const ensureVehicle = (
      vehicleId,
      vehicleNumber
    ) => {
      const identity = getVehicleIdentity(
        vehicleId,
        vehicleNumber,
        vehicleLookup
      );

      if (!identity) return null;

      if (!map.has(identity.key)) {
        map.set(identity.key, {
          key: identity.key,
          number: identity.number,
          challans: 0,
          completedChallans: 0,
          activeChallans: 0,
          dispatchedItems: 0,
          manualOperations: 0,
          manualTrips: 0,
          lastActivityAt: null,
        });
      }

      return map.get(identity.key);
    };

    periodChallans.forEach((challan) => {
      const row = ensureVehicle(
        challan?.vehicleId ||
        challan?.vehicle?.id,
        challan?.vehicleNumber ||
        challan?.vehicle?.vehicleNumber
      );

      if (!row) return;

      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );

      const lifecycle =
        getChallanLifecycleStatus(challan);

      if (lifecycle === "COMPLETED") {
        row.completedChallans += 1;
      }

      if (lifecycle === "RUNNING") {
        row.activeChallans += 1;
      }

      const start = parseBusinessDateTime(
        getChallanStart(challan)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    periodShifts.forEach((shift) => {
      const row = ensureVehicle(
        shift?.vehicle?.id ||
        shift?.vehicleId,
        shift?.vehicle?.vehicleNumber ||
        shift?.vehicleNumber
      );

      if (!row) return;

      if (
        ["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        row.manualOperations += 1;
        row.manualTrips += safeNumber(
          shift?.totalTrips
        );
      }

      const start = parseBusinessDateTime(
        getShiftStart(shift)
      );

      if (
        start &&
        (!row.lastActivityAt ||
          start.getTime() >
          row.lastActivityAt.getTime())
      ) {
        row.lastActivityAt = start;
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        activityCount:
          row.challans +
          row.manualOperations,
      }))
      .sort((a, b) =>
        b.activityCount - a.activityCount ||
        b.dispatchedItems -
        a.dispatchedItems ||
        a.number.localeCompare(b.number)
      );
  }, [
    periodChallans,
    periodShifts,
    vehicleLookup,
  ]);

  const attentionRows = useMemo(() => {
    const rows = [];

    runningChallans.forEach((challan) => {
      const startAt = getChallanStart(challan);
      const runningMinutes =
        calculateRunningMinutes(startAt);
      const challanNumber =
        challan?.challanNumber || "—";

      if (runningMinutes > 12 * 60) {
        rows.push({
          key: `LONG:${challanNumber}`,
          severity: "HIGH",
          title: "Long running challan trip",
          detail: `${challanNumber} • ${formatDuration(
            runningMinutes
          )} running • ${challan?.driverName || "No driver"
            } • ${challan?.vehicleNumber || "No vehicle"
            }`,
          startedAt: startAt,
        });
      }

      if (isMissingValue(challan?.driverName)) {
        rows.push({
          key: `DRIVER:${challanNumber}`,
          severity: "MEDIUM",
          title: "Driver missing",
          detail: `${challanNumber} has no driver assigned`,
          startedAt: startAt,
        });
      }

      if (isMissingValue(challan?.vehicleNumber)) {
        rows.push({
          key: `VEHICLE:${challanNumber}`,
          severity: "MEDIUM",
          title: "Vehicle missing",
          detail: `${challanNumber} has no vehicle assigned`,
          startedAt: startAt,
        });
      }

      if (!parseBusinessDateTime(startAt)) {
        rows.push({
          key: `START:${challanNumber}`,
          severity: "MEDIUM",
          title: "Trip start time missing",
          detail: `${challanNumber} is running without a valid start timestamp`,
          startedAt: null,
        });
      }
    });

    return rows.sort((a, b) => {
      const severityRank = {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };

      const rankDiff =
        (severityRank[b.severity] || 0) -
        (severityRank[a.severity] || 0);

      if (rankDiff !== 0) return rankDiff;

      const aTime =
        parseBusinessDateTime(a.startedAt)
          ?.getTime() || 0;
      const bTime =
        parseBusinessDateTime(b.startedAt)
          ?.getTime() || 0;

      return aTime - bTime;
    });
  }, [runningChallans]);

  const recentActivity = useMemo(() => {
    const rows = [];

    periodChallans.forEach((challan) => {
      rows.push({
        key: `CHALLAN:${challan?.challanNumber || getChallanStart(challan) || challan?.driverName || "UNKNOWN"}`,
        source: "Dispatch Challan",
        title:
          challan?.challanNumber ||
          "Dispatch Challan",
        subtitle: `${challan?.driverName || "No driver"} • ${challan?.vehicleNumber || "No vehicle"} • ${safeNumber(challan?.totalItems)} items`,
        status:
          getChallanLifecycleStatus(challan),
        at: getChallanStart(challan),
      });
    });

    periodShifts.forEach((shift) => {
      rows.push({
        key: `MANUAL:${shift?.id || getShiftStart(shift) || shift?.driver?.name || shift?.driverName || "UNKNOWN"}`,
        source: "Manual / Legacy",
        title:
          shift?.routeCategory ||
          "Manual Operation",
        subtitle: `${shift?.driver?.name || shift?.driverName || "No driver"} • ${shift?.vehicle?.vehicleNumber || shift?.vehicleNumber || "No vehicle"} • ${safeNumber(shift?.totalTrips)} trips`,
        status: normalizeStatus(
          shift?.status || "WORKING"
        ),
        at: getShiftStart(shift),
      });
    });

    return rows
      .sort((a, b) => {
        const aTime =
          parseBusinessDateTime(a.at)
            ?.getTime() || 0;
        const bTime =
          parseBusinessDateTime(b.at)
            ?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [periodChallans, periodShifts]);

  const timelineData = useMemo(() => {
    const map = new Map();

    const ensureRow = (dateKey) => {
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          date: formatChartDate(dateKey),
          challans: 0,
          manualOperations: 0,
          dispatchedItems: 0,
        });
      }

      return map.get(dateKey);
    };

    periodChallans.forEach((challan) => {
      const dateKey = getDateKey(
        getChallanStart(challan)
      );
      if (!dateKey) return;

      const row = ensureRow(dateKey);
      row.challans += 1;
      row.dispatchedItems += safeNumber(
        challan?.totalItems
      );
    });

    periodShifts.forEach((shift) => {
      if (
        !["WORKING", "COMPLETED"].includes(
          normalizeStatus(shift?.status)
        )
      ) {
        return;
      }

      const dateKey = getDateKey(
        getShiftStart(shift)
      );
      if (!dateKey) return;

      const row = ensureRow(dateKey);
      row.manualOperations += 1;
    });

    return Array.from(map.values())
      .sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey)
      )
      .slice(-14);
  }, [periodChallans, periodShifts]);

  const statusData = useMemo(
    () => [
      {
        name: "Running Challans",
        value: analytics.runningChallans,
        color: "#22c55e",
      },
      {
        name: "Completed Challans",
        value: analytics.completedChallans,
        color: "#3b82f6",
      },
      {
        name: "Active Manual",
        value: analytics.activeManualOperations,
        color: "#8b5cf6",
      },
      {
        name: "Completed Manual",
        value: analytics.completedManualOperations,
        color: "#06b6d4",
      },
      {
        name: "Cancelled",
        value:
          analytics.cancelledManualOperations +
          analytics.cancelledChallans,
        color: "#ef4444",
      },
      {
        name: "Off / Leave",
        value: analytics.availabilityRecords,
        color: "#f59e0b",
      },
    ].filter((entry) => entry.value > 0),
    [analytics]
  );

  const sectionData = useMemo(() => {
    switch (section) {
      case "dispatch":
        return {
          title: "Dispatch Challan Intelligence",
          subtitle: `${analytics.periodLabel} item-dispatch activity, completion and trip load`,
          cards: [
            {
              title: "Challans in Period",
              value: analytics.totalChallans,
              subtle: analytics.periodLabel,
              accent: "#60a5fa",
            },
            {
              title: "Running Now",
              value: analytics.runningChallans,
              subtle: "Awaiting trip end time",
              accent: "#22c55e",
            },
            {
              title: "Completion Rate",
              value: `${analytics.completionRate.toFixed(0)}%`,
              subtle: `${analytics.completedChallans} completed`,
              accent: "#3b82f6",
            },
            {
              title: "Dispatched Items",
              value: analytics.totalDispatchedItems,
              subtle: `${analytics.averageItemsPerChallan.toFixed(1)} avg / challan`,
              accent: "#8b5cf6",
            },
          ],
        };

      case "drivers":
        return {
          title: "Driver Operations Intelligence",
          subtitle: "Current assignments plus period-wise driver workload and dispatch output",
          cards: [
            {
              title: "Registered Drivers",
              value: analytics.totalDrivers,
              subtle: "Driver master records",
              accent: "#8b5cf6",
            },
            {
              title: "Drivers Active Now",
              value: analytics.activeDrivers,
              subtle: "Challan + manual operations",
              accent: "#22c55e",
            },
            {
              title: "Assignment Rate",
              value: `${analytics.driverAssignmentRate.toFixed(0)}%`,
              subtle: "Active / registered",
              accent: "#3b82f6",
            },
            {
              title: "Missing Driver",
              value: analytics.challansMissingDriver,
              subtle: "Running challans needing review",
              accent: "#ef4444",
            },
          ],
        };

      case "vehicles":
        return {
          title: "Vehicle Utilization Intelligence",
          subtitle: "Fleet usage, current assignments and period dispatch throughput",
          cards: [
            {
              title: "Registered Vehicles",
              value: analytics.totalVehicles,
              subtle: "Vehicle master records",
              accent: "#8b5cf6",
            },
            {
              title: "Vehicles Active Now",
              value: analytics.activeVehicles,
              subtle: "Current operational usage",
              accent: "#22c55e",
            },
            {
              title: "Fleet Utilization",
              value: `${analytics.vehicleUtilization.toFixed(0)}%`,
              subtle: "Active / registered",
              accent: "#3b82f6",
            },
            {
              title: "Missing Vehicle",
              value: analytics.challansMissingVehicle,
              subtle: "Running challans needing review",
              accent: "#ef4444",
            },
          ],
        };

      case "manual":
        return {
          title: "Manual & Legacy Operations",
          subtitle: `${analytics.periodLabel} non-challan activity kept separate from dispatch challans`,
          cards: [
            {
              title: "Manual Records",
              value: analytics.totalManualRecords,
              subtle: analytics.periodLabel,
              accent: "#8b5cf6",
            },
            {
              title: "Active Manual Ops",
              value: analytics.activeManualOperations,
              subtle: "Currently WORKING",
              accent: "#22c55e",
            },
            {
              title: "Manual Trip Entries",
              value: analytics.manualTripEntries,
              subtle: "Recorded trip count",
              accent: "#3b82f6",
            },
            {
              title: "Over Shift Records",
              value: analytics.overShiftManualCount,
              subtle: "Ended after 06:00 PM",
              accent: "#f59e0b",
            },
          ],
        };

      case "resources":
        return {
          title: "Manual Resource Analytics",
          subtitle: `${analytics.periodLabel} fuel, distance and helper metrics from manual records`,
          cards: [
            {
              title: "Helpers / Loaders",
              value: analytics.totalHelpers,
              subtle: "Manual records only",
              accent: "#22c55e",
            },
            {
              title: "Fuel Used",
              value: Number(analytics.totalFuel).toFixed(1),
              subtle: "Manual records only",
              accent: "#ef4444",
            },
            {
              title: "Distance Covered",
              value: Number(analytics.totalDistance).toFixed(1),
              subtle: "Manual records only",
              accent: "#3b82f6",
            },
            {
              title: "Completed Manual Ops",
              value: analytics.completedManualOperations,
              subtle: analytics.periodLabel,
              accent: "#8b5cf6",
            },
          ],
        };

      case "alerts":
        return {
          title: "Operational Attention Center",
          subtitle: "Live exceptions that management should review before they become delays",
          cards: [
            {
              title: "Attention Items",
              value: analytics.attentionCount,
              subtle: "Current live exceptions",
              accent: "#ef4444",
            },
            {
              title: "Long Running Trips",
              value: analytics.longRunningChallans,
              subtle: "Over 12 hours",
              accent: "#ef4444",
            },
            {
              title: "Missing Assignments",
              value:
                analytics.challansMissingDriver +
                analytics.challansMissingVehicle,
              subtle: "Driver / vehicle gaps",
              accent: "#f59e0b",
            },
            {
              title: "Missing Start Time",
              value: analytics.noStartTimeChallans,
              subtle: "Running challan data quality",
              accent: "#f59e0b",
            },
          ],
        };

      case "routes":
        return {
          title: "Manual Route Analysis",
          subtitle: `${analytics.periodLabel} route distribution from manual / legacy shifts`,
          cards: [
            {
              title: "Factory",
              value: analytics.routeCounts.FACTORY,
              subtle: "Manual route records",
              accent: "#3b82f6",
            },
            {
              title: "Residential",
              value: analytics.routeCounts.RESIDENTIAL,
              subtle: "Manual route records",
              accent: "#22c55e",
            },
            {
              title: "Warehouse",
              value: analytics.routeCounts.WAREHOUSE,
              subtle: "Manual route records",
              accent: "#f59e0b",
            },
            {
              title: "Mall / Other",
              value:
                analytics.routeCounts.MALL +
                analytics.routeCounts.OTHER,
              subtle: "Other manual routes",
              accent: "#8b5cf6",
            },
          ],
        };

      default:
        return {
          title: "Unified Logistics Command Center",
          subtitle: `${analytics.periodLabel} management view with live dispatch, driver, fleet and exception intelligence`,
          cards: [
            {
              title: "Live Operations",
              value:
                analytics.runningChallans +
                analytics.activeManualOperations,
              subtle: `${analytics.runningChallans} challan • ${analytics.activeManualOperations} manual`,
              accent: "#22c55e",
            },
            {
              title: "Period Challans",
              value: analytics.totalChallans,
              subtle: analytics.periodLabel,
              accent: "#60a5fa",
            },
            {
              title: "Dispatched Items",
              value: analytics.totalDispatchedItems,
              subtle: `${analytics.averageItemsPerChallan.toFixed(1)} avg / challan`,
              accent: "#8b5cf6",
            },
            {
              title: "Management Alerts",
              value: analytics.attentionCount,
              subtle: "Live attention items",
              accent:
                analytics.attentionCount > 0
                  ? "#ef4444"
                  : "#22c55e",
            },
          ],
        };
    }
  }, [section, analytics]);

  const CardComponent =
    StatCard || DashboardStatCard;

  const showDriverPanel =
    section === "summary" ||
    section === "drivers";
  const showVehiclePanel =
    section === "vehicles";
  const showAttentionPanel =
    section === "summary" ||
    section === "alerts";
  const showRecentPanel =
    ["summary", "dispatch"].includes(section);

  return (
    <div style={layout}>
      <ExecutiveSidebar
        section={section}
        setSection={setSection}
      />

      <div style={main}>
        <div style={topBar}>
          <div>
            <div style={header}>
              {sectionData.title}
            </div>
            <div style={subtitle}>
              {sectionData.subtitle}
            </div>
          </div>

          <div style={topActions}>
            <div style={periodSwitcher}>
              {PERIOD_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() =>
                    setPeriod(option.value)
                  }
                  style={{
                    ...periodButton,
                    ...(period === option.value
                      ? periodButtonActive
                      : {}),
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              style={{
                ...refreshButton,
                opacity:
                  refreshing || loading
                    ? 0.65
                    : 1,
                cursor:
                  refreshing || loading
                    ? "not-allowed"
                    : "pointer",
              }}
              onClick={() =>
                loadDashboard({ refresh: true })
              }
              disabled={refreshing || loading}
            >
              <RefreshIcon
                sx={{ fontSize: 17 }}
              />
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <div style={liveBadge}>
              <span style={liveDot} />
              LIVE
            </div>
          </div>
        </div>

        {loadError && (
          <div style={warningBox}>
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={loadingBox}>
            Loading unified logistics analytics...
          </div>
        ) : (
          <>
            <div style={kpiGrid}>
              {sectionData.cards.map((card) => (
                <CardComponent
                  key={card.title}
                  accent={card.accent}
                  title={card.title}
                  value={card.value}
                  subtle={card.subtle}
                />
              ))}
            </div>

            <div style={managementPulseGrid}>
              <PulseMetric
                label="Completion Rate"
                value={`${analytics.completionRate.toFixed(0)}%`}
                detail={`${analytics.completedChallans}/${analytics.totalChallans || 0} challans`}
              />
              <PulseMetric
                label="Avg Trip Duration"
                value={formatDuration(
                  analytics.avgTripDuration
                )}
                detail="Completed challans"
              />
              <PulseMetric
                label="Driver Assignment"
                value={`${analytics.driverAssignmentRate.toFixed(0)}%`}
                detail={`${analytics.activeDrivers}/${analytics.totalDrivers} active now`}
              />
              <PulseMetric
                label="Fleet Utilization"
                value={`${analytics.vehicleUtilization.toFixed(0)}%`}
                detail={`${analytics.activeVehicles}/${analytics.totalVehicles} active now`}
              />
              <PulseMetric
                label="Items Running"
                value={analytics.activeDispatchedItems}
                detail="On active challans"
              />
            </div>

            <div style={sourceNote}>
              <strong>Management data model:</strong> current item-based trips come from Dispatch Challans. Manual / legacy operations remain separate for fuel, distance, route, helper and overtime analytics, preventing double counting.
            </div>

            <div style={chartsGrid}>
              <TripsLineChart data={timelineData} />
              <StatusDistributionChart
                data={statusData}
              />
            </div>

            {(showDriverPanel ||
              showVehiclePanel ||
              showAttentionPanel) && (
                <div style={managementPanelsGrid}>
                  {showDriverPanel && (
                    <RankingPanel
                      title="Driver Activity & Output"
                      subtitle={`${analytics.periodLabel} • challans, items and manual work`}
                      rows={driverPerformance.slice(0, 8)}
                      type="DRIVER"
                    />
                  )}

                  {showVehiclePanel && (
                    <RankingPanel
                      title="Fleet Activity & Throughput"
                      subtitle={`${analytics.periodLabel} • challans, items and manual work`}
                      rows={vehiclePerformance.slice(0, 10)}
                      type="VEHICLE"
                    />
                  )}

                  {showAttentionPanel && (
                    <AttentionPanel
                      rows={attentionRows}
                    />
                  )}
                </div>
              )}

            {showRecentPanel && (
              <RecentActivityPanel
                rows={recentActivity}
                periodLabel={analytics.periodLabel}
              />
            )}

            {section === "drivers" && (
              <RankingPanel
                title="Complete Driver Workload Table"
                subtitle={`${analytics.periodLabel} driver-wise operational contribution`}
                rows={driverPerformance}
                type="DRIVER"
                fullWidth
              />
            )}

            {section === "vehicles" && (
              <RankingPanel
                title="Complete Vehicle Workload Table"
                subtitle={`${analytics.periodLabel} vehicle-wise operational contribution`}
                rows={vehiclePerformance}
                type="VEHICLE"
                fullWidth
              />
            )}

            {section === "alerts" && (
              <AttentionPanel
                rows={attentionRows}
                fullWidth
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PulseMetric({
  label,
  value,
  detail,
}) {
  return (
    <div style={pulseCard}>
      <div style={pulseLabel}>{label}</div>
      <div style={pulseValue}>{value}</div>
      <div style={pulseDetail}>{detail}</div>
    </div>
  );
}

function RankingPanel({
  title,
  subtitle,
  rows,
  type,
  fullWidth = false,
}) {
  const isDriver = type === "DRIVER";

  return (
    <div
      style={{
        ...panelCard,
        ...(fullWidth
          ? { gridColumn: "1 / -1", marginTop: 20 }
          : {}),
      }}
    >
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          <div style={panelSubtitle}>
            {subtitle}
          </div>
        </div>
        <div style={panelCountBadge}>
          {rows.length} records
        </div>
      </div>

      <div style={rankingTableWrap}>
        <div style={rankingHead}>
          <div>{isDriver ? "Driver" : "Vehicle"}</div>
          <div>Challans</div>
          <div>Items</div>
          <div>Active</div>
          <div>Manual</div>
          <div>Last Activity</div>
        </div>

        {rows.length === 0 && (
          <div style={panelEmpty}>
            No activity available for this period.
          </div>
        )}

        {rows.map((row, index) => (
          <div key={row.key} style={rankingRow}>
            <div style={rankingIdentity}>
              <span style={rankingNo}>
                {index + 1}
              </span>
              <span>
                {isDriver ? row.name : row.number}
              </span>
            </div>
            <div>{row.challans}</div>
            <div style={importantValue}>
              {row.dispatchedItems}
            </div>
            <div>{row.activeChallans}</div>
            <div>
              {row.manualOperations}
              {row.manualTrips > 0
                ? ` / ${row.manualTrips} trips`
                : ""}
            </div>
            <div style={lastActivityText}>
              {row.lastActivityAt
                ? formatDateTime(row.lastActivityAt)
                : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttentionPanel({
  rows,
  fullWidth = false,
}) {
  return (
    <div
      style={{
        ...panelCard,
        ...(fullWidth
          ? { gridColumn: "1 / -1", marginTop: 20 }
          : {}),
      }}
    >
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            Management Attention Queue
          </div>
          <div style={panelSubtitle}>
            Live exceptions from running dispatch challans
          </div>
        </div>
        <div
          style={{
            ...panelCountBadge,
            color:
              rows.length > 0
                ? "#f87171"
                : "#4ade80",
          }}
        >
          {rows.length} issues
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={healthyBox}>
          ✓ No current dispatch exceptions need management attention.
        </div>
      ) : (
        <div style={attentionList}>
          {rows.slice(0, fullWidth ? 20 : 8).map((row) => (
            <div
              key={row.key}
              style={attentionRow}
            >
              <span
                style={severityPill(row.severity)}
              >
                {row.severity}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={attentionTitle}>
                  {row.title}
                </div>
                <div style={attentionDetail}>
                  {row.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentActivityPanel({
  rows,
  periodLabel,
}) {
  return (
    <div style={recentPanel}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>
            Recent Logistics Activity
          </div>
          <div style={panelSubtitle}>
            Latest unified operations in {periodLabel}
          </div>
        </div>
      </div>

      <div style={recentGrid}>
        {rows.length === 0 && (
          <div style={panelEmpty}>
            No recent activity in the selected period.
          </div>
        )}

        {rows.map((row) => (
          <div key={row.key} style={recentRow}>
            <div style={recentDot} />
            <div style={{ minWidth: 0 }}>
              <div style={recentTitleRow}>
                <span style={recentTitle}>
                  {row.title}
                </span>
                <span style={recentSource}>
                  {row.source}
                </span>
              </div>
              <div style={recentSubtitle}>
                {row.subtitle}
              </div>
              <div style={recentTime}>
                {formatDateTime(row.at)} • {row.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardStatCard({
  title,
  value,
  subtle,
  accent = "#60a5fa",
}) {
  return (
    <div
      style={{
        ...fallbackCard,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div style={fallbackCardTitle}>{title}</div>
      <div style={fallbackCardValue}>{value}</div>
      <div style={fallbackCardSubtle}>{subtle}</div>
    </div>
  );
}

const layout = {
  display: "flex",
  gap: 20,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const main = {
  flex: "1 1 760px",
  minWidth: 0,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 22,
  flexWrap: "wrap",
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  flexWrap: "wrap",
};

const periodSwitcher = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: 4,
  borderRadius: 12,
  background: "rgba(2,6,23,.52)",
  border: "1px solid rgba(255,255,255,.06)",
};

const periodButton = {
  height: 32,
  padding: "0 10px",
  borderRadius: 9,
  border: "1px solid transparent",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: 10.5,
  fontWeight: 850,
};

const periodButtonActive = {
  color: "#fff",
  background:
    "linear-gradient(135deg,#2563eb,#3b82f6)",
  border:
    "1px solid rgba(96,165,250,.35)",
  boxShadow:
    "0 6px 16px rgba(37,99,235,.22)",
};

const refreshButton = {
  height: 40,
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  gap: 7,
  borderRadius: 11,
  border:
    "1px solid rgba(255,255,255,.08)",
  color: "#fff",
  background:
    "rgba(255,255,255,.045)",
  fontWeight: 800,
  fontFamily: "inherit",
};

const liveBadge = {
  height: 40,
  padding: "0 13px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  gap: 7,
  background:
    "rgba(34,197,94,.13)",
  color: "#4ade80",
  fontWeight: 900,
  letterSpacing: 0.8,
  border:
    "1px solid rgba(34,197,94,.22)",
  fontSize: 10.5,
};

const liveDot = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 12px rgba(34,197,94,.8)",
};

const header = {
  color: "#fff",
  fontSize: 29,
  fontWeight: 950,
  marginBottom: 6,
  lineHeight: 1.2,
};

const subtitle = {
  color: "rgba(255,255,255,.60)",
  fontSize: 13,
  fontWeight: 600,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
};

const managementPulseGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 10,
  marginTop: 12,
};

const pulseCard = {
  padding: "12px 13px",
  borderRadius: 14,
  background: "rgba(2,6,23,.38)",
  border: "1px solid rgba(255,255,255,.055)",
};

const pulseLabel = {
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const pulseValue = {
  marginTop: 5,
  color: "#e2e8f0",
  fontSize: 18,
  fontWeight: 950,
};

const pulseDetail = {
  marginTop: 3,
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 700,
};

const chartsGrid = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(320px,1fr))",
  gap: 16,
};

const managementPanelsGrid = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(360px,1fr))",
  gap: 16,
};

const sourceNote = {
  marginTop: 14,
  padding: "11px 13px",
  borderRadius: 13,
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 650,
  lineHeight: 1.5,
  background:
    "rgba(59,130,246,.06)",
  border:
    "1px solid rgba(59,130,246,.12)",
};

const panelCard = {
  minWidth: 0,
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.60))",
  border:
    "1px solid rgba(255,255,255,.065)",
};

const panelHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 13,
};

const panelTitle = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const panelSubtitle = {
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
  marginTop: 4,
};

const panelCountBadge = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.06)",
  color: "#94a3b8",
  fontSize: 9.5,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const rankingTableWrap = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.05)",
};

const rankingHead = {
  minWidth: 690,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .55fr .55fr .55fr .8fr 1fr",
  gap: 8,
  padding: "9px 10px",
  background: "rgba(2,6,23,.70)",
  color: "#64748b",
  fontSize: 9.5,
  fontWeight: 900,
  textTransform: "uppercase",
};

const rankingRow = {
  minWidth: 690,
  display: "grid",
  gridTemplateColumns:
    "1.4fr .55fr .55fr .55fr .8fr 1fr",
  gap: 8,
  padding: "10px 10px",
  alignItems: "center",
  color: "#cbd5e1",
  fontSize: 10.5,
  borderTop: "1px solid rgba(255,255,255,.045)",
};

const rankingIdentity = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#fff",
  fontWeight: 850,
};

const rankingNo = {
  width: 22,
  height: 22,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "rgba(59,130,246,.10)",
  color: "#60a5fa",
  fontSize: 9,
  fontWeight: 900,
};

const importantValue = {
  color: "#93c5fd",
  fontWeight: 900,
};

const lastActivityText = {
  color: "#94a3b8",
  fontSize: 9.5,
};

const panelEmpty = {
  padding: 22,
  color: "#64748b",
  textAlign: "center",
  fontSize: 11,
  fontWeight: 750,
};

const attentionList = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const attentionRow = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 9,
  padding: 10,
  borderRadius: 11,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.045)",
};

const severityPill = (severity) => ({
  alignSelf: "start",
  padding: "4px 6px",
  borderRadius: 999,
  fontSize: 8.5,
  fontWeight: 950,
  color:
    severity === "HIGH"
      ? "#f87171"
      : "#fbbf24",
  background:
    severity === "HIGH"
      ? "rgba(239,68,68,.12)"
      : "rgba(245,158,11,.12)",
});

const attentionTitle = {
  color: "#e2e8f0",
  fontSize: 10.5,
  fontWeight: 850,
};

const attentionDetail = {
  color: "#64748b",
  fontSize: 9.5,
  marginTop: 3,
  lineHeight: 1.4,
};

const healthyBox = {
  padding: 18,
  borderRadius: 12,
  color: "#4ade80",
  background: "rgba(34,197,94,.07)",
  border: "1px solid rgba(34,197,94,.12)",
  fontSize: 11,
  fontWeight: 800,
};

const recentPanel = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(15,23,42,.75),rgba(2,6,23,.58))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const recentGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(280px,1fr))",
  gap: 8,
};

const recentRow = {
  display: "grid",
  gridTemplateColumns: "10px 1fr",
  gap: 9,
  padding: 11,
  borderRadius: 12,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.045)",
};

const recentDot = {
  width: 7,
  height: 7,
  marginTop: 5,
  borderRadius: "50%",
  background: "#60a5fa",
  boxShadow: "0 0 10px rgba(96,165,250,.45)",
};

const recentTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const recentTitle = {
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
};

const recentSource = {
  color: "#60a5fa",
  fontSize: 8.5,
  fontWeight: 900,
};

const recentSubtitle = {
  color: "#94a3b8",
  fontSize: 9.5,
  marginTop: 4,
  lineHeight: 1.4,
};

const recentTime = {
  color: "#64748b",
  fontSize: 8.5,
  marginTop: 5,
  fontWeight: 700,
};

const warningBox = {
  marginBottom: 16,
  padding: 13,
  borderRadius: 13,
  color: "#fbbf24",
  background: "rgba(245,158,11,.10)",
  border: "1px solid rgba(245,158,11,.20)",
  fontWeight: 750,
  fontSize: 11,
};

const loadingBox = {
  minHeight: 260,
  display: "grid",
  placeItems: "center",
  color: "#94a3b8",
  borderRadius: 22,
  background: "rgba(255,255,255,.025)",
  border: "1px dashed rgba(255,255,255,.10)",
  fontWeight: 800,
};

const fallbackCard = {
  minHeight: 118,
  padding: 18,
  borderRadius: 18,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.86),rgba(15,23,42,.90))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const fallbackCardTitle = {
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 850,
};

const fallbackCardValue = {
  marginTop: 9,
  color: "#fff",
  fontSize: 28,
  fontWeight: 950,
};

const fallbackCardSubtle = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 10,
  fontWeight: 700,
};

export default LogisticsDashboard;
