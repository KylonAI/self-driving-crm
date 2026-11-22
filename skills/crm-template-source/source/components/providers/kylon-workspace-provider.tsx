"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { KylonWorkspaceContext } from "@/lib/kylon/bridge";
import {
  normalizeWorkspaceMemberProfiles,
  type WorkspaceMemberProfile,
  type WorkspaceMemberProfileMap,
} from "@/lib/kylon/workspace-member-profiles";
import { queryKeys } from "@/lib/query-keys";

const EMPTY_MEMBER_MAP: WorkspaceMemberProfileMap = new Map();
const KylonWorkspaceContextValue = createContext<KylonWorkspaceContext | null>(null);
const WorkspaceMemberProfilesContext =
  createContext<WorkspaceMemberProfileMap>(EMPTY_MEMBER_MAP);

async function fetchWorkspaceMembers(signal: AbortSignal): Promise<WorkspaceMemberProfile[]> {
  const response = await fetch("/api/kylon/workspace-members", {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (response.status === 401 || response.status === 403) return [];
  if (!response.ok) {
    throw new Error(`Failed to load workspace members: ${response.status}`);
  }
  return normalizeWorkspaceMemberProfiles(await response.json());
}

export function useWorkspaceMembers() {
  return useQuery({
    queryKey: queryKeys.workspaceMembers(),
    queryFn: ({ signal }) => fetchWorkspaceMembers(signal),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}

export function KylonWorkspaceProvider({
  value,
  children,
}: {
  value: KylonWorkspaceContext | null;
  children: ReactNode;
}) {
  const { data = [], isError } = useWorkspaceMembers();
  const membersById = useMemo<WorkspaceMemberProfileMap>(() => {
    if (isError || data.length === 0) return EMPTY_MEMBER_MAP;
    return new Map(data.map((member) => [member.userId, member]));
  }, [data, isError]);

  return (
    <KylonWorkspaceContextValue.Provider value={value}>
      <WorkspaceMemberProfilesContext.Provider value={membersById}>
        {children}
      </WorkspaceMemberProfilesContext.Provider>
    </KylonWorkspaceContextValue.Provider>
  );
}

export function useKylonWorkspaceContext() {
  return useContext(KylonWorkspaceContextValue);
}

export function useWorkspaceMemberProfiles() {
  return useContext(WorkspaceMemberProfilesContext);
}
