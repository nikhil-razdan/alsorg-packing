package com.alsorg.packing.bomflow.security;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
public class BomFlowAccessService {

    private final UserRepository userRepository;

    public BomFlowAccessService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User currentUser() {
        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || authentication.getName() == null
                || authentication.getName().isBlank()
                || "anonymousUser".equalsIgnoreCase(authentication.getName())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "User not authenticated");
        }

        User user = userRepository
                .findByUsernameIgnoreCase(authentication.getName().trim())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user account was not found"));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User is disabled");
        }

        return user;
    }

    public String currentUsername() {
        String username = currentUser().getUsername();
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }
        return username.trim();
    }

    public String currentRole() {
        Set<String> roles = currentRoles();
        return roles.stream().findFirst().orElse("");
    }

    public Set<String> currentRoles() {
        User user = currentUser();
        LinkedHashSet<String> roles = new LinkedHashSet<>();

        if (user.getEffectiveRoles() != null) {
            user.getEffectiveRoles().stream()
                    .filter(Objects::nonNull)
                    .map(this::normalizeRole)
                    .filter(role -> !role.isBlank())
                    .forEach(roles::add);
        }

        if (user.getRole() != null) {
            String role = normalizeRole(user.getRole());
            if (!role.isBlank()) roles.add(role);
        }

        return Set.copyOf(roles);
    }

    public boolean isManager() {
        Set<String> roles = currentRoles();
        return roles.contains("ADMIN") || roles.contains("BOMFLOW_MANAGER");
    }

    public boolean isEditor() {
        Set<String> roles = currentRoles();
        return roles.contains("ADMIN")
                || roles.contains("BOMFLOW_MANAGER")
                || roles.contains("BOMFLOW_EDITOR");
    }

    public boolean isReviewer() {
        Set<String> roles = currentRoles();
        return roles.contains("ADMIN")
                || roles.contains("BOMFLOW_MANAGER")
                || roles.contains("BOMFLOW_REVIEWER")
                || roles.contains("BOMFLOW_APPROVER");
    }

    public boolean isApprover() {
        Set<String> roles = currentRoles();
        return roles.contains("ADMIN")
                || roles.contains("BOMFLOW_MANAGER")
                || roles.contains("BOMFLOW_APPROVER");
    }

    public void requireBomFlowAccess() {
        Set<String> roles = currentRoles();
        boolean allowed = roles.stream().anyMatch(role -> switch (role) {
            case "ADMIN", "BOMFLOW_MANAGER", "BOMFLOW_EDITOR", "BOMFLOW_REVIEWER", "BOMFLOW_APPROVER" -> true;
            default -> false;
        });

        if (!allowed) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow module access required");
        }
    }

    public void requireEditor() {
        requireBomFlowAccess();
        if (!isEditor()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Editor access required");
        }
    }

    public void requireReviewer() {
        requireBomFlowAccess();
        if (!isReviewer()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Reviewer access required");
        }
    }

    public void requireApprover() {
        requireBomFlowAccess();
        if (!isApprover()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "BOMFlow Approver access required");
        }
    }

    private String normalizeRole(String value) {
        if (value == null) return "";
        String role = value.trim().toUpperCase(Locale.ROOT);
        return role.startsWith("ROLE_") ? role.substring(5) : role;
    }
}
