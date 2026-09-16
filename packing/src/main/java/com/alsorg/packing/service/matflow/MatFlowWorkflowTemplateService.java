package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.Criticality;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.ProductionFileStage;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Configurable-in-code V1 templates. They can later move to master tables without changing workflow records. */
@Service
public class MatFlowWorkflowTemplateService {
    private final MatFlowWorkItemRepository repository;
    private final MatFlowAccessService accessService;

    public MatFlowWorkflowTemplateService(MatFlowWorkItemRepository repository, MatFlowAccessService accessService) {
        this.repository = repository;
        this.accessService = accessService;
    }

    private record Seed(String key, String section, String title, Criticality criticality, boolean blocking) {}

    /** Exact 32-point Designer Checklist supplied by the Design Department. */
    private static final List<Seed> DESIGN = List.of(
            new Seed("DESIGN_01_SITE_MEASUREMENT", "Site / Drawing Control", "Production drawings must be as per site measurements.", Criticality.REQUIRED, true),
            new Seed("DESIGN_02_SITE_SIGNOFF", "Site / Drawing Control", "Production drawings must be signed by the site supervisor.", Criticality.REQUIRED, true),
            new Seed("DESIGN_03_SHUTTER_HEIGHT", "Geometry / Construction Limits", "Shutter height should not exceed 3000 mm (add loft if required).", Criticality.REQUIRED, true),
            new Seed("DESIGN_04_SHUTTER_WIDTH", "Geometry / Construction Limits", "Shutter width should not exceed 600 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_05_SOLID_SHUTTER_THICKNESS", "Geometry / Construction Limits", "Maximum thickness of a solid shutter should be 26 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_06_CARCASS_HEIGHT", "Geometry / Construction Limits", "Carcass height should not exceed 2400 mm (add loft if required).", Criticality.REQUIRED, true),
            new Seed("DESIGN_07_BACK_PLY_SIZE", "Geometry / Construction Limits", "Back Ply should not exceed 1200 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_08_DUMMY_SIDE_FINISH", "Finish / Detail", "Dummy side finish must be confirmed.", Criticality.REQUIRED, true),
            new Seed("DESIGN_09_VENEER_GRAIN", "Finish / Detail", "Veneer grain direction must always be shown.", Criticality.REQUIRED, true),
            new Seed("DESIGN_10_FLUTING_BLOWUP", "Finish / Detail", "Fluting detail blow-ups must always be shown.", Criticality.REQUIRED, true),
            new Seed("DESIGN_11_HANDLE_CUT_BLOWUP", "Finish / Detail", "Handle cut blow-up details must always be shown.", Criticality.REQUIRED, true),
            new Seed("DESIGN_12_SLIDING_CODE", "Hardware / Accessories", "Sliding fitting code must be mentioned.", Criticality.REQUIRED, true),
            new Seed("DESIGN_13_FILLER_JOINTS", "Geometry / Construction Limits", "Add joint lines in fillers if size exceeds 3000 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_14_EXTERNAL_HANDLE_CODES", "Hardware / Accessories", "External shutter and drawer handle codes and sizes are required.", Criticality.REQUIRED, true),
            new Seed("DESIGN_15_EXTERNAL_LOCK_HEIGHT", "Hardware / Accessories", "External lock dimensions must be specified from floor level.", Criticality.REQUIRED, true),
            new Seed("DESIGN_16_MIRROR_BACK_FINISH", "Finish / Detail", "Backside finish of mirror shutters must be specified.", Criticality.REQUIRED, true),
            new Seed("DESIGN_17_SPECIAL_SHUTTER_BACK_FINISH", "Finish / Detail", "Backside finish of leather, fabric, wallpaper, and tile shutters must be specified.", Criticality.REQUIRED, true),
            new Seed("DESIGN_18_ELEVATION_CROSSCHECK", "Site / Drawing Control", "Cross-check all elevation dimensions with plans and sections.", Criticality.REQUIRED, true),
            new Seed("DESIGN_19_INTERNAL_LAMINATE", "Finish / Detail", "Internal laminate company name and code must be properly mentioned.", Criticality.REQUIRED, true),
            new Seed("DESIGN_20_INTERNAL_HANDLE", "Hardware / Accessories", "Internal handle codes must be specified.", Criticality.REQUIRED, true),
            new Seed("DESIGN_21_GLASS_PULLOUT_WOOD", "Hardware / Accessories", "Wooden part in glass pull-out must be a minimum of 95 mm in height.", Criticality.REQUIRED, true),
            new Seed("DESIGN_22_LOCK_HANDLE_CONFLICT", "Hardware / Accessories", "Key lock/digital lock is not possible on drawer fronts in case of end-to-end handle cuts.", Criticality.REQUIRED, true),
            new Seed("DESIGN_23_LUCAS_SHELF", "Hardware / Accessories", "Lucas shelf (metal & glass) must be confirmed.", Criticality.REQUIRED, true),
            new Seed("DESIGN_24_LUCAS_LIGHTING", "Lighting", "Confirm whether Lucas shelf lighting is required on one side or both sides.", Criticality.REQUIRED, true),
            new Seed("DESIGN_25_GLASS_SHELF_THICKNESS", "Hardware / Accessories", "Toughened glass shelf thickness should be 8 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_26_LIT_SHELF_BLOWUP", "Lighting", "Internal lit-up shelf lighting detail blow-ups are required.", Criticality.REQUIRED, true),
            new Seed("DESIGN_27_TROUSER_PULLOUT", "Hardware / Accessories", "Trouser pull-out available sizes: 564 mm and 864 mm.", Criticality.REQUIRED, true),
            new Seed("DESIGN_28_LOCKER_WATCH_WINDER", "Hardware / Accessories", "Locker & watch winder (by Alsorg or client) must be specified.", Criticality.REQUIRED, true),
            new Seed("DESIGN_29_SUEDE_CODE", "Finish / Detail", "Accessory drawer suede code must be mentioned.", Criticality.REQUIRED, true),
            new Seed("DESIGN_30_HANGING_ROD_SPEC", "Hardware / Accessories", "Hanging rod name/specification must be mentioned.", Criticality.REQUIRED, true),
            new Seed("DESIGN_31_HANGING_ROD_HEIGHT", "Hardware / Accessories", "Hanging Rod height from floor level must be specified.", Criticality.REQUIRED, true),
            new Seed("DESIGN_32_SINGLE_SHUTTER_RUNNER", "Geometry / Construction Limits", "In case of single shutter wardrobe - Runner panel of the drawer will be only one side (only hinge side).", Criticality.REQUIRED, true));

