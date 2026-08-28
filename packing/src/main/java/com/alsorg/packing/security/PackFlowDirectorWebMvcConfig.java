package com.alsorg.packing.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class PackFlowDirectorWebMvcConfig implements WebMvcConfigurer {

    private final PackFlowDirectorApiIsolationInterceptor directorApiIsolationInterceptor;

    public PackFlowDirectorWebMvcConfig(
            PackFlowDirectorApiIsolationInterceptor directorApiIsolationInterceptor) {
        this.directorApiIsolationInterceptor = directorApiIsolationInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(directorApiIsolationInterceptor)
                .addPathPatterns("/api/**");
    }
}
