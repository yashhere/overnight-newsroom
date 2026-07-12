import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";

export type EditionPayload = FunctionReturnType<
  typeof api.public.latestEdition
>;

export type EditionStory = NonNullable<EditionPayload>["stories"][number];

export type EditionAudio = NonNullable<EditionPayload>["editionAudio"];

export type NewsroomHealth = NonNullable<EditionPayload>["health"];

export type EditionReceipt = NonNullable<EditionPayload>["receipts"][number];

export function useLatestEdition() {
  return useQuery(api.public.latestEdition, {});
}

export function useEditionByKey(editionKey: string | undefined) {
  return useQuery(
    api.public.getEditionByKey,
    editionKey ? { editionKey } : "skip",
  );
}

export function useNewsroomHealth() {
  return useQuery(api.public.getNewsroomHealth, {});
}
