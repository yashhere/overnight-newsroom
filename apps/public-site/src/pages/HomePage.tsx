import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, Newspaper, Calendar, Clock, Radio } from "lucide-react";
import { useLatestEdition } from "@/hooks/useEditions";

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

/** Masthead shown at the top of every page. */
function Masthead() {
	return (
		<header className="mb-8 text-center">
			<h1 className="font-serif text-4xl font-bold tracking-tight md:text-5xl">
				Overnight Newsroom
			</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				Your overnight news briefing — built while you sleep
			</p>
		</header>
	);
}

/** Full-page skeleton while data is loading. */
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

/** Empty state when no edition has been published yet. */
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

/** A single story card with attribution. */
function StoryCard({
	title,
	summary,
	summaryBullets,
	canonicalPublisherName,
	canonicalPublisherUrl,
	sourceUrl,
	sourceName,
	receiptUrl,
}: {
	title: string;
	summary: string;
	summaryBullets?: string[] | null;
	canonicalPublisherName?: string | null;
	canonicalPublisherUrl?: string | null;
	sourceUrl?: string | null;
	sourceName?: string | null;
	receiptUrl?: string | null;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="font-serif text-xl leading-snug">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-base leading-relaxed text-foreground/85">
					{summary}
				</p>

				{summaryBullets && summaryBullets.length > 0 && (
					<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
						{summaryBullets.map((bullet, i) => (
							<li key={i}>{bullet}</li>
						))}
					</ul>
				)}

				{/* Attribution */}
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
					{(canonicalPublisherName || sourceName) && (
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span className="font-medium">Source:</span>
							{canonicalPublisherUrl ? (
								<a
									href={canonicalPublisherUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-foreground"
								>
									{canonicalPublisherName ?? canonicalPublisherUrl}
									<ExternalLink className="h-3 w-3" />
								</a>
							) : (
								<span>{canonicalPublisherName ?? sourceName}</span>
							)}
						</div>
					)}

					{sourceUrl && sourceUrl !== canonicalPublisherUrl && (
						<a
							href={sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
						>
							Original article
							<ExternalLink className="h-3 w-3" />
						</a>
					)}
				</div>

				{/* Media receipt placeholder */}
				{receiptUrl ? (
					<Alert>
						<Radio className="h-4 w-4" />
						<AlertTitle>Audio available</AlertTitle>
						<AlertDescription>
							<a
								href={receiptUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="underline decoration-dotted underline-offset-2 hover:text-foreground"
							>
								Listen to this story
							</a>
						</AlertDescription>
					</Alert>
				) : (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Radio className="h-3 w-3" />
						<span>Audio not yet available</span>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/** Receipt bar showing publication proof. */
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

export function HomePage() {
	const data = useLatestEdition();

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
			<Masthead />

			{data === undefined && <LoadingSkeleton />}

			{data === null && <EmptyState />}

			{data && (
				<>
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
					<div className="space-y-6">
						{data.stories.map((story) => (
							<StoryCard
								key={story.storyKey}
								title={story.title}
								summary={story.summary}
								summaryBullets={story.summaryBullets}
								canonicalPublisherName={story.canonicalPublisherName}
								canonicalPublisherUrl={story.canonicalPublisherUrl}
								sourceUrl={story.sourceUrl}
								sourceName={story.sourceName}
								receiptUrl={story.receiptUrl}
							/>
						))}
					</div>

					{/* Receipts */}
					<ReceiptBar receipts={data.receipts} />

					{/* Navigation footer */}
					<div className="mt-10 flex justify-center">
						<Button variant="outline" size="sm" asChild>
							<Link
								to={`/editions/${data.edition.editionKey}`}
								className="gap-1.5"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Permalink to this edition
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
