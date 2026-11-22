import type { DataColumn } from '@/components/ui/data-types';
import { OptionBadge, selectOption, UserChip } from '@/components/ui/field-values/shared';
import type { WorkspaceMemberProfileMap } from '@/lib/kylon/workspace-member-profiles';
import { resolveUserOption } from '@/lib/kylon/workspace-member-profiles';

/** One filter value rendered the way its column renders cells: a person chip or an option badge. */
export function DataTableFilterValue<TRow>({
  column,
  value,
  workspaceMembers,
}: {
  column: DataColumn<TRow>;
  value: string;
  workspaceMembers: WorkspaceMemberProfileMap;
}) {
  if (column.type === 'user' || column.type === 'multi_user') {
    return <UserChip user={resolveUserOption(column, value, workspaceMembers)} />;
  }
  return <OptionBadge option={selectOption(column, value)} />;
}
