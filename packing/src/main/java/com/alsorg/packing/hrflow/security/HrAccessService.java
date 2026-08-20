package com.alsorg.packing.hrflow.security;

import com.alsorg.packing.hrflow.domain.HrAccessGrant;
import com.alsorg.packing.hrflow.domain.HrAccessRole;
import com.alsorg.packing.hrflow.exception.HrFlowException;
import com.alsorg.packing.hrflow.repository.HrAccessGrantRepository;
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

    public HrAccessService(HrAccessGrantRepository accessGrantRepository) {
        this.accessGrantRepository = accessGrantRepository;
    }

    public String actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            return "SYSTEM";
        }
        return auth.getName();
    }

    public boolean isGlobalAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        for (GrantedAuthority authority : auth.getAuthorities()) {
            String a = authority.getAuthority();
            if ("ADMIN".equalsIgnoreCase(a) || "ROLE_ADMIN".equalsIgnoreCase(a)) return true;
        }
        return false;
    }

    public List<HrAccessRole> currentRoles() {
        if (isGlobalAdmin()) return List.of(HrAccessRole.values());
        return accessGrantRepository.findAllByPrincipalNameIgnoreCaseAndActiveTrue(actor())
                .stream()
                .map(HrAccessGrant::getRole)
                .distinct()
                .toList();
    }

    public boolean allowed() {
        return isGlobalAdmin() || !currentRoles().isEmpty();
    }

    public void requireGlobalAdmin() {
        if (!isGlobalAdmin()) {
            throw HrFlowException.forbidden("Only a FlowSuite ADMIN can manage HRFLOW access grants.");
        }
    }

    public void requireAny(HrAccessRole... allowedRoles) {
        if (isGlobalAdmin()) return;
        Set<HrAccessRole> required = EnumSet.noneOf(HrAccessRole.class);
        required.addAll(Arrays.asList(allowedRoles));
        boolean ok = currentRoles().stream().anyMatch(required::contains);
        if (!ok) {
            throw HrFlowException.forbidden("You do not have permission for this HRFLOW operation.");
        }
    }
}
