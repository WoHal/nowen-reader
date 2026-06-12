"use client";

import { useState, useEffect, useCallback } from "react";
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

export function LibraryManagementPanel() {
  const { user: currentUser } = useAuth();
  const [libraries, setLibraries] = useState<LibraryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 创建书库表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"comic" | "novel" | "mixed">("comic");
  const [newRootPath, setNewRootPath] = useState("");
  const [creating, setCreating] = useState(false);

  // 编辑书库
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"comic" | "novel" | "mixed">("comic");
  const [editRootPath, setEditRootPath] = useState("");
  const [editScanEnabled, setEditScanEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);

  // 确认删除
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Folder browser
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseTarget, setBrowseTarget] = useState<"create" | "edit">("create");

  // Additional fields
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

  // 创建书库
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

  // 开始编辑
  const startEdit = (lib: LibraryType) => {
    setEditingId(lib.id);
    setEditName(lib.name);
    setEditType(lib.type);
    setEditRootPath(lib.rootPath);
    setEditScanEnabled(lib.scanEnabled);
    setEditDefaultAccess(lib.defaultAccess || "private");
    setEditScanEnabledState(lib.scanEnabled);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
  };

  // 保存编辑
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

  // 切换启用状态
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

  // 删除书库
  const handleDelete = async (id: string) => {
    try {
      await deleteLibrary(id);
      showMessage("书库删除成功");
      setDeletingId(null);
      fetchLibraryList();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "删除失败", true);
    }
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "comic":
        return <Book className="h-4 w-4" />;
      case "novel":
        return <BookOpen className="h-4 w-4" />;
      case "mixed":
        return <Library className="h-4 w-4" />;
      default:
        return <Library className="h-4 w-4" />;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "未扫描";
    try { return new Date(date).toLocaleString("zh-CN"); } catch { return date; }
  };

  // 获取类型名称
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

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted">需要管理员权限</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6" />
            书库管理
          </h2>
          <p className="text-muted mt-1">
            管理漫画和小说书库，控制用户访问权限
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLibraryList}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card hover:bg-card/80 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            创建书库
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 text-green-500">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* 创建书库表单 */}
      {showCreateForm && (
        <div className="p-6 rounded-2xl bg-card border border-border">
          <h3 className="text-lg font-semibold mb-4">创建新书库</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                书库名称 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：家庭漫画"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                书库类型
              </label>
              <select
                value={newType}
                onChange={(e) =>
                  setNewType(e.target.value as "comic" | "novel" | "mixed")
                }
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="comic">漫画</option>
                <option value="novel">小说</option>
                <option value="mixed">混合</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                根目录路径 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={newRootPath}
                onChange={(e) => setNewRootPath(e.target.value)}
                placeholder="例如：/mnt/comics 或 D:\Comics"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {creating ? "创建中..." : "创建"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-lg bg-card hover:bg-card/80 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 书库列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
      ) : libraries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <Library className="h-12 w-12 mb-4" />
          <p>暂无书库</p>
          <p className="text-sm">点击"创建书库"添加第一个书库</p>
        </div>
      ) : (
        <div className="space-y-4">
          {libraries.map((lib) => (
            <div
              key={lib.id}
              className={`p-6 rounded-2xl bg-card border transition-all ${
                lib.enabled
                  ? "border-border"
                  : "border-border opacity-60"
              }`}
            >
              {editingId === lib.id ? (
                // 编辑模式
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        书库名称
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        书库类型
                      </label>
                      <select
                        value={editType}
                        onChange={(e) =>
                          setEditType(
                            e.target.value as "comic" | "novel" | "mixed"
                          )
                        }
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="comic">漫画</option>
                        <option value="novel">小说</option>
                        <option value="mixed">混合</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">
                        根目录路径
                      </label>
                      <input
                        type="text"
                        value={editRootPath}
                        onChange={(e) => setEditRootPath(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(lib.id)}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saving ? "保存中..." : "保存"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 rounded-lg bg-card hover:bg-card/80 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 显示模式
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      {getTypeIcon(lib.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{lib.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary">
                          {getTypeName(lib.type)}
                        </span>
                        {!lib.enabled && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {lib.rootPath}
                        </span>
                        <span>{lib.comicCount} 个内容</span>
                        <span>{lib.scanEnabled ? "自动扫描：开" : "自动扫描：关"}</span>
                        <span>上次扫描：{formatDate(lib.lastScanAt)}</span>
                        <span>上次新增：{lib.lastScanAdded}</span>
                        <span>上次文件数：{lib.lastScanTotal}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleScan(lib.id)}
                      disabled={scanningId === lib.id}
                      className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      title="立即扫描"
                    >
                      {scanningId === lib.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScanLine className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleEnabled(lib.id, lib.enabled)}
                      className={`p-2 rounded-lg transition-colors ${
                        lib.enabled
                          ? "text-green-500 hover:bg-green-500/10"
                          : "text-muted hover:bg-card"
                      }`}
                      title={lib.enabled ? "禁用书库" : "启用书库"}
                    >
                      {lib.enabled ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(lib)}
                      className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card transition-colors"
                      title="编辑"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    {deletingId === lib.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(lib.id)}
                          className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors"
                        >
                          确认删除
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1.5 rounded-lg bg-card text-sm hover:bg-card/80 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(lib.id)}
                        className="p-2 rounded-lg text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Folder Browser */}
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