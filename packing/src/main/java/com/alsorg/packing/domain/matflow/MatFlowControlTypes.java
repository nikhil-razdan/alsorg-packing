package com.alsorg.packing.domain.matflow;

/** Compact MatFlow control vocabulary. */
public final class MatFlowControlTypes {
    private MatFlowControlTypes() {}

    public enum ProductionFileStage {
        DESIGN_DRAFT,
        DESIGN_CLARIFICATION,
        DESIGN_SUBMITTED,
        PPC_GATE_1,
        ENGINEERING_REVIEW,
        ENGINEERING_QUERY,
        ENGINEERING_WORK,
        REVISION_REVIEW,
        PPC_GATE_2,
        PRODUCTION_RELEASED,
        CANCELLED
    }

    public enum ReleaseHealth { GREEN, AMBER, RED }
    public enum EngineeringDecision { PENDING, APPROVED, QUERY_RAISED, RETURNED }

    public enum WorkItemType {
        DESIGN_CHECK,
        ENGINEERING_CHECK,
        ENGINEERING_QUERY,
        ENGINEERING_TASK,
        REVISION_REVIEW
    }

    public enum WorkItemStatus {
        PENDING,
        COMPLETE,
        NOT_APPLICABLE,
        OPEN,
        RESPONDED,
        CLOSED,
        TODO,
        ASSIGNED,
        IN_PROGRESS,
        BLOCKED,
        CANCELLED
    }

    public enum Criticality { CRITICAL, REQUIRED, OPTIONAL }
    public enum RevisionType { DESIGN_DRAWING, ENGINEERING_DRAWING, OTHER }
    public enum RevisionStatus { DRAFT, PENDING_IMPACT_REVIEW, ACTIVE, SUPERSEDED, REJECTED }

    /** Design Department task vocabulary derived from the working tracker. */
    public enum DesignTaskType {
        NEW_PROJECT,
        INITIAL_DRAWING,
        REVISION,
        PD_FILE,
        AS_PER_MEASUREMENT,
        COMMENTS,
        ADDITIONAL,
        SAMPLE,
        UN_HOLD,
        OTHER
    }

    public enum DesignTaskStatus {
        NEED_TO_START,
        ASSIGNED,
        WORKING,
        HOLD,
        DONE,
        CANCELLED
    }

    public enum BomStatus {
        DRAFT,
        READY_FOR_RELEASE,
        RELEASED,
        SUPERSEDED
    }
}
