package com.alsorg.packing.bomflow.security;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BomFlowAccessService {

    private final UserRepository userRepository;

    public BomFlowAccessService(
            UserRepository userRepository) {

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

        String username = authentication.getName().trim();

        User user = userRepository
                .findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "User not found: " + username));

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "User is disabled");
        }

        return user;
    }

    public String currentUsername() {
        return currentUser().getUsername();
    }

    public String currentRole() {
        String role = currentUser().getRole();

        return role == null
                ? ""
                : role.trim().replace("ROLE_", "").toUpperCase();
    }

    public boolean isManager() {
        String role = currentRole();

        return "ADMIN".equals(role)
                || "BOMFLOW_MANAGER".equals(role);
    }

    public boolean isEditor() {
        return isManager()
                || "BOMFLOW_EDITOR".equals(currentRole());
    }

    public boolean isReviewer() {
        String role = currentRole();

        return isManager()
                || "BOMFLOW_REVIEWER".equals(role)
                || "BOMFLOW_APPROVER".equals(role);
    }

    public boolean isApprover() {
        return isManager()
                || "BOMFLOW_APPROVER".equals(currentRole());
    }

    public void requireBomFlowAccess() {
        String role = currentRole();

        boolean allowed = switch (role) {
            case "ADMIN",
                    "BOMFLOW_MANAGER",
                    "BOMFLOW_EDITOR",
                    "BOMFLOW_REVIEWER",
                    "BOMFLOW_APPROVER" -> true;

            default -> false;
        };

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
}
