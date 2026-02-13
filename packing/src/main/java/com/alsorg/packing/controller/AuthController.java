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

	    if ("admin".equals(username) && "admin123".equals(password)) {
	        session.setAttribute("USER", username);
	        session.setAttribute("ROLE", "ADMIN");
	        return ResponseEntity.ok(Map.of("role", "ADMIN"));
	    }

	    if ("dispatch".equals(username) && "dispatch123".equals(password)) {
	        session.setAttribute("USER", username);
	        session.setAttribute("ROLE", "DISPATCH");
	        return ResponseEntity.ok(Map.of("role", "DISPATCH"));
	    }

	    if ("packing".equals(username) && "packing123".equals(password)) {
	        session.setAttribute("USER", username);
	        session.setAttribute("ROLE", "PACKING");
	        return ResponseEntity.ok(Map.of("role", "PACKING"));
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
        Object role = session.getAttribute("ROLE");

        if (user == null) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(
            Map.of(
                "username", user,
                "role", role
            )
        );
    }
}
