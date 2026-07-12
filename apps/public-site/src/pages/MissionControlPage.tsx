import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  Gavel,
  Hash,
  Layers,
  MessageSquare,
  Newspaper,
  Pencil,
  PieChart,
  Radio,
  Search,
  Shield,
  Timer,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  useMissionControl,
  useEditionsSelector,
  useRoleTrace,
  type MissionControlPayload,
  type MissionControlAgent,
  type MissionControlStory,
  type MissionControlEvent,
  type RoleTraceNode,
} from "@/hooks/useMissionControl";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatTime(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatElapsed(ms: number | undefined): string {
  if (!ms) return "—";
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatCents(cents: number | undefined): string {
  if (!cents) return "$0.00";
  return `$${(cents / 100).toFixed(3)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "completed":
    case "valid":
      return "bg-green-100 text-green-800 border-green-300";
    case "failed":
    case "invalid":
      return "bg-red-100 text-red-800 border-red-300";
    case "rejected":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "revised":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "pending":
      return "bg-gray-100 text-gray-600 border-gray-300";
    default:
      return "bg-gray-100 text-gray-600 border-gray-300";
  }
}

function eventIcon(type: string) {
  switch (type) {
    case "role_spawned":
      return <Bot className="h-3.5 w-3.5 text-blue-500" />;
    case "role_completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "handoff":
      return <Layers className="h-3.5 w-3.5 text-purple-500" />;
    case "draft_rejected":
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case "revision_accepted":
      return <Pencil className="h-3.5 w-3.5 text-green-500" />;
    case "claim_blocked":
      return <Gavel className="h-3.5 w-3.5 text-orange-500" />;
    case "publish_succeeded":
      return <Newspaper className="h-3.5 w-3.5 text-emerald-500" />;
    case "exception_raised":
      return <Shield className="h-3.5 w-3.5 text-red-500" />;
    case "tool_execution":
      return <Cpu className="h-3.5 w-3.5 text-gray-500" />;
    case "manager_action":
      return <Brain className="h-3.5 w-3.5 text-indigo-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-gray-400" />;
  }
}

const KANBAN_STAGES = [
  { key: "discovered", label: "Discovered", icon: Search },
  { key: "planned", label: "Planned", icon: Layers },
  { key: "reporting", label: "Reporting", icon: MessageSquare },
  { key: "drafting", label: "Drafting", icon: Pencil },
  { key: "fact_check", label: "Fact Check", icon: Shield },
  { key: "voice", label: "Voice", icon: Radio },
  { key: "publish", label: "Publish", icon: Newspaper },
  { key: "done", label: "Done", icon: CheckCircle2 },
] as const;

// ═══════════════════════════════════════════════════════════════
// Top Bar
// ═══════════════════════════════════════════════════════════════

function TopBar({
  editionKey,
  edition,
  stats,
  editionsToday,
  editionsList,
  onSelectEdition,
}: {
  editionKey: string;
  edition: MissionControlPayload["edition"];
  stats: MissionControlPayload["stats"] | undefined;
  editionsToday: number | undefined;
  editionsList: MissionControlPayload["editionsList"];
  onSelectEdition: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b bg-white px-4 py-2 text-sm">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="mr-1">
        <Link to="/" className="gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Edition selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Edition</span>
        <select
          value={editionKey}
          onChange={(e) => onSelectEdition(e.target.value)}
          className="rounded border bg-white px-2 py-1 text-xs font-mono"
        >
          {editionsList.map((e) => (
            <option key={e.editionKey} value={e.editionKey}>
              {e.editionKey} — {e.title.slice(0, 40)}
            </option>
          ))}
        </select>
        {edition && (
          <Badge
            variant="outline"
            className={`capitalize text-xs ${statusColor(edition.status)}`}
          >
            {edition.status}
          </Badge>
        )}
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Active agents */}
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {stats?.activeAgents ?? 0}/{stats?.totalAgents ?? 0} active
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Editions today */}
      <div className="flex items-center gap-1.5">
        <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {editionsToday ?? "—"} today
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Latency */}
      <div className="flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          avg {formatElapsed(stats?.averageLatencyMs)}
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Cost */}
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {formatCents(stats?.totalCostCents)} total
        </span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Health */}
      <div className="flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-xs text-emerald-600 font-medium">Healthy</span>
      </div>

      <div className="flex-1" />

      {/* Right-side quick stats */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3 w-3" />
        <span>{stats?.totalTokens?.toLocaleString() ?? 0} tokens</span>
      </div>

      <Separator orientation="vertical" className="h-6" />

      {/* Next cron */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          next cron ~{(() => { const n = new Date(); const m = n.getMinutes(); const next = Math.ceil((m + 1) / 15) * 15; n.setMinutes(next, 0, 0); return n.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); })()}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Agent List (Left Pane)
// ═══════════════════════════════════════════════════════════════

function AgentRow({
  agent,
  isSelected,
  onClick,
}: {
  agent: MissionControlAgent;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-b px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
        isSelected ? "bg-accent" : ""
      } ${agent.status !== "running" && agent.status !== "pending" ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        {agent.isEditorInChief ? (
          <Brain className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
        ) : (
          <Bot className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold">
              {agent.roleName}
            </span>
            {agent.isEditorInChief && (
              <Badge variant="secondary" className="text-[10px]">
                EIC
              </Badge>
            )}
          </div>
          {agent.beat && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Beat: {agent.beat}
            </div>
          )}
          {agent.assignment && (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {agent.assignment}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${statusColor(agent.status)}`}
            >
              {agent.status}
            </Badge>
            {agent.latencyMs && (
              <span className="text-[10px] text-muted-foreground">
                <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                {formatElapsed(agent.latencyMs)}
              </span>
            )}
            {agent.totalCostCents !== undefined && agent.totalCostCents > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {formatCents(agent.totalCostCents)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
      </div>
    </button>
  );
}

function AgentList({
  agents,
  selectedRoleId,
  onSelectAgent,
}: {
  agents: MissionControlPayload["agents"];
  selectedRoleId: string | null;
  onSelectAgent: (roleId: string) => void;
}) {
  const [roleFilter, setRoleFilter] = useState<string>("");

  const filteredAgents = useMemo(() => {
    if (!roleFilter) return agents;
    const q = roleFilter.toLowerCase();
    return agents.filter(
      (a) =>
        a.roleName.toLowerCase().includes(q) ||
        a.roleId.toLowerCase().includes(q) ||
        (a.beat && a.beat.toLowerCase().includes(q)),
    );
  }, [agents, roleFilter]);

  const activeAgents = filteredAgents.filter(
    (a) => a.status === "running" || a.status === "pending",
  );
  const finishedAgents = filteredAgents.filter(
    (a) => a.status !== "running" && a.status !== "pending",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agents
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {agents.length}
        </Badge>
      </div>

      {/* Role filter */}
      <div className="border-b px-2 py-1.5">
        <div className="flex items-center gap-1 rounded border bg-muted/30 px-2 py-1">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter roles..."
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
          />
          {roleFilter && (
            <button onClick={() => setRoleFilter("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {filteredAgents.length === 0 && agents.length > 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-muted-foreground">
          <Filter className="h-5 w-5 opacity-30" />
          <p>No roles matching &ldquo;{roleFilter}&rdquo;</p>
        </div>
      )}

      {agents.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
          <Bot className="h-6 w-6 opacity-30" />
          <p>No agents for this edition yet.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeAgents.map((agent) => (
          <AgentRow
            key={agent.roleId}
            agent={agent}
            isSelected={selectedRoleId === agent.roleId}
            onClick={() => onSelectAgent(agent.roleId)}
          />
        ))}

        {finishedAgents.length > 0 && (
          <>
            <div className="border-b px-3 py-1.5 text-[10px] font-medium uppercase text-muted-foreground/70">
              History
            </div>
            {finishedAgents.map((agent) => (
              <AgentRow
                key={agent.roleId}
                agent={agent}
                isSelected={selectedRoleId === agent.roleId}
                onClick={() => onSelectAgent(agent.roleId)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Story Board (Center Pane)
// ═══════════════════════════════════════════════════════════════

function StoryCardItem({
  story,
  onClick,
}: {
  story: MissionControlStory;
  onClick: () => void;
}) {
  const stageInfo = KANBAN_STAGES.find((s) => s.key === story.stage);
  const StageIcon = stageInfo?.icon ?? FileText;

  return (
    <button
      onClick={onClick}
      className="w-full rounded border bg-white p-2 text-left text-xs shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="mb-1 flex items-center gap-1">
        <StageIcon className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium leading-tight">{story.title}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {story.roleName && (
          <span className="flex items-center gap-0.5">
            <Bot className="h-2.5 w-2.5" />
            {story.roleName}
          </span>
        )}
        {story.beat && (
          <span className="flex items-center gap-0.5">
            <Hash className="h-2.5 w-2.5" />
            {story.beat}
          </span>
        )}
        {story.confidence !== undefined && (
          <span
            className={`ml-auto ${
              story.confidence >= 80
                ? "text-green-600"
                : story.confidence >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {story.confidence}%
          </span>
        )}
      </div>
    </button>
  );
}

function KanbanColumn({
  stage,
  stories,
  onSelectStory,
}: {
  stage: (typeof KANBAN_STAGES)[number];
  stories: MissionControlStory[];
  onSelectStory: (story: MissionControlStory) => void;
}) {
  const StageIcon = stage.icon;

  return (
    <div className="flex w-48 flex-shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <StageIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase text-muted-foreground">
          {stage.label}
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          {stories.length}
        </Badge>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-1">
        {stories.length === 0 && (
          <div className="py-6 text-center text-[10px] text-muted-foreground/50">
            —
          </div>
        )}
        {stories.map((story) => (
          <StoryCardItem
            key={story.storyId}
            story={story}
            onClick={() => onSelectStory(story)}
          />
        ))}
      </div>
    </div>
  );
}

function StoryBoard({
  storyBoard,
  onSelectStory,
}: {
  storyBoard: MissionControlPayload["storyBoard"];
  onSelectStory: (story: MissionControlStory) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Story Pipeline
        </span>
      </div>
      <div className="flex-1 overflow-x-auto p-2">
        <div className="flex h-full gap-2">
          {KANBAN_STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              stories={storyBoard[stage.key] ?? []}
              onSelectStory={onSelectStory}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Activity Feed (Right Pane)
// ═══════════════════════════════════════════════════════════════

function EventRow({
  event,
  onClick,
}: {
  event: MissionControlEvent;
  onClick: () => void;
}) {
  const isClickable = event.roleId || event.evidence;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`flex w-full items-start gap-2 border-b px-3 py-1.5 text-left transition-colors hover:bg-accent/50 ${
        !isClickable ? "cursor-default" : ""
      }`}
    >
      <span className="mt-0.5 flex-shrink-0">{eventIcon(event.type)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-tight">{event.message}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatTime(event.createdAt)}</span>
          {event.roleName && (
            <span className="truncate">{event.roleName}</span>
          )}
          {event.evidence && (
            <span className="flex items-center gap-0.5 text-blue-500">
              <ExternalLink className="h-2.5 w-2.5" /> evidence
            </span>
          )}
        </div>
      </div>
      {event.severity === "error" && (
        <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-red-400" />
      )}
      {event.severity === "warning" && (
        <Shield className="mt-0.5 h-3 w-3 flex-shrink-0 text-yellow-400" />
      )}
    </button>
  );
}

function ActivityFeed({
  events,
  onSelectEvent,
}: {
  events: MissionControlPayload["events"];
  onSelectEvent: (event: MissionControlEvent) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {events.length}
        </Badge>
      </div>

      {events.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
          <Activity className="h-6 w-6 opacity-30" />
          <p>No events yet.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {events.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={() => onSelectEvent(event)}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Detail Drawer
// ═══════════════════════════════════════════════════════════════

function DetailDrawer({
  editionKey,
  selectedRoleId,
  onClose,
}: {
  editionKey: string;
  selectedRoleId: string;
  onClose: () => void;
}) {
  const trace = useRoleTrace(editionKey, selectedRoleId);

  // Find the root trace node (no parent)
  const rootNode = trace?.find((tn) => !tn.parentNodeId);
  const childNodes = trace?.filter((tn) => tn.parentNodeId) ?? [];

  // Build parent-child groups
  const traceGroups = useMemo(() => {
    if (!trace) return [];
    const root = trace.find((tn) => !tn.parentNodeId);
    if (!root) return trace.map((tn) => ({ parent: tn, children: [] as RoleTraceNode[] }));

    const groups: Array<{ parent: RoleTraceNode; children: RoleTraceNode[] }> = [];
    const remaining = trace.filter((tn) => tn.nodeId !== root.nodeId);

    // Try to group children by parentNodeId
    const childMap = new Map<string, RoleTraceNode[]>();
    for (const tn of remaining) {
      if (tn.parentNodeId) {
        const existing = childMap.get(tn.parentNodeId) ?? [];
        existing.push(tn);
        childMap.set(tn.parentNodeId, existing);
      }
    }

    // Top-level group for root
    groups.push({ parent: root, children: childMap.get(root.nodeId) ?? [] });

    // Other groups
    for (const [parentId, children] of childMap) {
      if (parentId !== root.nodeId) {
        const parent = trace.find((tn) => tn.nodeId === parentId);
        if (parent) {
          groups.push({ parent, children });
        }
      }
    }

    return groups;
  }, [trace]);

  if (!trace && trace !== undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-32 w-48" />
      </div>
    );
  }

  if (!trace || trace.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8 opacity-30" />
        <p>No trace data available for this role.</p>
        <p className="text-xs">
          Trace nodes are recorded as the agent runs. Check back when the role
          has started.
        </p>
      </div>
    );
  }

  const totalTokens = trace.reduce((s, tn) => s + (tn.tokensUsed ?? 0), 0);
  const totalCost = trace.reduce(
    (s, tn) => s + (tn.estimatedCostCents ?? 0),
    0,
  );
  const totalLatency = trace.reduce((s, tn) => s + (tn.latencyMs ?? 0), 0);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold text-sm">
            {rootNode?.roleName ?? "Role Detail"}
          </h3>
          {rootNode?.beat && (
            <p className="text-xs text-muted-foreground">
              Beat: {rootNode.beat} · Role ID: {selectedRoleId}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 border-b px-4 py-3">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Tokens</div>
          <div className="text-sm font-mono font-semibold">
            {totalTokens.toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Cost</div>
          <div className="text-sm font-mono font-semibold">
            {formatCents(totalCost)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Latency</div>
          <div className="text-sm font-mono font-semibold">
            {formatElapsed(totalLatency)}
          </div>
        </div>
      </div>

      {/* Trace tree */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parent-Child Trace
        </h4>
        <div className="space-y-2">
          {traceGroups.map(({ parent, children }, gi) => (
            <div key={gi} className="rounded border bg-muted/30 p-2">
              {/* Parent node */}
              <div className="mb-1 flex items-start gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${statusColor(parent.status)}`}
                >
                  {parent.kind === "agent_session"
                    ? "agent"
                    : parent.kind === "manager_decision"
                      ? "manager"
                      : parent.kind === "judge_block"
                        ? "judge"
                        : "tool"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    {parent.assignment ?? parent.roleName ?? parent.nodeId}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                    {parent.tokensUsed && (
                      <span>{parent.tokensUsed.toLocaleString()} tok</span>
                    )}
                    {parent.estimatedCostCents && (
                      <span>{formatCents(parent.estimatedCostCents)}</span>
                    )}
                    {parent.latencyMs && (
                      <span>{formatElapsed(parent.latencyMs)}</span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${statusColor(parent.status)}`}
                >
                  {parent.status}
                </Badge>
              </div>

              {/* Redacted summaries */}
              {parent.inputSummary && (
                <div className="ml-4 mt-1 rounded bg-white/50 px-2 py-1 text-[10px] text-muted-foreground">
                  <span className="font-medium">Input:</span>{" "}
                  {parent.inputSummary}
                </div>
              )}
              {parent.outputSummary && (
                <div className="ml-4 mt-1 rounded bg-white/50 px-2 py-1 text-[10px] text-muted-foreground">
                  <span className="font-medium">Output:</span>{" "}
                  {parent.outputSummary}
                </div>
              )}
              {parent.evidence && (
                <div className="ml-4 mt-1 flex items-center gap-1 text-[10px] text-blue-500">
                  <ExternalLink className="h-2.5 w-2.5" />
                  <span>Evidence: {parent.evidence}</span>
                </div>
              )}
              {parent.errorMessage && (
                <div className="ml-4 mt-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-600">
                  {parent.errorMessage}
                </div>
              )}

              {/* Children */}
              {children.length > 0 && (
                <div className="ml-4 mt-2 space-y-1 border-l-2 border-muted pl-3">
                  {children.map((child, ci) => (
                    <div
                      key={ci}
                      className="rounded bg-white px-2 py-1 text-[10px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 ${statusColor(child.status)}`}
                        >
                          {child.kind}
                        </Badge>
                        <span className="font-medium">
                          {child.assignment ?? "step"}
                        </span>
                        {child.tokensUsed && (
                          <span className="text-muted-foreground">
                            {child.tokensUsed.toLocaleString()} tok
                          </span>
                        )}
                        {child.estimatedCostCents && (
                          <span className="text-muted-foreground">
                            {formatCents(child.estimatedCostCents)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Artifacts */}
        {trace.some((tn) => tn.artifacts && tn.artifacts.length > 0) && (
          <>
            <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Artifacts
            </h4>
            <div className="space-y-1">
              {trace
                .filter((tn) => tn.artifacts && tn.artifacts.length > 0)
                .flatMap((tn) => tn.artifacts!)
                .map((artifact, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-blue-500 hover:bg-accent"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="font-mono">{artifact}</span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Top bar skeleton */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Three panes */}
      <div className="flex flex-1">
        <div className="w-64 border-r p-3 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="w-80 border-l p-3 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <Activity className="h-12 w-12 text-muted-foreground/30" />
      <div>
        <p className="text-lg font-medium text-muted-foreground">
          No edition data yet
        </p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Select an edition above or wait for the first editorial plan to be
          created. Mission Control activates once a newsroom run starts.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Mission Control Page
// ═══════════════════════════════════════════════════════════════

export function MissionControlPage() {
  const allEditions = useEditionsSelector();
  const [selectedEditionKey, setSelectedEditionKey] = useState<
    string | undefined
  >(undefined);

  // Auto-select the latest edition on first load
  const effectiveEditionKey = useMemo(() => {
    if (selectedEditionKey) return selectedEditionKey;
    if (allEditions && allEditions.length > 0) return allEditions[0].editionKey;
    return undefined;
  }, [allEditions, selectedEditionKey]);

  const data = useMissionControl(effectiveEditionKey);

  // Filter state
  const [kanbanStatusFilter, setKanbanStatusFilter] = useState<string>("all");
  const [kanbanRoleFilter, setKanbanRoleFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventSearch, setEventSearch] = useState<string>("");

  // Filtered kanban. Stage and role filters compose:
  // - stage chip limits visible cards to one pipeline state
  // - role dropdown limits cards to one specialist
  const filteredStoryBoard = useMemo(() => {
    if (!data) return {};
    const result: Record<string, MissionControlStory[]> = {};
    for (const [stage, stories] of Object.entries(data.storyBoard)) {
      const stageMatches = kanbanStatusFilter === "all" || stage === kanbanStatusFilter;
      result[stage] = stageMatches
        ? stories.filter((s) => {
            if (kanbanRoleFilter !== "all" && s.roleId !== kanbanRoleFilter) {
              return false;
            }
            return true;
          })
        : [];
    }
    return result;
  }, [data, kanbanStatusFilter, kanbanRoleFilter]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => {
      if (eventTypeFilter === "errors" && e.severity !== "error") return false;
      if (eventTypeFilter === "warnings" && e.severity !== "warning" && e.severity !== "error") return false;
      if (eventTypeFilter === "handoffs" && e.type !== "handoff" && e.type !== "revision_accepted" && e.type !== "draft_rejected") return false;
      if (eventSearch) {
        const q = eventSearch.toLowerCase();
        if (!e.message.toLowerCase().includes(q) && !(e.roleName && e.roleName.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [data, eventTypeFilter, eventSearch]);

  // Detail drawer state
  const [drawerRoleId, setDrawerRoleId] = useState<string | null>(null);
  const [drawerStory, setDrawerStory] = useState<MissionControlStory | null>(
    null,
  );
  const [drawerEvent, setDrawerEvent] = useState<MissionControlEvent | null>(
    null,
  );

  const handleSelectAgent = (roleId: string) => {
    setDrawerRoleId(roleId);
    setDrawerStory(null);
    setDrawerEvent(null);
  };

  const handleSelectStory = (story: MissionControlStory) => {
    setDrawerStory(story);
    setDrawerRoleId(story.roleId ?? null);
    setDrawerEvent(null);
  };

  const handleSelectEvent = (event: MissionControlEvent) => {
    setDrawerEvent(event);
    setDrawerRoleId(event.roleId ?? null);
    setDrawerStory(null);
  };

  const handleCloseDrawer = () => {
    setDrawerRoleId(null);
    setDrawerStory(null);
    setDrawerEvent(null);
  };

  const drawerOpen = drawerRoleId !== null;

  // Loading state
  if (data === undefined) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="sm" asChild className="mr-1">
            <Link to="/" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">
            Mission Control
          </span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  // No edition selected
  if (!effectiveEditionKey) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Button variant="ghost" size="sm" asChild className="mr-1">
            <Link to="/" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">
            Mission Control
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <Newspaper className="h-12 w-12 text-muted-foreground/30" />
              <div className="text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  No editions available
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an edition to see the Mission Control dashboard.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/">Go to public page</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <TopBar
        editionKey={effectiveEditionKey}
        edition={data.edition}
        stats={data.stats}
        editionsToday={data.editionsToday}
        editionsList={data.editionsList}
        onSelectEdition={setSelectedEditionKey}
      />

      {/* Cost breakdown bar */}
      {data.agents.length > 0 && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-1.5 text-[10px]">
          <PieChart className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Per-role cost:</span>
          {data.agents
            .filter((a) => (a.totalCostCents ?? 0) > 0)
            .sort((a, b) => (b.totalCostCents ?? 0) - (a.totalCostCents ?? 0))
            .slice(0, 6)
            .map((a) => (
              <span key={a.roleId} className="flex items-center gap-1">
                <span className="max-w-[80px] truncate">{a.roleName}</span>
                <span className="font-mono text-muted-foreground">
                  {formatCents(a.totalCostCents)}
                </span>
              </span>
            ))}
        </div>
      )}

      {/* Three-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane — Agent List */}
        <div className="w-64 flex-shrink-0 border-r bg-white">
          <AgentList
            agents={data.agents}
            selectedRoleId={drawerRoleId}
            onSelectAgent={handleSelectAgent}
          />
        </div>

        {/* Center Pane — Story Kanban Board */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          {/* Kanban filters */}
          <div className="flex items-center gap-2 border-b bg-white px-3 py-1.5">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">
              Filter:
            </span>
            <div className="flex gap-1">
              {[
                { key: "all", label: "All" },
                { key: "planned", label: "Planned" },
                { key: "reporting", label: "Reporting" },
                { key: "drafting", label: "Drafting" },
                { key: "fact_check", label: "Fact Check" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setKanbanStatusFilter(f.key)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    kanbanStatusFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <select
              value={kanbanRoleFilter}
              onChange={(e) => setKanbanRoleFilter(e.target.value)}
              className="rounded border bg-white px-1.5 py-0.5 text-[10px]"
            >
              <option value="all">All roles</option>
              {data.agents
                .filter((a) => !a.isEditorInChief)
                .map((a) => (
                  <option key={a.roleId} value={a.roleId}>
                    {a.roleName}
                  </option>
                ))}
            </select>
          </div>
          <StoryBoard
            storyBoard={filteredStoryBoard}
            onSelectStory={handleSelectStory}
          />
        </div>

        {/* Right Pane — Activity Feed */}
        <div className="w-80 flex-shrink-0 border-l bg-white">
          {/* Event filters */}
          <div className="border-b px-2 py-1.5">
            <div className="mb-1.5 flex gap-1">
              {[
                { key: "all", label: "All" },
                { key: "errors", label: "Errors" },
                { key: "warnings", label: "Alerts" },
                { key: "handoffs", label: "Handoffs" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setEventTypeFilter(f.key)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    eventTypeFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded border bg-muted/30 px-2 py-1">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="flex-1 bg-transparent text-[10px] outline-none placeholder:text-muted-foreground/50"
              />
              {eventSearch && (
                <button onClick={() => setEventSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <ActivityFeed
            events={filteredEvents}
            onSelectEvent={handleSelectEvent}
          />
        </div>
      </div>

      {/* Detail Drawer (overlay right side) */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleCloseDrawer}
          />
          {/* Drawer */}
          <div className="fixed bottom-0 right-0 top-0 z-50 w-96 border-l bg-white shadow-xl">
            {drawerStory && (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-sm">Story Detail</h3>
                    <p className="text-xs text-muted-foreground">
                      Stage: {drawerStory.stage}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCloseDrawer}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <h2 className="font-serif text-lg font-semibold">
                    {drawerStory.title}
                  </h2>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {drawerStory.beat && (
                      <div>
                        <span className="text-muted-foreground">Beat:</span>{" "}
                        {drawerStory.beat}
                      </div>
                    )}
                    {drawerStory.roleName && (
                      <div>
                        <span className="text-muted-foreground">Role:</span>{" "}
                        {drawerStory.roleName}
                      </div>
                    )}
                    {drawerStory.confidence !== undefined && (
                      <div>
                        <span className="text-muted-foreground">
                          Confidence:
                        </span>{" "}
                        {drawerStory.confidence}%
                      </div>
                    )}
                    {drawerStory.clusterId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Cluster:</span>{" "}
                        <code className="text-[10px]">{drawerStory.clusterId}</code>
                      </div>
                    )}
                  </div>

                  {drawerStory.roleId && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Trace
                      </h4>
                      <DetailDrawer
                        editionKey={effectiveEditionKey}
                        selectedRoleId={drawerStory.roleId}
                        onClose={() => {}}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {drawerEvent && !drawerStory && (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-sm">Event Detail</h3>
                    <p className="text-xs text-muted-foreground">
                      {drawerEvent.type}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCloseDrawer}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <p className="text-sm">{drawerEvent.message}</p>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <div>
                      Time: {formatTime(drawerEvent.createdAt)}
                    </div>
                    {drawerEvent.roleId && (
                      <div>Role: {drawerEvent.roleId}</div>
                    )}
                    {drawerEvent.roleName && (
                      <div>Name: {drawerEvent.roleName}</div>
                    )}
                    {drawerEvent.evidence && (
                      <div className="flex items-center gap-1 text-blue-500">
                        <ExternalLink className="h-3 w-3" />
                        <span>Evidence: {drawerEvent.evidence}</span>
                      </div>
                    )}
                    <div>
                      Severity:{" "}
                      <Badge variant="outline" className="text-[10px]">
                        {drawerEvent.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {drawerRoleId && !drawerStory && !drawerEvent && (
              <DetailDrawer
                editionKey={effectiveEditionKey}
                selectedRoleId={drawerRoleId}
                onClose={handleCloseDrawer}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
