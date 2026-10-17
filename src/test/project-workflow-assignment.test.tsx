import { useContext, useEffect, useRef, type ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectSettingsPage from "@/pages/ProjectSettingsPage";
import { ProjectsContext, ProjectsProvider } from "@/contexts/ProjectsContext";
import { AuthenticatedTestProvider } from "@/test/AuthTestProvider";
import { MembersProvider } from "@/contexts/MembersContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ProjectWorkflowProvider } from "@/contexts/ProjectWorkflowContext";
import { TasksProvider } from "@/contexts/TasksContext";
import {
  WorkflowCatalogProvider,
  useWorkflowCatalog,
} from "@/contexts/WorkflowCatalogContext";
import { projects } from "@/test/fixtures/mockData";

const projectId = projects[0]!.id;

function WorkflowSeed() {
  const catalog = useWorkflowCatalog();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const active = catalog.getActiveWorkflow(projectId)!;
    void catalog.createWorkflow({
      name: "گردش‌کار قابل استفاده",
      statuses: active.statuses,
      transitions: active.transitions,
    });
    void catalog.createWorkflow({
      name: "گردش‌کار ناسازگار UI",
      statuses: [active.statuses[0]!],
      transitions: [],
    });
  }, [catalog]);
  return null;
}

function AssignmentProbe() {
  const catalog = useWorkflowCatalog();
  return (
    <output data-testid="assignment-probe">
      {catalog.getAssignment(projectId).defaultWorkflowId}
    </output>
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location-probe">
      {location.pathname}
      {location.search}
    </output>
  );
}

function AuthorizedProjectScope({ children }: { children: ReactNode }) {
  const projectsContext = useContext(ProjectsContext);
  if (!projectsContext) return <>{children}</>;

  return (
    <ProjectsContext.Provider
      value={{ ...projectsContext, canManageProjectAccess: () => true }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

function Wrapper() {
  return (
    <AuthenticatedTestProvider userId="m1">
      <MembersProvider>
    <ProjectsProvider>
      <TasksProvider>
        <WorkflowCatalogProvider>
          <MemoryRouter initialEntries={[`/projects/${projectId}/settings`]}>
            <LocationProbe />
            <Routes>
              <Route
                path="/projects/:projectId/*"
                element={
                  <ProjectProvider>
                    <AuthorizedProjectScope>
                      <ProjectWorkflowProvider>
                        <WorkflowSeed />
                        <AssignmentProbe />
                        <ProjectSettingsPage />
                      </ProjectWorkflowProvider>
                    </AuthorizedProjectScope>
                  </ProjectProvider>
                }
              />
            </Routes>
          </MemoryRouter>
        </WorkflowCatalogProvider>
      </TasksProvider>
    </ProjectsProvider>
      </MembersProvider>
    </AuthenticatedTestProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("project workflow assignment UI", () => {
  it("displays the active published workflow and lists reusable published workflows", async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "گردش‌کار" }));

    expect(
      screen.getByRole("heading", { name: "گردش‌کار پروژه" }),
    ).toBeTruthy();
    expect(screen.getAllByText("گردش‌کار پیش‌فرض").length).toBeGreaterThan(0);
    const selector = screen.getByLabelText(
      "انتخاب گردش‌کار منتشرشده",
    ) as HTMLSelectElement;
    await waitFor(() =>
      expect(Array.from(selector.options, (option) => option.text)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("گردش‌کار قابل استفاده"),
          expect.stringContaining("منتشرشده"),
        ]),
      ),
    );
  });

  it("awaits the existing assignment mutation, preserves the current reference on failure, and updates active workflow only after success", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "گردش‌کار" }));
    const selector = (await screen.findByLabelText(
      "انتخاب گردش‌کار منتشرشده",
    )) as HTMLSelectElement;
    await waitFor(() =>
      expect(
        Array.from(selector.options).some((option) =>
          option.text.includes("گردش‌کار ناسازگار UI"),
        ),
      ).toBe(true),
    );

    fireEvent.change(selector, {
      target: {
        value: Array.from(selector.options).find((option) =>
          option.text.includes("گردش‌کار ناسازگار UI"),
        )!.value,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغییر گردش‌کار" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "وضعیت بعضی از وظایف پروژه",
    );
    expect(screen.getByTestId("assignment-probe").textContent).toContain(
      "workflow-default",
    );

    fireEvent.change(selector, {
      target: {
        value: Array.from(selector.options).find((option) =>
          option.text.includes("گردش‌کار قابل استفاده"),
        )!.value,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "تغییر گردش‌کار" }));
    await waitFor(() =>
      expect(screen.getByTestId("assignment-probe").textContent).not.toContain(
        "workflow-default",
      ),
    );
    expect(screen.getAllByText("گردش‌کار قابل استفاده").length).toBeGreaterThan(0);
  });

  it("lists reusable clone sources, creates an independent clone, and opens the existing editor by workflow id", async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "گردش‌کار" }));
    fireEvent.click(screen.getByRole("button", { name: "کپی گردش‌کار" }));
    const source = screen.getByLabelText("گردش‌کار مبنا") as HTMLSelectElement;
    await waitFor(() =>
      expect(
        Array.from(source.options).some(
          (option) =>
            option.text.includes("گردش‌کار قابل استفاده") &&
            option.text.includes("وضعیت"),
        ),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("نام گردش‌کار جدید"), {
      target: { value: "گردش‌کار کپی‌شده" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت کپی" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-probe").textContent).toMatch(
        new RegExp(`/projects/${projectId}/workflow\\?workflowId=workflow-`),
      ),
    );
    expect(screen.getByTestId("assignment-probe").textContent).toBe(
      "workflow-default",
    );
  });

  it("creates a new reusable workflow without changing the current project runtime", async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "گردش‌کار" }));
    fireEvent.click(screen.getByRole("button", { name: "ساخت گردش‌کار جدید" }));
    fireEvent.click(screen.getByRole("button", { name: "ساخت گردش‌کار" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "نام گردش‌کار الزامی است",
    );
    fireEvent.change(screen.getByLabelText("نام گردش‌کار"), {
      target: { value: "گردش‌کار تازه" },
    });
    fireEvent.change(screen.getByLabelText("توضیحات گردش‌کار"), {
      target: { value: "شرح اختیاری" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ساخت گردش‌کار" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-probe").textContent).toMatch(
        new RegExp(`/projects/${projectId}/workflow\\?workflowId=workflow-`),
      ),
    );
    expect(screen.getByTestId("assignment-probe").textContent).toBe(
      "workflow-default",
    );
  });
});
