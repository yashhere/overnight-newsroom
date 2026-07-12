import { useParams, Link } from "react-router-dom";
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
	ArrowLeft,
	AlertTriangle,
} from "lucide-react";
import { useEditionByKey } from "@/hooks/useEditions";

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

export function EditionPage() {
	const { editionKey } = useParams<{ editionKey: string }>();
	const data = useEditionByKey(editionKey);

	return (
		<div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
			{/* Back link */}
			<div className="mb-6">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/" className="gap-1.5">
						<ArrowLeft className="h-4 w-4" />
						Back to latest edition
					</Link>
				</Button>
			</div>

			{/* Loading */}
			{data === undefined && (
				<div className="space-y-6">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-4 w-48" />
					<Separator className="my-6" />
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-3/4" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-3/4" />
						</CardContent>
					</Card>
				</div>
			)}

			{/* Not found */}
			{data === null && (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center gap-4 py-16">
						<AlertTriangle className="h-12 w-12 text-muted-foreground" />
						<div className="text-center">
							<p className="text-lg font-medium text-muted-foreground">
								Edition not found
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								The edition &ldquo;{editionKey}&rdquo; does not exist or has
								been archived.
							</p>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link to="/">View latest edition</Link>
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Edition data */}
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
								<span>Published {formatTime(data.edition.publishedAt)}</span>
							</div>
						</div>
						<h1 className="mt-3 font-serif text-3xl font-bold md:text-4xl">
							{data.edition.title}
						</h1>
						{data.edition.subtitle && (
							<p className="mt-1 text-muted-foreground">
								{data.edition.subtitle}
							</p>
						)}
						{data.edition.editionKey && (
							<p className="mt-2 font-mono text-xs text-muted-foreground">
								Edition: {data.edition.editionKey}
							</p>
						)}
					</div>

					<Separator className="my-6" />

					{/* Stories */}
					{data.stories.length === 0 && (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 py-12">
								<Newspaper className="h-10 w-10 text-muted-foreground" />
								<p className="text-muted-foreground">
									No stories in this edition.
								</p>
							</CardContent>
						</Card>
					)}

					<div className="space-y-6">
						{data.stories.map((story) => (
							<Card key={story.storyKey}>
								<CardHeader>
									<CardTitle className="font-serif text-xl leading-snug">
										{story.title}
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="text-base leading-relaxed text-foreground/85">
										{story.summary}
									</p>

									{story.summaryBullets && story.summaryBullets.length > 0 && (
										<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
											{story.summaryBullets.map((bullet, i) => (
												<li key={i}>{bullet}</li>
											))}
										</ul>
									)}

									{/* Attribution */}
									{(story.canonicalPublisherName || story.sourceName) && (
										<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
											{story.canonicalPublisherName && (
												<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
													<span className="font-medium">Source:</span>
													{story.canonicalPublisherUrl ? (
														<a
															href={story.canonicalPublisherUrl}
															target="_blank"
															rel="noopener noreferrer"
															className="flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-foreground"
														>
															{story.canonicalPublisherName}
															<ExternalLink className="h-3 w-3" />
														</a>
													) : (
														<span>{story.canonicalPublisherName}</span>
													)}
												</div>
											)}
											{story.sourceUrl &&
												story.sourceUrl !== story.canonicalPublisherUrl && (
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
									)}

									{/* Media receipt */}
									{story.receiptUrl ? (
										<Alert>
											<Radio className="h-4 w-4" />
											<AlertTitle>Audio available</AlertTitle>
											<AlertDescription>
												<a
													href={story.receiptUrl}
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
						))}
					</div>

					{/* Receipts */}
					{data.receipts && data.receipts.length > 0 && (
						<div className="mt-6 space-y-2">
							<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Publication Receipts
							</p>
							<div className="flex flex-wrap gap-2">
								{data.receipts.map((r, i) => (
									<Badge
										key={i}
										variant="outline"
										className="text-xs font-mono"
									>
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
					)}
				</>
			)}

			<footer className="mt-16 border-t pt-6 text-center text-xs text-muted-foreground">
				<p>Overnight Newsroom &copy; {new Date().getFullYear()}</p>
			</footer>
		</div>
	);
}
