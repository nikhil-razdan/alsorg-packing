package com.alsorg.packing.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration config = new CorsConfiguration();

                /*
                 * Required for HttpOnly cookie auth.
                 * Without this, browser will not send ALSORG_ACCESS cookie.
                 */
                config.setAllowCredentials(true);

                /*
                 * Must be exact frontend origins.
                 * Do not use "*" with credentials.
                 */
                config.setAllowedOrigins(List.of(
                                "http://localhost:5173",
                                "http://localhost:3000",
                                "https://alsorg-packing-frontend.onrender.com"));

                /*
                 * Allow all headers your frontend may send.
                 *
                 * Authorization is kept temporarily because some old frontend code
                 * may still send it during transition.
                 *
                 * X-Username is kept temporarily because old pages may still send it.
                 */
                config.setAllowedHeaders(List.of(
                                "Content-Type",
                                "Accept",
                                "Origin",
                                "X-Requested-With",
                                "Authorization",
                                "X-Username"));

                config.setAllowedMethods(List.of(
                                "GET",
                                "POST",
                                "PUT",
                                "PATCH",
                                "DELETE",
                                "OPTIONS"));

                /*
                 * Frontend needs Content-Disposition for PDF/Excel/CSV filenames.
                 * Logistics challan flow also reads X-Trip-Id and X-Challan-No.
                 */
                config.setExposedHeaders(List.of(
                                "Content-Disposition",
                                "X-Trip-Id",
                                "X-Challan-No",
                                "X-Total-Pages",
                                "X-Total-Elements",
                                "X-Page-Number",
                                "X-Page-Size",
                                "X-Has-Next"));

                config.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();

                source.registerCorsConfiguration(
                                "/**",
                                config);

                return source;
        }
}