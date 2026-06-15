import React from "react";

import {
  View,
  Text,
} from "react-native";

export default function StartTripScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.text}>
        Start Trip screen coming next.
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