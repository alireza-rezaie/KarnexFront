import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  assignWorkflow: vi.fn(),
  cloneWorkflow: vi.fn(),
  createWorkflow: vi.fn(),
}));

const defaultWorkflow = {
  workflowId: "workflow-default",
  version: 1,
  statuses: [{ id: "todo", name: "برای انجام", color: "#64748b" }],
  transitions: [],
};
const customWorkflow = {
  workflowId: "workflow-custom",
  version: 1,
  statuses: [
    { id: "todo", name: "برای انجام", color: "#64748b" },
    { id: "done", name: "انجام‌شده", color: "#22c55e" },
  ],
  transitions: [],
};
const workflows = [
  {
    id: "workflow-default",
    name: "گردش‌کار پیش‌فرض",
    publishedVersionId: "version-default",
    publishedVersions: [],
  },
  {
    id: "workflow-custom",
    name: "گردش‌کار منتشرشده",
    publishedVersionId: "version-custom",
    publishedVersions: [],
  },
];

vi.mock("@/contexts/ProjectsContext", () => ({
  useProjects: () => ({
    projects: [],
    createServiceAvailable: false,
    createLoading: false,
    createError: null,
    createCapabilities: { canCreateProject: true },
    createProject: mocks.createProject,
    displayCopy: { createLoading: "", createUnavailable: "" },
  }),
}));
vi.mock("@/contexts/MembersContext", () => ({
  useMembers: () => ({ members: [] }),
}));
vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ currentMember: null }),
}));
vi.mock("@/contexts/WorkflowCatalogContext", () => ({
  useWorkflowCatalog: () => ({
    workflows,
    capabilities: { canAssignWorkflow: true },
    getPublishedWorkflow: (id: string) =>
      id === "workflow-default"
        ? defaultWorkflow
        : id === "workflow-custom" || id === "workflow-clone"
          ? customWorkflow
          : undefined,
    assignWorkflow: mocks.assignWorkflow,
    cloneWorkflow: mocks.cloneWorkflow,
    createWorkflow: mocks.createWorkflow,
  }),
}));

import ProjectsPage from "@/pages/ProjectsPage";

function project(id = "project-created") {
  return {
    id,
    name: "پروژه تازه",
    key: "NEW",
    type: "scrum" as const,
    description: "",
    status: "active" as const,
    privacy: "private" as const,
    icon: "folder-kanban",
    color: "#3b82f6",
    progress: 0,
    members: [],
    startDate: "",
    endDate: "",
    tasksCount: 0,
    completedTasks: 0,
  };
}
function openAndFill() {
  fireEvent.click(screen.getByRole("button", { name: "پروژه جدید" }));
  fireEvent.change(screen.getByLabelText("نام پروژه"), {
    target: { value: "پروژه تازه" },
  });
  fireEvent.change(screen.getByLabelText("کلید پروژه"), {
    target: { value: "NEW" },
  });
}

afterEach(() => {
  cleanup();
  mocks.createProject.mockReset();
  mocks.assignWorkflow.mockReset();
  mocks.cloneWorkflow.mockReset();
  mocks.createWorkflow.mockReset();
});

describe("project creation workflow assignment", () => {
  it("lists published workflows, creates the project first, then assigns the selected workflow by created project id", async () => {
    mocks.createProject.mockResolvedValue({ ok: true, project: project() });
    mocks.assignWorkflow.mockResolvedValue({
      ok: true,
      assignment: {
        projectId: "project-created",
        defaultWorkflowId: "workflow-custom",
      },
    });
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    openAndFill();
    const selector = screen.getByLabelText(
      "گردش‌کار پروژه",
    ) as HTMLSelectElement;
    expect(Array.from(selector.options).map((option) => option.text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("گردش‌کار پیش‌فرض"),
        expect.stringContaining("گردش‌کار منتشرشده"),
      ]),
    );
    fireEvent.change(selector, { target: { value: "workflow-custom" } });
    fireEvent.click(screen.getByRole("button", { name: "ساخت پروژه" }));
    await waitFor(() =>
      expect(mocks.assignWorkflow).toHaveBeenCalledWith(
        "project-created",
        "workflow-custom",
      ),
    );
    expect(mocks.createProject.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assignWorkflow.mock.invocationCallOrder[0]!,
    );
  });

  it("does not assign a workflow when project creation fails and reports post-create assignment failure honestly", async () => {
    mocks.createProject
      .mockResolvedValueOnce({ ok: false, message: "خطای ساخت" })
      .mockResolvedValueOnce({ ok: true, project: project("project-kept") });
    mocks.assignWorkflow.mockResolvedValue({
      ok: false,
      message: "خطای تخصیص",
    });
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    openAndFill();
    fireEvent.click(screen.getByRole("button", { name: "ساخت پروژه" }));
    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledTimes(1));
    expect(mocks.assignWorkflow).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "پروژه جدید" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ساخت پروژه" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "پروژه ساخته شد",
    );
    expect(
      screen.getByRole("button", { name: "رفتن به تنظیمات گردش‌کار پروژه" }),
    ).toBeTruthy();
  });

  it("offers clone and create choices and clones only after project creation", async () => {
    mocks.createProject.mockResolvedValue({
      ok: true,
      project: project("project-flow"),
    });
    mocks.cloneWorkflow.mockResolvedValue({
      ok: true,
      workflow: { id: "workflow-clone" },
    });
    mocks.assignWorkflow.mockResolvedValue({
      ok: true,
      assignment: {
        projectId: "project-flow",
        defaultWorkflowId: "workflow-clone",
      },
    });
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    openAndFill();
    expect(
      screen.getByRole("button", { name: "استفاده از موجود" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "کپی از موجود" }));
    fireEvent.change(screen.getByLabelText("نام گردش‌کار کپی‌شده"), {
      target: { value: "کپی پروژه" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت پروژه" }));
    await waitFor(() =>
      expect(mocks.cloneWorkflow).toHaveBeenCalledWith(
        "workflow-default",
        expect.objectContaining({ name: "کپی پروژه" }),
      ),
    );
    expect(mocks.createProject.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cloneWorkflow.mock.invocationCallOrder[0]!,
    );
  });
});
