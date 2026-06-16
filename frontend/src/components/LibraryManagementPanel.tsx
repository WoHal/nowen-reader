"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Library,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  BookOpen,
  Book,
  ToggleLeft,
  ToggleRight,
  ScanLine,
  MoreHorizontal,
  Search,
  Database,
  Activity,
  ShieldAlert,
  Copy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchLibraries,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  scanLibrary,
  type Library as LibraryType,
} from "@/api/libraries";
import { FolderBrowser } from "@/components/FolderBrowser";

type NormalizedStatus = "scan-on" | "scan-off" | "access-public" | "access-private" | "last-scanned" | "last-unscanned" | "enabled" | "disabled";

const statusConfig: Record<NormalizedStatus, { label: string; className: string }> = {
  "scan-on": { label: "自动扫描", className: "bg-emerald-50 text-emerald-700 border border-emerald-200/70" },
  "scan-off": { label: "手动扫描", className: "bg-slate-50 text-slate-600 border border-slate-200/70" },
  "access-public": { label: "公开访问", className: "bg-sky-50 text-sky-700 border border-sky-200/70" },
  "access-private": { label: "私有访问", className: "bg-slate-50 text-slate-600 border border-slate-200/70" },
  "last-scanned": { label: "已扫描", className: "bg-indigo-50 text-indigo-700 border border-indigo-200/70" },
  "last-unscanned": { label: "未扫描", className: "bg-amber-50 text-amber-700 border border-amber-200/70" },
  enabled: { label: "启用", className: "bg-emerald-50 text-emerald-700 border border-emerald-200/70" },
  disabled: { label: "已禁用", className: "bg-rose-50 text-rose-700 border border-rose-200/70" },
};

