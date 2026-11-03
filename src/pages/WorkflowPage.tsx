import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  CirclePlus,
  Eye,
  EyeOff,
  FilePlus2,
  GitBranch,
  ListTree,
  Plus,
  Redo2,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Undo2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { baseTaskStatuses, isBaseTaskStatus } from "@/config/taskStatus";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectStatus } from "@/contexts/ProjectStatusContext";
import { useProjectTasks } from "@/contexts/ProjectTaskContext";
import { useProjectWorkflow } from "@/contexts/ProjectWorkflowContext";
import { useOptionalWorkflowCatalog } from "@/contexts/WorkflowCatalogContext";
import { useMembers } from "@/contexts/MembersContext";
import { useRoles } from "@/contexts/RolesContext";
import { useSprints } from "@/contexts/SprintsContext";
import { WorkflowRuleBuilder } from "@/components/workflow/WorkflowRuleBuilder";
import type { StatusDefinition } from "@/types/status";
import type { WorkflowNode, WorkflowTransition } from "@/types/workflow";
import {
  logicalCanvasSizeFromClient,
  logicalCanvasPointFromPointer,
  nodePositionFromPointer,
  resolveNodePosition,
  type CanvasSafePadding,
} from "@/utils/workflowCanvas";
import { workflowEdgePath } from "@/utils/workflowEdges";
import {
  WORKFLOW_ARROW_SIZE,
  WORKFLOW_EDGE_GAP,
  WORKFLOW_EDGE_HIT_AREA_WIDTH,
  WORKFLOW_EDGE_LABEL_FONT_SIZE,
  WORKFLOW_EDGE_STROKE_WIDTH,
  WORKFLOW_NODE_LABEL_MAX_WIDTH,
  WORKFLOW_NODE_SIZE,
  WORKFLOW_PLUS_BUTTON_SIZE,
  WORKFLOW_PLUS_ICON_SIZE,
  WORKFLOW_PORT_DIAMETER,
  WORKFLOW_PORT_RADIUS,
  WORKFLOW_SELECTED_EDGE_STROKE_WIDTH,
} from "@/utils/workflowGraphGeometry";
import { validateTransitionPolicyDefinition } from "@/utils/workflowPolicy";
import {
  cloneWorkflowDraft,
  createWorkflowDraft,
  loadWorkflowTemplates,
  pushWorkflowHistory,
  redoWorkflowHistory,
  saveWorkflowTemplate,
  undoWorkflowHistory,
  validateWorkflowDraft,
  workflowDraftEquals,
  type WorkflowDraft,
  type WorkflowHistory,
  type WorkflowTemplate,
} from "@/utils/workflowEditor";

type WorkflowTab = "graph" | "transitions" | "rules";
type NodePosition = Pick<WorkflowNode, "x" | "y">;
type EdgeElementRefs = {
  visible: SVGPathElement;
  hitArea: SVGPathElement;
  label: SVGTextElement | null;
};

const NODE_WIDTH = WORKFLOW_NODE_SIZE;
const NODE_HEIGHT = WORKFLOW_NODE_SIZE;
const PORT_OFFSET = WORKFLOW_EDGE_GAP;
const CANVAS_SAFE_PADDING: CanvasSafePadding = {
  top: 20,
  right: 64,
  bottom: 52,
  left: 22,
};
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.05;

const baseStatusNodePositions: Record<string, NodePosition> = {
  todo: { x: 140, y: 292 },
  inprogress: { x: 370, y: 98 },
  review: { x: 632, y: 426 },
  done: { x: 820, y: 292 },
};

const normalizeStatusName = (value: string) => value.trim().toLocaleLowerCase();
const defaultNodePosition = (statusId: string, index: number): NodePosition =>
  baseStatusNodePositions[statusId] ?? {
    x: 100 + (index % 4) * 248,
    y: 430 + Math.floor(index / 4) * 184,
  };
const nodePositionsFor = (statuses: StatusDefinition[]) =>
  Object.fromEntries(
    statuses.map((status, index) => [
      status.id,
      defaultNodePosition(status.id, index),
    ]),
  ) as Record<string, NodePosition>;

