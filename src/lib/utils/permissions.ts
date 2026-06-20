import { getCurrentUserTokenPayload } from "@/lib/utils/currentUser";

export type PermissionActions = Record<string, boolean | undefined>;
export type PermissionMap = Record<string, PermissionActions | undefined>;
export type ModuleAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type RoleLike = {
  name?: string | null;
  permissions?: unknown;
  Permissions?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const parsePermissions = (value: unknown): PermissionMap | null => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsePermissions(parsed);
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) return null;
  return value as PermissionMap;
};

export const getLoginPermissions = (): PermissionMap => {
  const payload = getCurrentUserTokenPayload() as Record<string, unknown> | null;
  if (!payload) return {};

  const directPermissions = parsePermissions(payload.permissions ?? payload.Permissions);
  if (directPermissions) return directPermissions;

  const user = payload.user;
  if (isRecord(user)) {
    const userPermissions = parsePermissions(user.permissions ?? user.Permissions);
    if (userPermissions) return userPermissions;
  }

  return {};
};

export const getLoginRoleNames = (): string[] => {
  const payload = getCurrentUserTokenPayload() as Record<string, unknown> | null;
  if (!payload) return [];

  const roleNames = new Set<string>();
  const addRole = (value: unknown) => {
    if (typeof value === "string" && value.trim()) roleNames.add(value.trim().toLowerCase());
  };

  addRole(payload.role);
  if (Array.isArray(payload.roles)) payload.roles.forEach(addRole);

  const user = payload.user;
  if (isRecord(user)) {
    addRole(user.role);
    if (Array.isArray(user.roles)) user.roles.forEach(addRole);
  }

  return Array.from(roleNames);
};

export const mergePermissions = (...permissionMaps: Array<PermissionMap | null | undefined>): PermissionMap => {
  const merged: PermissionMap = {};

  for (const permissionMap of permissionMaps) {
    if (!permissionMap) continue;

    for (const [moduleKey, actions] of Object.entries(permissionMap)) {
      if (!actions) continue;
      merged[moduleKey] = {
        ...(merged[moduleKey] ?? {}),
        ...actions,
      };
    }
  }

  return merged;
};

export const getPermissionsFromRoles = (roles: RoleLike[] | undefined, roleNames: string[]): PermissionMap => {
  if (!roles?.length || !roleNames.length) return {};

  const wanted = new Set(roleNames.map((name) => name.trim().toLowerCase()).filter(Boolean));
  const matchedPermissions = roles
    .filter((role) => typeof role.name === "string" && wanted.has(role.name.trim().toLowerCase()))
    .map((role) => parsePermissions(role.permissions ?? role.Permissions));

  return mergePermissions(...matchedPermissions);
};

export const hasAnyPermission = (permissions: PermissionMap): boolean => Object.keys(permissions).length > 0;

export const hasPermission = (permissions: PermissionMap, moduleKeys: string[], action: string): boolean =>
  moduleKeys.some((moduleKey) => permissions[moduleKey]?.[action] === true);

export const getModuleAccess = (permissions: PermissionMap, moduleKeys: string[]): ModuleAccess => ({
  canCreate: hasPermission(permissions, moduleKeys, "create"),
  canUpdate: hasPermission(permissions, moduleKeys, "update"),
  canDelete: hasPermission(permissions, moduleKeys, "delete"),
});
