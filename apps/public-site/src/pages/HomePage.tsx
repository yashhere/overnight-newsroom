import { useRef, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ExternalLink,
  Newspaper,
  Calendar,
  Clock,
  Radio,
  Activity,
  Play,
  Headphones,
  Shield,
  Info,
  AlertTriangle,
  CheckCircle2,
  Gavel,
  Quote,
  FileText,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Volume2,
  Archive,
  ListChecks,
} from "lucide-react";
import {
  useLatestEdition,
  useEditionByKey,
  usePublishedEditions,
  useNewsroomHealth,
  type EditionStory,
  type NewsroomHealth,
} from "@/hooks/useEditions";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/AudioPlayer";

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function formatTime(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function formatDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(ts: number | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDurationSec(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const mins = Math.floor(sec / 60);
  const s = sec % 60;
  return `${mins}:${s.toString().padStart(2, "0")}`;
}

function badgeVariant(
  badge: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (badge) {
    case "breaking":
      return "destructive";
    case "developing":
      return "secondary";
    case "correction":
      return "outline";
    case "new":
      return "default";
    case "follow-up":
      return "secondary";
    default:
      return "outline";
  }
}

function badgeIcon(badge: string) {
  switch (badge) {
    case "breaking":
      return <AlertTriangle className="h-3 w-3" />;
    case "developing":
      return <TrendingUp className="h-3 w-3" />;
    case "correction":
      return <RefreshCw className="h-3 w-3" />;
    case "new":
      return <FileText className="h-3 w-3" />;
    case "follow-up":
      return <ArrowRight className="h-3 w-3" />;
    default:
      return null;
  }
}

function storyBeat(story: EditionStory): string {
  return (
    story.badges?.[0] ||
    story.sourceName ||
    story.canonicalPublisherName ||
    "News Desk"
  );
}

// ═══════════════════════════════════════════════════════════════
// Masthead
// ═══════════════════════════════════════════════════════════════

function Masthead({
  publishedAt,
  health,
}: {
  publishedAt?: number;
  health: NewsroomHealth | null | undefined;
}) {
  return (
    <header className="mb-6 border-y-4 border-double border-ink py-4 text-center">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-ink/30 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span>Morning Edition</span>
        <span className="hidden sm:inline">•</span>
        <span>Autonomous Newspaper</span>
        <span className="hidden sm:inline">•</span>
        <span>{publishedAt ? formatDate(publishedAt) : "Preparing next issue"}</span>
      </div>

      <h1 className="font-serif text-5xl font-black leading-none tracking-[-0.06em] text-ink md:text-7xl lg:text-8xl">
        Overnight Newsroom
      </h1>
      <p className="mx-auto mt-2 max-w-2xl text-sm italic text-muted-foreground md:text-base">
        A newspaper-style briefing researched, checked, voiced, and published while you sleep.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
        {publishedAt && (
          <Badge variant="outline" className="rounded-none border-ink/30 bg-transparent font-mono">
            <Clock className="mr-1 h-3 w-3" /> Last publish {formatRelative(publishedAt)}
          </Badge>
        )}
        {health && (
          <Badge
            variant="outline"
            className={`rounded-none border-ink/30 bg-transparent font-mono ${
              health.status === "healthy"
                ? "text-emerald-700"
                : health.status === "degraded"
                  ? "text-yellow-700"
                  : "text-red-700"
            }`}
          >
            {health.status === "healthy" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : health.status === "degraded" ? (
              <AlertTriangle className="mr-1 h-3 w-3" />
            ) : (
              <Info className="mr-1 h-3 w-3" />
            )}
            Newsroom {health.status}
          </Badge>
        )}
        {health?.audioAvailable && (
          <Badge variant="outline" className="rounded-none border-ink/30 bg-transparent font-mono text-emerald-700">
            <Volume2 className="mr-1 h-3 w-3" /> Audio edition ready
          </Badge>
        )}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// Loading / Empty State
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Card className="rounded-none border-ink/30 bg-transparent shadow-none">
        <CardHeader>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="rounded-none border-dashed border-ink/30 bg-transparent shadow-none">
      <CardContent className="flex flex-col items-center gap-4 py-16">
        <Newspaper className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-serif text-2xl font-bold text-muted-foreground">
            No edition published yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The first overnight edition is being prepared.
            <br />
            Check back soon.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Story Badges / Evidence
// ═══════════════════════════════════════════════════════════════

function StoryBadges({ badges }: { badges?: string[] | null }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge
          key={b}
          variant={badgeVariant(b)}
          className="flex items-center gap-1 rounded-none text-[10px] capitalize"
        >
          {badgeIcon(b)}
          {b}
        </Badge>
      ))}
    </div>
  );
}

