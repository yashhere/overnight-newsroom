import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";

export type MissionControlPayload = FunctionReturnType<
  typeof api.missionControl.getMissionControl
>;
export type MissionControlAgent =
  NonNullable<MissionControlPayload>["agents"][number];
export type MissionControlStory =
  NonNullable<MissionControlPayload>["storyBoard"][string][number];
export type MissionControlEvent =
  NonNullable<MissionControlPayload>["events"][number];
export type MissionControlStats =
  NonNullable<MissionControlPayload>["stats"];

export type RoleTraceNode = NonNullable<
  FunctionReturnType<typeof api.missionControl.getRoleTrace>
>[number];

export type EditionSelectorItem = NonNullable<
  FunctionReturnType<typeof api.missionControl.getEditionsForSelector>
>[number];

/** Live mission control data for a selected edition. */
export function useMissionControl(editionKey: string | undefined) {
  return useQuery(
    api.missionControl.getMissionControl,
    editionKey ? { editionKey } : "skip",
  );
}

/** All editions for the top-bar selector dropdown. */
export function useEditionsSelector() {
  return useQuery(api.missionControl.getEditionsForSelector, {});
}

/** Trace tree for a specific role (detail drawer). */
export function useRoleTrace(
  editionKey: string | undefined,
  roleId: string | undefined,
) {
  return useQuery(
    api.missionControl.getRoleTrace,
    editionKey && roleId ? { editionKey, roleId } : "skip",
  );
}
