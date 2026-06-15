import React from "react";

import {
  NavigationContainer,
} from "@react-navigation/native";

import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";

import {
  ActivityIndicator,
  View,
} from "react-native";

import {
  useAuth,
} from "../auth/AuthContext";

import LoginScreen from "../screens/LoginScreen";
import DispatchHomeScreen from "../screens/DispatchHomeScreen";
import ScanDispatchScreen from "../screens/ScanDispatchScreen";
import BulkScanScreen from "../screens/BulkScanScreen";
import StartTripScreen from "../screens/StartTripScreen";
import TripsScreen from "../screens/TripsScreen";
import TripItemScreen from "../screens/TripItemScreen";
import EndTripScreen from "../screens/EndTripScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const {
    token,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020617",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#020617",
          },
          headerTintColor: "#fff",
          contentStyle: {
            backgroundColor: "#020617",
          },
        }}
      >
        {!token ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Home"
              component={DispatchHomeScreen}
              options={{
                title: "",
              }}
            />

            <Stack.Screen
              name="ScanDispatch"
              component={ScanDispatchScreen}
              options={{
                title: "",
              }}
            />

            <Stack.Screen
              name="BulkScan"
              component={BulkScanScreen}
              options={{
                title: "",
              }}
            />

            <Stack.Screen
              name="StartTrip"
              component={StartTripScreen}
              options={{
                title: "Start Trip",
              }}
            />

            <Stack.Screen
              name="Trips"
              component={TripsScreen}
              options={{
                title: "",
              }}
            />

            <Stack.Screen
              name="TripItems"
              component={TripItemScreen}
              options={{
                title: "Trip Items",
              }}
            />

            <Stack.Screen
              name="EndTrip"
              component={EndTripScreen}
              options={{
                title: "End Trip",
                presentation: "modal",
                animation: "slide_from_bottom",
                headerStyle: {
                  backgroundColor: "#020617",
                },
                headerTintColor: "#fff",
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}