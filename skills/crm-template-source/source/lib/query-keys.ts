export type QueryParams = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

export const queryKeys = {
  workspaceMembers: () => ["workspace", "members"] as const,
};
