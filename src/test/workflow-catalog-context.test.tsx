import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  WorkflowCatalogProvider,
  useWorkflowCatalog,
} from "@/contexts/WorkflowCatalogContext";
import { TasksProvider, useTasks } from "@/contexts/TasksContext";
import type { WorkflowDraftPayload } from "@/types/workflow";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TasksProvider>
      <WorkflowCatalogProvider>{children}</WorkflowCatalogProvider>
    </TasksProvider>
  );
}

const getDraft = (payload: WorkflowDraftPayload): WorkflowDraftPayload => ({
  statuses: payload.statuses.map((status) => ({ ...status })),
  transitions: payload.transitions.map((transition) => ({ ...transition })),
});

describe("workflow catalog and project assignment", () => {
  it("resolves the published default workflow for a project without an explicit assignment", () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });

    const assignment = result.current.getAssignment("project-new");
    const active = result.current.getActiveWorkflow("project-new");

    expect(assignment).toEqual({
      projectId: "project-new",
      defaultWorkflowId: "workflow-default",
    });
    expect(active?.statuses.map((status) => status.id)).toEqual([
      "todo",
      "inprogress",
      "review",
      "done",
    ]);
  });

  it("assigns one reusable published workflow to multiple projects by reference", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    let createdWorkflowId = "";

    await act(async () => {
      const created = await result.current.createWorkflow({
        name: "گردش‌کار مشترک",
        statuses: result.current.getActiveWorkflow("a")!.statuses,
        transitions: result.current.getActiveWorkflow("a")!.transitions,
      });
      if (!created.ok || !created.workflow)
        throw new Error("workflow creation failed");
      createdWorkflowId = created.workflow.id;
    });
    await act(async () => {
      await result.current.assignWorkflow("project-a", createdWorkflowId);
      await result.current.assignWorkflow("project-b", createdWorkflowId);
    });

    expect(result.current.getAssignment("project-a").defaultWorkflowId).toBe(
      createdWorkflowId,
    );
    expect(result.current.getAssignment("project-b").defaultWorkflowId).toBe(
      createdWorkflowId,
    );
    expect(result.current.getActiveWorkflow("project-a")?.workflowId).toBe(
      createdWorkflowId,
    );
    expect(result.current.getActiveWorkflow("project-b")?.workflowId).toBe(
      createdWorkflowId,
    );
  });

  it("clones a workflow into an owned draft with independent transition ids", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    let cloneId = "";

    await act(async () => {
      const cloned = await result.current.cloneWorkflow("workflow-default", { ownerProjectId: "project-clone" });
      if (!cloned.ok || !cloned.workflow)
        throw new Error("workflow cloning failed");
      cloneId = cloned.workflow.id;
    });

    const source = result.current.getPublishedWorkflow("workflow-default")!;
    const clone = result.current.getWorkflow(cloneId)!;
    expect(result.current.getPublishedWorkflow(cloneId)).toBeUndefined();
    expect(clone.ownerProjectId).toBe("project-clone");
    expect(clone.id).not.toBe(source.workflowId);
    expect(clone.draft!.transitions.map((transition) => transition.id)).not.toEqual(
      source.transitions.map((transition) => transition.id),
    );
  });

  it("preserves source data and project assignment when a clone is edited or cloning fails", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    const beforeSource =
      result.current.getPublishedWorkflow("workflow-default")!;
    let cloneId = "";

    await act(async () => {
      const cloned = await result.current.cloneWorkflow("workflow-default", {
        name: "کپی مستقل",
        ownerProjectId: "project-clone",
      });
      if (!cloned.ok || !cloned.workflow)
        throw new Error("workflow cloning failed");
      cloneId = cloned.workflow.id;
    });
    const clone = result.current.getWorkflow(cloneId)!;
    const cloneDraft = getDraft(clone.draft!);
    cloneDraft.statuses[0]!.name = "وضعیت کپی";
    cloneDraft.transitions[0]!.name = "انتقال کپی";
    await act(async () => {
      expect(
        await result.current.publishWorkflow(cloneId, cloneDraft),
      ).toMatchObject({ ok: true });
      expect(
        await result.current.cloneWorkflow("missing-workflow", { ownerProjectId: "project-clone" }),
      ).toMatchObject({ ok: false });
    });

    const sourceAfter =
      result.current.getPublishedWorkflow("workflow-default")!;
    const cloneAfter = result.current.getPublishedWorkflow(cloneId)!;
    expect(sourceAfter).toEqual(beforeSource);
    expect(cloneAfter.statuses[0]!.name).toBe("وضعیت کپی");
    expect(cloneAfter.transitions[0]!.name).toBe("انتقال کپی");
    expect(sourceAfter.statuses[0]).not.toBe(cloneAfter.statuses[0]);
    expect(sourceAfter.transitions[0]).not.toBe(cloneAfter.transitions[0]);
    expect(
      result.current.getAssignment("project-clone-safe").defaultWorkflowId,
    ).toBe("workflow-default");
  });

  it("keeps an editor draft out of the active workflow until it is published", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    const before = result.current.getActiveWorkflow("project-draft")!;
    const draft = getDraft(before);
    draft.statuses.push({ id: "ready", name: "آماده", color: "#111111" });

    expect(result.current.getActiveWorkflow("project-draft")?.statuses).toEqual(
      before.statuses,
    );

    await act(async () => {
      await result.current.publishWorkflow("workflow-default", draft);
    });

    expect(
      result.current
        .getActiveWorkflow("project-draft")
        ?.statuses.some((status) => status.id === "ready"),
    ).toBe(true);
  });

  it("creates a uniquely identified independent workflow without changing the active project workflow", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    const activeBefore = result.current.getActiveWorkflow(
      "project-create-safe",
    )!;
    let createdId = "";
    await act(async () => {
      const created = await result.current.createWorkflow({
        name: "گردش‌کار مستقل تازه",
        statuses: activeBefore.statuses.map((status) => ({ ...status })),
        transitions: [],
      });
      if (!created.ok || !created.workflow)
        throw new Error("workflow creation failed");
      createdId = created.workflow.id;
    });
    const created = result.current.getPublishedWorkflow(createdId)!;
    expect(created.workflowId).not.toBe(activeBefore.workflowId);
    expect(created.statuses).not.toBe(activeBefore.statuses);
    expect(created.statuses[0]).not.toBe(activeBefore.statuses[0]);
    expect(result.current.getActiveWorkflow("project-create-safe")).toEqual(
      activeBefore,
    );
    expect(
      result.current.getAssignment("project-create-safe").defaultWorkflowId,
    ).toBe("workflow-default");
  });

  it("creates an empty custom draft whose statuses are not the system defaults and publishes arbitrary stable status ids", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    const systemBefore = result.current.getPublishedWorkflow("workflow-default")!;
    let draftId = "";

    await act(async () => {
      const created = await result.current.createWorkflowDraft({
        name: "گردش‌کار کاملاً سفارشی",
        ownerProjectId: "project-draft",
      });
      if (!created.ok || !created.workflow) throw new Error("draft creation failed");
      draftId = created.workflow.id;
    });

    expect(result.current.getWorkflow(draftId)?.draft).toEqual({
      statuses: [],
      transitions: [],
    });
    expect(result.current.getPublishedWorkflow(draftId)).toBeUndefined();

    await act(async () => {
      expect(
        await result.current.publishWorkflow(draftId, {
          statuses: [
            { id: "custom-start", name: "To Do", color: "#111111" },
            { id: "custom-finish", name: "Done", color: "#222222" },
          ],
          transitions: [
            { id: "custom-transition", from: "custom-start", to: "custom-finish" },
          ],
        }),
      ).toMatchObject({ ok: true });
    });

    expect(result.current.getPublishedWorkflow(draftId)?.statuses.map((status) => status.id)).toEqual([
      "custom-start",
      "custom-finish",
    ]);
    expect(result.current.getPublishedWorkflow("workflow-default")).toEqual(systemBefore);
  });

  it("discarding an editor draft leaves the active published workflow unchanged", () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });
    const before = result.current.getActiveWorkflow("project-discard")!;
    const discardedDraft = getDraft(before);
    discardedDraft.transitions.length = 0;

    expect(result.current.getActiveWorkflow("project-discard")).toEqual(before);
  });

  it("stores assignments as ids only and has no current-user identity authority", async () => {
    const { result } = renderHook(() => useWorkflowCatalog(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.assignWorkflow(
        "project-reference",
        "workflow-default",
      );
    });

    const assignment = result.current.assignments.find(
      (candidate) => candidate.projectId === "project-reference",
    )!;
    expect(Object.keys(assignment).sort()).toEqual([
      "defaultWorkflowId",
      "projectId",
    ]);
    expect("currentUserId" in result.current).toBe(false);
  });

  it("rejects an assignment whose published workflow cannot represent current project task statuses", async () => {
    const { result } = renderHook(
      () => ({ catalog: useWorkflowCatalog(), tasks: useTasks() }),
      { wrapper: Wrapper },
    );
    const projectId = result.current.tasks.tasks[0]!.projectId;
    let workflowId = "";
    await act(async () => {
      const created = await result.current.catalog.createWorkflow({
        name: "گردش‌کار ناسازگار",
        statuses: [{ id: "todo", name: "برای انجام", color: "#64748b" }],
        transitions: [],
      });
      if (!created.ok || !created.workflow)
        throw new Error("workflow creation failed");
      workflowId = created.workflow.id;
    });

    await act(async () => {
      expect(
        await result.current.catalog.assignWorkflow(projectId, workflowId),
      ).toMatchObject({ ok: false, message: expect.stringContaining("وضعیت") });
    });
    expect(
      result.current.catalog.getAssignment(projectId).defaultWorkflowId,
    ).toBe("workflow-default");
  });
});
