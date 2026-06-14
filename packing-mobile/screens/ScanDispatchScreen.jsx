import React from "react";

import {
  View,
  Text,
} from "react-native";

export default function ScanDispatchScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.text}>
        Single QR Dispatch screen coming next.
      </Text>
    </View>
  );
}

const styles = {
  page: {
    flex: 1,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  text: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
};