    private static final Set<String> DESIGN_KEYS = DESIGN.stream().map(Seed::key).collect(Collectors.toUnmodifiableSet());

    private static final List<Seed> ENGINEERING = List.of(
            new Seed("DIMENSIONS", "Design", "Dimensions verified", Criticality.CRITICAL, true),
            new Seed("CONSTRUCTION", "Design", "Construction verified", Criticality.CRITICAL, true),
            new Seed("SHUTTER_DETAILS", "Design", "Shutter details verified", Criticality.REQUIRED, false),
            new Seed("FINISH", "Design", "Finish verified", Criticality.REQUIRED, false),
            new Seed("LAMINATE", "Design", "Laminate verified", Criticality.REQUIRED, false),
            new Seed("EDGE_BAND", "Design", "Edge band verified", Criticality.REQUIRED, false),
            new Seed("HANDLE", "Design", "Handle verified", Criticality.REQUIRED, false),
            new Seed("GLASS", "Design", "Glass verified", Criticality.REQUIRED, false),
            new Seed("PROFILE", "Design", "Profile verified", Criticality.REQUIRED, false),
            new Seed("MATERIAL_SPEC", "Technical", "Material specification verified", Criticality.CRITICAL, true),
            new Seed("THICKNESS", "Technical", "Thickness verified", Criticality.CRITICAL, true),
            new Seed("HARDWARE", "Technical", "Hardware verified", Criticality.REQUIRED, false),
            new Seed("CNC_REQUIREMENT", "Technical", "CNC requirement identified", Criticality.REQUIRED, false),
            new Seed("DRILLING", "Technical", "Drilling requirement identified", Criticality.REQUIRED, false),
            new Seed("GROOVING", "Technical", "Grooving requirement identified", Criticality.REQUIRED, false),
            new Seed("ASSEMBLY_METHOD", "Technical", "Assembly method verified", Criticality.REQUIRED, false),
            new Seed("JOINT_DETAILS", "Technical", "Joint details verified", Criticality.REQUIRED, false),
            new Seed("SPECIAL_PROCESSES", "Technical", "Special processes identified", Criticality.REQUIRED, false),
            new Seed("MANUFACTURABLE", "Manufacturing", "Manufacturability confirmed", Criticality.CRITICAL, true),
            new Seed("UNIQUE_HARDWARE", "Manufacturing", "Unique hardware availability reviewed", Criticality.REQUIRED, false),
            new Seed("OUTSOURCING", "Manufacturing", "Outsourcing requirement reviewed", Criticality.REQUIRED, false),
            new Seed("CNC_CAPACITY", "Manufacturing", "CNC capacity reviewed", Criticality.REQUIRED, false));

