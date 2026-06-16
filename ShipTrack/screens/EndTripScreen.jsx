import React, {
    useState,
} from "react";

import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Image,
} from "react-native";

import * as Location from "expo-location";

import {
    safeDownloadPodImage,
    safeOpenPodImage,
} from "../api/podDownloadApi";

import {
    stopLiveLocation,
} from "../api/liveLocationTracker";

import * as ImagePicker from "expo-image-picker";

import {
    uploadPodPhoto,
} from "../api/podApi";

import {
    endTrip,
} from "../api/logisticsApi";

function getNowDateTimeLocal() {
    const d = new Date();

    d.setMinutes(
        d.getMinutes() - d.getTimezoneOffset()
    );

    return d.toISOString().slice(0, 16);
}

function toBackendDateTime(value) {
    if (!value) return null;

    return value.length === 16
        ? `${value}:00`
        : value;
}

export default function EndTripScreen({
    route,
    navigation,
}) {
    const trip =
        route?.params?.trip || null;

    const [saving, setSaving] =
        useState(false);

    const [capturingLocation, setCapturingLocation] =
        useState(false);

    const [uploadingPod, setUploadingPod] =
        useState(false);

    const [podPhotoUri, setPodPhotoUri] =
        useState("");

    const [form, setForm] =
        useState({
            tripEnd: getNowDateTimeLocal(),
            receiverName: "",
            receiverPhone: "",
            podUrl: "",
            deliveryRemarks: "",
            remarks: "",
            deliveryLatitude: "",
            deliveryLongitude: "",
            deliveryLocationAccuracy: "",
        });

    const update = (
        key,
        value
    ) => {
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const captureLocation = async () => {
        try {
            setCapturingLocation(true);

            const permission =
                await Location.requestForegroundPermissionsAsync();

            if (permission.status !== "granted") {
                Alert.alert(
                    "Permission required",
                    "Please allow location permission to capture delivery location."
                );

                return;
            }

            const current =
                await Location.getCurrentPositionAsync({
                    accuracy:
                        Location.Accuracy.High,
                });

            update(
                "deliveryLatitude",
                String(current.coords.latitude)
            );

            update(
                "deliveryLongitude",
                String(current.coords.longitude)
            );

            update(
                "deliveryLocationAccuracy",
                String(
                    current.coords.accuracy || ""
                )
            );

            Alert.alert(
                "Location captured",
                "Delivery location has been captured successfully."
            );
        } catch (e) {
            console.error(e);

            Alert.alert(
                "Location failed",
                e?.message ||
                "Unable to capture location."
            );
        } finally {
            setCapturingLocation(false);
        }
    };

    const capturePodPhoto = async () => {
        try {
            setUploadingPod(true);

            const permission =
                await ImagePicker.requestCameraPermissionsAsync();

            if (permission.status !== "granted") {
                Alert.alert(
                    "Camera permission required",
                    "Please allow camera permission to capture POD photo."
                );

                return;
            }

            const result =
                await ImagePicker.launchCameraAsync({
                    mediaTypes: ["images"],
                    cameraType:
                        ImagePicker.CameraType.back,
                    allowsEditing: false,
                    quality: 0.55,
                });

            if (result.canceled) {
                return;
            }

            const asset =
                result.assets && result.assets.length > 0
                    ? result.assets[0]
                    : null;

            if (!asset?.uri) {
                throw new Error(
                    "Captured photo URI missing"
                );
            }

            setPodPhotoUri(asset.uri);

            const uploaded =
                await uploadPodPhoto(asset.uri);

            if (!uploaded?.url) {
                throw new Error(
                    "POD upload did not return URL"
                );
            }

            update("podUrl", uploaded.url);

            Alert.alert(
                "POD photo uploaded",
                "Photo captured and POD URL saved successfully."
            );
        } catch (e) {
            console.error(e);

            Alert.alert(
                "POD photo failed",
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Unable to capture/upload POD photo."
            );
        } finally {
            setUploadingPod(false);
        }
    };

    const submit = async () => {
        if (!trip?.id) {
            Alert.alert(
                "Trip missing",
                "Trip id not found."
            );

            return;
        }

        if (!form.tripEnd) {
            Alert.alert(
                "Required",
                "Trip end time is required."
            );

            return;
        }

        if (!form.receiverName.trim()) {
            Alert.alert(
                "Required",
                "Receiver name is required."
            );

            return;
        }

        if (
            !form.deliveryLatitude ||
            !form.deliveryLongitude
        ) {
            Alert.alert(
                "GPS Required",
                "Please capture delivery GPS location before ending the trip."
            );

            return;
        }

        try {
            setSaving(true);

            await endTrip(
                trip.id,
                {
                    tripEnd:
                        toBackendDateTime(
                            form.tripEnd
                        ),

                    remarks:
                        form.remarks || "",

                    receiverName:
                        form.receiverName || "",

                    receiverPhone:
                        form.receiverPhone || "",

                    podUrl:
                        form.podUrl || "",

                    deliveryRemarks:
                        form.deliveryRemarks || "",

                    deliveryLatitude:
                        form.deliveryLatitude
                            ? Number(
                                form.deliveryLatitude
                            )
                            : null,

                    deliveryLongitude:
                        form.deliveryLongitude
                            ? Number(
                                form.deliveryLongitude
                            )
                            : null,

                    deliveryLocationAccuracy:
                        form.deliveryLocationAccuracy
                            ? Number(
                                form.deliveryLocationAccuracy
                            )
                            : null,
                }
            );

            await stopLiveLocation();

            Alert.alert(
                "Trip delivered",
                "Trip ended successfully and all items are marked delivered.",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            navigation.navigate("Trips");
                        },
                    },
                ]
            );
        } catch (e) {
            console.error(e);

            Alert.alert(
                "End trip failed",
                e?.response?.data?.message ||
                e?.response?.data ||
                e?.message ||
                "Failed to end trip"
            );
        } finally {
            setSaving(false);
        }
    };

    const driverName =
        trip?.driver?.name ||
        trip?.driverName ||
        "—";

    const vehicleNo =
        trip?.vehicle?.vehicleNumber ||
        trip?.vehicleNumber ||
        "—";

    return (
        <ScrollView
            style={styles.page}
            contentContainerStyle={{
                paddingBottom: 36,
            }}
        >
            <View style={styles.tripCard}>
                <Text style={styles.label}>
                    Challan
                </Text>

                <Text style={styles.challan}>
                    {trip?.challanNumber || "—"}
                </Text>

                <Text style={styles.meta}>
                    {driverName} • {vehicleNo}
                </Text>

                <View style={styles.infoRow}>
                    <Info
                        label="Items"
                        value={String(
                            trip?.totalItems || 0
                        )}
                    />

                    <Info
                        label="Started"
                        value={
                            trip?.tripStart
                                ? new Date(
                                    trip.tripStart
                                ).toLocaleString()
                                : "—"
                        }
                    />
                </View>
            </View>

            <Text style={styles.sectionTitle}>
                Delivery Completion
            </Text>

            <Field label="Trip End Time">
                <TextInput
                    value={form.tripEnd}
                    onChangeText={(v) =>
                        update("tripEnd", v)
                    }
                    placeholder="YYYY-MM-DDTHH:mm"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                />
            </Field>

            <Field label="Receiver Name *">
                <TextInput
                    value={form.receiverName}
                    onChangeText={(v) =>
                        update("receiverName", v)
                    }
                    placeholder="Person who received material"
                    placeholderTextColor="#64748b"
                    style={styles.input}
                />
            </Field>

            <Field label="Receiver Phone">
                <TextInput
                    value={form.receiverPhone}
                    onChangeText={(v) =>
                        update("receiverPhone", v)
                    }
                    placeholder="Receiver contact number"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    style={styles.input}
                />
            </Field>

            <Field label="POD Photo / File URL">
                <TextInput
                    value={form.podUrl}
                    onChangeText={(v) =>
                        update("podUrl", v)
                    }
                    placeholder="Capture photo or paste POD image/file URL"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    style={styles.input}
                />

                <View style={styles.podActions}>
                    <TouchableOpacity
                        style={styles.podCaptureBtn}
                        onPress={capturePodPhoto}
                        disabled={uploadingPod}
                    >
                        {uploadingPod ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.podCaptureText}>
                                Capture POD Photo
                            </Text>
                        )}
                    </TouchableOpacity>

                    {form.podUrl ? (
                        <TouchableOpacity
                            style={styles.podClearBtn}
                            onPress={() => {
                                update("podUrl", "");
                                setPodPhotoUri("");
                            }}
                            disabled={uploadingPod}
                        >
                            <Text style={styles.podClearText}>
                                Clear
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {podPhotoUri ? (
                    <Image
                        source={{
                            uri: podPhotoUri,
                        }}
                        style={styles.podImage}
                    />
                ) : null}

                {form.podUrl ? (
                    <Text
                        style={styles.podUrlText}
                        numberOfLines={2}
                    >
                        Uploaded URL: {form.podUrl}
                    </Text>
                ) : null}
                {form.podUrl ? (
                    <View style={styles.podDownloadActions}>
                        <TouchableOpacity
                            style={styles.podOpenBtn}
                            onPress={() =>
                                safeOpenPodImage(
                                    podPhotoUri || form.podUrl
                                )
                            }
                        >
                            <Text style={styles.podOpenText}>
                                Open in Gallery
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.podDownloadBtn}
                            onPress={() =>
                                safeDownloadPodImage(
                                    podPhotoUri || form.podUrl
                                )
                            }
                        >
                            <Text style={styles.podDownloadText}>
                                Download POD
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </Field>

            <Field label="Delivery Remarks">
                <TextInput
                    value={form.deliveryRemarks}
                    onChangeText={(v) =>
                        update(
                            "deliveryRemarks",
                            v
                        )
                    }
                    placeholder="Material received, damage, shortage, unloading notes..."
                    placeholderTextColor="#64748b"
                    style={[
                        styles.input,
                        styles.textarea,
                    ]}
                    multiline
                />
            </Field>

            <View style={styles.locationCard}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.locationTitle}>
                        Delivery Location
                    </Text>

                    {form.deliveryLatitude &&
                        form.deliveryLongitude ? (
                        <>
                            <Text style={styles.locationText}>
                                Lat:{" "}
                                {form.deliveryLatitude}
                            </Text>

                            <Text style={styles.locationText}>
                                Long:{" "}
                                {form.deliveryLongitude}
                            </Text>

                            <Text style={styles.locationText}>
                                Accuracy:{" "}
                                {form.deliveryLocationAccuracy
                                    ? `${Math.round(
                                        Number(
                                            form.deliveryLocationAccuracy
                                        )
                                    )} m`
                                    : "—"}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.locationSub}>
                            No location captured yet
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.locationBtn}
                    onPress={captureLocation}
                    disabled={capturingLocation}
                >
                    {capturingLocation ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.locationBtnText}>
                            Capture GPS
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            <Field label="Internal Trip Remarks">
                <TextInput
                    value={form.remarks}
                    onChangeText={(v) =>
                        update("remarks", v)
                    }
                    placeholder="Optional internal logistics remarks"
                    placeholderTextColor="#64748b"
                    style={[
                        styles.input,
                        styles.textarea,
                    ]}
                    multiline
                />
            </Field>

            <TouchableOpacity
                style={[
                    styles.submitBtn,
                    saving
                        ? styles.submitDisabled
                        : null,
                ]}
                onPress={submit}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.submitText}>
                        End Trip & Mark Delivered
                    </Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}

