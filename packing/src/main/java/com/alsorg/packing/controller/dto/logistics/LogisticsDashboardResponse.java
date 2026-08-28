package com.alsorg.packing.controller.dto.logistics;

import java.util.Map;

public class LogisticsDashboardResponse {

    private int totalTrips;
    private int totalLoaders;
    private double efficiency;
    private int activeDrivers;
    private int activeVehicles;
    private double totalWorkingHours;
    private Map<String, Integer> tripsOverTime;
    private Map<String, Integer> tripsByVehicle;
    private Map<String, Integer> tripsByDriver;
    private Map<String, Double> driverPerformance;
    private Map<String, Double> vehicleUtilization;

    public int getTotalTrips() {
        return totalTrips;
    }

    public void setTotalTrips(int totalTrips) {
        this.totalTrips = totalTrips;
    }

    public int getTotalLoaders() {
        return totalLoaders;
    }

    public void setTotalLoaders(int totalLoaders) {
        this.totalLoaders = totalLoaders;
    }

    public double getEfficiency() {
        return efficiency;
    }

    public void setEfficiency(double efficiency) {
        this.efficiency = efficiency;
    }

    public int getActiveDrivers() {
        return activeDrivers;
    }

    public void setActiveDrivers(int activeDrivers) {
        this.activeDrivers = activeDrivers;
    }

    public int getActiveVehicles() {
        return activeVehicles;
    }

    public void setActiveVehicles(int activeVehicles) {
        this.activeVehicles = activeVehicles;
    }

    public double getTotalWorkingHours() {
        return totalWorkingHours;
    }

    public void setTotalWorkingHours(double totalWorkingHours) {
        this.totalWorkingHours = totalWorkingHours;
    }

    public Map<String, Integer> getTripsOverTime() {
        return tripsOverTime;
    }

    public void setTripsOverTime(Map<String, Integer> tripsOverTime) {
        this.tripsOverTime = tripsOverTime;
    }

    public Map<String, Integer> getTripsByVehicle() {
        return tripsByVehicle;
    }

    public void setTripsByVehicle(Map<String, Integer> tripsByVehicle) {
        this.tripsByVehicle = tripsByVehicle;
    }

    public Map<String, Integer> getTripsByDriver() {
        return tripsByDriver;
    }

    public void setTripsByDriver(Map<String, Integer> tripsByDriver) {
        this.tripsByDriver = tripsByDriver;
    }

    public Map<String, Double> getDriverPerformance() {
        return driverPerformance;
    }

    public void setDriverPerformance(Map<String, Double> driverPerformance) {
        this.driverPerformance = driverPerformance;
    }

    public Map<String, Double> getVehicleUtilization() {
        return vehicleUtilization;
    }

    public void setVehicleUtilization(Map<String, Double> vehicleUtilization) {
        this.vehicleUtilization = vehicleUtilization;
    }
}
