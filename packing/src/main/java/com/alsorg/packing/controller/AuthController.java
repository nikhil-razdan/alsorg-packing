package com.alsorg.packing.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody Map<String, String> body,
            HttpSession session
    ) {
        String username = body.get("username");
        String password = body.get("password");

        // 🔒 TEMP HARD-CODED (SAFE FOR NOW)
        if ("admin".equals(username) && "admin123".equals(password)) {
            session.setAttribute("USER", username);
            return ResponseEntity.ok(Map.of("success", true));
        }

        return ResponseEntity.status(401)
                .body(Map.of("message", "Invalid credentials"));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpSession session) {
        Object user = session.getAttribute("USER");
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("username", user));
    }
}
