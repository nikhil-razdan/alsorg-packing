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

import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import DispatchItemsScreen from "../screens/DispatchItemsScreen";
import LoginScreen from "../screens/LoginScreen";
import DispatchHomeScreen from "../screens/DispatchHomeScreen";
import ScanDispatchScreen from "../screens/ScanDispatchScreen";
import BulkScanScreen from "../screens/BulkScanScreen";
import TripsScreen from "../screens/TripsScreen";
import TripItemScreen from "../screens/TripItemScreen";
import SiteLifecycleScreen from "../screens/SiteLifecycleScreen";

const Stack = createNativeStackNavigator();

function HomeEntry(props) {
  const {
    hasRole,
  } = useAuth();

  if (hasRole("ADMIN")) {
    return (
      <AdminDashboardScreen
        {...props}
      />
    );
  }

  const pureDriver =
    hasRole("DRIVER") &&
    !hasRole("DISPATCH") &&
    !hasRole("UTL_DISPATCH") &&
    !hasRole("LOGISTICS");

  const pureOnsite =
    hasRole("ONSITE") &&
    !hasRole("DRIVER") &&
    !hasRole("DISPATCH") &&
    !hasRole("UTL_DISPATCH") &&
    !hasRole("LOGISTICS");

  if (pureDriver) {
    return (
      <SiteLifecycleScreen
        {...props}
        initialMode="DELIVERY"
      />
    );
  }

  if (pureOnsite) {
    return (
      <SiteLifecycleScreen
        {...props}
        initialMode="OPENING"
      />
    );
  }

  return (
    <DispatchHomeScreen
      {...props}
    />
  );
}

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
              component={HomeEntry}
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
              name="DispatchItems"
              component={DispatchItemsScreen}
              options={{
                title: "",
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
                title: "Dispatch Items",
              }}
            />

            <Stack.Screen
              name="SiteLifecycle"
              component={SiteLifecycleScreen}
              options={{
                title: "Site Proof",
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}