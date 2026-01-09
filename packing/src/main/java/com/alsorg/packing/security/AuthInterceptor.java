package com.alsorg.packing.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) throws Exception {

        String path = request.getRequestURI();

        // allow login endpoint
        if (path.startsWith("/api/auth")) {
            return true;
        }

        Object user = request.getSession().getAttribute("USER");

        if (user == null) {
            response.setStatus(401);
            return false;
        }

        return true;
    }
}
