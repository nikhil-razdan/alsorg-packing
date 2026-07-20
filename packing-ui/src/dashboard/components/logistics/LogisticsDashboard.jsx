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

const COMPLETED_CHALLAN_STATUSES =
  new Set([
    "ENDED",
    "COMPLETED",
    "DELIVERED",
  ]);

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const safeNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const isMissingValue = (value) => {
  const text =
    String(value || "")
      .trim()
      .toUpperCase();

  return (
    !text ||
    text === "-" ||
    text === "—" ||
    text === "NULL" ||
    text === "UNDEFINED"
  );
};

const getChallanLifecycleStatus = (
  challan
) => {
  const status =
    normalizeStatus(
      challan?.tripStatus
    );

  /*
   * Keep classifications mutually exclusive.
   * A cancelled challan must not also be counted
   * as completed merely because an end time exists.
   */
  if (status === "CANCELLED") {
    return "CANCELLED";
  }

  if (
    challan?.tripEndedAt ||
    COMPLETED_CHALLAN_STATUSES.has(
      status
    )
  ) {
    return "COMPLETED";
  }

  return "RUNNING";
};

const getChallanStart = (challan) =>
  challan?.tripStartedAt ||
  challan?.dispatchedAt ||
  challan?.generatedAt ||
  null;

const getDateKey = (value) => {
  const date =
    parseBusinessDateTime(value);

  if (!date) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const formatChartDate = (
  dateKey
) => {
  if (!dateKey) {
    return "";
  }

  const parts =
    dateKey.split("-");

  if (parts.length !== 3) {
    return dateKey;
  }

  return `${parts[2]}/${parts[1]}`;
};

const calculateRunningMinutes = (
  startValue
) => {
  const start =
    parseBusinessDateTime(
      startValue
    );

  if (!start) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (
        Date.now() -
        start.getTime()
      ) / 60000
    )
  );
};

const getIdentityKey = ({
  id,
  value,
  prefix,
}) => {
  if (id) {
    return `${prefix}:ID:${String(
      id
    )}`;
  }

  if (isMissingValue(value)) {
    return "";
  }

  return `${prefix}:VALUE:${String(
    value
  )
    .trim()
    .toUpperCase()}`;
};

