package com.alsorg.packing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AlsorgPackingPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(AlsorgPackingPlatformApplication.class, args);
    }
}