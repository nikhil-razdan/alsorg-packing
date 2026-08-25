package com.alsorg.packing.config;

import java.time.ZoneId;
import java.util.TimeZone;

import jakarta.annotation.PostConstruct;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeZoneConfig {

    private static final Logger log =
            LoggerFactory.getLogger(
                    TimeZoneConfig.class);

    public static final ZoneId APP_ZONE =
            ZoneId.of("Asia/Kolkata");

    @PostConstruct
    public void init() {

        TimeZone.setDefault(
                TimeZone.getTimeZone(
                        APP_ZONE));

        log.info(
                "Application timezone initialized: {}",
                APP_ZONE);
    }
}