function Field({
    label,
    children,
}) {
    return (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>
                {label}
            </Text>

            {children}
        </View>
    );
}

function Info({
    label,
    value,
}) {
    return (
        <View style={styles.info}>
            <Text style={styles.infoLabel}>
                {label}
            </Text>

            <Text
                style={styles.infoValue}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
}

const styles = {
    page: {
        flex: 1,
        backgroundColor: "#020617",
        padding: 16,
    },

    tripCard: {
        backgroundColor: "#0f172a",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.08)",
        marginBottom: 18,
    },

    label: {
        color: "#64748b",
        fontSize: 11,
        fontWeight: "900",
        marginBottom: 4,
    },

    challan: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "900",
    },

    meta: {
        color: "#94a3b8",
        marginTop: 6,
        fontWeight: "700",
    },

    infoRow: {
        flexDirection: "row",
        marginHorizontal: -4,
        marginTop: 14,
    },

    info: {
        flex: 1,
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

    sectionTitle: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
        marginBottom: 14,
    },

    field: {
        marginBottom: 14,
    },

    fieldLabel: {
        color: "#94a3b8",
        fontSize: 12,
        fontWeight: "900",
        marginBottom: 8,
    },

    input: {
        minHeight: 50,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.10)",
        backgroundColor: "rgba(255,255,255,.05)",
        color: "#fff",
        paddingHorizontal: 14,
        fontWeight: "700",
    },

    textarea: {
        minHeight: 96,
        paddingTop: 12,
        textAlignVertical: "top",
    },

    locationCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "rgba(59,130,246,.10)",
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: "rgba(59,130,246,.18)",
        marginBottom: 14,
    },

    locationTitle: {
        color: "#fff",
        fontWeight: "900",
        marginBottom: 5,
    },

    locationSub: {
        color: "#94a3b8",
        fontWeight: "700",
        fontSize: 12,
    },

    locationText: {
        color: "#cbd5e1",
        fontWeight: "700",
        fontSize: 12,
        marginTop: 2,
    },

    locationBtn: {
        minWidth: 112,
        height: 44,
        borderRadius: 12,
        backgroundColor: "#2563eb",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
    },

    locationBtnText: {
        color: "#fff",
        fontWeight: "900",
    },

    submitBtn: {
        height: 54,
        borderRadius: 16,
        backgroundColor: "#10b981",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 10,
    },

    submitDisabled: {
        opacity: 0.65,
    },

    submitText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 15,
    },
    podActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },

    podCaptureBtn: {
        flex: 1,
        minHeight: 46,
        borderRadius: 14,
        backgroundColor: "#2563eb",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
    },

    podCaptureText: {
        color: "#fff",
        fontWeight: "900",
    },

    podClearBtn: {
        width: 86,
        minHeight: 46,
        borderRadius: 14,
        backgroundColor: "rgba(239,68,68,.16)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,.28)",
        alignItems: "center",
        justifyContent: "center",
    },

    podClearText: {
        color: "#fca5a5",
        fontWeight: "900",
    },
    podImage: {
        width: "100%",
        height: 220,
        borderRadius: 16,
        marginTop: 12,
        backgroundColor: "#0f172a",
    },

    podUrlText: {
        color: "#93c5fd",
        fontSize: 11,
        fontWeight: "700",
        marginTop: 8,
        lineHeight: 16,
    },
    podDownloadActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 10,
    },

    podOpenBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: "rgba(59,130,246,.12)",
        borderWidth: 1,
        borderColor: "rgba(59,130,246,.25)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    podOpenText: {
        color: "#93c5fd",
        fontWeight: "900",
        fontSize: 12,
    },

    podDownloadBtn: {
        flex: 1,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: "rgba(16,185,129,.14)",
        borderWidth: 1,
        borderColor: "rgba(16,185,129,.28)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
    },

    podDownloadText: {
        color: "#6ee7b7",
        fontWeight: "900",
        fontSize: 12,
    },
};