    private static final List<Seed> TASKS = List.of(
            new Seed("BOM", "Engineering documentation", "BOM", Criticality.REQUIRED, true),
            new Seed("CUTTING_LIST", "Engineering documentation", "Cutting List", Criticality.REQUIRED, true),
            new Seed("PASTING_LIST", "Engineering documentation", "Pasting List", Criticality.REQUIRED, true),
            new Seed("DRILLING", "Engineering documentation", "Drilling Details", Criticality.REQUIRED, true),
            new Seed("CNC", "Engineering documentation", "CNC Documentation", Criticality.REQUIRED, true),
            new Seed("PRODUCTION_DRAWING", "Engineering documentation", "Production Drawing", Criticality.REQUIRED, true),
            new Seed("HARDWARE_LIST", "Engineering documentation", "Hardware List", Criticality.REQUIRED, true),
            new Seed("ASSEMBLY_DRAWING", "Engineering documentation", "Assembly Drawing", Criticality.REQUIRED, true),
            new Seed("SHUTTER_DRAWING", "Engineering documentation", "Shutter Drawing", Criticality.REQUIRED, true));

    public void seedDesignChecklist(MatFlowProductionFile file) {
        reconcileDesignChecklist(file, accessService.actor());
    }

    public void seedEngineeringChecklist(MatFlowProductionFile file) {
        seed(file, WorkItemType.ENGINEERING_CHECK, ENGINEERING, WorkItemStatus.PENDING, accessService.actor());
    }

    public void seedEngineeringTasks(MatFlowProductionFile file) {
        seed(file, WorkItemType.ENGINEERING_TASK, TASKS, WorkItemStatus.TODO, accessService.actor());
    }

    /**
     * Migration-safe overload. Existing project/product rows can be converted to
     * the new Production File model at application startup before a user exists.
     */
    public void seedDesignChecklist(MatFlowProductionFile file, String actor) {
        reconcileDesignChecklist(file, actor);
    }

    /**
     * Upgrades only files still inside Design. Files already handed to PPC or
     * Engineering retain their historical checklist snapshot and are not
     * retroactively blocked by the new 32-point template.
     */
    public void reconcileDesignChecklist(MatFlowProductionFile file, String actor) {
        if (file == null || file.getId() == null) return;
        boolean inDesign = Set.of(ProductionFileStage.DESIGN_DRAFT, ProductionFileStage.DESIGN_CLARIFICATION)
                .contains(file.getStage());
        if (!inDesign) return;
        String effectiveActor = actor == null || actor.isBlank() ? "SYSTEM" : actor.trim();
        for (MatFlowWorkItem existing : repository.findByProductionFile_IdAndItemTypeOrderByDisplayOrderAscCreatedAtAsc(file.getId(), WorkItemType.DESIGN_CHECK)) {
            if (DESIGN_KEYS.contains(existing.getItemKey())) continue;
            if (existing.getStatus() != WorkItemStatus.CANCELLED) {
                existing.setStatus(WorkItemStatus.CANCELLED);
                existing.setCompletionNote("Retired when Design Department checklist was upgraded to the approved 32-point template.");
                existing.setUpdatedBy(effectiveActor);
                repository.save(existing);
            }
        }
        seed(file, WorkItemType.DESIGN_CHECK, DESIGN, WorkItemStatus.PENDING, effectiveActor);
    }

    private void seed(MatFlowProductionFile file, WorkItemType type, List<Seed> seeds,
            WorkItemStatus initial, String actor) {
        String effectiveActor = actor == null || actor.isBlank() ? "SYSTEM" : actor.trim();
        int order = 0;
        for (Seed seed : seeds) {
            order++;
            if (repository.findByProductionFile_IdAndItemTypeAndItemKeyIgnoreCase(file.getId(), type, seed.key()).isPresent()) continue;
            MatFlowWorkItem row = new MatFlowWorkItem();
            row.setProductionFile(file); row.setItemType(type); row.setItemKey(seed.key()); row.setSection(seed.section()); row.setTitle(seed.title());
            row.setCriticality(seed.criticality()); row.setBlocking(seed.blocking()); row.setDisplayOrder(order);
            if (type == WorkItemType.ENGINEERING_TASK && file.getAssignedEngineer() != null) {
                row.setAssignedTo(file.getAssignedEngineer());
                row.setStatus(WorkItemStatus.ASSIGNED);
            } else {
                row.setStatus(initial);
            }
            row.setCreatedBy(effectiveActor); row.setUpdatedBy(effectiveActor); repository.save(row);
        }
    }
}
