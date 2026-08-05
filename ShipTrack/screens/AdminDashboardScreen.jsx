import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

import {
  useFocusEffect,
} from "@react-navigation/native";

import {
  useAuth,
} from "../auth/AuthContext";

import {
  getBackendMessage,
} from "../api/client";

import {
  fetchDispatchedItems,
} from "../api/dispatchedApi";

import {
  fetchDispatchedChallans,
  fetchDrivers,
  fetchVehicles,
} from "../api/logisticsApi";

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function clean(value) {
  const text =
    String(value || "").trim();

  return text || "—";
}

function formatStatus(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "—";
  }

  return text.replace(/_/g, " ");
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

function isToday(value) {
  if (!value) {
    return false;
  }

  const raw =
    String(value).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  const now =
    new Date();

  if (match) {
    return (
      Number(match[1]) === now.getFullYear() &&
      Number(match[2]) === now.getMonth() + 1 &&
      Number(match[3]) === now.getDate()
    );
  }

  const date =
    new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getCurrentLocation(item) {
  return (
    item?.currentLocationCode ||
    item?.location ||
    item?.currentLocation ||
    item?.warehouseCode ||
    ""
  );
}

function isLegacyLocationMissing(item) {
  return (
    !item?.plantCode ||
    !item?.currentLocationCode ||
    !item?.fgAreaCode
  );
}

function isPkdLocation(item) {
  const loc =
    getCurrentLocation(item);

  return String(loc || "")
    .toUpperCase()
    .startsWith("PKD");
}

function isFgLocation(item) {
  const loc =
    getCurrentLocation(item);

  const fg =
    item?.fgAreaCode;

  if (!loc || !fg) {
    return false;
  }

  return String(loc)
    .toUpperCase()
    .startsWith(
      String(fg).toUpperCase()
    );
}

function needsFgMove(item) {
  const status =
    normalizeStatus(item?.status);

  return (
    status === "READY" &&
    !isLegacyLocationMissing(item) &&
    isPkdLocation(item)
  );
}

function canDispatchItem(item) {
  const status =
    normalizeStatus(item?.status);

  if (status === "READY_TO_DISPATCH") {
    return true;
  }

  if (status === "READY") {
    return (
      isLegacyLocationMissing(item) ||
      isFgLocation(item)
    );
  }

  return false;
}

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

export default function AdminDashboardScreen({
  navigation,
}) {

  const {
    username,
    role,
    roles,
    hasRole,
    logout,
  } = useAuth();

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [items, setItems] =
    useState([]);

  const [challans, setChallans] =
    useState([]);

  const [drivers, setDrivers] =
    useState([]);

  const [vehicles, setVehicles] =
    useState([]);

  const [notice, setNotice] =
    useState(null);

  const loadDashboard =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          itemData,
          challanData,
          driverData,
          vehicleData,
        ] =
          await Promise.all([
            fetchDispatchedItems(),
            fetchDispatchedChallans(),
            fetchDrivers(),
            fetchVehicles(),
          ]);

        setItems(
          Array.isArray(itemData)
            ? itemData
            : []
        );

        setChallans(
          Array.isArray(challanData)
            ? challanData
            : []
        );

        setDrivers(
          Array.isArray(driverData)
            ? driverData
            : []
        );

        setVehicles(
          Array.isArray(vehicleData)
            ? vehicleData
            : []
        );

        setNotice(null);
      } catch (e) {
        setNotice({
          type: "error",
          title: "Dashboard failed",
          message: getBackendMessage(
            e,
            "Unable to load admin dashboard."
          ),
        });
      } finally {
        setLoading(false);
      }
    }, []);

  const refresh =
    useCallback(async () => {
      try {
        setRefreshing(true);
        await loadDashboard();
      } finally {
        setRefreshing(false);
      }
    }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const stats =
    useMemo(() => {
      const totalItems =
        items.length;

      const ready =
        items.filter(
          (item) =>
            normalizeStatus(item.status) === "READY"
        ).length;

      const readyToDispatch =
        items.filter(
          (item) =>
            normalizeStatus(item.status) ===
            "READY_TO_DISPATCH"
        ).length;

      const dispatched =
        items.filter(
          (item) =>
            normalizeStatus(item.status) === "DISPATCHED"
        ).length;

      const needFg =
        items.filter(needsFgMove).length;

      const dispatchable =
        items.filter(canDispatchItem).length;

      const inWarehouse =
        items.filter((item) =>
          [
            "IN_WAREHOUSE",
            "WAREHOUSE_REQUESTED",
            "READY_TO_STORE",
            "WAREHOUSE_RETURN_REQUESTED",
          ].includes(
            normalizeStatus(item.status)
          )
        ).length;

      const totalChallans =
        challans.length;

      const runningTrips =
        challans.filter(
          (challan) =>
            !challan.tripEndedAt ||
            normalizeStatus(challan.tripStatus) === "RUNNING"
        ).length;

      const endedTrips =
        challans.filter(
          (challan) =>
            challan.tripEndedAt ||
            normalizeStatus(challan.tripStatus) === "ENDED"
        ).length;

      const todayChallans =
        challans.filter((challan) =>
          isToday(
            challan.dispatchedAt ||
            challan.tripStartedAt
          )
        ).length;

      const todayItems =
        challans
          .filter((challan) =>
            isToday(
              challan.dispatchedAt ||
              challan.tripStartedAt
            )
          )
          .reduce(
            (sum, challan) =>
              sum +
              Number(
                challan.totalItems ||
                challan.items?.length ||
                0
              ),
            0
          );

      return {
        totalItems,
        ready,
        readyToDispatch,
        dispatched,
        needFg,
        dispatchable,
        inWarehouse,
        totalChallans,
        runningTrips,
        endedTrips,
        todayChallans,
        todayItems,
        drivers: drivers.length,
        vehicles: vehicles.length,
      };
    }, [
      items,
      challans,
      drivers,
      vehicles,
    ]);

  const recentChallans =
    useMemo(() => {
      return [...challans]
        .sort((a, b) => {
          const aTime =
            new Date(
              a.dispatchedAt ||
              a.tripStartedAt ||
              0
            ).getTime();

          const bTime =
            new Date(
              b.dispatchedAt ||
              b.tripStartedAt ||
              0
            ).getTime();

          return bTime - aTime;
        })
        .slice(0, 5);
    }, [challans]);

  const runningChallans =
    useMemo(() => {
      return challans
        .filter(
          (challan) =>
            !challan.tripEndedAt ||
            normalizeStatus(challan.tripStatus) === "RUNNING"
        )
        .slice(0, 3);
    }, [challans]);

  const completionPercent =
    stats.totalChallans > 0
      ? Math.round(
        (stats.endedTrips / stats.totalChallans) * 100
      )
      : 0;

  if (
    loading &&
    items.length === 0 &&
    challans.length === 0
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />

        <Text style={styles.loadingText}>
          Loading admin dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#fff"
        />
      }
      contentContainerStyle={{
        paddingBottom: 34,
      }}
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>
            ADMIN DASHBOARD
          </Text>

          <Text style={styles.title}>
            ShipTrack Control
          </Text>

          <Text style={styles.sub}>
            {username || "Admin"} •{" "}
            {normalizeStatus(role) || "ADMIN"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
        >
          <Text style={styles.logoutText}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>

      {notice ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>
            {notice.title}
          </Text>

          <Text style={styles.noticeMessage}>
            {notice.message}
          </Text>
        </View>
      ) : null}

      <View style={styles.todayCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayLabel}>
            Today&apos;s Dispatch
          </Text>

          <Text style={styles.todayValue}>
            {stats.todayChallans} Challans
          </Text>

          <Text style={styles.todaySub}>
            {stats.todayItems} dispatched items today
          </Text>
        </View>

        <View style={styles.todayBadge}>
          <Text style={styles.todayBadgeValue}>
            {completionPercent}%
          </Text>

          <Text style={styles.todayBadgeLabel}>
            Closed
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <MiniStat
          label="Total Items"
          value={stats.totalItems}
        />

        <MiniStat
          label="Ready"
          value={stats.ready}
          active={stats.ready > 0}
        />

        <MiniStat
          label="Ready Dispatch"
          value={stats.readyToDispatch}
          active={stats.readyToDispatch > 0}
        />

        <MiniStat
          label="Need FG"
          value={stats.needFg}
          warning={stats.needFg > 0}
        />

        <MiniStat
          label="Dispatched"
          value={stats.dispatched}
          active={stats.dispatched > 0}
        />

        <MiniStat
          label="Warehouse"
          value={stats.inWarehouse}
        />

        <MiniStat
          label="Challans"
          value={stats.totalChallans}
        />

        <MiniStat
          label="Running Trips"
          value={stats.runningTrips}
          warning={stats.runningTrips > 0}
        />

        <MiniStat
          label="Drivers"
          value={stats.drivers}
        />

        <MiniStat
          label="Vehicles"
          value={stats.vehicles}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Quick Actions
        </Text>

        <View style={styles.actionGrid}>
          <ActionCard
            icon="📋"
            title="Dispatch Items"
            subtitle="Search, filter and manage items"
            onPress={() =>
              navigation.navigate("DispatchItems")
            }
          />

          <ActionCard
            icon="🚚"
            title="Trips with Challans"
            subtitle="View challans and trip timing"
            onPress={() =>
              navigation.navigate("Trips")
            }
          />

          <ActionCard
            icon="📄"
            title="Recent Challans"
            subtitle="Open latest challan list"
            onPress={() =>
              navigation.navigate("Trips")
            }
          />

          <ActionCard
            icon="🔄"
            title="Refresh"
            subtitle="Reload live dashboard"
            onPress={refresh}
          />
        </View>
      </View>

      {runningChallans.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Running Trips
          </Text>

          {runningChallans.map((challan) => (
            <TripMiniCard
              key={challan.challanNumber}
              challan={challan}
              onPress={() =>
                navigation.navigate(
                  "TripItems",
                  {
                    trip: challan,
                  }
                )
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>
            Recent Challans
          </Text>

          <TouchableOpacity
            onPress={() =>
              navigation.navigate("Trips")
            }
          >
            <Text style={styles.viewAllText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {recentChallans.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No challans found.
            </Text>
          </View>
        ) : (
          recentChallans.map((challan) => (
            <RecentChallan
              key={challan.challanNumber}
              challan={challan}
              onPress={() =>
                navigation.navigate(
                  "TripItems",
                  {
                    trip: challan,
                  }
                )
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MiniStat({
  label,
  value,
  active,
  warning,
}) {
  return (
    <View
      style={[
        styles.miniStat,
        active
          ? styles.miniStatActive
          : warning
            ? styles.miniStatWarning
            : null,
      ]}
    >
      <Text
        style={styles.miniStatValue}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Text
        style={styles.miniStatLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <Text style={styles.actionIcon}>
        {icon}
      </Text>

      <Text style={styles.actionTitle}>
        {title}
      </Text>

      <Text
        style={styles.actionSub}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function TripMiniCard({
  challan,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.tripMiniCard}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.tripNo}>
          {challan.challanNumber || "—"}
        </Text>

        <Text style={styles.tripMeta}>
          {challan.driverName || "—"} •{" "}
          {challan.vehicleNumber || "—"}
        </Text>

        <Text style={styles.tripSub}>
          Start:{" "}
          {formatDateTime(
            challan.tripStartedAt ||
            challan.dispatchedAt
          )}
        </Text>
      </View>

      <View style={styles.runningBadge}>
        <Text style={styles.runningText}>
          RUNNING
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function RecentChallan({
  challan,
  onPress,
}) {
  const ended =
    Boolean(challan.tripEndedAt) ||
    normalizeStatus(challan.tripStatus) === "ENDED";

  return (
    <TouchableOpacity
      style={styles.recentCard}
      onPress={onPress}
      activeOpacity={0.86}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.recentTitle}>
          {challan.challanNumber || "—"}
        </Text>

        <Text style={styles.recentMeta}>
          {challan.driverName || "—"} •{" "}
          {challan.vehicleNumber || "—"}
        </Text>

        <Text style={styles.recentSub}>
          {formatDateTime(
            challan.dispatchedAt ||
            challan.tripStartedAt
          )}{" "}
          • {challan.totalItems || 0} items
        </Text>

        <Text style={styles.recentSub}>
          Duration:{" "}
          {formatDuration(
            challan.tripDurationMinutes
          )}
        </Text>
      </View>

      <View
        style={[
          styles.statusPill,
          ended
            ? styles.endedPill
            : styles.runningPill,
        ]}
      >
        <Text
          style={[
            styles.statusPillText,
            ended
              ? styles.endedText
              : styles.runningText,
          ]}
        >
          {ended ? "ENDED" : "RUNNING"}
        </Text>
      </View>
    </TouchableOpacity>
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

  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    padding: 18,
    marginBottom: 14,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginBottom: 5,
  },

  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    marginTop: 5,
    fontWeight: "700",
  },

  logoutBtn: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(239,68,68,.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.25)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  logoutText: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 11,
  },

  noticeBox: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(239,68,68,.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.25)",
    marginBottom: 12,
  },

  noticeTitle: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 3,
  },

  noticeMessage: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 17,
  },

  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37,99,235,.14)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,.28)",
    padding: 16,
    marginBottom: 14,
  },

  todayLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },

  todayValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },

  todaySub: {
    color: "#cbd5e1",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 12,
  },

  todayBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(16,185,129,.14)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.28)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
  },

  todayBadgeValue: {
    color: "#6ee7b7",
    fontWeight: "900",
    fontSize: 18,
  },

  todayBadgeLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 10,
    marginTop: 2,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  miniStat: {
    width: "31.6%",
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: "center",
  },

  miniStatActive: {
    borderColor: "rgba(16,185,129,.32)",
    backgroundColor: "rgba(16,185,129,.08)",
  },

  miniStatWarning: {
    borderColor: "rgba(245,158,11,.32)",
    backgroundColor: "rgba(245,158,11,.08)",
  },

  miniStatValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 18,
  },

  miniStatLabel: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 10,
    marginTop: 3,
  },

  section: {
    marginBottom: 16,
  },

  sectionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },

  viewAllText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  actionCard: {
    width: "48.4%",
    minHeight: 116,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    padding: 14,
  },

  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },

  actionTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  actionSub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  tripMiniCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.22)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },

  tripNo: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  tripMeta: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },

  tripSub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },

  runningBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245,158,11,.14)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,.25)",
    marginLeft: 10,
  },

  recentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    padding: 14,
    marginBottom: 10,
  },

  recentTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  recentMeta: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },

  recentSub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 11,
    marginTop: 4,
  },

  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 10,
    borderWidth: 1,
  },

  runningPill: {
    backgroundColor: "rgba(245,158,11,.14)",
    borderColor: "rgba(245,158,11,.25)",
  },

  endedPill: {
    backgroundColor: "rgba(16,185,129,.14)",
    borderColor: "rgba(16,185,129,.25)",
  },

  statusPillText: {
    fontWeight: "900",
    fontSize: 10,
  },

  runningText: {
    color: "#facc15",
    fontWeight: "900",
    fontSize: 10,
  },

  endedText: {
    color: "#6ee7b7",
  },

  emptyBox: {
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    padding: 18,
    alignItems: "center",
  },

  emptyText: {
    color: "#94a3b8",
    fontWeight: "700",
  },
};
