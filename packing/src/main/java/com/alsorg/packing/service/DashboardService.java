package com.alsorg.packing.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alsorg.packing.domain.dashboard.DashboardResponse;
import com.alsorg.packing.repository.DriverRepository;
import com.alsorg.packing.repository.LogisticsShiftRepository;
import com.alsorg.packing.repository.VehicleRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
public class DashboardService {

    private final DriverRepository driverRepository;
    private final VehicleRepository vehicleRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public DashboardService(
            LogisticsShiftRepository shiftRepository,
            DriverRepository driverRepository,
            VehicleRepository vehicleRepository) {
        // Keep the existing constructor contract; dashboard reads now aggregate via EntityManager.
        this.driverRepository = driverRepository;
        this.vehicleRepository = vehicleRepository;
    }

    /**
     * Dashboard aggregation is intentionally performed in PostgreSQL.
     *
     * The previous implementation materialized every LogisticsShift row and then
     * grouped the complete history in the application JVM. That made dashboard
     * cost grow linearly with shift history and also initialized Driver/Vehicle
     * relationships row-by-row.
     *
     * These aggregate queries preserve the same response contract while moving
     * sums/grouping to the database and returning only the small result sets that
     * the dashboard actually renders.
     */
    @Transactional(readOnly = true)
    public DashboardResponse getDashboard() {

        Object[] totals = entityManager.createQuery(
                        """
                        select coalesce(sum(s.totalTrips), 0),
                               coalesce(sum(s.totalLoaders), 0)
                        from LogisticsShift s
                        """,
                        Object[].class)
                .getSingleResult();

        int totalTrips = safeInt(totals[0]);
        int totalLoaders = safeInt(totals[1]);

        double efficiency = totalTrips == 0
                ? 0D
                : ((double) totalLoaders / totalTrips) * 100D;

        int activeDrivers = Math.toIntExact(
                driverRepository.count());

        int activeVehicles = Math.toIntExact(
                vehicleRepository.count());

        double avgTripsPerDriver = activeDrivers == 0
                ? 0D
                : (double) totalTrips / activeDrivers;

        double avgTripsPerVehicle = activeVehicles == 0
                ? 0D
                : (double) totalTrips / activeVehicles;

        Map<String, Integer> tripsOverTime = intMap(
                entityManager.createQuery(
                                """
                                select function('date', s.shiftStart),
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                where s.shiftStart is not null
                                group by function('date', s.shiftStart)
                                order by function('date', s.shiftStart)
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Integer> tripsByLocation = intMap(
                entityManager.createQuery(
                                """
                                select coalesce(s.routeCategory, 'UNKNOWN'),
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                group by coalesce(s.routeCategory, 'UNKNOWN')
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Integer> driverTrips = intMap(
                entityManager.createQuery(
                                """
                                select s.driver.name,
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                where s.driver is not null
                                group by s.driver.name
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Double> performance = doubleMap(
                entityManager.createQuery(
                                """
                                select s.driver.name,
                                       coalesce(avg(s.driverPerformance), 0)
                                from LogisticsShift s
                                where s.driver is not null
                                group by s.driver.name
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Integer> vehicleUtilization = intMap(
                entityManager.createQuery(
                                """
                                select s.vehicle.vehicleNumber,
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                where s.vehicle is not null
                                group by s.vehicle.vehicleNumber
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Double> overtime = doubleMap(
                entityManager.createQuery(
                                """
                                select s.driver.name,
                                       coalesce(sum(s.overtimeHours), 0)
                                from LogisticsShift s
                                where s.driver is not null
                                group by s.driver.name
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Integer> shiftPerformance = intMap(
                entityManager.createQuery(
                                """
                                select coalesce(s.status, 'UNKNOWN'),
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                group by coalesce(s.status, 'UNKNOWN')
                                """,
                                Object[].class)
                        .getResultList());

        DashboardResponse response = new DashboardResponse();

        response.setTotalTrips(totalTrips);
        response.setTotalLoaders(totalLoaders);
        response.setEfficiency(efficiency);
        response.setActiveDrivers(activeDrivers);
        response.setActiveVehicles(activeVehicles);
        response.setAverageTripsPerDriver(avgTripsPerDriver);
        response.setAverageTripsPerVehicle(avgTripsPerVehicle);
        response.setTripsOverTime(tripsOverTime);
        response.setTripsByLocation(tripsByLocation);
        response.setDriverTrips(driverTrips);
        response.setDriverPerformance(performance);
        response.setVehicleUtilization(vehicleUtilization);
        response.setOvertimeAnalytics(overtime);
        response.setShiftPerformance(shiftPerformance);

        return response;
    }

    /**
     * Director-safe logistics view.
     *
     * This query path intentionally never loads driver names, vehicle numbers,
     * overtime, individual performance or shift-status detail. The executive
     * response contains only aggregate capacity and trend information required
     * by the Director dashboard.
     */
    @Transactional(readOnly = true)
    public DashboardResponse getExecutiveDashboard() {

        Object[] totals = entityManager.createQuery(
                        """
                        select coalesce(sum(s.totalTrips), 0),
                               coalesce(sum(s.totalLoaders), 0)
                        from LogisticsShift s
                        """,
                        Object[].class)
                .getSingleResult();

        int totalTrips = safeInt(totals[0]);
        int totalLoaders = safeInt(totals[1]);

        int activeDrivers = Math.toIntExact(
                driverRepository.count());

        int activeVehicles = Math.toIntExact(
                vehicleRepository.count());

        double avgTripsPerDriver = activeDrivers == 0
                ? 0D
                : (double) totalTrips / activeDrivers;

        double avgTripsPerVehicle = activeVehicles == 0
                ? 0D
                : (double) totalTrips / activeVehicles;

        Map<String, Integer> tripsOverTime = intMap(
                entityManager.createQuery(
                                """
                                select function('date', s.shiftStart),
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                where s.shiftStart is not null
                                group by function('date', s.shiftStart)
                                order by function('date', s.shiftStart)
                                """,
                                Object[].class)
                        .getResultList());

        Map<String, Integer> tripsByLocation = intMap(
                entityManager.createQuery(
                                """
                                select coalesce(s.routeCategory, 'UNKNOWN'),
                                       coalesce(sum(s.totalTrips), 0)
                                from LogisticsShift s
                                group by coalesce(s.routeCategory, 'UNKNOWN')
                                """,
                                Object[].class)
                        .getResultList());

        DashboardResponse response = new DashboardResponse();

        response.setTotalTrips(totalTrips);
        response.setTotalLoaders(totalLoaders);
        response.setEfficiency(0D);
        response.setActiveDrivers(activeDrivers);
        response.setActiveVehicles(activeVehicles);
        response.setAverageTripsPerDriver(avgTripsPerDriver);
        response.setAverageTripsPerVehicle(avgTripsPerVehicle);
        response.setTripsOverTime(tripsOverTime);
        response.setTripsByLocation(tripsByLocation);
        response.setDriverTrips(new LinkedHashMap<>());
        response.setDriverPerformance(new LinkedHashMap<>());
        response.setVehicleUtilization(new LinkedHashMap<>());
        response.setOvertimeAnalytics(new LinkedHashMap<>());
        response.setShiftPerformance(new LinkedHashMap<>());

        return response;
    }

    private Map<String, Integer> intMap(
            List<Object[]> rows) {

        Map<String, Integer> result = new LinkedHashMap<>();

        if (rows == null) {
            return result;
        }

        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null) {
                continue;
            }

            result.put(
                    String.valueOf(row[0]),
                    safeInt(row[1]));
        }

        return result;
    }

    private Map<String, Double> doubleMap(
            List<Object[]> rows) {

        Map<String, Double> result = new LinkedHashMap<>();

        if (rows == null) {
            return result;
        }

        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null) {
                continue;
            }

            result.put(
                    String.valueOf(row[0]),
                    safeDouble(row[1]));
        }

        return result;
    }

    private int safeInt(
            Object value) {

        if (!(value instanceof Number number)) {
            return 0;
        }

        long longValue = number.longValue();

        if (longValue > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }

        if (longValue < Integer.MIN_VALUE) {
            return Integer.MIN_VALUE;
        }

        return (int) longValue;
    }

    private double safeDouble(
            Object value) {

        if (!(value instanceof Number number)) {
            return 0D;
        }

        double result = number.doubleValue();

        return Double.isFinite(result)
                ? result
                : 0D;
    }
}