function LogisticsDashboard({
  StatCard,
}) {
  const [section, setSection] =
    useState("summary");

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

  const mountedRef =
    useRef(true);

  const latestRequestRef =
    useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDashboard =
    useCallback(
      async ({
        refresh = false,
      } = {}) => {
        const requestId =
          latestRequestRef.current + 1;

        latestRequestRef.current =
          requestId;

        try {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setLoadError("");

          const results =
            await Promise.allSettled([
              fetchDispatchChallans(),
              fetchShifts(),
              fetchDrivers(),
              fetchVehicles(),
            ]);

          if (
            !mountedRef.current ||
            requestId !==
            latestRequestRef.current
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

          if (
            challanResult.status ===
            "fulfilled"
          ) {
            setChallans(
              Array.isArray(
                challanResult.value
              )
                ? challanResult.value
                : []
            );
          } else {
            console.error(
              "Dispatch challan dashboard load failed",
              challanResult.reason
            );

            failedSources.push(
              "dispatch challans"
            );
          }

          if (
            shiftResult.status ===
            "fulfilled"
          ) {
            setShifts(
              Array.isArray(
                shiftResult.value
              )
                ? shiftResult.value
                : []
            );
          } else {
            console.error(
              "Manual shift dashboard load failed",
              shiftResult.reason
            );

            failedSources.push(
              "manual operations"
            );
          }

          if (
            driverResult.status ===
            "fulfilled"
          ) {
            setDrivers(
              Array.isArray(
                driverResult.value
              )
                ? driverResult.value
                : []
            );
          } else {
            console.error(
              "Driver dashboard load failed",
              driverResult.reason
            );

            failedSources.push(
              "drivers"
            );
          }

          if (
            vehicleResult.status ===
            "fulfilled"
          ) {
            setVehicles(
              Array.isArray(
                vehicleResult.value
              )
                ? vehicleResult.value
                : []
            );
          } else {
            console.error(
              "Vehicle dashboard load failed",
              vehicleResult.reason
            );

            failedSources.push(
              "vehicles"
            );
          }

          if (
            failedSources.length ===
            results.length
          ) {
            throw new Error(
              "Unable to load logistics dashboard"
            );
          }

          if (
            failedSources.length > 0
          ) {
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
            requestId ===
            latestRequestRef.current
          ) {
            setLoadError(
              error?.message ||
              "Unable to load logistics dashboard"
            );
          }
        } finally {
          if (
            mountedRef.current &&
            requestId ===
            latestRequestRef.current
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

  const analytics =
    useMemo(() => {
      const runningChallans =
        challans.filter(
          (challan) =>
            getChallanLifecycleStatus(
              challan
            ) === "RUNNING"
        );

      const completedChallans =
        challans.filter(
          (challan) =>
            getChallanLifecycleStatus(
              challan
            ) === "COMPLETED"
        );

      const cancelledChallans =
        challans.filter(
          (challan) =>
            getChallanLifecycleStatus(
              challan
            ) === "CANCELLED"
        );

      const activeManualShifts =
        shifts.filter(
          (shift) =>
            normalizeStatus(
              shift?.status
            ) === "WORKING"
        );

      const completedManualShifts =
        shifts.filter(
          (shift) =>
            normalizeStatus(
              shift?.status
            ) === "COMPLETED"
        );

      const cancelledManualShifts =
        shifts.filter(
          (shift) =>
            normalizeStatus(
              shift?.status
            ) === "CANCELLED"
        );

      const offManualShifts =
        shifts.filter((shift) =>
          [
            "OFF",
            "ON_LEAVE",
          ].includes(
            normalizeStatus(
              shift?.status
            )
          )
        );

      /*
       * Only actual manual operations should contribute
       * to route and overtime analytics.
       */
      const operationalManualShifts =
        shifts.filter((shift) =>
          [
            "WORKING",
            "COMPLETED",
          ].includes(
            normalizeStatus(
              shift?.status
            )
          )
        );

      const totalDispatchedItems =
        challans.reduce(
          (sum, challan) =>
            sum +
            safeNumber(
              challan?.totalItems
            ),
          0
        );

      const activeDispatchedItems =
        runningChallans.reduce(
          (sum, challan) =>
            sum +
            safeNumber(
              challan?.totalItems
            ),
          0
        );

      const manualTripEntries =
        operationalManualShifts.reduce(
          (sum, shift) =>
            sum +
            safeNumber(
              shift?.totalTrips
            ),
          0
        );

      const totalHelpers =
        operationalManualShifts.reduce(
          (sum, shift) =>
            sum +
            safeNumber(
              shift?.totalLoaders ??
              shift?.totalHelpers
            ),
          0
        );

      const totalFuel =
        operationalManualShifts.reduce(
          (sum, shift) =>
            sum +
            safeNumber(
              shift?.fuelUsed
            ),
          0
        );

      const totalDistance =
        operationalManualShifts.reduce(
          (sum, shift) =>
            sum +
            safeNumber(
              shift?.totalDistance
            ),
          0
        );

      const activeDriverKeys =
        new Set();

      const activeVehicleKeys =
        new Set();

      runningChallans.forEach(
        (challan) => {
          const driverKey =
            getIdentityKey({
              id:
                challan?.driverId,
              value:
                challan?.driverName,
              prefix: "DRIVER",
            });

          const vehicleKey =
            getIdentityKey({
              id:
                challan?.vehicleId,
              value:
                challan?.vehicleNumber,
              prefix: "VEHICLE",
            });

          if (driverKey) {
            activeDriverKeys.add(
              driverKey
            );
          }

          if (vehicleKey) {
            activeVehicleKeys.add(
              vehicleKey
            );
          }
        }
      );

      activeManualShifts.forEach(
        (shift) => {
          const driverKey =
            getIdentityKey({
              id:
                shift?.driver?.id ||
                shift?.driverId,
              value:
                shift?.driver?.name ||
                shift?.driverName,
              prefix: "DRIVER",
            });

          const vehicleKey =
            getIdentityKey({
              id:
                shift?.vehicle?.id ||
                shift?.vehicleId,
              value:
                shift?.vehicle
                  ?.vehicleNumber ||
                shift?.vehicleNumber,
              prefix: "VEHICLE",
            });

          if (driverKey) {
            activeDriverKeys.add(
              driverKey
            );
          }

          if (vehicleKey) {
            activeVehicleKeys.add(
              vehicleKey
            );
          }
        }
      );

      const challansMissingDriver =
        runningChallans.filter(
          (challan) =>
            isMissingValue(
              challan?.driverName
            )
        ).length;

      const challansMissingVehicle =
        runningChallans.filter(
          (challan) =>
            isMissingValue(
              challan?.vehicleNumber
            )
        ).length;

      const longRunningChallans =
        runningChallans.filter(
          (challan) =>
            calculateRunningMinutes(
              getChallanStart(
                challan
              )
            ) >
            12 * 60
        ).length;

      const overShiftManualCount =
        operationalManualShifts.filter(
          isShiftOverSixPm
        ).length;

      const activeDrivers =
        activeDriverKeys.size;

      const activeVehicles =
        activeVehicleKeys.size;

      const driverAssignmentRate =
        drivers.length === 0
          ? 0
          : Math.min(
            100,
            (
              activeDrivers /
              drivers.length
            ) * 100
          );

      const vehicleUtilization =
        vehicles.length === 0
          ? 0
          : Math.min(
            100,
            (
              activeVehicles /
              vehicles.length
            ) * 100
          );

      const routeCounts = {
        FACTORY: 0,
        RESIDENTIAL: 0,
        WAREHOUSE: 0,
        MALL: 0,
        OTHER: 0,
      };

      operationalManualShifts.forEach(
        (shift) => {
          const route =
            normalizeStatus(
              shift?.routeCategory
            );

          if (
            Object.prototype
              .hasOwnProperty.call(
                routeCounts,
                route
              )
          ) {
            routeCounts[route] += 1;
          } else {
            routeCounts.OTHER += 1;
          }
        }
      );

      return {
        totalChallans:
          challans.length,

        runningChallans:
          runningChallans.length,

        completedChallans:
          completedChallans.length,

        cancelledChallans:
          cancelledChallans.length,

        totalDispatchedItems,
        activeDispatchedItems,

        totalManualRecords:
          shifts.length,

        activeManualOperations:
          activeManualShifts.length,

        completedManualOperations:
          completedManualShifts.length,

        cancelledManualOperations:
          cancelledManualShifts.length,

        availabilityRecords:
          offManualShifts.length,

        manualTripEntries,
        totalHelpers,
        totalFuel,
        totalDistance,

        totalDrivers:
          drivers.length,

        activeDrivers,
        driverAssignmentRate,

        totalVehicles:
          vehicles.length,

        activeVehicles,
        vehicleUtilization,

        overShiftManualCount,

        challansMissingDriver,
        challansMissingVehicle,
        longRunningChallans,

        routeCounts,
      };
    }, [
      challans,
      shifts,
      drivers,
      vehicles,
    ]);

  const timelineData =
    useMemo(() => {
      const map =
        new Map();

      const ensureRow = (
        dateKey
      ) => {
        if (!map.has(dateKey)) {
          map.set(dateKey, {
            dateKey,

            date:
              formatChartDate(
                dateKey
              ),

            challans: 0,
            manualOperations: 0,
            dispatchedItems: 0,
          });
        }

        return map.get(dateKey);
      };

      challans.forEach(
        (challan) => {
          const dateKey =
            getDateKey(
              getChallanStart(
                challan
              )
            );

          if (!dateKey) {
            return;
          }

          const row =
            ensureRow(dateKey);

          row.challans += 1;

          row.dispatchedItems +=
            safeNumber(
              challan?.totalItems
            );
        }
      );

      shifts.forEach(
        (shift) => {
          const status =
            normalizeStatus(
              shift?.status
            );

          if (
            ![
              "WORKING",
              "COMPLETED",
            ].includes(status)
          ) {
            return;
          }

          const dateKey =
            getDateKey(
              shift?.shiftStart ||
              shift?.date ||
              shift?.createdAt
            );

          if (!dateKey) {
            return;
          }

          const row =
            ensureRow(dateKey);

          row.manualOperations += 1;
        }
      );

      return Array.from(
        map.values()
      )
        .sort((a, b) =>
          a.dateKey.localeCompare(
            b.dateKey
          )
        )
        .slice(-14);
    }, [
      challans,
      shifts,
    ]);

  const statusData =
    useMemo(
      () =>
        [
          {
            name:
              "Running Challans",

            value:
              analytics.runningChallans,

            color: "#22c55e",
          },
          {
            name:
              "Completed Challans",

            value:
              analytics.completedChallans,

            color: "#3b82f6",
          },
          {
            name:
              "Active Manual",

            value:
              analytics
                .activeManualOperations,

            color: "#8b5cf6",
          },
          {
            name:
              "Completed Manual",

            value:
              analytics
                .completedManualOperations,

            color: "#06b6d4",
          },
          {
            name: "Cancelled",

            value:
              analytics
                .cancelledManualOperations +
              analytics
                .cancelledChallans,

            color: "#ef4444",
          },
          {
            name: "Off / Leave",

            value:
              analytics
                .availabilityRecords,

            color: "#f59e0b",
          },
        ].filter(
          (entry) =>
            entry.value > 0
        ),
      [analytics]
    );

  const sectionData =
    useMemo(() => {
      switch (section) {
        case "dispatch":
          return {
            title:
              "Dispatch Challan Intelligence",

            subtitle:
              "Current item-based dispatch activity and challan completion",

            cards: [
              {
                title:
                  "Running Challan Trips",

                value:
                  analytics
                    .runningChallans,

                subtle:
                  "Awaiting trip end time",

                accent: "#22c55e",
              },
              {
                title:
                  "Completed Challans",

                value:
                  analytics
                    .completedChallans,

                subtle:
                  "Trip end time recorded",

                accent: "#3b82f6",
              },
              {
                title:
                  "Dispatched Items",

                value:
                  analytics
                    .totalDispatchedItems,

                subtle:
                  "Across all challans",

                accent: "#8b5cf6",
              },
              {
                title:
                  "Items Currently Running",

                value:
                  analytics
                    .activeDispatchedItems,

                subtle:
                  "Items on active challans",

                accent: "#f59e0b",
              },
            ],
          };

        case "drivers":
          return {
            title:
              "Driver Operations Intelligence",

            subtitle:
              "Driver master strength and current operational assignments",

            cards: [
              {
                title:
                  "Registered Drivers",

                value:
                  analytics.totalDrivers,

                subtle:
                  "Driver master records",

                accent: "#8b5cf6",
              },
              {
                title:
                  "Drivers Assigned",

                value:
                  analytics.activeDrivers,

                subtle:
                  "Current active operations",

                accent: "#22c55e",
              },
              {
                title:
                  "Assignment Rate",

                value:
                  `${analytics.driverAssignmentRate.toFixed(
                    0
                  )}%`,

                subtle:
                  "Assigned / registered",

                accent: "#3b82f6",
              },
              {
                title:
                  "Missing Driver",

                value:
                  analytics
                    .challansMissingDriver,

                subtle:
                  "Running challans without driver",

                accent: "#ef4444",
              },
            ],
          };

        case "vehicles":
          return {
            title:
              "Vehicle Utilization Intelligence",

            subtitle:
              "Fleet master data and vehicles currently assigned to operations",

            cards: [
              {
                title:
                  "Registered Vehicles",

                value:
                  analytics.totalVehicles,

                subtle:
                  "Vehicle master records",

                accent: "#8b5cf6",
              },
              {
                title:
                  "Vehicles Assigned",

                value:
                  analytics.activeVehicles,

                subtle:
                  "Current active operations",

                accent: "#22c55e",
              },
              {
                title:
                  "Fleet Utilization",

                value:
                  `${analytics.vehicleUtilization.toFixed(
                    0
                  )}%`,

                subtle:
                  "Assigned / registered",

                accent: "#3b82f6",
              },
              {
                title:
                  "Missing Vehicle",

                value:
                  analytics
                    .challansMissingVehicle,

                subtle:
                  "Running challans without vehicle",

                accent: "#ef4444",
              },
            ],
          };

        case "manual":
          return {
            title:
              "Manual & Legacy Operations",

            subtitle:
              "Historical shifts and non-challan logistics activity",

            cards: [
              {
                title:
                  "Manual Records",

                value:
                  analytics
                    .totalManualRecords,

                subtle:
                  "Legacy and non-challan records",

                accent: "#8b5cf6",
              },
              {
                title:
                  "Active Manual Ops",

                value:
                  analytics
                    .activeManualOperations,

                subtle:
                  "Status currently WORKING",

                accent: "#22c55e",
              },
              {
                title:
                  "Manual Trip Entries",

                value:
                  analytics
                    .manualTripEntries,

                subtle:
                  "Trips recorded in shifts",

                accent: "#3b82f6",
              },
              {
                title:
                  "Over Shift Records",

                value:
                  analytics
                    .overShiftManualCount,

                subtle:
                  "Ended after 06:00 PM",

                accent: "#f59e0b",
              },
            ],
          };

        case "resources":
          return {
            title:
              "Manual Resource Analytics",

            subtitle:
              "Fuel, distance and helper data available from manual records",

            cards: [
              {
                title:
                  "Helpers / Loaders",

                value:
                  analytics.totalHelpers,

                subtle:
                  "Manual records only",

                accent: "#22c55e",
              },
              {
                title: "Fuel Used",

                value:
                  Number(
                    analytics.totalFuel
                  ).toFixed(1),

                subtle:
                  "Manual records only",

                accent: "#ef4444",
              },
              {
                title:
                  "Distance Covered",

                value:
                  Number(
                    analytics.totalDistance
                  ).toFixed(1),

                subtle:
                  "Manual records only",

                accent: "#3b82f6",
              },
              {
                title:
                  "Completed Manual Ops",

                value:
                  analytics
                    .completedManualOperations,

                subtle:
                  "Legacy completion records",

                accent: "#8b5cf6",
              },
            ],
          };

        case "alerts":
          return {
            title:
              "Operational Attention Center",

            subtitle:
              "Real issues derived from active logistics records",

            cards: [
              {
                title:
                  "Long Running Trips",

                value:
                  analytics
                    .longRunningChallans,

                subtle:
                  "Running for over 12 hours",

                accent: "#ef4444",
              },
              {
                title:
                  "Missing Drivers",

                value:
                  analytics
                    .challansMissingDriver,

                subtle:
                  "Active challans requiring review",

                accent: "#f59e0b",
              },
              {
                title:
                  "Missing Vehicles",

                value:
                  analytics
                    .challansMissingVehicle,

                subtle:
                  "Active challans requiring review",

                accent: "#f59e0b",
              },
              {
                title:
                  "Cancelled Records",

                value:
                  analytics
                    .cancelledChallans +
                  analytics
                    .cancelledManualOperations,

                subtle:
                  "Challan and manual records",

                accent: "#8b5cf6",
              },
            ],
          };

        case "routes":
          return {
            title:
              "Manual Route Analysis",

            subtitle:
              "Route distribution from manual and legacy shift records",

            cards: [
              {
                title: "Factory",

                value:
                  analytics
                    .routeCounts
                    .FACTORY,

                subtle:
                  "Manual route records",

                accent: "#3b82f6",
              },
              {
                title:
                  "Residential",

                value:
                  analytics
                    .routeCounts
                    .RESIDENTIAL,

                subtle:
                  "Manual route records",

                accent: "#22c55e",
              },
              {
                title:
                  "Warehouse",

                value:
                  analytics
                    .routeCounts
                    .WAREHOUSE,

                subtle:
                  "Manual route records",

                accent: "#f59e0b",
              },
              {
                title:
                  "Mall / Other",

                value:
                  analytics
                    .routeCounts
                    .MALL +
                  analytics
                    .routeCounts
                    .OTHER,

                subtle:
                  "Other manual routes",

                accent: "#8b5cf6",
              },
            ],
          };

        default:
          return {
            title:
              "Unified Logistics Command Center",

            subtitle:
              "Live dispatch challans, manual operations, drivers and fleet overview",

            cards: [
              {
                title:
                  "Running Challan Trips",

                value:
                  analytics
                    .runningChallans,

                subtle:
                  "Current item dispatches",

                accent: "#22c55e",
              },
              {
                title:
                  "Active Manual Ops",

                value:
                  analytics
                    .activeManualOperations,

                subtle:
                  "Non-challan operations",

                accent: "#8b5cf6",
              },
              {
                title:
                  "Dispatched Items",

                value:
                  analytics
                    .totalDispatchedItems,

                subtle:
                  "Across all challans",

                accent: "#3b82f6",
              },
              {
                title:
                  "Assigned Vehicles",

                value:
                  analytics
                    .activeVehicles,

                subtle:
                  "Active operational usage",

                accent: "#f59e0b",
              },
            ],
          };
      }
    }, [
      section,
      analytics,
    ]);

  const CardComponent =
    StatCard ||
    DashboardStatCard;

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
            <button
              type="button"
              style={{
                ...refreshButton,

                opacity:
                  refreshing ||
                    loading
                    ? 0.65
                    : 1,

                cursor:
                  refreshing ||
                    loading
                    ? "not-allowed"
                    : "pointer",
              }}
              onClick={() =>
                loadDashboard({
                  refresh: true,
                })
              }
              disabled={
                refreshing ||
                loading
              }
            >
              <RefreshIcon
                sx={{
                  fontSize: 17,
                }}
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <div style={liveBadge}>
              <span style={liveDot} />

              LIVE OPERATIONS
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
            Loading unified logistics
            analytics...
          </div>
        ) : (
          <>
            <div style={kpiGrid}>
              {sectionData.cards.map(
                (card) => (
                  <CardComponent
                    key={card.title}
                    accent={
                      card.accent
                    }
                    title={
                      card.title
                    }
                    value={
                      card.value
                    }
                    subtle={
                      card.subtle
                    }
                  />
                )
              )}
            </div>

            <div style={sourceNote}>
              Dispatch-challan figures
              come from current item
              dispatch records. Fuel,
              distance, helpers, routes and
              overtime come only from
              manual or legacy shift
              records.
            </div>

            <div style={chartsGrid}>
              <TripsLineChart
                data={timelineData}
              />

              <StatusDistributionChart
                data={statusData}
              />
            </div>
          </>
        )}
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

        borderTop:
          `3px solid ${accent}`,
      }}
    >
      <div style={fallbackCardTitle}>
        {title}
      </div>

      <div style={fallbackCardValue}>
        {value}
      </div>

      <div style={fallbackCardSubtle}>
        {subtle}
      </div>
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
  marginBottom: 24,
  flexWrap: "wrap",
};

const topActions = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const refreshButton = {
  height: 42,
  padding: "0 15px",
  display: "flex",
  alignItems: "center",
  gap: 7,
  borderRadius: 12,
  border:
    "1px solid rgba(255,255,255,.08)",
  color: "#fff",
  background:
    "rgba(255,255,255,.045)",
  fontWeight: 800,
  fontFamily: "inherit",
};

const liveBadge = {
  height: 42,
  padding: "0 16px",
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background:
    "rgba(34,197,94,.13)",
  color: "#4ade80",
  fontWeight: 900,
  letterSpacing: 0.8,
  border:
    "1px solid rgba(34,197,94,.22)",
  fontSize: 11,
};

const liveDot = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow:
    "0 0 12px rgba(34,197,94,.8)",
};

