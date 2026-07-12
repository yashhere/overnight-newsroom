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
} from "lucide-react";
import {
  useLatestEdition,
  useEditionByKey,
  usePublishedEditions,
  useNewsroomHealth,
  type EditionPayload,
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
    <header className="mb-8 text-center">
      <h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
        Overnight Newsroom
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your overnight news briefing — built while you sleep
      </p>

      {/* Status bar */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        {publishedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last publish: {formatRelative(publishedAt)}
          </span>
        )}
        {health && (
          <span
            className={`flex items-center gap-1 ${
              health.status === "healthy"
                ? "text-emerald-600"
                : health.status === "degraded"
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {health.status === "healthy" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : health.status === "degraded" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Info className="h-3 w-3" />
            )}
            Newsroom: {health.status}
            {health.recentErrorCount > 0 &&
              ` (${health.recentErrorCount} errors)`}
          </span>
        )}
        {health?.audioAvailable && (
          <span className="flex items-center gap-1 text-emerald-600">
            <Volume2 className="h-3 w-3" />
            Audio ready
          </span>
        )}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <Card>
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

// ═══════════════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16">
        <Newspaper className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
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
// Story Badges
// ═══════════════════════════════════════════════════════════════

function StoryBadges({ badges }: { badges?: string[] | null }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <Badge
          key={b}
          variant={badgeVariant(b)}
          className="flex items-center gap-1 text-[10px] capitalize"
        >
          {badgeIcon(b)}
          {b}
        </Badge>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Evidence Section (inlined in each story card)
// ═══════════════════════════════════════════════════════════════

function EvidenceSection({ story }: { story: EditionStory }) {
  const hasClaims = story.claims && story.claims.length > 0;
  const hasVerdicts = story.verdicts && story.verdicts.length > 0;
  if (!hasClaims && !hasVerdicts) return null;

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        Evidence &amp; Fact Check
      </div>

      {hasClaims && (
        <div className="space-y-1.5">
          {story.claims!.map((claim, i) => {
            const verdict = story.verdicts!.find(
              (v) => v.claimId === claim.claimId,
            );
            return (
              <div key={i} className="rounded bg-white px-2 py-1.5 text-xs">
                <div className="flex items-start gap-1.5">
                  <Quote className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{claim.claim}</p>
                    {claim.sourceLines.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Sources: {claim.sourceLines.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                {verdict && (
                  <div className="ml-4.5 mt-1 flex items-center gap-2 text-[10px]">
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
                      className="text-[9px]"
                    >
                      <Gavel className="mr-0.5 h-2.5 w-2.5" />
                      {verdict.verdict}
                    </Badge>
                    <span className="text-muted-foreground">
                      {verdict.reason}
                    </span>
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
}: {
  story: EditionStory;
  playerRef: React.RefObject<AudioPlayerHandle | null>;
}) {
  const handleListenFromHere = () => {
    if (story.audioSegment && playerRef.current) {
      playerRef.current.seekTo(story.audioSegment.offsetMs);
    }
  };

  return (
    <Card id={`story-${story.storyKey}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="font-serif text-xl leading-snug md:text-2xl">
              {story.title}
            </CardTitle>
          </div>

          {/* Audio controls */}
          {story.audioSegment && (
            <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleListenFromHere}
                className="h-8 gap-1.5 text-xs"
              >
                <Headphones className="h-3.5 w-3.5" />
                Listen from here
              </Button>
              <span className="text-[10px] text-muted-foreground">
                <Play className="mr-0.5 inline h-2.5 w-2.5" />
                {formatDurationSec(story.audioSegment.durationMs)}
                {" · "}anchor {story.audioSegment.anchor}
              </span>
            </div>
          )}
        </div>

        {/* Badges */}
        <StoryBadges badges={story.badges} />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <p className="text-base leading-relaxed text-foreground/85">
          {story.summary}
        </p>

        {/* Summary bullets */}
        {story.summaryBullets && story.summaryBullets.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {story.summaryBullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        )}

        {/* Attribution */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          {(story.canonicalPublisherName || story.sourceName) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium">Source:</span>
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

        {/* Publication / update times */}
        {story.createdAt && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Published {formatShortDate(story.createdAt)}</span>
          </div>
        )}

        {/* Evidence */}
        <EvidenceSection story={story} />

        {/* Media receipt */}
        {story.receiptUrl ? (
          <Alert>
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
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Receipt Bar
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
    <div className="mt-6 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Publication Receipts
      </p>
      <div className="flex flex-wrap gap-2">
        {receipts.map((r, i) => (
          <Badge key={i} variant="outline" className="text-xs font-mono">
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HomePage
// ═══════════════════════════════════════════════════════════════

export function HomePage() {
  const publishedEditions = usePublishedEditions();
  const [selectedEditionKey, setSelectedEditionKey] = useState<string | null>(null);

  // Use selected edition or fall back to latest
  const latestData = useLatestEdition();
  const selectedData = useEditionByKey(selectedEditionKey ?? undefined);
  const data = selectedEditionKey ? selectedData : latestData;
  const health = useNewsroomHealth();
  const playerRef = useRef<AudioPlayerHandle>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Masthead publishedAt={data?.edition.publishedAt} health={health} />

      {/* Edition selector */}
      {publishedEditions && publishedEditions.length > 1 && (
        <div className="mb-6 flex items-center justify-center gap-2">
          <select
            value={selectedEditionKey ?? ""}
            onChange={(e) => setSelectedEditionKey(e.target.value || null)}
            className="rounded border bg-white px-3 py-1.5 text-sm font-medium"
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
          {/* Sticky Audio Player */}
          {data.editionAudio && (
            <div className="sticky top-0 z-30 -mx-4 mb-6 px-4 pb-3 pt-1 backdrop-blur-sm md:-mx-0 md:px-0">
              <AudioPlayer
                ref={playerRef}
                fullAudioUrl={data.editionAudio.fullAudioUrl}
                totalDurationMs={data.editionAudio.totalDurationMs}
              />
            </div>
          )}

          {/* Edition header */}
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="capitalize">
                {data.edition.status}
              </Badge>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(data.edition.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Updated {formatTime(data.edition.updatedAt)}</span>
              </div>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-semibold md:text-3xl">
              {data.edition.title}
            </h2>
            {data.edition.subtitle && (
              <p className="mt-1 text-muted-foreground">
                {data.edition.subtitle}
              </p>
            )}
          </div>

          <Separator className="my-6" />

          {/* Stories */}
          <div className="space-y-8">
            {data.stories.map((story) => (
              <StoryCard
                key={story.storyKey}
                story={story}
                playerRef={playerRef}
              />
            ))}
          </div>

          {/* Receipts */}
          <ReceiptBar receipts={data.receipts} />

          {/* Navigation footer */}
          <div className="mt-10 flex justify-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`/editions/${data.edition.editionKey}`}
                className="gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Permalink to this edition
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/mission-control" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Mission Control
              </Link>
            </Button>
          </div>
        </>
      )}

      <footer className="mt-16 border-t pt-6 text-center text-xs text-muted-foreground">
        <p>
          Overnight Newsroom &copy; {new Date().getFullYear()} &middot; Built
          while you sleep
        </p>
      </footer>
    </div>
  );
}