export default function WorkflowPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentProject } = useProject();
  const workflowCatalog = useOptionalWorkflowCatalog();
  const {
    statuses,
    replaceStatuses,
    capabilities: statusCapabilities,
  } = useProjectStatus();
  const { tasks } = useProjectTasks();
  const {
    transitions,
    replaceTransitions,
    capabilities: workflowCapabilities,
    displayCopy: workflowDisplayCopy,
  } = useProjectWorkflow();
  const { members } = useMembers();
  const { roles } = useRoles();
  const { sprints } = useSprints();
  const requestedWorkflowId = searchParams.get("workflowId");
  const activeWorkflow = workflowCatalog?.getActiveWorkflow(currentProject?.id ?? "");
  const editorDefinition =
    requestedWorkflowId && workflowCatalog
      ? workflowCatalog.getWorkflow(requestedWorkflowId)
      : undefined;
  const editorWorkflow = editorDefinition
    ? workflowCatalog?.getPublishedWorkflow(editorDefinition.id)
    : undefined;
  const activeWorkflowDefinition = !requestedWorkflowId && activeWorkflow
    ? workflowCatalog?.getWorkflow(activeWorkflow.workflowId)
    : undefined;
  const editorPayload = editorWorkflow ?? editorDefinition?.draft ?? (!requestedWorkflowId ? activeWorkflow : undefined);
  const editorIdentity = `${requestedWorkflowId ?? 'active'}:${editorDefinition?.publishedVersionId ?? (editorDefinition?.draft ? 'draft' : activeWorkflow?.id ?? editorDefinition?.id ?? 'loading')}`;
  const editorStatuses = editorPayload?.statuses ?? statuses;
  const editorTransitions = editorPayload?.transitions ?? transitions;
  const isSystemWorkflow = editorDefinition?.isSystem ?? activeWorkflowDefinition?.isSystem ?? !requestedWorkflowId;
  const isEditingActiveWorkflow =
    !requestedWorkflowId ||
    workflowCatalog?.getActiveWorkflow(currentProject?.id ?? "")?.workflowId ===
      editorDefinition?.id;
  const lastEditorIdentityRef = useRef(editorIdentity);
  const workflowCanvasRef = useRef<HTMLDivElement>(null);
  const nodeElementRefs = useRef(new Map<string, HTMLDivElement>());
  const edgeElementRefs = useRef(new Map<string, EdgeElementRefs>());
  const liveNodePositionsRef = useRef<Record<string, NodePosition>>({});
  const livePaintFrameRef = useRef<number | null>(null);
  const pointerDragRef = useRef<{
    nodeId: string;
    pointerId: number;
    grabOffset: NodePosition;
  } | null>(null);
  const dragStartDraftRef = useRef<WorkflowDraft | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("graph");
  const [draftStatuses, setDraftStatuses] = useState<StatusDefinition[]>(() =>
    editorStatuses.map((status) => ({ ...status })),
  );
  const [draftTransitions, setDraftTransitions] = useState<
    WorkflowTransition[]
  >(() => editorTransitions.map((transition) => ({ ...transition })));
  const [nodePositions, setNodePositions] = useState<
    Record<string, NodePosition>
  >(() => nodePositionsFor(editorStatuses));
  const [canvasSize, setCanvasSize] = useState<NodePosition>({ x: 0, y: 0 });
  const [publishedDraft, setPublishedDraft] = useState<WorkflowDraft>(() =>
    createWorkflowDraft(
      editorStatuses,
      editorTransitions,
      nodePositionsFor(editorStatuses),
    ),
  );
  const [history, setHistory] = useState<WorkflowHistory>({
    undo: [],
    redo: [],
  });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);
  const [selectedTransitionId, setSelectedTransitionId] = useState<
    string | null
  >(null);
  const [zoom, setZoom] = useState(1);
  const [showTransitionLabels, setShowTransitionLabels] = useState(false);
  const [showAddStatusDialog, setShowAddStatusDialog] = useState(false);
  const [showAddTransitionDialog, setShowAddTransitionDialog] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusError, setNewStatusError] = useState("");
  const [transitionFrom, setTransitionFrom] = useState("");
  const [transitionTo, setTransitionTo] = useState("");
  const [transitionError, setTransitionError] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [workflowActionError, setWorkflowActionError] = useState("");
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(() =>
    loadWorkflowTemplates(),
  );
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showUseTemplateDialog, setShowUseTemplateDialog] = useState(false);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowError, setNewWorkflowError] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const currentDraft = createWorkflowDraft(
    draftStatuses,
    draftTransitions,
    nodePositions,
  );
  const isDirty = !workflowDraftEquals(currentDraft, publishedDraft);
  const nodes = useMemo<WorkflowNode[]>(
    () =>
      draftStatuses.map((status, index) => ({
        ...status,
        ...resolveNodePosition(
          nodePositions,
          status.id,
          defaultNodePosition(status.id, index),
        ),
      })),
    [draftStatuses, nodePositions],
  );
  const nodesForPositions = useCallback(
    (positions: Record<string, NodePosition>) =>
      draftStatuses.map((status, index) => ({
        ...status,
        ...resolveNodePosition(
          positions,
          status.id,
          defaultNodePosition(status.id, index),
        ),
      })),
    [draftStatuses],
  );
  const edgeRouteOffset = useCallback(
    (transition: WorkflowTransition, positionedNodes: WorkflowNode[]) => {
      const from = positionedNodes.find((node) => node.id === transition.from);
      const to = positionedNodes.find((node) => node.id === transition.to);
      return from &&
        to &&
        from.x + NODE_WIDTH + PORT_OFFSET > to.x - PORT_OFFSET
        ? WORKFLOW_PORT_RADIUS * 3
        : 0;
    },
    [],
  );
  const canvasSizeForNodes = useCallback(
    (availableSize: NodePosition) =>
      nodesForPositions(nodePositions).reduce(
        (size, node) => ({
          x: Math.max(size.x, node.x + NODE_WIDTH + CANVAS_SAFE_PADDING.right),
          y: Math.max(
            size.y,
            node.y + NODE_HEIGHT + CANVAS_SAFE_PADDING.bottom,
          ),
        }),
        availableSize,
      ),
    [nodePositions, nodesForPositions],
  );
  const selectedStatus =
    draftStatuses.find((status) => status.id === selectedStatusId) ?? null;
  const selectedTransition =
    draftTransitions.find(
      (transition) => transition.id === selectedTransitionId,
    ) ?? null;
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? null;
  const getStatus = (statusId: string) =>
    draftStatuses.find((status) => status.id === statusId);
  const projectSprints = useMemo(
    () => sprints.filter((sprint) => sprint.projectId === currentProject?.id),
    [sprints, currentProject?.id],
  );

  const restoreDraft = (draft: WorkflowDraft) => {
    setDraftStatuses(draft.statuses.map((status) => ({ ...status })));
    setDraftTransitions(
      draft.transitions.map((transition) => ({ ...transition })),
    );
    setNodePositions(
      Object.fromEntries(
        Object.entries(draft.nodePositions).map(([id, position]) => [
          id,
          { ...position },
        ]),
      ),
    );
  };
  useEffect(() => {
    if (lastEditorIdentityRef.current === editorIdentity) return;
    lastEditorIdentityRef.current = editorIdentity;
    const nextStatuses = editorPayload?.statuses ?? statuses;
    const nextTransitions = editorPayload?.transitions ?? transitions;
    const nextDraft = createWorkflowDraft(nextStatuses, nextTransitions, nodePositionsFor(nextStatuses));
    restoreDraft(nextDraft);
    setPublishedDraft(cloneWorkflowDraft(nextDraft));
    setHistory({ undo: [], redo: [] });
    setSelectedStatusId(null);
    setSelectedTransitionId(null);
    setWorkflowActionError("");
    // The identity changes only when the selected workflow or its published version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorIdentity]);

  const recordDraftChange = (nextDraft: WorkflowDraft) => {
    setHistory((current) => pushWorkflowHistory(current, currentDraft));
    restoreDraft(nextDraft);
    setWorkflowActionError("");
  };

  const selectStatus = (statusId: string) => {
    setSelectedStatusId(statusId);
    setSelectedTransitionId(null);
    setStatusActionError("");
  };
  const selectTransition = (transitionId: string) => {
    setSelectedTransitionId(transitionId);
    setSelectedStatusId(null);
    setStatusActionError("");
  };
  const getCanvasBounds = () => {
    const canvas = workflowCanvasRef.current;
    if (!canvas)
      return {
        canvasWidth: canvasSize.x,
        canvasHeight: canvasSize.y,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
      };
    const size = logicalCanvasSizeFromClient({
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      zoom,
    });
    return {
      canvasWidth: Math.max(size.x, canvasSize.x),
      canvasHeight: Math.max(size.y, canvasSize.y),
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    };
  };
  const paintLiveGraph = () => {
    livePaintFrameRef.current = null;
    const liveNodes = nodesForPositions(liveNodePositionsRef.current);
    liveNodes.forEach((node) => {
      const element = nodeElementRefs.current.get(node.id);
      if (!element) return;
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
    });
    draftTransitions.forEach((transition) => {
      const edge = workflowEdgePath({
        transition,
        nodes: liveNodes,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
        portOffset: PORT_OFFSET,
        routeOffset: edgeRouteOffset(transition, liveNodes),
      });
      const elements = edgeElementRefs.current.get(transition.id);
      if (!edge || !elements) return;
      elements.visible.setAttribute("d", edge.path);
      elements.hitArea.setAttribute("d", edge.path);
      if (elements.label) {
        elements.label.setAttribute("x", String(edge.label.x));
        elements.label.setAttribute("y", String(edge.label.y));
      }
    });
  };
  const requestLivePaint = () => {
    if (livePaintFrameRef.current !== null) return;
    livePaintFrameRef.current = window.requestAnimationFrame(paintLiveGraph);
  };
  useEffect(() => {
    if (!pointerDragRef.current) liveNodePositionsRef.current = nodePositions;
  }, [nodePositions]);
  useEffect(() => {
    const canvas = workflowCanvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const availableSize = logicalCanvasSizeFromClient({
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        zoom,
      });
      const size = canvasSizeForNodes(availableSize);
      setCanvasSize((current) =>
        current.x === size.x && current.y === size.y ? current : size,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [activeTab, canvasSizeForNodes, zoom]);
  useEffect(
    () => () => {
      if (livePaintFrameRef.current !== null)
        window.cancelAnimationFrame(livePaintFrameRef.current);
    },
    [],
  );
  const getLogicalPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = workflowCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return logicalCanvasPointFromPointer({
      clientX: event.clientX,
      clientY: event.clientY,
      canvasLeft: rect.left,
      canvasTop: rect.top,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
      zoom,
    });
  };
  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    node: WorkflowNode,
  ) => {
    const pointer = getLogicalPointer(event);
    if (!pointer) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = {
      nodeId: node.id,
      pointerId: event.pointerId,
      grabOffset: { x: pointer.x - node.x, y: pointer.y - node.y },
    };
    dragStartDraftRef.current = currentDraft;
    setDraggedNode(node.id);
    selectStatus(node.id);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    const pointer = getLogicalPointer(event);
    if (!drag || drag.pointerId !== event.pointerId || !pointer) return;

    const position = nodePositionFromPointer(
      pointer,
      drag.grabOffset,
      {
        ...getCanvasBounds(),
      },
      CANVAS_SAFE_PADDING,
    );
    liveNodePositionsRef.current = {
      ...liveNodePositionsRef.current,
      [drag.nodeId]: position,
    };
    requestLivePaint();
  };
  const finishPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const pointer = getLogicalPointer(event);
    if (pointer) {
      const position = nodePositionFromPointer(
        pointer,
        drag.grabOffset,
        {
          ...getCanvasBounds(),
        },
        CANVAS_SAFE_PADDING,
      );
      liveNodePositionsRef.current = {
        ...liveNodePositionsRef.current,
        [drag.nodeId]: position,
      };
      if (livePaintFrameRef.current !== null) {
        window.cancelAnimationFrame(livePaintFrameRef.current);
        livePaintFrameRef.current = null;
      }
      paintLiveGraph();
      setNodePositions(liveNodePositionsRef.current);
      const dragStart = dragStartDraftRef.current;
      if (dragStart) {
        const nextDraft = createWorkflowDraft(
          dragStart.statuses,
          dragStart.transitions,
          { ...dragStart.nodePositions, [drag.nodeId]: position },
        );
        if (!workflowDraftEquals(dragStart, nextDraft)) {
          setHistory((current) => pushWorkflowHistory(current, dragStart));
        }
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerDragRef.current = null;
    dragStartDraftRef.current = null;
    setDraggedNode(null);
  };
  const closeAddStatusDialog = () => {
    setShowAddStatusDialog(false);
    setNewStatusName("");
    setNewStatusError("");
  };
  const closeAddTransitionDialog = () => {
    setShowAddTransitionDialog(false);
    setTransitionFrom("");
    setTransitionTo("");
    setTransitionError("");
  };
  const closeSaveTemplateDialog = () => {
    setShowSaveTemplateDialog(false);
    setTemplateName("");
    setTemplateError("");
  };
  const closeUseTemplateDialog = () => {
    setShowUseTemplateDialog(false);
    setSelectedTemplateId(null);
    setTemplateError("");
  };
  const addNode = () => {
    const name = newStatusName.trim();
    if (!name) return setNewStatusError("نام وضعیت الزامی است.");
    if (
      draftStatuses.some(
        (status) =>
          normalizeStatusName(status.name) === normalizeStatusName(name),
      )
    ) {
      return setNewStatusError("وضعیتی با این نام وجود دارد.");
    }
    const status = {
      id: `status-${crypto.randomUUID()}`,
      name,
      color: "#f97316",
    };
    recordDraftChange(
      createWorkflowDraft([...draftStatuses, status], draftTransitions, {
        ...nodePositions,
        [status.id]: defaultNodePosition(status.id, nodes.length),
      }),
    );
    closeAddStatusDialog();
    selectStatus(status.id);
  };
  const addWorkflowTransition = () => {
    if (!transitionFrom || !transitionTo)
      return setTransitionError("وضعیت مبدا و مقصد را انتخاب کنید.");
    if (
      transitionFrom === transitionTo ||
      draftTransitions.some(
        (transition) =>
          transition.from === transitionFrom && transition.to === transitionTo,
      )
    )
      return setTransitionError("این انتقال معتبر نیست یا از قبل وجود دارد.");
    recordDraftChange(
      createWorkflowDraft(
        draftStatuses,
        [
          ...draftTransitions,
          {
            id: `transition-${crypto.randomUUID()}`,
            from: transitionFrom,
            to: transitionTo,
          },
        ],
        nodePositions,
      ),
    );
    closeAddTransitionDialog();
  };
  const removeStatus = (status: StatusDefinition) => {
    if (
      (isSystemWorkflow && isBaseTaskStatus(status.id)) ||
      (isEditingActiveWorkflow && tasks.some((task) => task.status === status.id))
    ) {
      setStatusActionError(
        isSystemWorkflow && isBaseTaskStatus(status.id)
          ? "وضعیت‌های پایه قابل حذف نیستند."
          : "این وضعیت به وظیفه‌ای متصل است و قابل حذف نیست.",
      );
      return;
    }
    recordDraftChange(
      createWorkflowDraft(
        draftStatuses.filter((draftStatus) => draftStatus.id !== status.id),
        draftTransitions.filter(
          (transition) =>
            transition.from !== status.id && transition.to !== status.id,
        ),
        Object.fromEntries(
          Object.entries(nodePositions).filter(([id]) => id !== status.id),
        ),
      ),
    );
    setSelectedStatusId(null);
    setStatusActionError("");
  };
  const removeTransition = (transitionId: string) => {
    recordDraftChange(
      createWorkflowDraft(
        draftStatuses,
        draftTransitions.filter((transition) => transition.id !== transitionId),
        nodePositions,
      ),
    );
    setSelectedTransitionId((current) =>
      current === transitionId ? null : current,
    );
  };
  const updateTransition = (nextTransition: WorkflowTransition) => {
    recordDraftChange(
      createWorkflowDraft(
        draftStatuses,
        draftTransitions.map((transition) =>
          transition.id === nextTransition.id ? nextTransition : transition,
        ),
        nodePositions,
      ),
    );
  };
  const renameStatus = (statusId: string, nextName: string) => {
    const name = nextName.trim();
    if (!name) return setStatusActionError("نام وضعیت الزامی است.");
    if (
      draftStatuses.some(
        (status) =>
          status.id !== statusId &&
          normalizeStatusName(status.name) === normalizeStatusName(name),
      )
    ) {
      return setStatusActionError("وضعیتی با این نام وجود دارد.");
    }
    recordDraftChange(
      createWorkflowDraft(
        draftStatuses.map((status) =>
          status.id === statusId ? { ...status, name } : status,
        ),
        draftTransitions,
        nodePositions,
      ),
    );
    setStatusActionError("");
  };
  const resetView = () => {
    setNodePositions(nodePositionsFor(draftStatuses));
    setZoom(1);
  };
  const saveDraft = async () => {
    if (!workflowCatalog || !editorDefinition || !currentProject) {
      return setWorkflowActionError("ابتدا یک گردش‌کار سفارشی ایجاد یا انتخاب کنید.");
    }
    if (!editorDefinition.ownerProjectId || editorDefinition.isSystem) {
      return setWorkflowActionError("ذخیرهٔ پیش‌نویس فقط برای گردش‌کار سفارشیِ متعلق به پروژه امکان‌پذیر است.");
    }
    const validationError = validateWorkflowDraft(currentDraft, []);
    if (validationError) return setWorkflowActionError(validationError);
    const policyError = currentDraft.transitions.flatMap((transition) =>
      validateTransitionPolicyDefinition(transition, {
        memberIds: members.map((member) => member.id),
        roleIds: roles.map((role) => role.id),
      }),
    )[0];
    if (policyError) return setWorkflowActionError(policyError);
    const result = await workflowCatalog.saveWorkflowDraft(editorDefinition.id, currentDraft);
    if (!result.ok) return setWorkflowActionError(result.message ?? "ذخیرهٔ پیش‌نویس انجام نشد.");
    setPublishedDraft(cloneWorkflowDraft(currentDraft));
    setHistory({ undo: [], redo: [] });
    setWorkflowActionError("");
  };
  const publishDraft = async () => {
    const validationError = validateWorkflowDraft(
      currentDraft,
      isSystemWorkflow ? baseTaskStatuses.map((status) => status.id) : [],
    );
    if (validationError) return setWorkflowActionError(validationError);
    const policyError = currentDraft.transitions.flatMap((transition) =>
      validateTransitionPolicyDefinition(transition, {
        memberIds: members.map((member) => member.id),
        roleIds: roles.map((role) => role.id),
      }),
    )[0];
    if (policyError) return setWorkflowActionError(policyError);
    if (
      !statusCapabilities.canReplaceStatuses ||
      !workflowCapabilities.canReplaceTransitions
    ) {
      return setWorkflowActionError(workflowDisplayCopy.actionUnavailable);
    }
    if (workflowCatalog && currentProject) {
      const workflowId =
        editorDefinition?.id ??
        workflowCatalog.getActiveWorkflow(currentProject.id)?.workflowId;
      if (!workflowId)
        return setWorkflowActionError("گردش‌کار منتشرشده پیدا نشد.");
      const result = await workflowCatalog.publishWorkflow(
        workflowId,
        currentDraft,
      );
      if (!result.ok)
        return setWorkflowActionError(
          result.message ?? "گردش‌کار Draft قابل انتشار نیست.",
        );
    } else {
      const statusResult = await (replaceStatuses(
        currentDraft.statuses,
      ) as unknown as
        Promise<import("@/types/status").StatusMutationResult> | boolean);
      if (
        typeof statusResult === "boolean" ? !statusResult : !statusResult.ok
      ) {
        return setWorkflowActionError(
          typeof statusResult === "boolean"
            ? "وضعیت‌های Draft قابل انتشار نیستند."
            : (("message" in statusResult ? statusResult.message : undefined) ??
                "وضعیت‌های Draft قابل انتشار نیستند."),
        );
      }
      const transitionResult = await (replaceTransitions(
        currentDraft.transitions,
      ) as unknown as
        Promise<import("@/types/workflow").WorkflowMutationResult> | boolean);
      if (
        typeof transitionResult === "boolean"
          ? !transitionResult
          : !transitionResult.ok
      ) {
        return setWorkflowActionError(
          typeof transitionResult === "boolean"
            ? "انتقال‌های Draft قابل انتشار نیستند."
            : (("message" in transitionResult
                ? transitionResult.message
                : undefined) ?? "انتقال‌های Draft قابل انتشار نیستند."),
        );
      }
    }
    setPublishedDraft(cloneWorkflowDraft(currentDraft));
    setHistory({ undo: [], redo: [] });
    setWorkflowActionError("");
  };
  const cancelDraft = () => {
    restoreDraft(publishedDraft);
    setHistory({ undo: [], redo: [] });
    setSelectedStatusId(null);
    setSelectedTransitionId(null);
    setWorkflowActionError("");
  };
  const undoDraft = () => {
    const result = undoWorkflowHistory(history, currentDraft);
    if (!result.draft) return;
    setHistory(result.history);
    restoreDraft(result.draft);
    setWorkflowActionError("");
  };
  const redoDraft = () => {
    const result = redoWorkflowHistory(history, currentDraft);
    if (!result.draft) return;
    setHistory(result.history);
    restoreDraft(result.draft);
    setWorkflowActionError("");
  };
  const openSaveTemplate = () => {
    setTemplateName("");
    setTemplateError("");
    setShowSaveTemplateDialog(true);
  };
  const persistTemplate = () => {
    const result = saveWorkflowTemplate(
      templates,
      templateName,
      currentDraft,
      () => `workflow-template-${crypto.randomUUID()}`,
    );
    if (!result.template)
      return setTemplateError(result.error ?? "الگو ذخیره نشد.");
    setTemplates((current) => [...current, result.template!]);
    closeSaveTemplateDialog();
  };
  const draftFromTemplate = (template: WorkflowTemplate) => {
    const templateCustomStatuses = template.statuses.filter(
      (status) => !isBaseTaskStatus(status.id),
    );
    const nextStatuses = [
      ...baseTaskStatuses.map((status) => ({ ...status })),
      ...templateCustomStatuses.map((status) => ({ ...status })),
    ];
    const validStatusIds = new Set(nextStatuses.map((status) => status.id));
    const nextTransitions = template.transitions
      .filter(
        (transition, index, values) =>
          validStatusIds.has(transition.from) &&
          validStatusIds.has(transition.to) &&
          transition.from !== transition.to &&
          values.findIndex(
            (candidate) =>
              candidate.from === transition.from &&
              candidate.to === transition.to,
          ) === index,
      )
      .map((transition) => ({ ...transition }));
    const fallbackPositions = nodePositionsFor(nextStatuses);
    const nextPositions = Object.fromEntries(
      nextStatuses.map((status) => [
        status.id,
        template.nodePositions[status.id] ?? fallbackPositions[status.id],
      ]),
    ) as Record<string, NodePosition>;
    return createWorkflowDraft(nextStatuses, nextTransitions, nextPositions);
  };
  const applySelectedTemplate = () => {
    if (!selectedTemplate) return setTemplateError("یک الگو را انتخاب کنید.");
    recordDraftChange(draftFromTemplate(selectedTemplate));
    closeUseTemplateDialog();
  };
  const startNewWorkflow = async () => {
    if (!workflowCatalog || !currentProject) {
      recordDraftChange(createWorkflowDraft([], [], {}));
      setShowNewWorkflowDialog(false);
      setSelectedStatusId(null);
      setSelectedTransitionId(null);
      return;
    }
    if (!newWorkflowName.trim()) {
      setNewWorkflowError("نام گردش‌کار الزامی است.");
      return;
    }
    const result = await workflowCatalog.createWorkflowDraft({
      name: newWorkflowName,
      ownerProjectId: currentProject.id,
    });
    if (!result.ok || !result.workflow) {
      setNewWorkflowError(result.ok ? "ساخت گردش‌کار انجام نشد." : result.message ?? "ساخت گردش‌کار انجام نشد.");
      return;
    }
    setShowNewWorkflowDialog(false);
    setNewWorkflowName("");
    setNewWorkflowError("");
    navigate(
      `/projects/${currentProject.id}/workflow?workflowId=${encodeURIComponent(result.workflow.id)}`,
    );
  };
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      )
        return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        if (history.redo.length) {
          event.preventDefault();
          const result = redoWorkflowHistory(history, currentDraft);
          if (result.draft) {
            setHistory(result.history);
            setDraftStatuses(result.draft.statuses);
            setDraftTransitions(result.draft.transitions);
            setNodePositions(result.draft.nodePositions);
          }
        }
      } else if (event.key.toLowerCase() === "z") {
        if (history.undo.length) {
          event.preventDefault();
          const result = undoWorkflowHistory(history, currentDraft);
          if (result.draft) {
            setHistory(result.history);
            setDraftStatuses(result.draft.statuses);
            setDraftTransitions(result.draft.transitions);
            setNodePositions(result.draft.nodePositions);
          }
        }
      } else if (event.key.toLowerCase() === "y" && history.redo.length) {
        event.preventDefault();
        const result = redoWorkflowHistory(history, currentDraft);
        if (result.draft) {
          setHistory(result.history);
          setDraftStatuses(result.draft.statuses);
          setDraftTransitions(result.draft.transitions);
          setNodePositions(result.draft.nodePositions);
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [history, currentDraft]);
  const tabClass = (tab: WorkflowTab) =>
    [
      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
      activeTab === tab
        ? "bg-surface-interactive text-foreground shadow-sm"
        : "text-muted-foreground hover:bg-surface-interactive/70 hover:text-foreground",
    ].join(" ");

  return (
    <main
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 pb-8"
      dir="rtl"
    >
      <header className="rounded-2xl border border-border/70 bg-[linear-gradient(135deg,hsl(var(--surface-inset)/.92),hsl(var(--card)/.96))] p-4 shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/.035),0_12px_30px_hsl(var(--depth-shadow)/.16)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                onClick={() =>
                  navigate("/projects/" + currentProject?.id + "/settings")
                }
                className="transition hover:text-foreground"
              >
                تنظیمات پروژه
              </button>
              <ChevronLeft className="size-3" />
              <span>گردش‌کار</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <Workflow className="size-5" />
              </span>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  گردش‌کار ستون‌های اسپرینت
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentProject?.name ?? "پروژه جاری"} · وضعیت‌ها و انتقال‌های
                  مجاز را مدیریت کنید.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
              variant="outline"
              size="sm"
              onClick={() => setShowNewWorkflowDialog(true)}
            >
              <FilePlus2 data-icon="inline-start" />
              گردش‌کار جدید
            </Button>
            <Button
              className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
              variant="outline"
              size="sm"
              disabled={!templates.length}
              onClick={() => {
                setTemplateError("");
                setSelectedTemplateId(null);
                setShowUseTemplateDialog(true);
              }}
            >
              استفاده از الگو
            </Button>
            <Button
              className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
              variant="outline"
              size="sm"
              onClick={openSaveTemplate}
            >
              ذخیره به‌عنوان الگو
            </Button>
            <Button
              className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
              variant="outline"
              size="sm"
              disabled={!isDirty}
              onClick={cancelDraft}
            >
              لغو تغییرات
            </Button>
            <Button
              className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
              size="sm"
              disabled={
                !isDirty ||
                !statusCapabilities.canReplaceStatuses ||
                !workflowCapabilities.canReplaceTransitions
              }
              onClick={() => void publishDraft()}
            >
              انتشار تغییرات
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-2 shadow-sm">
        <div
          className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface-inset/75 p-1"
          role="tablist"
          aria-label="نمای گردش‌کار"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "graph"}
            onClick={() => setActiveTab("graph")}
            className={tabClass("graph")}
          >
            <Workflow className="size-3.5" />
            نمودار
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "transitions"}
            onClick={() => setActiveTab("transitions")}
            className={tabClass("transitions")}
          >
            <ListTree className="size-3.5" />
            لیست انتقال‌ها
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "rules"}
            onClick={() => setActiveTab("rules")}
            className={tabClass("rules")}
          >
            <ShieldAlert className="size-3.5" />
            قوانین و محدودیت‌ها
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setNewStatusName("");
              setNewStatusError("");
              setShowAddStatusDialog(true);
            }}
          >
            <CirclePlus data-icon="inline-start" />
            افزودن وضعیت
          </Button>
          <Button
            className="h-8 gap-1.5 px-2.5 text-[11px] [&_svg]:size-3.5"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setTransitionFrom("");
              setTransitionTo("");
              setTransitionError("");
              setShowAddTransitionDialog(true);
            }}
          >
            <GitBranch data-icon="inline-start" />
            افزودن انتقال
          </Button>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setZoom((value) =>
                Math.max(
                  MIN_ZOOM,
                  Math.min(MAX_ZOOM, Number((value - ZOOM_STEP).toFixed(2))),
                ),
              )
            }
            aria-label="کوچک‌نمایی"
          >
            <ZoomOut />
          </Button>
          <span className="min-w-10 text-center text-[11px] font-medium text-muted-foreground">
            {Math.round(zoom * 100)}٪
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              setZoom((value) =>
                Math.max(
                  MIN_ZOOM,
                  Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))),
                ),
              )
            }
            aria-label="بزرگ‌نمایی"
          >
            <ZoomIn />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={resetView}
            aria-label="بازنشانی نما"
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showTransitionLabels}
            onClick={() => setShowTransitionLabels((value) => !value)}
          >
            {showTransitionLabels ? (
              <Eye data-icon="inline-start" />
            ) : (
              <EyeOff data-icon="inline-start" />
            )}
            {showTransitionLabels ? "پنهان‌کردن نام‌ها" : "نمایش عنوان انتقال"}
          </Button>
          <span className="flex">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!history.undo.length}
              onClick={undoDraft}
              aria-label="لغو تغییر"
            >
              <Redo2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!history.redo.length}
              onClick={redoDraft}
              aria-label="بازانجام تغییر"
            >
              <Undo2 />
            </Button>
          </span>
        </div>
      </section>

      {activeTab === "graph" && (
        <section className="grid min-h-[680px] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface-inset/55 shadow-[inset_0_1px_0_hsl(var(--depth-highlight)/.025),0_12px_28px_hsl(var(--depth-shadow)/.15)]">
              <div className="flex items-center justify-between border-b border-border/60 bg-card/70 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    نمودار گردش‌کار
                  </h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    برای انتخاب، روی وضعیت یا انتقال کلیک کنید. جابه‌جایی
                    وضعیت‌ها فقط نمای این نشست را تغییر می‌دهد.
                  </p>
                  {workflowActionError && (
                    <p className="mt-2 text-xs text-destructive">
                      {workflowActionError}
                    </p>
                  )}
                </div>
                <span className="rounded-lg border border-border/65 bg-surface-interactive px-2 py-1 text-[10px] text-muted-foreground">
                  {draftStatuses.length} وضعیت · {draftTransitions.length}{" "}
                  انتقال{isDirty ? " · پیش‌نویس منتشرنشده" : ""}
                </span>
              </div>
              <div
                ref={workflowCanvasRef}
                className="relative min-h-[590px] overflow-auto touch-none bg-[#09070d]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(145, 137, 160, 0.56) 1.25px, transparent 1.35px)",
                  backgroundSize: "28px 28px",
                }}
              >
                <div
                  style={{
                    width: Math.max(1, canvasSize.x * zoom),
                    height: Math.max(1, canvasSize.y * zoom),
                  }}
                >
                  <div
                    className="relative"
                    style={{
                      width: Math.max(1, canvasSize.x),
                      height: Math.max(1, canvasSize.y),
                      transform: "scale(" + zoom + ")",
                      transformOrigin: "top left",
                    }}
                    dir="ltr"
                  >
                    <svg
                      className="absolute inset-0 overflow-visible"
                      width={canvasSize.x}
                      height={canvasSize.y}
                      aria-label="انتقال‌های گردش‌کار"
                    >
                      <defs>
                        <marker
                          id="workflow-arrow"
                          markerWidth={WORKFLOW_ARROW_SIZE}
                          markerHeight={WORKFLOW_ARROW_SIZE}
                          refX={WORKFLOW_ARROW_SIZE}
                          refY={WORKFLOW_ARROW_SIZE / 2}
                          orient="auto"
                        >
                          <path
                            d={`M0,0 L${WORKFLOW_ARROW_SIZE},${WORKFLOW_ARROW_SIZE / 2} L0,${WORKFLOW_ARROW_SIZE} Z`}
                            fill="#b5b0bd"
                          />
                        </marker>
                      </defs>
                      {draftTransitions.map((transition) => {
                        const edge = workflowEdgePath({
                          transition,
                          nodes,
                          nodeWidth: NODE_WIDTH,
                          nodeHeight: NODE_HEIGHT,
                          portOffset: PORT_OFFSET,
                          routeOffset: edgeRouteOffset(transition, nodes),
                        });
                        if (!edge) return null;
                        const isSelected =
                          selectedTransitionId === transition.id;
                        return (
                          <g
                            key={transition.id}
                            ref={(element) => {
                              if (!element) {
                                edgeElementRefs.current.delete(transition.id);
                                return;
                              }
                              const [visible, hitArea] = Array.from(
                                element.querySelectorAll("path"),
                              );
                              const label = element.querySelector("text");
                              if (
                                visible instanceof SVGPathElement &&
                                hitArea instanceof SVGPathElement
                              ) {
                                edgeElementRefs.current.set(transition.id, {
                                  visible,
                                  hitArea,
                                  label:
                                    label instanceof SVGTextElement
                                      ? label
                                      : null,
                                });
                              }
                            }}
                            className="cursor-pointer"
                            onClick={() => selectTransition(transition.id)}
                          >
                            <path
                              d={edge.path}
                              fill="none"
                              stroke={isSelected ? "#8074ff" : "#b5b0bd"}
                              strokeWidth={
                                isSelected
                                  ? WORKFLOW_SELECTED_EDGE_STROKE_WIDTH
                                  : WORKFLOW_EDGE_STROKE_WIDTH
                              }
                              strokeLinecap="round"
                              markerEnd="url(#workflow-arrow)"
                            />
                            <path
                              d={edge.path}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={WORKFLOW_EDGE_HIT_AREA_WIDTH}
                            />
                            {showTransitionLabels && (
                              <text
                                x={edge.label.x}
                                y={edge.label.y}
                                textAnchor="middle"
                                fill="#b5b0bd"
                                fontSize={WORKFLOW_EDGE_LABEL_FONT_SIZE}
                              >
                                انتقال مجاز
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    {nodes.map((node) => (
                      <div
                        key={node.id}
                        ref={(element) => {
                          if (element)
                            nodeElementRefs.current.set(node.id, element);
                          else nodeElementRefs.current.delete(node.id);
                        }}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(event) =>
                          handlePointerDown(event, node)
                        }
                        onPointerMove={handlePointerMove}
                        onPointerUp={finishPointerDrag}
                        onPointerCancel={finishPointerDrag}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectStatus(node.id);
                          }
                        }}
                        className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
                        style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
                      >
                        <article
                          className={[
                            "group relative grid size-[54px] place-items-center rounded-[6px] border bg-[#262129] shadow-[0_3px_8px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.035)] transition-[box-shadow,transform,border-color] duration-150",
                            draggedNode === node.id
                              ? "scale-[1.015] shadow-[0_5px_10px_rgba(0,0,0,.62)]"
                              : "hover:border-[#645b6a] hover:shadow-[0_4px_9px_rgba(0,0,0,.58)]",
                            selectedStatusId === node.id
                              ? "border-[#9185ff] ring-[0.5px] ring-[#9185ff]/35 ring-offset-0"
                              : "border-[#49434e]",
                          ].join(" ")}
                          dir="rtl"
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border border-[#a9a5ae] bg-[#b5b0b9] shadow-[0_1px_2px_rgba(0,0,0,.55)]"
                            style={{
                              left: -WORKFLOW_PORT_RADIUS,
                              width: WORKFLOW_PORT_DIAMETER,
                              height: WORKFLOW_PORT_DIAMETER,
                            }}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border border-[#a9a5ae] bg-[#b5b0b9] shadow-[0_1px_2px_rgba(0,0,0,.55)]"
                            style={{
                              right: -WORKFLOW_PORT_RADIUS,
                              width: WORKFLOW_PORT_DIAMETER,
                              height: WORKFLOW_PORT_DIAMETER,
                            }}
                          />
                          <Workflow
                            className="size-5 stroke-[2.2]"
                            style={{ color: node.color }}
                          />
                          {(!isSystemWorkflow || !isBaseTaskStatus(node.id)) && (
                            <button
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeStatus(node);
                              }}
                              className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full border border-[#5a525e] bg-[#17131a] text-[#aaa3b0] opacity-0 shadow-md transition hover:border-red-400 hover:text-red-300 group-hover:opacity-100"
                              aria-label={"حذف وضعیت " + node.name}
                            >
                              <Trash2 className="size-2" />
                            </button>
                          )}
                        </article>
                        <div
                          className="relative mt-1 text-center leading-tight"
                          style={{
                            left: "50%",
                            width: WORKFLOW_NODE_LABEL_MAX_WIDTH,
                            transform: "translateX(-50%)",
                          }}
                          dir="rtl"
                        >
                          <h3 className="break-words text-[11px] font-semibold tracking-[-.02em] text-[#f1eef3]">
                            {node.name}
                          </h3>
                          <p className="mt-0.5 text-[10px] text-[#aaa4b0]">
                            {
                              tasks.filter((task) => task.status === node.id)
                                .length
                            }{" "}
                            وظیفه
                          </p>
                        </div>
                        <div
                          className="absolute flex items-center"
                          style={{
                            left: NODE_WIDTH + PORT_OFFSET,
                            top:
                              NODE_HEIGHT / 2 - WORKFLOW_PLUS_BUTTON_SIZE / 2,
                          }}
                          dir="ltr"
                        >
                          <span
                            aria-hidden
                            className="h-px bg-[#b5b0bd]"
                            style={{ width: WORKFLOW_PORT_RADIUS }}
                          />
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              setTransitionFrom(node.id);
                              setTransitionTo("");
                              setTransitionError("");
                              setShowAddTransitionDialog(true);
                            }}
                            className="grid place-items-center rounded-[2px] border border-[#b5b0bd] bg-[#302b33] text-[#d1ccd5] shadow-[0_1px_3px_rgba(0,0,0,.45)] transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9185ff]"
                            style={{
                              width: WORKFLOW_PLUS_BUTTON_SIZE,
                              height: WORKFLOW_PLUS_BUTTON_SIZE,
                            }}
                            aria-label={"افزودن انتقال از " + node.name}
                          >
                            <Plus
                              className="stroke-[2.5]"
                              style={{
                                width: WORKFLOW_PLUS_ICON_SIZE,
                                height: WORKFLOW_PLUS_ICON_SIZE,
                              }}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <TransitionTable
              transitions={draftTransitions}
              getStatus={getStatus}
              selectedTransitionId={selectedTransitionId}
              onSelect={selectTransition}
              onDelete={removeTransition}
            />
          </div>
          <WorkflowDetailPanel
            selectedStatus={selectedStatus}
            selectedTransition={selectedTransition}
            statuses={draftStatuses}
            tasks={tasks}
            getStatus={getStatus}
            statusActionError={statusActionError}
            onDeleteStatus={removeStatus}
            onRenameStatus={renameStatus}
            onDeleteTransition={removeTransition}
            onUpdateTransition={updateTransition}
            members={members}
            roles={roles}
            sprints={projectSprints}
            isSystemWorkflow={isSystemWorkflow}
          />
        </section>
      )}

      {activeTab === "transitions" && (
        <TransitionTable
          transitions={draftTransitions}
          getStatus={getStatus}
          selectedTransitionId={selectedTransitionId}
          onSelect={selectTransition}
          onDelete={removeTransition}
          expanded
        />
      )}
      {activeTab === "rules" && (
        <WorkflowRulesSummary
          transitions={draftTransitions}
          getStatus={getStatus}
          onSelect={(id) => {
            selectTransition(id);
            setActiveTab("graph");
          }}
        />
      )}

      <section className="rounded-2xl border border-border/70 bg-surface-inset/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              راهنمای استفاده
            </h2>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-3">
              <li>۱. وضعیت جدید ایجاد کنید و آن را در نمودار جابه‌جا کنید.</li>
              <li>۲. فقط انتقال‌های مجاز را بین دو وضعیت تعریف کنید.</li>
              <li>
                ۳. Board فقط انتقال‌هایی را می‌پذیرد که در این Workflow ثبت
                شده‌اند.
              </li>
            </ul>
          </div>
          <span className="text-xs text-muted-foreground">
            تغییر موقعیت Nodeها فقط presentation این نشست است.
          </span>
        </div>
      </section>

      <Dialog
        open={showAddStatusDialog}
        onOpenChange={(open) => {
          if (!open) closeAddStatusDialog();
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن وضعیت</DialogTitle>
            <DialogDescription>
              نام وضعیت باید در همین پروژه یکتا باشد.
            </DialogDescription>
          </DialogHeader>
          <label
            className="grid gap-2 text-sm font-medium text-foreground"
            htmlFor="workflow-status-name"
          >
            نام وضعیت
            <Input
              id="workflow-status-name"
              value={newStatusName}
              onChange={(event) => {
                setNewStatusName(event.target.value);
                setNewStatusError("");
              }}
              placeholder="مثلاً آماده انتشار"
              autoFocus
            />
          </label>
          {newStatusError && (
            <p className="text-xs text-destructive">{newStatusError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeAddStatusDialog}
            >
              انصراف
            </Button>
            <Button type="button" onClick={addNode}>
              <Plus data-icon="inline-start" />
              افزودن وضعیت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showAddTransitionDialog}
        onOpenChange={(open) => {
          if (!open) closeAddTransitionDialog();
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>افزودن انتقال</DialogTitle>
            <DialogDescription>
              انتقال فقط برای وضعیت‌های همین پروژه تعریف می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <label className="grid gap-2 text-sm font-medium text-foreground">
              وضعیت مبدا
              <Select
                value={transitionFrom || undefined}
                onValueChange={(value) => {
                  setTransitionFrom(value);
                  setTransitionError("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {draftStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            <ArrowRight className="mx-auto size-4 text-muted-foreground" />
            <label className="grid gap-2 text-sm font-medium text-foreground">
              وضعیت مقصد
              <Select
                value={transitionTo || undefined}
                onValueChange={(value) => {
                  setTransitionTo(value);
                  setTransitionError("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="انتخاب وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {draftStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          </div>
          {transitionError && (
            <p className="text-xs text-destructive">{transitionError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeAddTransitionDialog}
            >
              انصراف
            </Button>
            <Button type="button" onClick={addWorkflowTransition}>
              <GitBranch data-icon="inline-start" />
              افزودن انتقال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showSaveTemplateDialog}
        onOpenChange={(open) => {
          if (!open) closeSaveTemplateDialog();
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ذخیره به‌عنوان الگو</DialogTitle>
            <DialogDescription>
              الگو در همین مرورگر ذخیره می‌شود و وابسته به پروژه نیست.
            </DialogDescription>
          </DialogHeader>
          <label
            className="grid gap-2 text-sm font-medium text-foreground"
            htmlFor="workflow-template-name"
          >
            نام الگو
            <Input
              id="workflow-template-name"
              value={templateName}
              onChange={(event) => {
                setTemplateName(event.target.value);
                setTemplateError("");
              }}
              placeholder="مثلاً گردش‌کار انتشار"
              autoFocus
            />
          </label>
          {templateError && (
            <p className="text-xs text-destructive">{templateError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeSaveTemplateDialog}
            >
              انصراف
            </Button>
            <Button type="button" onClick={persistTemplate}>
              ذخیره الگو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showUseTemplateDialog}
        onOpenChange={(open) => {
          if (!open) closeUseTemplateDialog();
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>استفاده از الگو</DialogTitle>
            <DialogDescription>
              اعمال الگو فقط پیش‌نویس این پروژه را تغییر می‌دهد و تا انتشار،
              Contextها را تغییر نمی‌دهد.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setTemplateError("");
                }}
                className={[
                  "rounded-xl border p-3 text-right text-sm transition",
                  selectedTemplateId === template.id
                    ? "border-primary bg-primary/10"
                    : "border-border/65 hover:bg-surface-interactive/60",
                ].join(" ")}
              >
                <strong className="block text-foreground">
                  {template.name}
                </strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {template.statuses.length} وضعیت ·{" "}
                  {template.transitions.length} انتقال
                </span>
              </button>
            ))}
          </div>
          {selectedTemplate && (
            <div className="rounded-xl border border-border/60 bg-surface-inset/50 p-3 text-xs text-muted-foreground">
              پیش‌نمایش: {selectedTemplate.statuses.length} وضعیت،{" "}
              {selectedTemplate.transitions.length} انتقال و چیدمان Nodeهای
              ذخیره‌شده.
            </div>
          )}
          {templateError && (
            <p className="text-xs text-destructive">{templateError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeUseTemplateDialog}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={!selectedTemplate}
              onClick={applySelectedTemplate}
            >
              اعمال در پیش‌نویس
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showNewWorkflowDialog}
        onOpenChange={setShowNewWorkflowDialog}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>گردش‌کار جدید</DialogTitle>
            <DialogDescription>
              یک گردش‌کار سفارشیِ خالی ساخته می‌شود. تا زمانی که حداقل یک وضعیت
              تعریف و آن را منتشر نکنید، به هیچ پروژه‌ای اعمال نمی‌شود.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="new-workflow-name">
            نام گردش‌کار
            <Input
              id="new-workflow-name"
              value={newWorkflowName}
              onChange={(event) => {
                setNewWorkflowName(event.target.value);
                setNewWorkflowError("");
              }}
              autoFocus
            />
          </label>
          {newWorkflowError && <p className="text-xs text-destructive">{newWorkflowError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewWorkflowDialog(false)}
            >
              انصراف
            </Button>
            <Button type="button" onClick={() => void startNewWorkflow()}>
              <FilePlus2 data-icon="inline-start" />
              ساخت گردش‌کار سفارشی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function WorkflowDetailPanel({
  selectedStatus,
  selectedTransition,
  statuses,
  tasks,
  getStatus,
  statusActionError,
  onDeleteStatus,
  onRenameStatus,
  onDeleteTransition,
  onUpdateTransition,
  members,
  roles,
  sprints,
  isSystemWorkflow,
}: {
  selectedStatus: StatusDefinition | null;
  selectedTransition: WorkflowTransition | null;
  statuses: StatusDefinition[];
  tasks: { status: string }[];
  getStatus: (id: string) => StatusDefinition | undefined;
  statusActionError: string;
  onDeleteStatus: (status: StatusDefinition) => void;
  onRenameStatus: (statusId: string, name: string) => void;
  onDeleteTransition: (id: string) => void;
  onUpdateTransition: (transition: WorkflowTransition) => void;
  members: import("@/types/member").Member[];
  roles: import("@/types/role").Role[];
  sprints: import("@/types/sprint").Sprint[];
  isSystemWorkflow: boolean;
}) {
  if (selectedTransition) {
    const from = getStatus(selectedTransition.from);
    const to = getStatus(selectedTransition.to);
    return (
      <aside className="h-fit rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <p className="text-[10px] text-muted-foreground">
              انتقال انتخاب‌شده
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">
              جزئیات انتقال
            </h2>
          </div>
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <GitBranch className="size-4" />
          </span>
        </div>
        <dl className="grid gap-3 text-xs">
          <div className="rounded-xl border border-border/60 bg-surface-inset/55 p-3">
            <dt className="text-muted-foreground">نام انتقال</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {from?.name ?? "—"} ← {to?.name ?? "—"}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/55 p-2">
              <dt className="text-[10px] text-muted-foreground">وضعیت مبدا</dt>
              <dd className="mt-1 font-medium text-foreground">
                {from?.name ?? "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-border/55 p-2">
              <dt className="text-[10px] text-muted-foreground">وضعیت مقصد</dt>
              <dd className="mt-1 font-medium text-foreground">
                {to?.name ?? "—"}
              </dd>
            </div>
          </div>
        </dl>
        <WorkflowRuleBuilder
          transition={selectedTransition}
          members={members}
          roles={roles}
          sprints={sprints}
          onChange={onUpdateTransition}
        />
        <Button
          className="mt-4 w-full"
          variant="destructive"
          size="sm"
          onClick={() => onDeleteTransition(selectedTransition.id)}
        >
          <Trash2 data-icon="inline-start" />
          حذف انتقال
        </Button>
      </aside>
    );
  }
  if (selectedStatus) {
    const baseStatus = isSystemWorkflow && isBaseTaskStatus(selectedStatus.id);
    const taskCount = tasks.filter(
      (task) => task.status === selectedStatus.id,
    ).length;
    return (
      <aside className="h-fit rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
          <div>
            <p className="text-[10px] text-muted-foreground">
              وضعیت انتخاب‌شده
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">
              جزئیات وضعیت
            </h2>
          </div>
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: selectedStatus.color }}
          />
        </div>
        <dl className="grid gap-3 text-xs">
          <div className="rounded-xl border border-border/60 bg-surface-inset/55 p-3">
            <dt className="text-muted-foreground">نام وضعیت</dt>
            <dd
              className="mt-2"
            >
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = new FormData(event.currentTarget).get("statusName");
                  onRenameStatus(selectedStatus.id, typeof value === "string" ? value : "");
                }}
              >
              <Input
                aria-label="نام وضعیت انتخاب‌شده"
                key={selectedStatus.id}
                name="statusName"
                defaultValue={selectedStatus.name}
                disabled={baseStatus}
              />
              {!baseStatus && (
                <Button type="submit" size="sm">
                  ذخیره
                </Button>
              )}
              </form>
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/55 p-2">
              <dt className="text-[10px] text-muted-foreground">نوع</dt>
              <dd className="mt-1 font-medium text-foreground">
                {baseStatus ? "وضعیت پایه" : "وضعیت سفارشی"}
              </dd>
            </div>
            <div className="rounded-lg border border-border/55 p-2">
              <dt className="text-[10px] text-muted-foreground">وظایف</dt>
              <dd className="mt-1 font-medium text-foreground">{taskCount}</dd>
            </div>
          </div>
          {!baseStatus && <div className="rounded-xl border border-border/55 bg-surface-inset/40 p-3 text-[10px] leading-5 text-muted-foreground">
            نام وضعیت سفارشی در Draft تغییر می‌کند و پس از انتشار اعمال خواهد شد.
          </div>}
        </dl>
        {statusActionError && (
          <p className="mt-3 text-xs text-destructive">{statusActionError}</p>
        )}
        {!baseStatus && (
          <Button
            className="mt-4 w-full"
            variant="destructive"
            size="sm"
            onClick={() => onDeleteStatus(selectedStatus)}
          >
            <Trash2 data-icon="inline-start" />
            حذف وضعیت
          </Button>
        )}
      </aside>
    );
  }
  return (
    <aside className="h-fit rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Workflow className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            جزئیات گردش‌کار
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            یک وضعیت یا انتقال را انتخاب کنید.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <div className="rounded-xl border border-border/60 bg-surface-inset/50 p-3 text-xs text-muted-foreground">
          <strong className="block text-foreground">
            {statuses.length} وضعیت فعال
          </strong>
          <span className="mt-1 block">
            وضعیت‌ها از ProjectStatusContext خوانده می‌شوند.
          </span>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface-inset/50 p-3 text-xs text-muted-foreground">
          <strong className="block text-foreground">انتقال‌های معتبر</strong>
          <span className="mt-1 block">
            انتقال‌ها مستقیماً روی Board اعمال می‌شوند.
          </span>
        </div>
      </div>
    </aside>
  );
}

function WorkflowRulesSummary({
  transitions,
  getStatus,
  onSelect,
}: {
  transitions: WorkflowTransition[];
  getStatus: (id: string) => StatusDefinition | undefined;
  onSelect: (id: string) => void;
}) {
  const conditionCount = (
    group: import("@/types/workflowPolicy").WorkflowConditionGroup | undefined,
  ): number =>
    group
      ? group.children.reduce(
          (count, child) =>
            count + (child.kind === "group" ? conditionCount(child) : 1),
          0,
        )
      : 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="border-b border-border/60 px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          قوانین و محدودیت‌های انتقال
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          برای ویرایش قانون هر انتقال، همان انتقال را انتخاب کنید.
        </p>
      </header>
      {transitions.length ? (
        <div className="divide-y divide-border/55">
          {transitions.map((transition) => {
            const conditions = conditionCount(transition.conditions);
            const validators = transition.validators?.length ?? 0;
            const approval =
              transition.approval?.mode === "required"
                ? transition.approval.approverType === "role"
                  ? "نقش"
                  : "شخص"
                : "ندارد";
            return (
              <button
                key={transition.id}
                type="button"
                onClick={() => onSelect(transition.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-right transition hover:bg-surface-interactive/65"
              >
                <strong className="text-xs text-foreground">
                  {getStatus(transition.from)?.name ?? "—"} ←{" "}
                  {getStatus(transition.to)?.name ?? "—"}
                </strong>
                <span className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded-md bg-surface-inset px-2 py-1">
                    {conditions} شرط
                  </span>
                  <span className="rounded-md bg-surface-inset px-2 py-1">
                    {validators} اعتبارسنج
                  </span>
                  <span className="rounded-md bg-surface-inset px-2 py-1">
                    تأیید: {approval}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-muted-foreground">
          هنوز انتقالی برای نمایش قوانین وجود ندارد.
        </p>
      )}
    </section>
  );
}

function TransitionTable({
  transitions,
  getStatus,
  selectedTransitionId,
  onSelect,
  onDelete,
  expanded = false,
}: {
  transitions: WorkflowTransition[];
  getStatus: (id: string) => StatusDefinition | undefined;
  selectedTransitionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  expanded?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            ستون‌ها و انتقال‌ها
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            فهرست انتقال‌های مجاز این پروژه
          </p>
        </div>
        <span className="rounded-lg bg-surface-inset px-2 py-1 text-[10px] text-muted-foreground">
          {transitions.length} انتقال
        </span>
      </header>
      {transitions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-right text-xs">
            <thead className="bg-surface-inset/60 text-[10px] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">نام انتقال</th>
                <th className="px-4 py-3 font-medium">از</th>
                <th className="px-4 py-3 font-medium">به</th>
                <th className="px-4 py-3 font-medium">نوع انتقال</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((transition) => {
                const selected = selectedTransitionId === transition.id;
                const from = getStatus(transition.from);
                const to = getStatus(transition.to);
                return (
                  <tr
                    key={transition.id}
                    className={[
                      "border-t border-border/55 transition",
                      selected
                        ? "bg-primary/10"
                        : "hover:bg-surface-interactive/65",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelect(transition.id)}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {from?.name ?? "—"} ← {to?.name ?? "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {from?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {to?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-surface-inset px-2 py-1 text-[10px] text-muted-foreground">
                        عادی
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(transition.id)}
                        aria-label="حذف انتقال"
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={[
            "grid place-items-center text-center text-sm text-muted-foreground",
            expanded ? "min-h-80" : "min-h-32",
          ].join(" ")}
        >
          هنوز انتقالی در این گردش‌کار تعریف نشده است.
        </div>
      )}
    </section>
  );
}
