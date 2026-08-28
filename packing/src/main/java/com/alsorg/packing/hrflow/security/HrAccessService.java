package com.alsorg.packing.hrflow.security;

import com.alsorg.packing.hrflow.domain.HrAccessGrant;
import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrAccessGrantRepository;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
public class HrAccessService {

    private final HrAccessGrantRepository accessGrantRepository;

    public HrAccessService(
            HrAccessGrantRepository accessGrantRepository
    ) {
        this.accessGrantRepository = accessGrantRepository;
    }

    /**
     * Returns the authenticated FlowSuite principal. "SYSTEM" is reserved for
     * trusted internal calls; Spring's anonymousUser must never be treated as a
     * real HRFLOW principal.
     */
    public String actor() {
        Authentication auth = authenticated();

        if (auth == null) {
            return "SYSTEM";
        }

        String name = auth.getName();
        if (name == null || name.isBlank()) {
            return "SYSTEM";
        }

        return name.trim();
    }

    public boolean isGlobalAdmin() {
        Authentication auth = authenticated();

        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }

        for (GrantedAuthority authority : auth.getAuthorities()) {
            if (authority == null || authority.getAuthority() == null) {
                continue;
            }

            String value = authority.getAuthority().trim();

            if ("ADMIN".equalsIgnoreCase(value)
                    || "ROLE_ADMIN".equalsIgnoreCase(value)) {
                return true;
            }
        }

        return false;
    }

    public List<HrAccessRole> currentRoles() {
        if (isGlobalAdmin()) {
            return List.of(HrAccessRole.values());
        }

        Authentication auth = authenticated();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return List.of();
        }

        return accessGrantRepository
                .findAllByPrincipalNameIgnoreCaseAndActiveTrue(
                        auth.getName().trim()
                )
                .stream()
                .map(HrAccessGrant::getRole)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
    }

    public boolean allowed() {
        if (isGlobalAdmin()) {
            return true;
        }

        return !currentRoles().isEmpty();
    }

    public void requireGlobalAdmin() {
        if (!isGlobalAdmin()) {
            throw HrFlowException.forbidden(
                    "Only a FlowSuite ADMIN can manage HRFLOW access grants."
            );
        }
    }

    public void requireAny(
            HrAccessRole... allowedRoles
    ) {
        if (isGlobalAdmin()) {
            return;
        }

        if (allowedRoles == null || allowedRoles.length == 0) {
            throw HrFlowException.forbidden(
                    "You do not have permission for this HRFLOW operation."
            );
        }

        Set<HrAccessRole> required =
                EnumSet.noneOf(HrAccessRole.class);

        Arrays.stream(allowedRoles)
                .filter(java.util.Objects::nonNull)
                .forEach(required::add);

        if (required.isEmpty()) {
            throw HrFlowException.forbidden(
                    "You do not have permission for this HRFLOW operation."
            );
        }

        boolean allowed =
                currentRoles()
                        .stream()
                        .anyMatch(required::contains);

        if (!allowed) {
            throw HrFlowException.forbidden(
                    "You do not have permission for this HRFLOW operation."
            );
        }
    }

    private Authentication authenticated() {
        Authentication auth =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (auth == null
                || !auth.isAuthenticated()
                || auth instanceof AnonymousAuthenticationToken) {
            return null;
        }

        return auth;
    }
}
