package com.alsorg.packing.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.alsorg.packing.domain.analytics.DriverLog;
import com.alsorg.packing.domain.dashboard.DashboardResponse;
import com.alsorg.packing.repository.DriverLogRepository;

@Service
public class DashboardService {

    private final DriverLogRepository repo;

    public DashboardService(DriverLogRepository repo) {
        this.repo = repo;
    }

    public DashboardResponse getDashboard() {

        List<DriverLog> data = repo.findAll();
        int totalTrips = data.stream()
                .mapToInt(d -> d.getTrips() == 0 ? 0 : d.getTrips())
                .sum();

        int totalLoaders = data.stream()
                .mapToInt(d -> d.getLoaders() == 0 ? 0 : d.getLoaders())
                .sum();
        
        System.out.println("TOTAL LOGS: " + data.size());
        System.out.println("TOTAL TRIPS: " + totalTrips);
        System.out.println("TOTAL LOADERS: " + totalLoaders);
        
        double efficiency = totalTrips == 0 ? 0 : (double) totalLoaders / totalTrips;

        Map<String, Long> byDriver =
                data.stream().collect(Collectors.groupingBy(
                        DriverLog::getDriverName,
                        Collectors.counting()
                ));
        
        Map<String, Integer> tripsOverTime =
        	    data.stream().collect(Collectors.groupingBy(
        	        d -> d.getCreatedAt().toLocalDate().toString(),
        	        Collectors.summingInt(DriverLog::getTrips)
        	    ));

        	Map<String, Integer> tripsByLocation =
        	    data.stream().collect(Collectors.groupingBy(
        	        DriverLog::getLocation,
        	        Collectors.summingInt(DriverLog::getTrips)
        	    ));

        return new DashboardResponse(totalTrips, totalLoaders, efficiency, byDriver, tripsOverTime, tripsByLocation);
    }
}