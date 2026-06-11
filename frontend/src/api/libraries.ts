/**
 * 书库管理 API
 * 对应后端 /api/admin/libraries/*
 */

// ============================================================
// 类型定义
// ============================================================

export interface Library {
  id: string;
  name: string;
  type: "comic" | "novel" | "mixed";
  rootPath: string;
  enabled: boolean;
  sortOrder: number;
  defaultAccess: "public" | "private";
  createdAt: string;
  updatedAt: string;
  comicCount: number;
}

export interface UserLibraryAccess {
  libraryId: string;
  canView: boolean;
  canDownload: boolean;
  canManage: boolean;
}

// ============================================================
// API 函数
// ============================================================

async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// 获取所有书库
export async function fetchLibraries(): Promise<Library[]> {
  const res = await fetch("/api/admin/libraries");
  const data = await safeJson<{ libraries: Library[] }>(res);
  return data.libraries || [];
}

// 创建书库
export async function createLibrary(library: {
  name: string;
  type: "comic" | "novel" | "mixed";
  rootPath: string;
  enabled?: boolean;
  sortOrder?: number;
  defaultAccess?: "public" | "private";
}): Promise<Library> {
  const res = await fetch("/api/admin/libraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(library),
  });
  const data = await safeJson<{ library: Library }>(res);
  return data.library;
}

// 更新书库
export async function updateLibrary(
  id: string,
  updates: Partial<{
    name: string;
    type: "comic" | "novel" | "mixed";
    rootPath: string;
    enabled: boolean;
    sortOrder: number;
    defaultAccess: "public" | "private";
  }>
): Promise<Library> {
  const res = await fetch(`/api/admin/libraries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await safeJson<{ library: Library }>(res);
  return data.library;
}

// 删除书库
export async function deleteLibrary(id: string): Promise<void> {
  const res = await fetch(`/api/admin/libraries/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}

// 获取用户的书库访问权限
export async function fetchUserLibraryAccess(userId: string): Promise<{
  userId: string;
  libraries: Array<Library & { canView: boolean }>;
}> {
  const res = await fetch(`/api/admin/users/${userId}/library-access`);
  return safeJson(res);
}

// 设置用户的书库访问权限
export async function setUserLibraryAccess(
  userId: string,
  libraryIds: string[]
): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}/library-access`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ libraryIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
}
