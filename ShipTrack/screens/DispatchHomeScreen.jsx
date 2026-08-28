import React, {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
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

function normalizeStatus(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}

function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  try {
    const raw =
      String(
        value
      ).trim();

    const match =
      raw.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
      );

    let date;

    if (match) {
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
        new Date(
          raw
        );
    }

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return raw;
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(
      date
    );
  } catch {
    return String(
      value || "—"
    );
  }
}

function isToday(
  value
) {
  if (!value) {
    return false;
  }

  const raw =
    String(
      value
    ).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  const now =
    new Date();

  if (match) {
    return (
      Number(match[1]) ===
      now.getFullYear() &&
      Number(match[2]) ===
      now.getMonth() + 1 &&
      Number(match[3]) ===
      now.getDate()
    );
  }

  const date =
    new Date(
      raw
    );

  return (
    !Number.isNaN(
      date.getTime()
    ) &&
    date.getFullYear() ===
    now.getFullYear() &&
    date.getMonth() ===
    now.getMonth() &&
    date.getDate() ===
    now.getDate()
  );
}

function getCurrentLocation(
  item
) {
  return (
    item?.currentLocationCode ||
    item?.location ||
    item?.currentLocation ||
    ""
  );
}

function isLegacyItem(
  item
) {
  return (
    !item?.plantCode ||
    !item?.currentLocationCode ||
    !item?.fgAreaCode
  );
}

function isPkd(
  item
) {
  return String(
    getCurrentLocation(
      item
    ) || ""
  )
    .toUpperCase()
    .startsWith(
      "PKD"
    );
}

function isFg(
  item
) {
  const location =
    getCurrentLocation(
      item
    );

  const fg =
    item?.fgAreaCode;

  if (
    !location ||
    !fg
  ) {
    return false;
  }

  return String(
    location
  )
    .toUpperCase()
    .startsWith(
      String(
        fg
      ).toUpperCase()
    );
}

function needsFg(
  item
) {
  return (
    normalizeStatus(
      item?.status
    ) === "READY" &&
    !isLegacyItem(
      item
    ) &&
    isPkd(
      item
    )
  );
}

function canDispatch(
  item
) {
  const status =
    normalizeStatus(
      item?.status
    );

  if (
    status ===
    "READY_TO_DISPATCH"
  ) {
    return true;
  }

  return (
    status === "READY" &&
    (
      isLegacyItem(
        item
      ) ||
      isFg(
        item
      )
    )
  );
}

function isTripEnded(
  challan
) {
  return (
    Boolean(
      challan?.tripEndedAt
    ) ||
    normalizeStatus(
      challan?.tripStatus
    ) === "ENDED"
  );
}

