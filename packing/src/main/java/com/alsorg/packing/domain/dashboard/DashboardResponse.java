package com.alsorg.packing.domain.dashboard;

import java.util.Map;

public class DashboardResponse {

    private int totalTrips;
    private int totalLoaders;
    private double efficiency;
    private Map<String, Long> drivers;
    public Map<String, Integer> tripsOverTime;
    public Map<String, Integer> tripsByLocation;
    public Map<String, Integer> shiftPerformance;
    public Map<String, Integer> vehicleUtilization;

    public DashboardResponse(
            int totalTrips,
            int totalLoaders,
            double efficiency,
            Map<String, Long> drivers,
            Map<String, Integer> tripsOverTime,
            Map<String, Integer> tripsByLocation
    ) {
        this.totalTrips = totalTrips;
        this.totalLoaders = totalLoaders;
        this.efficiency = efficiency;
        this.drivers = drivers;
        this.tripsOverTime = tripsOverTime;
        this.tripsByLocation = tripsByLocation;
    }
    
    public DashboardResponse() {}
    
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

    public Map<String, Long> getDrivers() {
        return drivers;
    }

    public void setDrivers(Map<String, Long> drivers) {
        this.drivers = drivers;
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
}