function StatusChip({ status }: { status: NormalizedStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function VaultCardShell({ active, disabled, children }: { active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[20px] border bg-white/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? "border-indigo-200/80 ring-1 ring-indigo-100"
          : "border-slate-200/70"
      } ${disabled ? "opacity-70" : ""}`}
    >
      <div className="pointer-events-none absolute inset-x-8 -top-20 h-40 rounded-full bg-indigo-100/40 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {children}
    </div>
  );
}

function VaultMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function InlineButton({ variant = "ghost", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "soft" | "primary" | "danger" }) {
  const base = "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors disabled:opacity-50";
  const map = {
    ghost: "text-slate-600 hover:bg-slate-100",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
  } as const;
  return <button className={`${base} ${map[variant]} ${className}`} {...props} />;
}

function MoreMenu({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute right-3 top-3 z-20">
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
export function LibraryManagementPanel() {
  const { user: currentUser } = useAuth();
  const [libraries, setLibraries] = useState<LibraryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"comic" | "novel" | "mixed">("comic");
  const [newRootPath, setNewRootPath] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"comic" | "novel" | "mixed">("comic");
  const [editRootPath, setEditRootPath] = useState("");
  const [editScanEnabled, setEditScanEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const [deletingTarget, setDeletingTarget] = useState<LibraryType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseTarget, setBrowseTarget] = useState<"create" | "edit">("create");

  const [newDefaultAccess, setNewDefaultAccess] = useState<"public" | "private">("private");
  const [newScanEnabled, setNewScanEnabled] = useState(true);
  const [editDefaultAccess, setEditDefaultAccess] = useState<"public" | "private">("private");
  const [editScanEnabledState, setEditScanEnabledState] = useState(true);

  const showMessage = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccess("");
    } else {
      setSuccess(msg);
      setError("");
    }
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
  }, []);

  const fetchLibraryList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchLibraries();
      setLibraries(data);
    } catch {
      showMessage("获取书库列表失败", true);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchLibraryList();
  }, [fetchLibraryList]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  const filteredLibraries = useMemo(() => {
    if (!searchQuery.trim()) return libraries;
    const q = searchQuery.toLowerCase();
    return libraries.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.rootPath.toLowerCase().includes(q)
    );
  }, [libraries, searchQuery]);

  const summary = useMemo(() => {
    return {
      total: libraries.length,
      content: libraries.reduce((sum, item) => sum + (item.comicCount ?? 0), 0),
      scanEnabledCount: libraries.filter((item) => item.scanEnabled).length,
      alerts: libraries.filter((item) => !item.enabled || !item.lastScanAt).length,
    };
  }, [libraries]);

  const handleCreate = async () => {
    if (!newName.trim() || !newRootPath.trim()) {
      showMessage("名称和路径不能为空", true);
      return;
    }

    setCreating(true);
    try {
      await createLibrary({
        name: newName.trim(),
        type: newType,
        rootPath: newRootPath.trim(),
        defaultAccess: newDefaultAccess,
      });
      showMessage("书库创建成功");
      setShowCreateForm(false);
      setNewName("");
      setNewRootPath("");
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "创建失败", true);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (lib: LibraryType) => {
    setEditingId(lib.id);
    setEditName(lib.name);
    setEditType(lib.type);
    setEditRootPath(lib.rootPath);
    setEditScanEnabled(lib.scanEnabled);
    setEditDefaultAccess(lib.defaultAccess || "private");
    setEditScanEnabledState(lib.scanEnabled);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = async (id: string) => {
    if (!editName.trim() || !editRootPath.trim()) {
      showMessage("名称和路径不能为空", true);
      return;
    }

    setSaving(true);
    try {
      await updateLibrary(id, {
        name: editName.trim(),
        type: editType,
        rootPath: editRootPath.trim(),
        scanEnabled: editScanEnabled,
        defaultAccess: editDefaultAccess,
        enabled: editScanEnabledState,
      });
      showMessage("书库更新成功");
      setEditingId(null);
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "更新失败", true);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateLibrary(id, { enabled: !enabled });
      showMessage(enabled ? "书库已禁用" : "书库已启用");
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "更新失败", true);
    }
  };

  const handleScan = async (id: string) => {
    try {
      setScanningId(id);
      const result = await scanLibrary(id);
      showMessage(`扫描完成，新增 ${result.added} 个内容`);
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "扫描失败", true);
    } finally {
      setScanningId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingTarget) return;
    try {
      setDeleting(true);
      await deleteLibrary(deletingTarget.id);
      showMessage("书库已从管理中心移除");
      setDeletingTarget(null);
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "删除失败", true);
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "comic":
        return <Book className="h-5 w-5" />;
      case "novel":
        return <BookOpen className="h-5 w-5" />;
      case "mixed":
        return <Library className="h-5 w-5" />;
      default:
        return <Library className="h-5 w-5" />;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "未扫描";
    try { return new Date(date).toLocaleString("zh-CN"); } catch { return date; }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "comic":
        return "漫画";
      case "novel":
        return "小说";
      case "mixed":
        return "混合";
      default:
        return type;
    }
  };

  const getStatuses = (lib: LibraryType): NormalizedStatus[] => {
    const statuses: NormalizedStatus[] = [];
    statuses.push(lib.scanEnabled ? "scan-on" : "scan-off");
    statuses.push((lib.defaultAccess || "private") === "public" ? "access-public" : "access-private");
    statuses.push(lib.lastScanAt ? "last-scanned" : "last-unscanned");
    statuses.push(lib.enabled ? "enabled" : "disabled");
    return statuses;
  };

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">需要管理员权限</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VaultCardShell>
        <div className="relative rounded-[20px] bg-gradient-to-br from-slate-50 to-indigo-50/40 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-500">
                <Library className="h-4 w-4" />
                Library Vault
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">书库管理</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                管理你的私人藏书空间、扫描规则与访问权限，保持书库整洁有序。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索书库名称、类型、路径"
                  className="w-56 rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <InlineButton variant="ghost" onClick={fetchLibraryList}>
                <RefreshCw className="h-4 w-4" /> 刷新
              </InlineButton>
              <InlineButton variant="soft" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" /> 创建书库
              </InlineButton>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <VaultMetric icon={<Database className="h-4 w-4" />} label="书库数量" value={summary.total} />
            <VaultMetric icon={<BookOpen className="h-4 w-4" />} label="总内容" value={summary.content} />
            <VaultMetric icon={<Activity className="h-4 w-4" />} label="自动扫描" value={`${summary.scanEnabledCount} 个开启`} />
            <VaultMetric icon={<ShieldAlert className="h-4 w-4" />} label="待关注" value={`${summary.alerts} 项`} />
          </div>
        </div>
      </VaultCardShell>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {showCreateForm && (
        <VaultCardShell active>
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">创建新书库</h3>
                <p className="mt-1 text-sm text-slate-500">新建一个独立藏书空间，设置目录与默认访问范围。</p>
              </div>
              <button onClick={() => setShowCreateForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-600">
                  书库名称 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：家庭漫画"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">书库类型</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "comic" | "novel" | "mixed")}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="comic">漫画</option>
                  <option value="novel">小说</option>
                  <option value="mixed">混合</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600">默认访问</label>
                <select
                  value={newDefaultAccess}
                  onChange={(e) => setNewDefaultAccess(e.target.value as "public" | "private")}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="private">私有</option>
                  <option value="public">公开</option>
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={newScanEnabled}
                    onChange={(e) => setNewScanEnabled(e.target.checked)}
                  />
                  创建后自动扫描
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600">
                  根目录路径 <span className="text-rose-500">*</span>
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newRootPath}
                    onChange={(e) => setNewRootPath(e.target.value)}
                    placeholder="例如：/mnt/comics 或 D:\Comics"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <InlineButton variant="ghost" type="button" onClick={() => { setBrowseTarget("create"); setBrowseOpen(true); }}>
                    <FolderOpen className="h-4 w-4" /> 浏览
                  </InlineButton>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <InlineButton variant="primary" onClick={handleCreate} disabled={creating}>
                {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {creating ? "创建中..." : "创建书库"}
              </InlineButton>
              <InlineButton variant="ghost" onClick={() => setShowCreateForm(false)}>取消</InlineButton>
            </div>
          </div>
        </VaultCardShell>
      )}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-[20px] border border-slate-200/70 bg-white/70" />
          ))}
        </div>
      ) : filteredLibraries.length === 0 ? (
        <VaultCardShell>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Library className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">还没有书库</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">创建第一个书库，把漫画、小说或混合内容集中到专属藏书空间。</p>
            <div className="mt-5">
              <InlineButton variant="soft" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" /> 创建第一个书库
              </InlineButton>
            </div>
          </div>
        </VaultCardShell>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredLibraries.map((lib) => {
            const statuses = getStatuses(lib);
            return (
              <VaultCardShell key={lib.id} active={editingId === lib.id} disabled={!lib.enabled}>
                <MoreMenu>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((prev) => (prev === lib.id ? null : lib.id));
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openMenuId === lib.id && (
                    <div className="absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          handleScan(lib.id);
                        }}
                      >
                        <ScanLine className="h-4 w-4" /> 立即扫描
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          navigator.clipboard.writeText(lib.rootPath);
                          showMessage("已复制书库路径");
                        }}
                      >
                        <Copy className="h-4 w-4" /> 复制路径
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          toggleEnabled(lib.id, lib.enabled);
                        }}
                      >
                        {lib.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        {lib.enabled ? "禁用书库" : "启用书库"}
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          startEdit(lib);
                        }}
                      >
                        <Edit className="h-4 w-4" /> 编辑书库
                      </button>
                      <div className="my-1 h-px bg-slate-100" />
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setDeletingTarget(lib);
                        }}
                      >
                        <Trash2 className="h-4 w-4" /> 删除书库
                      </button>
                    </div>
                  )}
                </MoreMenu>

                {editingId === lib.id ? (
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">编辑书库</h3>
                        <p className="mt-1 text-sm text-slate-500">调整书库名称、目录或扫描设置。</p>
                      </div>
                      <button onClick={cancelEdit} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-600">
                          书库名称 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600">书库类型</label>
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as "comic" | "novel" | "mixed")}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="comic">漫画</option>
                          <option value="novel">小说</option>
                          <option value="mixed">混合</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600">默认访问</label>
                        <select
                          value={editDefaultAccess}
                          onChange={(e) => setEditDefaultAccess(e.target.value as "public" | "private")}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="private">私有</option>
                          <option value="public">公开</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            checked={editScanEnabled}
                            onChange={(e) => setEditScanEnabled(e.target.checked)}
                          />
                          自动扫描
                        </label>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-600">
                          根目录路径 <span className="text-rose-500">*</span>
                        </label>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={editRootPath}
                            onChange={(e) => setEditRootPath(e.target.value)}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                          <InlineButton variant="ghost" type="button" onClick={() => { setBrowseTarget("edit"); setBrowseOpen(true); }}>
                            <FolderOpen className="h-4 w-4" /> 浏览
                          </InlineButton>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <InlineButton variant="primary" onClick={() => handleSave(lib.id)} disabled={saving}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? "保存中..." : "保存修改"}
                      </InlineButton>
                      <InlineButton variant="ghost" onClick={cancelEdit}>取消</InlineButton>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-sky-50 text-indigo-600">
                        {getTypeIcon(lib.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-slate-900">{lib.name}</h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {getTypeName(lib.type)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span className="truncate">{lib.rootPath}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <StatusChip key={status} status={status} />
                      ))}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
                        <div className="text-xs text-slate-400">内容数</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{lib.comicCount ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
                        <div className="text-xs text-slate-400">上次扫描</div>
                        <div className="mt-1 font-medium text-slate-800">{formatDate(lib.lastScanAt)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
                        <div className="text-xs text-slate-400">上次新增</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{lib.lastScanAdded ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3">
                        <div className="text-xs text-slate-400">文件数</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{lib.lastScanTotal ?? 0}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <InlineButton variant="soft" onClick={() => handleScan(lib.id)} disabled={scanningId === lib.id}>
                        {scanningId === lib.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                        立即扫描
                      </InlineButton>
                      <InlineButton variant="ghost" onClick={() => startEdit(lib)}>
                        <Edit className="h-4 w-4" /> 编辑
                      </InlineButton>
                      <InlineButton variant="ghost" onClick={() => toggleEnabled(lib.id, lib.enabled)}>
                        {lib.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        {lib.enabled ? "禁用" : "启用"}
                      </InlineButton>
                    </div>
                  </div>
                )}
              </VaultCardShell>
            );
          })}
        </div>
      )}
      {deletingTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!deleting) setDeletingTarget(null); }} />
          <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">删除书库？</h3>
              <button
                disabled={deleting}
                onClick={() => setDeletingTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-slate-600">
              <p>
                即将从管理中心移除 <span className="font-semibold text-slate-900">{deletingTarget.name}</span>。
              </p>
              <p>
                该操作仅移除书库记录，不会删除本地文件。若需彻底清理，请在服务器文件系统中手动处理。
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <InlineButton variant="ghost" disabled={deleting} onClick={() => setDeletingTarget(null)}>取消</InlineButton>
              <InlineButton variant="danger" disabled={deleting} onClick={handleDelete}>
                {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                确认删除
              </InlineButton>
            </div>
          </div>
        </div>
      )}

      <FolderBrowser
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        onSelect={(path) => {
          if (browseTarget === "create") {
            setNewRootPath(path);
          } else {
            setEditRootPath(path);
          }
        }}
      />
    </div>
  );
}