function EvidenceSection({ story }: { story: EditionStory }) {
  const hasClaims = story.claims && story.claims.length > 0;
  const hasVerdicts = story.verdicts && story.verdicts.length > 0;
  if (!hasClaims && !hasVerdicts) return null;

  return (
    <div className="border border-ink/20 bg-white/40 px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Evidence Ledger
      </div>

      {hasClaims && (
        <div className="space-y-1.5">
          {story.claims!.map((claim, i) => {
            const verdict = story.verdicts!.find(
              (v) => v.claimId === claim.claimId,
            );
            return (
              <div key={i} className="border-l-2 border-ink/20 bg-white/50 px-2 py-1.5 text-xs">
                <div className="flex items-start gap-1.5">
                  <Quote className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-700" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{claim.claim}</p>
                    {claim.sourceLines.length > 0 && (
                      <p className="mt-0.5 break-words text-[10px] text-muted-foreground">
                        Sources: {claim.sourceLines.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {verdict && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-4 text-[10px]">
                    <Badge
                      variant={
                        verdict.verdict === "approved"
                          ? "default"
                          : verdict.verdict === "block"
                            ? "destructive"
                            : verdict.verdict === "revise"
                              ? "secondary"
                              : "outline"
                      }
                      className="rounded-none text-[9px]"
                    >
                      <Gavel className="mr-0.5 h-2.5 w-2.5" />
                      {verdict.verdict}
                    </Badge>
                    <span className="text-muted-foreground">{verdict.reason}</span>
                    <span className="ml-auto text-muted-foreground">
                      {verdict.confidence}% confidence
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Story Card
// ═══════════════════════════════════════════════════════════════

function StoryCard({
  story,
  playerRef,
  variant = "standard",
}: {
  story: EditionStory;
  playerRef: React.RefObject<AudioPlayerHandle | null>;
  variant?: "lead" | "standard" | "compact";
}) {
  const handleListenFromHere = () => {
    if (story.audioSegment && playerRef.current) {
      playerRef.current.seekTo(story.audioSegment.offsetMs);
    }
  };

  const isLead = variant === "lead";
  const isCompact = variant === "compact";

  return (
    <article
      id={`story-${story.storyKey}`}
      className={`border-ink/25 bg-transparent ${
        isLead
          ? "border-b pb-5 md:border-b-0 md:border-r md:pr-6"
          : isCompact
            ? "border-b pb-4"
            : "border-b pb-6"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span>{storyBeat(story)}</span>
        {story.createdAt && <span>• {formatShortDate(story.createdAt)}</span>}
      </div>

      <h2
        className={`font-serif font-black leading-[0.95] tracking-[-0.035em] text-ink ${
          isLead
            ? "text-4xl md:text-5xl lg:text-6xl"
            : isCompact
              ? "text-xl md:text-2xl"
              : "text-2xl md:text-3xl"
        }`}
      >
        {story.title}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StoryBadges badges={story.badges} />
        {story.audioSegment && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleListenFromHere}
            className="h-8 rounded-none border-ink/30 bg-white/40 gap-1.5 text-xs"
          >
            <Headphones className="h-3.5 w-3.5" />
            Listen from here
          </Button>
        )}
        {story.audioSegment && (
          <span className="text-[10px] text-muted-foreground">
            <Play className="mr-0.5 inline h-2.5 w-2.5" />
            {formatDurationSec(story.audioSegment.durationMs)} · anchor {story.audioSegment.anchor}
          </span>
        )}
      </div>

      {story.summary && (
        <p
          className={`mt-4 text-foreground/90 ${
            isLead
              ? "font-serif text-xl leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-6xl first-letter:font-black first-letter:leading-[0.82]"
              : "text-sm leading-relaxed"
          }`}
        >
          {story.summary}
        </p>
      )}

      {story.summaryBullets && story.summaryBullets.length > 0 && (
        <ul
          className={`mt-4 list-disc space-y-1 pl-5 text-muted-foreground ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          {story.summaryBullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-3">
        {(story.canonicalPublisherName || story.sourceName) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-bold uppercase tracking-wider">Source</span>
            {story.canonicalPublisherUrl ? (
              <a
                href={story.canonicalPublisherUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                {story.canonicalPublisherName ?? story.canonicalPublisherUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span>{story.canonicalPublisherName ?? story.sourceName}</span>
            )}
          </div>
        )}

        {story.sourceUrl && story.sourceUrl !== story.canonicalPublisherUrl && (
          <a
            href={story.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            Original article
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {!isCompact && (
        <div className="mt-4 space-y-3">
          <EvidenceSection story={story} />
          {story.receiptUrl ? (
            <Alert className="rounded-none border-ink/20 bg-white/40">
              <Radio className="h-4 w-4" />
              <AlertTitle>Media receipt</AlertTitle>
              <AlertDescription>
                <a
                  href={story.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  View proof object
                </a>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-3 w-3" />
              <span>No media receipt yet</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════
// Newspaper furniture
// ═══════════════════════════════════════════════════════════════

function ReceiptBar({
  receipts,
}: {
  receipts: Array<{
    receiptType: string;
    receiptUrl?: string | null;
    status: string;
    createdAt: number;
  }>;
}) {
  if (!receipts || receipts.length === 0) return null;

  return (
    <aside className="border border-ink/25 bg-white/35 p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" /> Publication Receipts
      </p>
      <div className="flex flex-wrap gap-2">
        {receipts.map((r, i) => (
          <Badge key={i} variant="outline" className="rounded-none border-ink/30 bg-transparent text-xs font-mono">
            {r.receiptType}: {r.status}
            {r.receiptUrl && (
              <>
                {" "}
                <a
                  href={r.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  view
                </a>
              </>
            )}
          </Badge>
        ))}
      </div>
    </aside>
  );
}

function EditionIndex({ stories }: { stories: EditionStory[] }) {
  if (stories.length === 0) return null;

  return (
    <aside className="border border-ink/25 bg-white/35 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
        <Archive className="h-3.5 w-3.5" /> In this issue
      </p>
      <ol className="space-y-3 text-sm">
        {stories.map((story, i) => (
          <li key={story.storyKey} className="border-b border-ink/10 pb-2 last:border-0 last:pb-0">
            <a href={`#story-${story.storyKey}`} className="group grid grid-cols-[1.5rem_1fr] gap-2">
              <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-serif font-bold leading-tight group-hover:underline">
                {story.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════
// HomePage
// ═══════════════════════════════════════════════════════════════

export function HomePage() {
  const publishedEditions = usePublishedEditions();
  const [selectedEditionKey, setSelectedEditionKey] = useState<string | null>(null);

  const latestData = useLatestEdition();
  const selectedData = useEditionByKey(selectedEditionKey ?? undefined);
  const data = selectedEditionKey ? selectedData : latestData;
  const health = useNewsroomHealth();
  const playerRef = useRef<AudioPlayerHandle>(null);

  const leadStory = data?.stories[0];
  const secondaryStories = data?.stories.slice(1, 3) ?? [];
  const remainingStories = data?.stories.slice(3) ?? [];
  const allStories = data?.stories ?? [];
  const issueStats = useMemo(() => {
    const sourceCount = new Set(
      allStories
        .map((story) => story.canonicalPublisherName || story.sourceName)
        .filter(Boolean),
    ).size;
    const claimCount = allStories.reduce(
      (sum, story) => sum + (story.claims?.length ?? 0),
      0,
    );
    return { sourceCount, claimCount };
  }, [allStories]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(120,93,55,0.08),_transparent_34rem)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <Masthead publishedAt={data?.edition.publishedAt} health={health} />

        {publishedEditions && publishedEditions.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 border-b border-ink/20 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Archive
            </span>
            <select
              value={selectedEditionKey ?? ""}
              onChange={(e) => setSelectedEditionKey(e.target.value || null)}
              className="rounded-none border border-ink/30 bg-white/60 px-3 py-1.5 text-sm font-medium"
            >
              <option value="">Latest edition</option>
              {publishedEditions.map((ed) => (
                <option key={ed.editionKey} value={ed.editionKey}>
                  {ed.title} — {ed.publishedAt ? new Date(ed.publishedAt).toLocaleDateString() : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {data === undefined && <LoadingSkeleton />}

        {data === null && <EmptyState />}

        {data && (
          <>
            {data.editionAudio && (
              <div className="sticky top-0 z-30 -mx-4 mb-6 border-y border-ink/20 bg-newsprint/90 px-4 py-2 shadow-sm backdrop-blur-sm md:-mx-6 md:px-6">
                <AudioPlayer
                  ref={playerRef}
                  fullAudioUrl={data.editionAudio.fullAudioUrl}
                  totalDurationMs={data.editionAudio.totalDurationMs}
                />
              </div>
            )}

            <section className="mb-6 grid gap-4 border-b border-ink/25 pb-5 md:grid-cols-[1fr_auto_1fr] md:items-end">
              <div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="rounded-none capitalize">
                    {data.edition.status}
                  </Badge>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {formatDate(data.edition.publishedAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Updated {formatTime(data.edition.updatedAt)}
                  </span>
                </div>
                <h2 className="mt-3 font-serif text-3xl font-black leading-none tracking-tight md:text-5xl">
                  {data.edition.title}
                </h2>
              </div>

              <div className="hidden h-20 w-px bg-ink/20 md:block" />

              <div className="md:text-right">
                {data.edition.subtitle && (
                  <p className="font-serif text-lg italic leading-snug text-muted-foreground">
                    {data.edition.subtitle}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                  <Badge variant="outline" className="rounded-none border-ink/30 bg-transparent font-mono">
                    {allStories.length} stories
                  </Badge>
                  <Badge variant="outline" className="rounded-none border-ink/30 bg-transparent font-mono">
                    {issueStats.sourceCount} sources
                  </Badge>
                  <Badge variant="outline" className="rounded-none border-ink/30 bg-transparent font-mono">
                    {issueStats.claimCount} checked claims
                  </Badge>
                </div>
              </div>
            </section>

            {leadStory && (
              <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
                  <StoryCard story={leadStory} playerRef={playerRef} variant="lead" />
                  <div className="space-y-5">
                    {secondaryStories.map((story) => (
                      <StoryCard
                        key={story.storyKey}
                        story={story}
                        playerRef={playerRef}
                        variant="compact"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4 lg:border-l lg:border-ink/25 lg:pl-6">
                  <EditionIndex stories={allStories} />
                  <ReceiptBar receipts={data.receipts} />
                  <div className="border border-ink/25 bg-white/35 p-4 text-xs leading-relaxed text-muted-foreground">
                    <p className="mb-2 font-black uppercase tracking-[0.2em]">Proof desk</p>
                    <p>
                      Every article links back to source receipts, fact-check verdicts, Mission Control traces, and audio chapter timing where available.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {remainingStories.length > 0 && (
              <>
                <div className="my-8 flex items-center gap-3">
                  <Separator className="flex-1 bg-ink/25" />
                  <span className="font-serif text-xl font-black uppercase tracking-wide">More from this edition</span>
                  <Separator className="flex-1 bg-ink/25" />
                </div>
                <section className="grid gap-x-6 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
                  {remainingStories.map((story) => (
                    <StoryCard
                      key={story.storyKey}
                      story={story}
                      playerRef={playerRef}
                      variant="standard"
                    />
                  ))}
                </section>
              </>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-3 border-t border-ink/25 pt-6">
              <Button variant="outline" size="sm" asChild className="rounded-none border-ink/30 bg-white/40">
                <Link to={`/editions/${data.edition.editionKey}`} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Permalink to this edition
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="rounded-none border-ink/30 bg-white/40">
                <Link to="/mission-control" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Mission Control
                </Link>
              </Button>
            </div>
          </>
        )}

        <footer className="mt-16 border-t border-ink/25 pt-6 text-center text-xs text-muted-foreground">
          <p>
            Overnight Newsroom &copy; {new Date().getFullYear()} &middot; Built while you sleep
          </p>
        </footer>
      </div>
    </div>
  );
}
