import React, {
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";

import {
  createDriver,
  createVehicle,
} from "../api/logisticsApi";

import {
  getBackendMessage,
} from "../api/client";

function driverLabel(driver) {
  return (
    driver?.name ||
    driver?.driverName ||
    "Driver"
  );
}

function vehicleLabel(vehicle) {
  return (
    vehicle?.vehicleNumber ||
    vehicle?.registrationNumber ||
    vehicle?.name ||
    "Vehicle"
  );
}

function unwrapCreated(result, type, value) {
  const possible =
    result?.[type] ||
    result?.data ||
    result;

  const source =
    possible &&
    typeof possible === "object"
      ? possible
      : {};

  const id =
    typeof possible === "string"
      ? possible
      : (
          source.id ||
          source.driverId ||
          source.vehicleId ||
          ""
        );

  if (!id) {
    throw new Error(
      `${type === "driver"
        ? "Driver"
        : "Vehicle"
      } was created but its ID was not returned.`
    );
  }

  if (type === "driver") {
    return {
      ...source,
      id,
      name:
        source.name ||
        source.driverName ||
        value,
    };
  }

  return {
    ...source,
    id,
    vehicleNumber:
      source.vehicleNumber ||
      source.registrationNumber ||
      value,
  };
}

export default function DriverVehicleFields({
  drivers = [],
  vehicles = [],
  driverId = "",
  vehicleId = "",
  onDriverChange,
  onVehicleChange,
  onCreated,
}) {
  const [createType, setCreateType] =
    useState("");

  const [draftValue, setDraftValue] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const selectedDriver =
    useMemo(
      () =>
        drivers.find(
          (driver) =>
            String(driver?.id) ===
            String(driverId)
        ),
      [drivers, driverId]
    );

  const selectedVehicle =
    useMemo(
      () =>
        vehicles.find(
          (vehicle) =>
            String(vehicle?.id) ===
            String(vehicleId)
        ),
      [vehicles, vehicleId]
    );

  const openCreate = (type) => {
    setCreateType(type);
    setDraftValue("");
    setError("");
  };

  const closeCreate = () => {
    if (saving) {
      return;
    }

    setCreateType("");
    setDraftValue("");
    setError("");
  };

  const submitCreate = async () => {
    const value =
      String(draftValue || "").trim();

    if (!value) {
      setError(
        createType === "driver"
          ? "Enter driver name."
          : "Enter vehicle number."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const result =
        createType === "driver"
          ? await createDriver({
              name: value,
            })
          : await createVehicle({
              vehicleNumber: value,
            });

      const created =
        unwrapCreated(
          result,
          createType,
          value
        );

      onCreated?.(
        createType,
        created
      );

      if (createType === "driver") {
        onDriverChange?.(
          String(created.id)
        );
      } else {
        onVehicleChange?.(
          String(created.id)
        );
      }

      closeCreate();
    } catch (e) {
      setError(
        getBackendMessage(
          e,
          `Unable to create ${createType}.`
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MasterSection
        label="Driver (Optional)"
        items={drivers}
        selectedId={driverId}
        getLabel={driverLabel}
        emptyText="Leave Empty"
        createText="+ Create Driver"
        selectedText={
          selectedDriver
            ? `Selected: ${driverLabel(
                selectedDriver
              )}`
            : "Driver will remain blank."
        }
        onChange={onDriverChange}
        onCreate={() =>
          openCreate("driver")
        }
      />

      <MasterSection
        label="Vehicle (Optional)"
        items={vehicles}
        selectedId={vehicleId}
        getLabel={vehicleLabel}
        emptyText="Leave Empty"
        createText="+ Create Vehicle"
        selectedText={
          selectedVehicle
            ? `Selected: ${vehicleLabel(
                selectedVehicle
              )}`
            : "Vehicle will remain blank."
        }
        onChange={onVehicleChange}
        onCreate={() =>
          openCreate("vehicle")
        }
      />

      <Modal
        visible={Boolean(createType)}
        transparent
        animationType="fade"
        onRequestClose={closeCreate}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={closeCreate}
          />

          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {createType === "driver"
                ? "Create Driver"
                : "Create Vehicle"}
            </Text>

            <Text style={styles.modalSub}>
              The newly created record will be
              selected automatically.
            </Text>

            <TextInput
              value={draftValue}
              onChangeText={setDraftValue}
              placeholder={
                createType === "driver"
                  ? "Driver name"
                  : "Vehicle number"
              }
              placeholderTextColor="#64748b"
              style={styles.input}
              autoCapitalize={
                createType === "driver"
                  ? "words"
                  : "characters"
              }
              editable={!saving}
            />

            {error ? (
              <Text style={styles.errorText}>
                {error}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeCreate}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={submitCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#fff"
                  />
                ) : (
                  <Text style={styles.createText}>
                    Create & Select
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MasterSection({
  label,
  items,
  selectedId,
  getLabel,
  emptyText,
  createText,
  selectedText,
  onChange,
  onCreate,
}) {
  const emptySelected =
    !String(selectedId || "").trim();

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <View style={styles.selectBox}>
        <TouchableOpacity
          style={[
            styles.optionChip,
            styles.emptyChip,
            emptySelected
              ? styles.emptyChipActive
              : null,
          ]}
          onPress={() =>
            onChange?.("")
          }
        >
          <Text
            style={[
              styles.optionText,
              emptySelected
                ? styles.emptyTextActive
                : null,
            ]}
          >
            {emptyText}
          </Text>
        </TouchableOpacity>

        {items.map((item, index) => {
          const active =
            String(item?.id) ===
            String(selectedId);

          return (
            <TouchableOpacity
              key={
                item?.id ||
                `${getLabel(item)}-${index}`
              }
              style={[
                styles.optionChip,
                active
                  ? styles.optionChipActive
                  : null,
              ]}
              onPress={() =>
                onChange?.(
                  String(item?.id || "")
                )
              }
            >
              <Text
                style={[
                  styles.optionText,
                  active
                    ? styles.optionTextActive
                    : null,
                ]}
              >
                {getLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[
            styles.optionChip,
            styles.addChip,
          ]}
          onPress={onCreate}
        >
          <Text style={styles.addChipText}>
            {createText}
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.selectionHint,
          emptySelected
            ? styles.emptyHint
            : null,
        ]}
      >
        {selectedText}
      </Text>
    </View>
  );
}

const styles = {
  field: {
    marginBottom: 14,
  },

  fieldLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
  },

  selectBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
  },

  optionChipActive: {
    backgroundColor: "rgba(16,185,129,.14)",
    borderColor: "rgba(16,185,129,.35)",
  },

  optionText: {
    color: "#cbd5e1",
    fontWeight: "900",
    fontSize: 12,
  },

  optionTextActive: {
    color: "#6ee7b7",
  },

  emptyChip: {
    backgroundColor: "rgba(148,163,184,.06)",
  },

  emptyChipActive: {
    backgroundColor: "rgba(168,85,247,.15)",
    borderColor: "rgba(168,85,247,.38)",
  },

  emptyTextActive: {
    color: "#c4b5fd",
  },

  addChip: {
    backgroundColor: "rgba(59,130,246,.12)",
    borderColor: "rgba(59,130,246,.30)",
  },

  addChipText: {
    color: "#93c5fd",
    fontWeight: "900",
    fontSize: 12,
  },

  selectionHint: {
    color: "#6ee7b7",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 8,
  },

  emptyHint: {
    color: "#c4b5fd",
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.65)",
  },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  modalCard: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
    padding: 18,
    paddingBottom: 28,
  },

  modalTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "900",
  },

  modalSub: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
    marginBottom: 14,
  },

  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    backgroundColor: "rgba(255,255,255,.05)",
    color: "#fff",
    paddingHorizontal: 14,
    fontWeight: "800",
  },

  errorText: {
    color: "#fca5a5",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 8,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    color: "#cbd5e1",
    fontWeight: "900",
  },

  createBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  createText: {
    color: "#fff",
    fontWeight: "900",
  },
};