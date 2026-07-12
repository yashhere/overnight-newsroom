import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Secret check — mutations need the INGESTION_API_SECRET.
// Queries are public (no authentication) — the public page reads them.
// ---------------------------------------------------------------------------
function checkSecret(secret: string) {
	if (secret !== process.env.INGESTION_API_SECRET) {
		throw new Error("Unauthorized: invalid INGESTION_API_SECRET");
	}
}

// ---------------------------------------------------------------------------
// upsertEdition
//
// Idempotent: same editionKey → update existing. Different key → create new.
// Deletes old stories first, then inserts the current set.
// ---------------------------------------------------------------------------
export const upsertEdition = mutation({
	args: {
		secret: v.string(),
		editionKey: v.string(),
		title: v.string(),
		subtitle: v.optional(v.string()),
		status: v.union(
			v.literal("draft"),
			v.literal("published"),
			v.literal("archived"),
		),
		publishedAt: v.optional(v.number()),
		stories: v.array(
			v.object({
				storyKey: v.string(),
				clusterId: v.optional(v.id("storyClusters")),
				title: v.string(),
				summary: v.string(),
				summaryBullets: v.optional(v.array(v.string())),
				canonicalPublisherName: v.optional(v.string()),
				canonicalPublisherUrl: v.optional(v.string()),
				sourceUrl: v.optional(v.string()),
				sourceName: v.optional(v.string()),
				receiptUrl: v.optional(v.string()),
				sortOrder: v.number(),
			}),
		),
	},
	handler: async (ctx, args) => {
		checkSecret(args.secret);

		const now = Date.now();

		// Upsert edition by editionKey
		const existing = await ctx.db
			.query("editions")
			.withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
			.take(1);

		let editionId: Id<"editions">;

		if (existing.length > 0) {
			editionId = existing[0]._id;
			await ctx.db.patch(editionId, {
				title: args.title,
				subtitle: args.subtitle,
				status: args.status,
				publishedAt: args.publishedAt ?? existing[0].publishedAt,
				updatedAt: now,
			});

			// Delete old stories for this edition (re-insert below)
			const oldStories = await ctx.db
				.query("editionStories")
				.withIndex("by_editionId_sortOrder", (q) =>
					q.eq("editionId", editionId),
				)
				.collect();

			await Promise.all(oldStories.map((s) => ctx.db.delete(s._id)));
		} else {
			editionId = await ctx.db.insert("editions", {
				editionKey: args.editionKey,
				title: args.title,
				subtitle: args.subtitle,
				status: args.status,
				publishedAt: args.publishedAt,
				createdAt: now,
				updatedAt: now,
			});
		}

		// Insert new stories
		for (const story of args.stories) {
			await ctx.db.insert("editionStories", {
				editionId,
				clusterId: story.clusterId,
				storyKey: story.storyKey,
				title: story.title,
				summary: story.summary,
				summaryBullets: story.summaryBullets,
				canonicalPublisherName: story.canonicalPublisherName,
				canonicalPublisherUrl: story.canonicalPublisherUrl,
				sourceUrl: story.sourceUrl,
				sourceName: story.sourceName,
				receiptUrl: story.receiptUrl,
				sortOrder: story.sortOrder,
				createdAt: now,
			});
		}

		return { editionId: editionId.toString(), editionKey: args.editionKey };
	},
});

// ---------------------------------------------------------------------------
// addPublicationReceipt
// ---------------------------------------------------------------------------
export const addPublicationReceipt = mutation({
	args: {
		secret: v.string(),
		editionKey: v.string(),
		receiptType: v.union(
			v.literal("deploy"),
			v.literal("publish"),
			v.literal("media"),
		),
		receiptUrl: v.optional(v.string()),
		status: v.string(),
		metadata: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		checkSecret(args.secret);

		const editions = await ctx.db
			.query("editions")
			.withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
			.take(1);

		if (editions.length === 0) {
			throw new Error(`Edition not found: ${args.editionKey}`);
		}

		const now = Date.now();

		// Idempotent: upsert by editionKey + receiptType
		const existing = await ctx.db
			.query("publicationReceipts")
			.withIndex("by_editionKey_receiptType", (q) =>
				q.eq("editionKey", args.editionKey).eq("receiptType", args.receiptType),
			)
			.take(1);

		if (existing.length > 0) {
			await ctx.db.patch(existing[0]._id, {
				receiptUrl: args.receiptUrl,
				status: args.status,
				metadata: args.metadata,
			});
		} else {
			await ctx.db.insert("publicationReceipts", {
				editionId: editions[0]._id,
				editionKey: args.editionKey,
				receiptType: args.receiptType,
				receiptUrl: args.receiptUrl,
				status: args.status,
				metadata: args.metadata,
				createdAt: now,
			});
		}

		return { status: "ok" };
	},
});

