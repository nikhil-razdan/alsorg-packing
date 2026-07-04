package com.alsorg.packing.config;

import java.time.ZoneId;
import java.util.TimeZone;

import jakarta.annotation.PostConstruct;

import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeZoneConfig {

    public static final ZoneId APP_ZONE =
            ZoneId.of("Asia/Kolkata");

    @PostConstruct
    public void init() {
        TimeZone.setDefault(
                TimeZone.getTimeZone(APP_ZONE)
        );

        System.out.println(
                "✅ Application timezone set to Asia/Kolkata"
        );
    }
}