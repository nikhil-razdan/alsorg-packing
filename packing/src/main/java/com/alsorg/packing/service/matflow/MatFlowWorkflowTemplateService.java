package com.alsorg.packing.service.matflow;

import com.alsorg.packing.domain.matflow.MatFlowControlTypes.Criticality;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemStatus;
import com.alsorg.packing.domain.matflow.MatFlowControlTypes.WorkItemType;
import com.alsorg.packing.domain.matflow.MatFlowProductionFile;
import com.alsorg.packing.domain.matflow.MatFlowWorkItem;
import com.alsorg.packing.repository.matflow.MatFlowWorkItemRepository;
import java.util.List;
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

    private static final List<Seed> DESIGN = List.of(
            new Seed("OVERALL_DIMENSIONS", "Drawing", "Overall dimensions", Criticality.CRITICAL, true),
            new Seed("INTERNAL_DIMENSIONS", "Drawing", "Internal dimensions", Criticality.CRITICAL, true),
            new Seed("MATERIAL", "Specification", "Material", Criticality.CRITICAL, true),
            new Seed("LAMINATE", "Specification", "Laminate", Criticality.REQUIRED, false),
            new Seed("EDGE_BAND", "Specification", "Edge band", Criticality.REQUIRED, false),
            new Seed("HANDLE", "Specification", "Handle", Criticality.REQUIRED, false),
            new Seed("HARDWARE", "Specification", "Hardware", Criticality.REQUIRED, false),
            new Seed("FINISH", "Specification", "Finish", Criticality.REQUIRED, false),
            new Seed("GLASS", "Specification", "Glass", Criticality.REQUIRED, false),
            new Seed("PROFILE", "Specification", "Profile", Criticality.REQUIRED, false),
            new Seed("SHUTTER_DETAILS", "Product detail", "Shutter details", Criticality.REQUIRED, false),
            new Seed("LEATHER_DETAILS", "Product detail", "Leather details", Criticality.OPTIONAL, false));

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

    public void seedDesignChecklist(MatFlowProductionFile file) { seed(file, WorkItemType.DESIGN_CHECK, DESIGN, WorkItemStatus.PENDING); }
    public void seedEngineeringChecklist(MatFlowProductionFile file) { seed(file, WorkItemType.ENGINEERING_CHECK, ENGINEERING, WorkItemStatus.PENDING); }
    public void seedEngineeringTasks(MatFlowProductionFile file) { seed(file, WorkItemType.ENGINEERING_TASK, TASKS, WorkItemStatus.TODO); }

    private void seed(MatFlowProductionFile file, WorkItemType type, List<Seed> seeds, WorkItemStatus initial) {
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
            row.setCreatedBy(accessService.actor()); row.setUpdatedBy(accessService.actor()); repository.save(row);
        }
    }
}
