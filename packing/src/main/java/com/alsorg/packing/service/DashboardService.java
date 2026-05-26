package com.alsorg.packing.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.dashboard.DashboardResponse;
import com.alsorg.packing.domain.logistics.LogisticsShift;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsShiftRepository;
import com.alsorg.packing.repository.VehicleRepository;

@Service
public class DashboardService {

    private final LogisticsShiftRepository shiftRepository;

    private final DriverRepository driverRepository;

    private final VehicleRepository vehicleRepository;

    public DashboardService(
            LogisticsShiftRepository shiftRepository,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository
    ) {
        this.shiftRepository = shiftRepository;
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
    }

    public DashboardResponse getDashboard() {

        List<LogisticsShift> data =
                shiftRepository.findAll();

        DashboardResponse response =
                new DashboardResponse();

        /*
         * TOTALS
         */

        int totalTrips =
                data.stream()
                        .mapToInt(s ->
                                s.getTotalTrips() != null
                                        ? s.getTotalTrips()
                                        : 0
                        )
                        .sum();

        int totalLoaders =
                data.stream()
                        .mapToInt(s ->
                                s.getTotalLoaders() != null
                                        ? s.getTotalLoaders()
                                        : 0
                        )
                        .sum();

        /*
         * KPI
         */

        double efficiency =
                totalTrips == 0
                        ? 0
                        : ((double) totalLoaders / totalTrips) * 100;

        int activeDrivers =
                (int) driverRepository.count();

        int activeVehicles =
                (int) vehicleRepository.count();

        double avgTripsPerDriver =
                activeDrivers == 0
                        ? 0
                        : (double) totalTrips / activeDrivers;

        double avgTripsPerVehicle =
                activeVehicles == 0
                        ? 0
                        : (double) totalTrips / activeVehicles;

        /*
         * TRIPS OVER TIME
         */

        Map<String, Integer> tripsOverTime =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getShiftStart()
                                        .toLocalDate()
                                        .toString(),

                                Collectors.summingInt(
                                        s -> s.getTotalTrips() != null
                                                ? s.getTotalTrips()
                                                : 0
                                )
                        ));

        /*
         * ROUTE ANALYTICS
         */

        Map<String, Integer> tripsByLocation =
                data.stream()
                        .collect(Collectors.groupingBy(
                                LogisticsShift::getRouteCategory,

                                Collectors.summingInt(
                                        s -> s.getTotalTrips() != null
                                                ? s.getTotalTrips()
                                                : 0
                                )
                        ));

        /*
         * DRIVER TRIPS
         */

        Map<String, Integer> driverTrips =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getDriver().getName(),

                                Collectors.summingInt(
                                        s -> s.getTotalTrips() != null
                                                ? s.getTotalTrips()
                                                : 0
                                )
                        ));

        /*
         * DRIVER PERFORMANCE
         */

        Map<String, Double> performance =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getDriver().getName(),

                                Collectors.averagingDouble(
                                        s -> s.getDriverPerformance() != null
                                                ? s.getDriverPerformance()
                                                : 0
                                )
                        ));

        /*
         * VEHICLE UTILIZATION
         */

        Map<String, Integer> vehicleUtilization =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getVehicle()
                                        .getVehicleNumber(),

                                Collectors.summingInt(
                                        s -> s.getTotalTrips() != null
                                                ? s.getTotalTrips()
                                                : 0
                                )
                        ));

        /*
         * OVERTIME ANALYTICS
         */

        Map<String, Double> overtime =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getDriver().getName(),

                                Collectors.summingDouble(
                                        s -> s.getOvertimeHours() != null
                                                ? s.getOvertimeHours()
                                                : 0
                                )
                        ));

        /*
         * SHIFT PERFORMANCE
         */

        Map<String, Integer> shiftPerformance =
                data.stream()
                        .collect(Collectors.groupingBy(
                                s -> s.getStatus() != null
                                        ? s.getStatus()
                                        : "UNKNOWN",

                                Collectors.summingInt(
                                        s -> s.getTotalTrips() != null
                                                ? s.getTotalTrips()
                                                : 0
                                )
                        ));

        /*
         * RESPONSE
         */

        response.setTotalTrips(totalTrips);

        response.setTotalLoaders(totalLoaders);

        response.setEfficiency(efficiency);

        response.setActiveDrivers(activeDrivers);

        response.setActiveVehicles(activeVehicles);

        response.setAverageTripsPerDriver(
                avgTripsPerDriver
        );

        response.setAverageTripsPerVehicle(
                avgTripsPerVehicle
        );

        response.setTripsOverTime(tripsOverTime);

        response.setTripsByLocation(tripsByLocation);

        response.setDriverTrips(driverTrips);

        response.setDriverPerformance(performance);

        response.setVehicleUtilization(vehicleUtilization);

        response.setOvertimeAnalytics(overtime);

        response.setShiftPerformance(shiftPerformance);

        return response;
    }
}