export default function DispatchHomeScreen({
  navigation,
}) {
  const {
    role,
    roles = [],
    hasRole,
    username,
    logout,
  } = useAuth();

  const isDispatch =
    hasRole(
      "DISPATCH"
    );

  const roleLabel =
    roles.length
      ? roles.join(" • ")
      : normalizeStatus(
        role
      ) || "DISPATCH";

  const [
    loading,
    setLoading,
  ] = useState(
    false
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(
    false
  );

  const [
    items,
    setItems,
  ] = useState(
    []
  );

  const [
    challans,
    setChallans,
  ] = useState(
    []
  );

  const [
    drivers,
    setDrivers,
  ] = useState(
    []
  );

  const [
    vehicles,
    setVehicles,
  ] = useState(
    []
  );

  const [
    notice,
    setNotice,
  ] = useState(
    ""
  );

  const loadDashboard =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

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
            Array.isArray(
              itemData
            )
              ? itemData
              : []
          );

          setChallans(
            Array.isArray(
              challanData
            )
              ? challanData
              : []
          );

          setDrivers(
            Array.isArray(
              driverData
            )
              ? driverData
              : []
          );

          setVehicles(
            Array.isArray(
              vehicleData
            )
              ? vehicleData
              : []
          );

          setNotice(
            ""
          );
        } catch (e) {
          setNotice(
            getBackendMessage(
              e,
              "Unable to load dispatch dashboard."
            )
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  const refresh =
    useCallback(
      async () => {
        try {
          setRefreshing(
            true
          );

          await loadDashboard();
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        loadDashboard,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        if (
          isDispatch
        ) {
          loadDashboard();
        }
      },
      [
        isDispatch,
        loadDashboard,
      ]
    )
  );

  const stats =
    useMemo(
      () => {
        const ready =
          items.filter(
            (item) =>
              normalizeStatus(
                item.status
              ) === "READY"
          ).length;

        const readyDispatch =
          items.filter(
            (item) =>
              normalizeStatus(
                item.status
              ) ===
              "READY_TO_DISPATCH"
          ).length;

        const needFgCount =
          items.filter(
            needsFg
          ).length;

        const dispatchable =
          items.filter(
            canDispatch
          ).length;

        const dispatched =
          items.filter(
            (item) =>
              normalizeStatus(
                item.status
              ) ===
              "DISPATCHED"
          ).length;

        const todayRows =
          challans.filter(
            (challan) =>
              isToday(
                challan.dispatchedAt ||
                challan.tripStartedAt
              )
          );

        const todayItems =
          todayRows.reduce(
            (
              total,
              challan
            ) =>
              total +
              Number(
                challan.totalItems ||
                challan.items
                  ?.length ||
                0
              ),
            0
          );

        const running =
          challans.filter(
            (challan) =>
              !isTripEnded(
                challan
              )
          ).length;

        return {
          ready,
          readyDispatch,
          needFg:
            needFgCount,
          dispatchable,
          dispatched,
          todayChallans:
            todayRows.length,
          todayItems,
          running,
          drivers:
            drivers.length,
          vehicles:
            vehicles.length,
        };
      },
      [
        items,
        challans,
        drivers,
        vehicles,
      ]
    );

  const recentChallans =
    useMemo(
      () =>
        [...challans]
          .sort(
            (
              a,
              b
            ) => {
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

              return (
                bTime -
                aTime
              );
            }
          )
          .slice(
            0,
            4
          ),
      [
        challans,
      ]
    );

  if (
    !isDispatch
  ) {
    return (
      <View style={styles.center}>
        <Text style={styles.restrictedTitle}>
          Access Restricted
        </Text>

        <Text style={styles.restrictedText}>
          This control centre is available to DISPATCH users.
        </Text>

        <TouchableOpacity
          style={styles.logoutMain}
          onPress={
            logout
          }
        >
          <Text style={styles.logoutMainText}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (
    loading &&
    items.length === 0 &&
    challans.length === 0
  ) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />

        <Text style={styles.loadingText}>
          Loading dispatch control centre...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      showsVerticalScrollIndicator={
        false
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={
            refresh
          }
          tintColor="#fff"
        />
      }
      contentContainerStyle={{
        paddingBottom:
          36,
      }}
    >
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />

            <Text style={styles.kicker}>
              SHIPTRACK • LIVE
            </Text>
          </View>

          <Text style={styles.title}>
            Dispatch Control
          </Text>

          <Text style={styles.sub}>
            {username ||
              "User"}{" "}
            • {roleLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutSmall}
          onPress={
            logout
          }
        >
          <Text style={styles.logoutSmallText}>
            Logout
          </Text>
        </TouchableOpacity>
      </View>

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            Dashboard Update Failed
          </Text>

          <Text style={styles.noticeText}>
            {notice}
          </Text>

          <TouchableOpacity
            onPress={
              refresh
            }
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.todayCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayKicker}>
            TODAY&apos;S OPERATIONS
          </Text>

          <Text style={styles.todayValue}>
            {stats.todayItems}
          </Text>

          <Text style={styles.todayLabel}>
            Items dispatched
          </Text>

          <View style={styles.todayMetaRow}>
            <Text style={styles.todayMeta}>
              {
                stats.todayChallans
              }{" "}
              Challans
            </Text>

            <View style={styles.metaDot} />

            <Text style={styles.todayMeta}>
              {
                stats.running
              }{" "}
              Running
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.healthBadge,
            stats.needFg > 0
              ? styles.healthWarning
              : styles.healthGood,
          ]}
        >
          <Text style={styles.healthIcon}>
            {stats.needFg > 0
              ? "!"
              : "✓"}
          </Text>

          <Text style={styles.healthText}>
            {stats.needFg > 0
              ? `${stats.needFg} Need FG`
              : "Flow Clear"}
          </Text>
        </View>
      </View>

      <View style={styles.priorityRow}>
        <PriorityCard
          label="Dispatchable"
          value={
            stats.dispatchable
          }
          caption="Can challan now"
          tone="good"
        />

        <PriorityCard
          label="Need FG"
          value={
            stats.needFg
          }
          caption="Needs action"
          tone={
            stats.needFg > 0
              ? "warn"
              : "normal"
          }
        />
      </View>

      <Text style={styles.sectionTitle}>
        Quick Dispatch
      </Text>

      <View style={styles.primaryActions}>
        <TouchableOpacity
          style={styles.primaryAction}
          activeOpacity={0.86}
          onPress={() =>
            navigation.navigate(
              "ScanDispatch"
            )
          }
        >
          <View style={styles.primaryIcon}>
            <Text style={styles.primaryIconText}>
              ◫
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.primaryActionTitle}>
              Single Dispatch
            </Text>

            <Text style={styles.primaryActionSub}>
              Scan QR or enter Sticker Number
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryAction}
          activeOpacity={0.86}
          onPress={() =>
            navigation.navigate(
              "BulkScan"
            )
          }
        >
          <View style={styles.primaryIcon}>
            <Text style={styles.primaryIconText}>
              ▦
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.primaryActionTitle}>
              Bulk Dispatch
            </Text>

            <Text style={styles.primaryActionSub}>
              Mix QR scans and Sticker Numbers
            </Text>
          </View>

          <Text style={styles.arrow}>
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Live Status
      </Text>

      <View style={styles.statsGrid}>
        <MiniStat
          label="Ready"
          value={
            stats.ready
          }
        />

        <MiniStat
          label="R.T.D."
          value={
            stats.readyDispatch
          }
          active={
            stats.readyDispatch >
            0
          }
        />

        <MiniStat
          label="Need FG"
          value={
            stats.needFg
          }
          warning={
            stats.needFg >
            0
          }
        />

        <MiniStat
          label="Running"
          value={
            stats.running
          }
          warning={
            stats.running >
            0
          }
        />

        <MiniStat
          label="Drivers"
          value={
            stats.drivers
          }
        />

        <MiniStat
          label="Vehicles"
          value={
            stats.vehicles
          }
        />
      </View>

      <Text style={styles.sectionTitle}>
        Operations
      </Text>

      <View style={styles.secondaryActions}>
        <SmallAction
          icon="📋"
          title="Dispatch Items"
          subtitle="Search and manage inventory"
          onPress={() =>
            navigation.navigate(
              "DispatchItems"
            )
          }
        />

        <SmallAction
          icon="🚚"
          title="Trips"
          subtitle="Challans & trip timing"
          onPress={() =>
            navigation.navigate(
              "Trips"
            )
          }
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Recent Challans
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(
              "Trips"
            )
          }
        >
          <Text style={styles.viewAll}>
            View All
          </Text>
        </TouchableOpacity>
      </View>

      {recentChallans.length ===
        0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No dispatch challans yet.
          </Text>
        </View>
      ) : (
        recentChallans.map(
          (
            challan,
            index
          ) => (
            <TouchableOpacity
              key={
                String(
                  challan.challanNumber ||
                  challan.id ||
                  `challan-${index}`
                )
              }
              style={styles.challanCard}
              activeOpacity={0.86}
              onPress={() =>
                navigation.navigate(
                  "TripItems",
                  {
                    trip:
                      challan,
                  }
                )
              }
            >
              <View style={styles.challanTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challanNo}>
                    {challan.challanNumber ||
                      "—"}
                  </Text>

                  <Text style={styles.challanTime}>
                    {formatDateTime(
                      challan.dispatchedAt ||
                      challan.tripStartedAt
                    )}
                  </Text>
                </View>

                <View
                  style={[
                    styles.tripBadge,
                    isTripEnded(
                      challan
                    )
                      ? styles.tripEnded
                      : styles.tripRunning,
                  ]}
                >
                  <Text style={styles.tripBadgeText}>
                    {isTripEnded(
                      challan
                    )
                      ? "ENDED"
                      : "RUNNING"}
                  </Text>
                </View>
              </View>

              <View style={styles.challanMetaRow}>
                <Meta
                  label="Items"
                  value={
                    challan.totalItems ||
                    challan.items
                      ?.length ||
                    0
                  }
                />

                <Meta
                  label="Driver"
                  value={
                    challan.driverName ||
                    "—"
                  }
                />

                <Meta
                  label="Vehicle"
                  value={
                    challan.vehicleNumber ||
                    "—"
                  }
                />
              </View>
            </TouchableOpacity>
          )
        )
      )}

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={
          refresh
        }
        disabled={
          refreshing
        }
      >
        {refreshing ? (
          <ActivityIndicator
            color="#93c5fd"
          />
        ) : (
          <Text style={styles.refreshText}>
            ↻ Refresh Live Data
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function PriorityCard({
  label,
  value,
  caption,
  tone,
}) {
  return (
    <View
      style={[
        styles.priorityCard,
        tone === "good"
          ? styles.priorityGood
          : tone === "warn"
            ? styles.priorityWarn
            : null,
      ]}
    >
      <Text style={styles.priorityLabel}>
        {label}
      </Text>

      <Text style={styles.priorityValue}>
        {value}
      </Text>

      <Text style={styles.priorityCaption}>
        {caption}
      </Text>
    </View>
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
      <Text style={styles.miniStatValue}>
        {value}
      </Text>

      <Text style={styles.miniStatLabel}>
        {label}
      </Text>
    </View>
  );
}

function SmallAction({
  icon,
  title,
  subtitle,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.smallAction}
      onPress={
        onPress
      }
      activeOpacity={0.86}
    >
      <Text style={styles.smallActionIcon}>
        {icon}
      </Text>

      <Text style={styles.smallActionTitle}>
        {title}
      </Text>

      <Text
        style={styles.smallActionSub}
        numberOfLines={2}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function Meta({
  label,
  value,
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>
        {label}
      </Text>

      <Text
        style={styles.metaValue}
        numberOfLines={1}
      >
        {String(
          value ?? "—"
        )}
      </Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor:
      "#020617",
    paddingHorizontal: 16,
  },

  center: {
    flex: 1,
    backgroundColor:
      "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 12,
  },

  hero: {
    marginTop: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 18,
    borderRadius: 24,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
  },

  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor:
      "#22c55e",
    marginRight: 7,
  },

  kicker: {
    color: "#60a5fa",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  title: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900",
  },

  sub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 5,
  },

  logoutSmall: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor:
      "rgba(239,68,68,.10)",
    borderWidth: 1,
    borderColor:
      "rgba(239,68,68,.22)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  logoutSmallText: {
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: "900",
  },

  notice: {
    backgroundColor:
      "rgba(239,68,68,.08)",
    borderColor:
      "rgba(239,68,68,.22)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
  },

  noticeTitle: {
    color: "#fca5a5",
    fontWeight: "900",
    fontSize: 12,
  },

  noticeText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  retryText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 11,
    marginTop: 7,
  },

  todayCard: {
    flexDirection: "row",
    backgroundColor:
      "rgba(37,99,235,.13)",
    borderRadius: 23,
    borderWidth: 1,
    borderColor:
      "rgba(59,130,246,.28)",
    padding: 17,
    marginBottom: 11,
  },

  todayKicker: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  todayValue: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 34,
    marginTop: 4,
    lineHeight: 38,
  },

  todayLabel: {
    color: "#cbd5e1",
    fontWeight: "800",
    fontSize: 12,
  },

  todayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  todayMeta: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor:
      "#64748b",
    marginHorizontal: 8,
  },

  healthBadge: {
    width: 84,
    minHeight: 84,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    borderWidth: 1,
  },

  healthGood: {
    backgroundColor:
      "rgba(16,185,129,.10)",
    borderColor:
      "rgba(16,185,129,.28)",
  },

  healthWarning: {
    backgroundColor:
      "rgba(245,158,11,.10)",
    borderColor:
      "rgba(245,158,11,.28)",
  },

  healthIcon: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 22,
  },

  healthText: {
    color: "#cbd5e1",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 4,
  },

  priorityRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 18,
  },

  priorityCard: {
    flex: 1,
    borderRadius: 18,
    padding: 13,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
  },

  priorityGood: {
    borderColor:
      "rgba(16,185,129,.24)",
  },

  priorityWarn: {
    borderColor:
      "rgba(245,158,11,.30)",
    backgroundColor:
      "rgba(245,158,11,.06)",
  },

  priorityLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "900",
  },

  priorityValue: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 3,
  },

  priorityCaption: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },

  primaryActions: {
    gap: 9,
    marginBottom: 20,
  },

  primaryAction: {
    minHeight: 76,
    borderRadius: 19,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(59,130,246,.22)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  primaryIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor:
      "rgba(37,99,235,.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  primaryIconText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 22,
  },

  primaryActionTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  primaryActionSub: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 10,
    marginTop: 4,
  },

  arrow: {
    color: "#64748b",
    fontSize: 28,
    marginLeft: 8,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },

  miniStat: {
    width: "31.6%",
    minHeight: 62,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
    justifyContent: "center",
  },

  miniStatActive: {
    backgroundColor:
      "rgba(16,185,129,.07)",
    borderColor:
      "rgba(16,185,129,.25)",
  },

  miniStatWarning: {
    backgroundColor:
      "rgba(245,158,11,.07)",
    borderColor:
      "rgba(245,158,11,.26)",
  },

  miniStatValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  miniStatLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "900",
    marginTop: 3,
  },

  secondaryActions: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 20,
  },

  smallAction: {
    flex: 1,
    minHeight: 108,
    backgroundColor:
      "#0f172a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
    padding: 13,
  },

  smallActionIcon: {
    fontSize: 22,
    marginBottom: 7,
  },

  smallActionTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  smallActionSub: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  viewAll: {
    color: "#60a5fa",
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 10,
  },

  challanCard: {
    borderRadius: 18,
    backgroundColor:
      "#0f172a",
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
    padding: 13,
    marginBottom: 9,
  },

  challanTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  challanNo: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  challanTime: {
    color: "#64748b",
    fontWeight: "700",
    fontSize: 9,
    marginTop: 4,
  },

  tripBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },

  tripRunning: {
    backgroundColor:
      "rgba(245,158,11,.08)",
    borderColor:
      "rgba(245,158,11,.22)",
  },

  tripEnded: {
    backgroundColor:
      "rgba(16,185,129,.08)",
    borderColor:
      "rgba(16,185,129,.22)",
  },

  tripBadgeText: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 8,
  },

  challanMetaRow: {
    flexDirection: "row",
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor:
      "rgba(255,255,255,.05)",
  },

  metaItem: {
    flex: 1,
    paddingRight: 8,
  },

  metaLabel: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  metaValue: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 3,
  },

  emptyCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,.08)",
    backgroundColor:
      "#0f172a",
    padding: 18,
  },

  emptyText: {
    color: "#64748b",
    textAlign: "center",
    fontWeight: "700",
  },

  refreshButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor:
      "rgba(59,130,246,.08)",
    borderWidth: 1,
    borderColor:
      "rgba(59,130,246,.20)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  refreshText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 11,
  },

  restrictedTitle: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 21,
  },

  restrictedText: {
    color: "#94a3b8",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 7,
    marginBottom: 18,
  },

  logoutMain: {
    minHeight: 45,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutMainText: {
    color: "#fff",
    fontWeight: "900",
  },
};