import { ComplianceStatus } from "../../../../generated/prisma/enums";
import {
  assertComplianceStatusTransition,
  canTransitionComplianceStatus,
  COMPLIANCE_STATUS_TRANSITIONS,
  FINAL_COMPLIANCE_STATUSES,
  getAllowedNextComplianceStatuses,
  isFinalComplianceStatus,
} from "../domain/compliance-status-transition";
import { InvalidComplianceStatusTransitionError } from "../errors/transaction.error";

describe("compliance-status-transition", () => {
  describe("isFinalComplianceStatus", () => {
    it.each([ComplianceStatus.CLEARED, ComplianceStatus.BLOCKED])("returns true for terminal status %s", (status) => {
      expect(isFinalComplianceStatus(status)).toBe(true);
    });

    it.each([
      ComplianceStatus.PENDING,
      ComplianceStatus.SCREENING,
      ComplianceStatus.FDS,
      ComplianceStatus.PRE_CLEARED,
      ComplianceStatus.MANUAL_REVIEW,
      ComplianceStatus.ORIS_REPORTING,
    ])("returns false for non-terminal status %s", (status) => {
      expect(isFinalComplianceStatus(status)).toBe(false);
    });

    it("exposes exactly CLEARED and BLOCKED as final statuses", () => {
      expect(new Set(FINAL_COMPLIANCE_STATUSES)).toEqual(new Set([ComplianceStatus.CLEARED, ComplianceStatus.BLOCKED]));
    });
  });

  describe("getAllowedNextComplianceStatuses", () => {
    it("drives the happy path PENDING -> SCREENING -> FDS -> PRE_CLEARED -> ORIS_REPORTING -> CLEARED", () => {
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.PENDING)).toContain(ComplianceStatus.SCREENING);
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.SCREENING)).toContain(ComplianceStatus.FDS);
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.FDS)).toContain(ComplianceStatus.PRE_CLEARED);
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.PRE_CLEARED)).toContain(ComplianceStatus.ORIS_REPORTING);
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.ORIS_REPORTING)).toContain(ComplianceStatus.CLEARED);
    });

    it("lets SCREENING and FDS divert to MANUAL_REVIEW", () => {
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.SCREENING)).toContain(ComplianceStatus.MANUAL_REVIEW);
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.FDS)).toContain(ComplianceStatus.MANUAL_REVIEW);
    });

    it("lets MANUAL_REVIEW resume to FDS or PRE_CLEARED, or block", () => {
      expect(getAllowedNextComplianceStatuses(ComplianceStatus.MANUAL_REVIEW)).toEqual(
        expect.arrayContaining([ComplianceStatus.FDS, ComplianceStatus.PRE_CLEARED, ComplianceStatus.BLOCKED]),
      );
    });

    it("allows BLOCKED from every non-terminal stage (fail-fast)", () => {
      for (const status of [
        ComplianceStatus.PENDING,
        ComplianceStatus.SCREENING,
        ComplianceStatus.FDS,
        ComplianceStatus.PRE_CLEARED,
        ComplianceStatus.MANUAL_REVIEW,
        ComplianceStatus.ORIS_REPORTING,
      ]) {
        expect(getAllowedNextComplianceStatuses(status)).toContain(ComplianceStatus.BLOCKED);
      }
    });

    it.each(FINAL_COMPLIANCE_STATUSES)("returns empty array for terminal status %s", (status) => {
      expect(getAllowedNextComplianceStatuses(status)).toEqual([]);
    });
  });

  describe("canTransitionComplianceStatus", () => {
    it("forbids skipping screening (PENDING -> CLEARED)", () => {
      expect(canTransitionComplianceStatus(ComplianceStatus.PENDING, ComplianceStatus.CLEARED)).toBe(false);
    });

    it("forbids reaching CLEARED without the ORIS report (PRE_CLEARED -> CLEARED)", () => {
      expect(canTransitionComplianceStatus(ComplianceStatus.PRE_CLEARED, ComplianceStatus.CLEARED)).toBe(false);
    });

    it("forbids any move out of a terminal status", () => {
      expect(canTransitionComplianceStatus(ComplianceStatus.CLEARED, ComplianceStatus.BLOCKED)).toBe(false);
      expect(canTransitionComplianceStatus(ComplianceStatus.BLOCKED, ComplianceStatus.SCREENING)).toBe(false);
    });
  });

  describe("assertComplianceStatusTransition", () => {
    it("treats same-status as an idempotent no-op", () => {
      expect(() =>
        assertComplianceStatusTransition(ComplianceStatus.SCREENING, ComplianceStatus.SCREENING),
      ).not.toThrow();
      expect(() => assertComplianceStatusTransition(ComplianceStatus.BLOCKED, ComplianceStatus.BLOCKED)).not.toThrow();
    });

    it("rejects an illegal edge with InvalidComplianceStatusTransitionError", () => {
      expect(() => assertComplianceStatusTransition(ComplianceStatus.PENDING, ComplianceStatus.ORIS_REPORTING)).toThrow(
        InvalidComplianceStatusTransitionError,
      );
    });

    it("rejects leaving a terminal status with InvalidComplianceStatusTransitionError", () => {
      expect(() => assertComplianceStatusTransition(ComplianceStatus.CLEARED, ComplianceStatus.SCREENING)).toThrow(
        InvalidComplianceStatusTransitionError,
      );
    });
  });

  describe("COMPLIANCE_STATUS_TRANSITIONS table", () => {
    it("covers every ComplianceStatus value as a key", () => {
      const enumValues = Object.values(ComplianceStatus);
      const tableKeys = Object.keys(COMPLIANCE_STATUS_TRANSITIONS);
      expect(new Set(tableKeys)).toEqual(new Set(enumValues));
    });
  });
});
