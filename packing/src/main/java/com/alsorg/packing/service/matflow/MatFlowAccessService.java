package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.users.User;
import com.alsorg.packing.service.CurrentUserService;
import com.alsorg.packing.domain.matflow.MatFlowLocation;
import com.alsorg.packing.domain.matflow.MatFlowPlanningTypes.LocationType;
import java.util.Set;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class MatFlowAccessService {

        private final CurrentUserService currentUserService;

        public MatFlowAccessService(
                        CurrentUserService currentUserService) {
                this.currentUserService = currentUserService;
        }

        public User currentUser() {
                User user = currentUserService
                                .requireCurrentUser();

                if (!isAdmin(user) &&
                                !currentUserService.hasModule(
                                                user,
                                                "MATFLOW")) {
                        throw new AccessDeniedException(
                                        "MatFlow module access required");
                }

                return user;
        }

        public String actor() {
                return currentUser()
                                .getUsername();
        }

        public void requireRead() {
                User user = currentUser();

                if (isAdmin(user) ||
                                roleStartsWith(user, "MATFLOW_")) {
                        return;
                }

                throw new AccessDeniedException(
                                "MatFlow access required");
        }

        public void requireMaterialMasterWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE",
                                "MATFLOW_PURCHASE");
        }

        public void requireProjectWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_ENGINEERING");
        }

        public void requireEngineeringWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_ENGINEERING");
        }

        public void requireApproval() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_DIRECTOR");
        }

        public void requirePlantAccess(
                        String plantCode) {

                String normalizedPlant = plantCode == null
                                ? null
                                : plantCode
                                                .trim()
                                                .toUpperCase(
                                                                Locale.ROOT);

                if (normalizedPlant == null ||
                                normalizedPlant.isBlank()) {

                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Plant code is missing from the requested MatFlow record");
                }

                User user = currentUser();

                if (!currentUserService.canAccessPlant(
                                user,
                                normalizedPlant)) {

                        throw new AccessDeniedException(
                                        "No access to plant: " +
                                                        normalizedPlant);
                }
        }

        public Set<String> allowedPlants() {
                return currentUserService.allowedPlants(
                                currentUser());
        }

        public boolean canAccessPlant(
                        String plantCode) {

                String normalizedPlant = plantCode == null
                                ? null
                                : plantCode.trim()
                                                .toUpperCase(
                                                                Locale.ROOT);

                if (normalizedPlant == null ||
                                normalizedPlant.isBlank()) {

                        return false;
                }

                return currentUserService.canAccessPlant(
                                currentUser(),
                                normalizedPlant);
        }

        private void requireRole(
                        User user,
                        String... roles) {
                String currentRole = normalize(user.getRole());

                for (String role : roles) {
                        if (currentRole.equals(
                                        normalize(role))) {
                                return;
                        }
                }

                throw new AccessDeniedException(
                                "You do not have permission to perform this MatFlow action");
        }

        private boolean isAdmin(User user) {
                return "ADMIN".equals(
                                normalize(user.getRole()));
        }

        private boolean roleStartsWith(
                        User user,
                        String prefix) {
                return normalize(user.getRole())
                                .startsWith(
                                                normalize(prefix));
        }

        private String normalize(
                        String value) {

                if (value == null) {
                        return "";
                }

                return value.trim()
                                .toUpperCase(
                                                Locale.ROOT)
                                .replaceFirst(
                                                "^ROLE_",
                                                "");
        }

        public void requireProductionBomReview() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PRODUCTION");
        }

        public void requireLocationWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        public void requireStockWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        public void requireProductionRequest() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PRODUCTION");
        }

        public void requireMaterialPlanning() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        public void requireIndentRead() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE",
                                "MATFLOW_PURCHASE");
        }

        public void requireTransferDispatch(
                        MatFlowLocation source) {

                if (source == null) {
                        throw new AccessDeniedException(
                                        "Transfer source is missing");
                }

                requirePlantAccess(
                                source.getPlantCode());

                User user = currentUser();

                if (isAnyRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER")) {

                        return;
                }

                LocationType type = source.getLocationType();

                if (type == LocationType.STORE &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_STORE")) {

                        return;
                }

                if ((type == LocationType.PROCESSING ||
                                type == LocationType.EXTERNAL_PROCESSOR) &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_PROCESSING")) {

                        return;
                }

                if (type == LocationType.QC &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_QC")) {

                        return;
                }

                if (type == LocationType.PRODUCTION &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_PRODUCTION")) {

                        return;
                }

                throw new AccessDeniedException(
                                "You cannot dispatch material from location: " +
                                                source.getLocationCode());
        }

        public void requireTransferReceive(
                        MatFlowLocation destination) {

                if (destination == null) {
                        throw new AccessDeniedException(
                                        "Transfer destination is missing");
                }

                requirePlantAccess(
                                destination.getPlantCode());

                User user = currentUser();

                if (isAnyRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER")) {

                        return;
                }

                LocationType type = destination.getLocationType();

                if (type == LocationType.STORE &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_STORE")) {

                        return;
                }

                if ((type == LocationType.PROCESSING ||
                                type == LocationType.EXTERNAL_PROCESSOR) &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_PROCESSING")) {

                        return;
                }

                if (type == LocationType.QC &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_QC")) {

                        return;
                }

                if (type == LocationType.PRODUCTION &&
                                isAnyRole(
                                                user,
                                                "MATFLOW_PRODUCTION")) {

                        return;
                }

                throw new AccessDeniedException(
                                "You cannot receive material at location: " +
                                                destination.getLocationCode());
        }

        public void requireStore() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        private boolean isAnyRole(
                        User user,
                        String... roles) {
                String userRole = normalize(user == null
                                ? null
                                : user.getRole());

                for (String role : roles) {
                        if (userRole.equals(
                                        normalize(role))) {
                                return true;
                        }
                }

                return false;
        }

        public void requireVendorWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PURCHASE");
        }

        public void requirePurchaseOrderWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PURCHASE");
        }

        public void requireGoodsReceiptWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        public void requireQcWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_QC");
        }

        public void requireVendorReturnWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE",
                                "MATFLOW_PURCHASE");
        }

        public void requireProcessingWrite() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PROCESSING");
        }

        public void requireReservationRelease() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_STORE");
        }

        public void requireRequisitionCancel() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PRODUCTION");
        }

        public void requireProductionReturnCreate() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_PRODUCTION");
        }

        public void requireQcDisposition() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_QC");
        }

        public void requireIntegrityRead() {
                User user = currentUser();

                requireRole(
                                user,
                                "ADMIN",
                                "MATFLOW_MANAGER",
                                "MATFLOW_DIRECTOR");
        }
}