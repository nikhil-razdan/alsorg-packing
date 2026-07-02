import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";

import DateTimePicker from "@react-native-community/datetimepicker";

function pad(value) {
  return String(value).padStart(2, "0");
}

function toLocalInputValue(date) {
  const d =
    date instanceof Date && !Number.isNaN(date.getTime())
      ? date
      : new Date();

  return (
    `${d.getFullYear()}-` +
    `${pad(d.getMonth() + 1)}-` +
    `${pad(d.getDate())}T` +
    `${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}`
  );
}

function parseLocalInputValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text =
    String(value || "").trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

  if (!match) {
    return new Date();
  }

  const [, y, m, d, h, min] =
    match;

  return new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(h),
    Number(min),
    0,
    0
  );
}

function formatDisplay(value) {
  const date =
    parseLocalInputValue(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDay(value) {
  const date =
    parseLocalInputValue(value);

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(value) {
  const date =
    parseLocalInputValue(value);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function addMinutes(baseValue, minutes) {
  const date =
    parseLocalInputValue(baseValue);

  date.setMinutes(
    date.getMinutes() + minutes
  );

  return toLocalInputValue(date);
}

function setTodayAt(hour, minute = 0) {
  const date =
    new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return toLocalInputValue(date);
}

export default function TripStartPicker({
  value,
  onChange,
  label = "Trip Start Time",
}) {
  const [pickerMode, setPickerMode] =
    useState(null);

  const [draftDate, setDraftDate] =
    useState(() =>
      parseLocalInputValue(value)
    );

  useEffect(() => {
    if (!pickerMode) {
      setDraftDate(
        parseLocalInputValue(value)
      );
    }
  }, [value, pickerMode]);

  const displayText =
    useMemo(
      () => formatDisplay(value),
      [value]
    );

  const dayText =
    useMemo(
      () => formatDay(value),
      [value]
    );

  const timeText =
    useMemo(
      () => formatTime(value),
      [value]
    );

  const openDatePicker = () => {
    setDraftDate(
      parseLocalInputValue(value)
    );

    setPickerMode("date");
  };

  const applyDate = (selectedDate) => {
    const existing =
      draftDate || new Date();

    const selected =
      selectedDate || existing;

    const merged =
      new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        existing.getHours(),
        existing.getMinutes(),
        0,
        0
      );

    setDraftDate(merged);

    if (Platform.OS === "android") {
      setPickerMode("time");
    }
  };

  const applyTime = (selectedDate) => {
    const existing =
      draftDate || new Date();

    const selected =
      selectedDate || existing;

    const merged =
      new Date(
        existing.getFullYear(),
        existing.getMonth(),
        existing.getDate(),
        selected.getHours(),
        selected.getMinutes(),
        0,
        0
      );

    setDraftDate(merged);

    onChange(
      toLocalInputValue(merged)
    );

    if (Platform.OS === "android") {
      setPickerMode(null);
    }
  };

  const onPickerChange = (
    event,
    selectedDate
  ) => {
    if (
      Platform.OS === "android" &&
      event?.type === "dismissed"
    ) {
      setPickerMode(null);
      return;
    }

    if (!selectedDate) {
      return;
    }

    if (pickerMode === "date") {
      applyDate(selectedDate);
      return;
    }

    if (pickerMode === "time") {
      applyTime(selectedDate);
    }
  };

  const applyQuick = (nextValue) => {
    onChange(nextValue);
    setDraftDate(
      parseLocalInputValue(nextValue)
    );
    setPickerMode(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
        </Text>

        <Text style={styles.badge}>
          Local Time
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.mainCard}
        onPress={openDatePicker}
      >
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>
            🕒
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.mainValue}>
            {displayText}
          </Text>

          <Text style={styles.subValue}>
            {dayText} • {timeText}
          </Text>
        </View>

        <Text style={styles.changeText}>
          Change
        </Text>
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <QuickButton
          label="Now"
          onPress={() =>
            applyQuick(
              toLocalInputValue(new Date())
            )
          }
        />

        <QuickButton
          label="+30 min"
          onPress={() =>
            applyQuick(
              addMinutes(value, 30)
            )
          }
        />

        <QuickButton
          label="+1 hr"
          onPress={() =>
            applyQuick(
              addMinutes(value, 60)
            )
          }
        />

        <QuickButton
          label="6 PM"
          onPress={() =>
            applyQuick(
              setTodayAt(18, 0)
            )
          }
        />
      </View>

      {pickerMode ? (
        <DateTimePicker
          value={draftDate}
          mode={pickerMode}
          display={
            pickerMode === "time"
              ? "clock"
              : "calendar"
          }
          is24Hour={false}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

function QuickButton({
  label,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.quickBtn}
      onPress={onPress}
    >
      <Text style={styles.quickText}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = {
  wrap: {
    marginBottom: 14,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },

  badge: {
    color: "#93c5fd",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,.12)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.25)",
  },

  mainCard: {
    minHeight: 72,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(16,185,129,.14)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconText: {
    fontSize: 21,
  },

  mainValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  subValue: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },

  changeText: {
    color: "#6ee7b7",
    fontSize: 12,
    fontWeight: "900",
  },

  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,.22)",
  },

  quickText: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "900",
  },
};