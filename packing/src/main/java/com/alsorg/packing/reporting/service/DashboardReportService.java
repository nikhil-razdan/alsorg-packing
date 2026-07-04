package com.alsorg.packing.reporting.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alsorg.packing.reporting.dto.DailyThroughputUserDTO;
import com.alsorg.packing.reporting.dto.DashboardStatsDTO;
import com.alsorg.packing.reporting.repository.DashboardReportRepository;

@Service
public class DashboardReportService {

        private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

        private final DashboardReportRepository repo;

        public DashboardReportService(
                        DashboardReportRepository repo) {
                this.repo = repo;
        }

        public DashboardStatsDTO getDashboardStats() {

                LocalDate today = LocalDate.now(ZONE);

                LocalDateTime startOfToday = today.atStartOfDay();

                LocalDateTime startOfTomorrow = today
                                .plusDays(1)
                                .atStartOfDay();

                /*
                 * =====================================================
                 * OLD DASHBOARD-COMPATIBLE COUNTS
                 * =====================================================
                 *
                 * totalItems must remain:
                 * Warehouse + Ready To Dispatch + Ready
                 *
                 * Because existing frontend card already uses this logic.
                 */
                long warehouseItems = repo.countWarehouseItems();

                long readyToDispatchItems = repo.countReadyToDispatchItems();

                long readyItems = repo.countReadyItems();

                long totalItems = warehouseItems
                                + readyToDispatchItems
                                + readyItems;

                long packedItems = repo.countPackedItems();

                long dispatchedItems = repo.countDispatchedItems();

                long pendingItems = repo.countPendingItems();

                long stickersGenerated = repo.countStickersGenerated();

                long todayStickerGenerated = repo.countTodayStickerGenerated(
                                startOfToday,
                                startOfTomorrow);

                /*
                 * This remains dispatched item count for existing frontend naming.
                 * New distinct challan count is todayDispatchChallans.
                 */
                long todayChallanGenerated = repo.countTodayDispatchedItems(
                                startOfToday,
                                startOfTomorrow);

                /*
                 * =====================================================
                 * MASTER / PACKET STRUCTURE
                 * =====================================================
                 */
                long masterItems = repo.countMasterItems();

                long totalPackets = repo.countTotalPackets();

                long packetItems = repo.countPacketItems();

                long fullyPackedMasterItems = repo.countFullyPackedMasterItems();

                long partiallyPackedMasterItems = repo.countPartiallyPackedMasterItems();

                long unpackedMasterItems = repo.countUnpackedMasterItems();

                long packedPackets = repo.countPackedPackets();

                long pendingPackets = repo.countPendingPackets();

                long packetItemsWithSticker = repo.countPacketItemsWithSticker();

                long packetItemsPendingSticker = repo.countPacketItemsPendingSticker();

                long stickerReprints = repo.countStickerReprints();

                /*
                 * =====================================================
                 * DISPATCH / WAREHOUSE / CHALLANS
                 * =====================================================
                 */
                long readyToStoreItems = repo.countReadyToStoreItems();

                long warehouseRequestedItems = repo.countWarehouseRequestedItems();

                long returnRequestedItems = repo.countReturnRequestedItems();

                long queuedItems = repo.countQueuedItems();

                long pkdItems = repo.countPkdItems();

                long fgItems = repo.countFgItems();

                long normalDispatchChallans = repo.countNormalDispatchChallans();

                long todayDispatchChallans = repo.countTodayDispatchChallans(
                                startOfToday,
                                startOfTomorrow);

                long runningTrips = repo.countRunningTrips();

                long endedTrips = repo.countEndedTrips();

                /*
                 * =====================================================
                 * CUSTOM CHALLANS
                 * =====================================================
                 */
                long customChallans = repo.countCustomChallans();

                long todayCustomChallans = repo.countTodayCustomChallans(
                                startOfToday,
                                startOfTomorrow);

                long customChallanItems = repo.countCustomChallanItems();

                /*
                 * =====================================================
                 * LOGISTICS MASTER
                 * =====================================================
                 */
                long activeDrivers = repo.countActiveDrivers();

                long activeVehicles = repo.countActiveVehicles();

                long expiredFitness = repo.countExpiredFitness(today);

                long expiredInsurance = repo.countExpiredInsurance(today);

                long expiredPucc = repo.countExpiredPucc(today);

                /*
                 * =====================================================
                 * DATA EXCEPTIONS
                 * =====================================================
                 */
                long masterItemsWithoutPackets = repo.countMasterItemsWithoutPackets();

                long packetsWithoutPacketItems = repo.countPacketsWithoutPacketItems();

                long packetItemsWithoutMaster = repo.countPacketItemsWithoutMaster();

                long dispatchedWithoutPacketItem = repo.countDispatchedWithoutPacketItem();

                long dispatchedWithoutChallan = repo.countDispatchedWithoutChallan();

                long dispatchedWithoutDriver = repo.countDispatchedWithoutDriver();

                long duplicateCurrentStickers = repo.countDuplicateCurrentStickers();

                long readyItemsStillInPkd = repo.countReadyItemsStillInPkd();

                long exceptionsCount = masterItemsWithoutPackets
                                + packetsWithoutPacketItems
                                + packetItemsWithoutMaster
                                + dispatchedWithoutPacketItem
                                + dispatchedWithoutChallan
                                + dispatchedWithoutDriver
                                + duplicateCurrentStickers
                                + readyItemsStillInPkd;

                DashboardStatsDTO dto = new DashboardStatsDTO();

                /*
                 * Old response fields.
                 */
                dto.setTotalItems(totalItems);
                dto.setWarehouseItems(warehouseItems);
                dto.setReadyToDispatchItems(readyToDispatchItems);
                dto.setReadyItems(readyItems);
                dto.setPackedItems(packedItems);
                dto.setDispatchedItems(dispatchedItems);
                dto.setPendingItems(pendingItems);
                dto.setStickersGenerated(stickersGenerated);
                dto.setTodayStickerGenerated(todayStickerGenerated);
                dto.setTodayChallanGenerated(todayChallanGenerated);

                /*
                 * New fields.
                 */
                dto.setMasterItems(masterItems);
                dto.setTotalPackets(totalPackets);
                dto.setPacketItems(packetItems);

                dto.setFullyPackedMasterItems(fullyPackedMasterItems);
                dto.setPartiallyPackedMasterItems(partiallyPackedMasterItems);
                dto.setUnpackedMasterItems(unpackedMasterItems);

                dto.setPackedPackets(packedPackets);
                dto.setPendingPackets(pendingPackets);

                dto.setPacketItemsWithSticker(packetItemsWithSticker);
                dto.setPacketItemsPendingSticker(packetItemsPendingSticker);
                dto.setStickerReprints(stickerReprints);

                dto.setReadyToStoreItems(readyToStoreItems);
                dto.setWarehouseRequestedItems(warehouseRequestedItems);
                dto.setReturnRequestedItems(returnRequestedItems);
                dto.setQueuedItems(queuedItems);

                dto.setPkdItems(pkdItems);
                dto.setFgItems(fgItems);

                dto.setNormalDispatchChallans(normalDispatchChallans);
                dto.setTodayDispatchChallans(todayDispatchChallans);
                dto.setRunningTrips(runningTrips);
                dto.setEndedTrips(endedTrips);

                dto.setCustomChallans(customChallans);
                dto.setTodayCustomChallans(todayCustomChallans);
                dto.setCustomChallanItems(customChallanItems);

                dto.setActiveDrivers(activeDrivers);
                dto.setActiveVehicles(activeVehicles);
                dto.setExpiredFitness(expiredFitness);
                dto.setExpiredInsurance(expiredInsurance);
                dto.setExpiredPucc(expiredPucc);

                dto.setExceptionsCount(exceptionsCount);
                dto.setMasterItemsWithoutPackets(masterItemsWithoutPackets);
                dto.setPacketsWithoutPacketItems(packetsWithoutPacketItems);
                dto.setPacketItemsWithoutMaster(packetItemsWithoutMaster);
                dto.setDispatchedWithoutPacketItem(dispatchedWithoutPacketItem);
                dto.setDispatchedWithoutChallan(dispatchedWithoutChallan);
                dto.setDispatchedWithoutDriver(dispatchedWithoutDriver);
                dto.setDuplicateCurrentStickers(duplicateCurrentStickers);
                dto.setReadyItemsStillInPkd(readyItemsStillInPkd);

                return dto;
        }

        public List<DailyThroughputUserDTO> getTodayThroughputUsers(
                        String type) {
                LocalDate today = LocalDate.now(ZONE);

                LocalDateTime startOfToday = today.atStartOfDay();

                LocalDateTime startOfTomorrow = today
                                .plusDays(1)
                                .atStartOfDay();

                String normalizedType = type != null
                                ? type.trim().toLowerCase()
                                : "";

                if ("packing".equals(normalizedType)
                                || "packed".equals(normalizedType)) {
                        return repo.fetchTodayPackingByUser(
                                        startOfToday,
                                        startOfTomorrow);
                }

                if ("dispatch".equals(normalizedType)
                                || "dispatched".equals(normalizedType)) {
                        return repo.fetchTodayDispatchByUser(
                                        startOfToday,
                                        startOfTomorrow);
                }

                throw new IllegalArgumentException(
                                "Invalid throughput type: " + type);
        }
}