const header = {
  color: "#fff",
  fontSize: 30,
  fontWeight: 950,
  marginBottom: 7,
  lineHeight: 1.2,
};

const subtitle = {
  color:
    "rgba(255,255,255,.60)",
  fontSize: 14,
  fontWeight: 600,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 18,
};

const chartsGrid = {
  marginTop: 20,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(320px,1fr))",
  gap: 20,
};

const sourceNote = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 14,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.5,
  background:
    "rgba(59,130,246,.07)",
  border:
    "1px solid rgba(59,130,246,.13)",
};

const warningBox = {
  marginBottom: 18,
  padding: 14,
  borderRadius: 14,
  color: "#fbbf24",
  background:
    "rgba(245,158,11,.10)",
  border:
    "1px solid rgba(245,158,11,.20)",
  fontWeight: 750,
};

const loadingBox = {
  minHeight: 260,
  display: "grid",
  placeItems: "center",
  color: "#94a3b8",
  borderRadius: 22,
  background:
    "rgba(255,255,255,.025)",
  border:
    "1px dashed rgba(255,255,255,.10)",
  fontWeight: 800,
};

const fallbackCard = {
  minHeight: 125,
  padding: 20,
  borderRadius: 20,
  background:
    "linear-gradient(180deg,rgba(30,41,59,.86),rgba(15,23,42,.90))",
  border:
    "1px solid rgba(255,255,255,.06)",
};

const fallbackCardTitle = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 850,
};

const fallbackCardValue = {
  marginTop: 10,
  color: "#fff",
  fontSize: 29,
  fontWeight: 950,
};

const fallbackCardSubtle = {
  marginTop: 7,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
};

export default LogisticsDashboard;