// ---------------------------------------------------------------------------
// latestEdition — public query, no authentication
// ---------------------------------------------------------------------------
export const latestEdition = query({
	args: {},
	handler: async (ctx) => {
		const edition = await ctx.db
			.query("editions")
			.withIndex("by_status_publishedAt", (q) => q.eq("status", "published"))
			.order("desc")
			.first();

		if (!edition) return null;

		const stories = await ctx.db
			.query("editionStories")
			.withIndex("by_editionId_sortOrder", (q) =>
				q.eq("editionId", edition._id),
			)
			.order("asc")
			.collect();

		const receipts = await ctx.db
			.query("publicationReceipts")
			.withIndex("by_editionId", (q) => q.eq("editionId", edition._id))
			.collect();

		return {
			edition: {
				editionKey: edition.editionKey,
				title: edition.title,
				subtitle: edition.subtitle,
				status: edition.status,
				publishedAt: edition.publishedAt,
				updatedAt: edition.updatedAt,
			},
			stories: stories.map((s) => ({
				storyKey: s.storyKey,
				title: s.title,
				summary: s.summary,
				summaryBullets: s.summaryBullets,
				canonicalPublisherName: s.canonicalPublisherName,
				canonicalPublisherUrl: s.canonicalPublisherUrl,
				sourceUrl: s.sourceUrl,
				sourceName: s.sourceName,
				receiptUrl: s.receiptUrl,
				sortOrder: s.sortOrder,
			})),
			receipts: receipts.map((r) => ({
				receiptType: r.receiptType,
				receiptUrl: r.receiptUrl,
				status: r.status,
				metadata: r.metadata,
				createdAt: r.createdAt,
			})),
		};
	},
});

// ---------------------------------------------------------------------------
// getEditionByKey — public query, no authentication.
// Only returns published editions; draft/archived are invisible publicly.
// ---------------------------------------------------------------------------
export const getEditionByKey = query({
	args: { editionKey: v.string() },
	handler: async (ctx, args) => {
		const editions = await ctx.db
			.query("editions")
			.withIndex("by_editionKey", (q) => q.eq("editionKey", args.editionKey))
			.take(1);

		if (editions.length === 0) return null;

		const edition = editions[0];

		// Only expose published editions on the public page
		if (edition.status !== "published") return null;

		const stories = await ctx.db
			.query("editionStories")
			.withIndex("by_editionId_sortOrder", (q) =>
				q.eq("editionId", edition._id),
			)
			.order("asc")
			.collect();

		const receipts = await ctx.db
			.query("publicationReceipts")
			.withIndex("by_editionId", (q) => q.eq("editionId", edition._id))
			.collect();

		return {
			edition: {
				editionKey: edition.editionKey,
				title: edition.title,
				subtitle: edition.subtitle,
				status: edition.status,
				publishedAt: edition.publishedAt,
				updatedAt: edition.updatedAt,
			},
			stories: stories.map((s) => ({
				storyKey: s.storyKey,
				title: s.title,
				summary: s.summary,
				summaryBullets: s.summaryBullets,
				canonicalPublisherName: s.canonicalPublisherName,
				canonicalPublisherUrl: s.canonicalPublisherUrl,
				sourceUrl: s.sourceUrl,
				sourceName: s.sourceName,
				receiptUrl: s.receiptUrl,
				sortOrder: s.sortOrder,
			})),
			receipts: receipts.map((r) => ({
				receiptType: r.receiptType,
				receiptUrl: r.receiptUrl,
				status: r.status,
				metadata: r.metadata,
				createdAt: r.createdAt,
			})),
		};
	},
});
