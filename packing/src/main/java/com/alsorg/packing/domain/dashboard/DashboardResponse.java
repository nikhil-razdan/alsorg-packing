package com.alsorg.packing.domain.dashboard;

import java.util.Map;

public class DashboardResponse {

    /*
     * CORE KPIs
     */

    private int totalTrips;

    private int totalLoaders;

    private double efficiency;

    private int activeDrivers;

    private int activeVehicles;

    private double averageTripsPerDriver;

    private double averageTripsPerVehicle;

    /*
     * ANALYTICS
     */

    private Map<String, Integer> tripsOverTime;

    private Map<String, Integer> tripsByLocation;

    private Map<String, Integer> shiftPerformance;

    private Map<String, Integer> vehicleUtilization;

    private Map<String, Integer> driverTrips;

    private Map<String, Double> driverPerformance;

    private Map<String, Double> overtimeAnalytics;

    /*
     * GETTERS & SETTERS
     */

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

    public double getAverageTripsPerDriver() {
        return averageTripsPerDriver;
    }

    public void setAverageTripsPerDriver(double averageTripsPerDriver) {
        this.averageTripsPerDriver = averageTripsPerDriver;
    }

    public double getAverageTripsPerVehicle() {
        return averageTripsPerVehicle;
    }

    public void setAverageTripsPerVehicle(double averageTripsPerVehicle) {
        this.averageTripsPerVehicle = averageTripsPerVehicle;
    }

    public Map<String, Integer> getTripsOverTime() {
        return tripsOverTime;
    }

    public void setTripsOverTime(Map<String, Integer> tripsOverTime) {
        this.tripsOverTime = tripsOverTime;
    }

    public Map<String, Integer> getTripsByLocation() {
        return tripsByLocation;
    }

    public void setTripsByLocation(Map<String, Integer> tripsByLocation) {
        this.tripsByLocation = tripsByLocation;
    }

    public Map<String, Integer> getShiftPerformance() {
        return shiftPerformance;
    }

    public void setShiftPerformance(Map<String, Integer> shiftPerformance) {
        this.shiftPerformance = shiftPerformance;
    }

    public Map<String, Integer> getVehicleUtilization() {
        return vehicleUtilization;
    }

    public void setVehicleUtilization(Map<String, Integer> vehicleUtilization) {
        this.vehicleUtilization = vehicleUtilization;
    }

    public Map<String, Integer> getDriverTrips() {
        return driverTrips;
    }

    public void setDriverTrips(Map<String, Integer> driverTrips) {
        this.driverTrips = driverTrips;
    }

    public Map<String, Double> getDriverPerformance() {
        return driverPerformance;
    }

    public void setDriverPerformance(Map<String, Double> driverPerformance) {
        this.driverPerformance = driverPerformance;
    }

    public Map<String, Double> getOvertimeAnalytics() {
        return overtimeAnalytics;
    }

    public void setOvertimeAnalytics(Map<String, Double> overtimeAnalytics) {
        this.overtimeAnalytics = overtimeAnalytics;
    }
}