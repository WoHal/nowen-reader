"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Crown,
  UserPlus,
  Trash2,
  Shield,
  ShieldOff,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  Eye,
  EyeOff,
  Globe,
  Lock,
  UserX,
  Brain,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface UserItem {
  id: string;
  username: string;
  nickname: string;
  role: string;
  aiEnabled: boolean;
}

type RegistrationMode = "open" | "invite" | "closed";

const REG_MODE_OPTIONS: { value: RegistrationMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: "open", label: "开放注册", desc: "任何人都可以自行注册", icon: <Globe className="h-4 w-4" /> },
  { value: "invite", label: "邀请制", desc: "仅管理员可以创建新用户", icon: <UserPlus className="h-4 w-4" /> },
  { value: "closed", label: "关闭注册", desc: "不再允许新用户加入", icon: <Lock className="h-4 w-4" /> },
];

export function UserManagementPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 注册策略
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("open");
  const [savingMode, setSavingMode] = useState(false);

  // 创建用户表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // 确认删除
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMessage = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccess("");
    } else {
      setSuccess(msg);
      setError("");
    }
    setTimeout(() => { setError(""); setSuccess(""); }, 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showMessage("获取用户列表失败", true);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/site-settings");
      if (!res.ok) return;
      const data = await res.json();
      if (data.registrationMode) {
        setRegistrationMode(data.registrationMode);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, [fetchUsers, fetchSettings]);

  // 更新注册策略
  const updateRegistrationMode = async (mode: RegistrationMode) => {
    setSavingMode(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationMode: mode }),
      });
      if (!res.ok) throw new Error();
      setRegistrationMode(mode);
      showMessage("注册策略已更新");
    } catch {
      showMessage("更新注册策略失败", true);
    } finally {
      setSavingMode(false);
    }
  };

  // 创建用户
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          nickname: newNickname || undefined,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      setShowCreateForm(false);
      setNewUsername("");
      setNewPassword("");
      setNewNickname("");
      setNewRole("user");
      showMessage(`用户 "${data.user.username}" 创建成功`);
      fetchUsers();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "创建用户失败", true);
    } finally {
      setCreating(false);
    }
  };

  // 更新角色
  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/auth/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRole", userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失败");
      showMessage("角色已更新");
      fetchUsers();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "更新角色失败", true);
    }
  };

  // 更新 AI 权限
  const handleUpdateAiEnabled = async (userId: string, aiEnabled: boolean) => {
    try {
      const res = await fetch("/api/auth/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateAiEnabled", userId, aiEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "更新失败");
      showMessage(aiEnabled ? "已启用 AI 权限" : "已关闭 AI 权限");
      fetchUsers();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "更新 AI 权限失败", true);
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch("/api/auth/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setDeletingId(null);
      showMessage("用户已删除");
      fetchUsers();
    } catch (err) {
      showMessage(err instanceof Error ? err.message : "删除用户失败", true);
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>仅管理员可以访问用户管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 消息提示 */}
      {(error || success) && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          error
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-green-500/30 bg-green-500/10 text-green-400"
        }`}>
          {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          {error || success}
        </div>
      )}

      {/* ══════ 注册策略 ══════ */}
      <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            注册策略
          </h3>
          <p className="text-xs text-muted mt-1">控制新用户如何加入系统</p>
        </div>
        <div className="p-4 grid gap-2">
          {REG_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              disabled={savingMode}
              onClick={() => updateRegistrationMode(opt.value)}
              className={`relative flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all ${
                registrationMode === opt.value
                  ? "border-accent/50 bg-accent/5"
                  : "border-border/30 hover:border-border/60 hover:bg-card-hover/50"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                registrationMode === opt.value
                  ? "bg-accent/15 text-accent"
                  : "bg-card text-muted"
              }`}>
                {opt.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${
                  registrationMode === opt.value ? "text-accent" : "text-foreground"
                }`}>
                  {opt.label}
                </div>
                <div className="text-xs text-muted mt-0.5">{opt.desc}</div>
              </div>
              {registrationMode === opt.value && (
                <Check className="h-4 w-4 text-accent shrink-0" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ══════ 用户列表 ══════ */}
      <section className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              用户列表
              <span className="ml-1 text-xs text-muted font-normal">({users.length})</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              添加用户
            </button>
          </div>
        </div>

        {/* 创建用户表单 */}
        {showCreateForm && (
          <div className="border-b border-border/30 bg-accent/5 p-4">
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">用户名 *</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="3-32 个字符"
                    required
                    minLength={3}
                    maxLength={32}
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">密码 *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="至少 6 个字符"
                      required
                      minLength={6}
                      className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">昵称</label>
                  <input
                    type="text"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    placeholder="留空则使用用户名"
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">角色</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                    className="w-full rounded-lg border border-border/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  创建
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 用户列表 */}
        {loading ? (
          <div className="p-8 text-center text-muted animate-pulse">加载中...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted">暂无用户</div>
        ) : (
          <div className="divide-y divide-border/20">
            {users.map((u) => {
              const isCurrentUser = u.id === currentUser?.id;
              const isAdmin = u.role === "admin";
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-card-hover/30 transition-colors"
                >
                  {/* 头像 */}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 text-sm font-bold ${
                    isAdmin
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-accent/10 text-accent"
                  }`}>
                    {u.nickname?.charAt(0)?.toUpperCase() || u.username.charAt(0).toUpperCase()}
                  </div>

                  {/* 用户信息 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {u.nickname || u.username}
                      </span>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                          <Crown className="h-3 w-3" />
                          管理员
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="text-[10px] text-muted bg-card px-1.5 py-0.5 rounded-full">
                          当前
                        </span>
                      )}
                      {(isAdmin || u.aiEnabled) && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400" title="AI 已启用">
                          <Brain className="h-2.5 w-2.5" />
                          AI
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">@{u.username}</div>
                  </div>

                  {/* 操作按钮 */}
                  {!isCurrentUser && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* AI 权限开关 */}
                      {!isAdmin && (
                        <button
                          onClick={() => handleUpdateAiEnabled(u.id, !u.aiEnabled)}
                          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors ${
                            u.aiEnabled
                              ? "text-purple-400 hover:bg-purple-500/10"
                              : "text-muted hover:bg-purple-500/10 hover:text-purple-400"
                          }`}
                          title={u.aiEnabled ? "关闭 AI 权限" : "开启 AI 权限"}
                        >
                          <Brain className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{u.aiEnabled ? "AI" : "AI"}</span>
                        </button>
                      )}
                      {/* 切换角色 */}
                      <button
                        onClick={() => handleUpdateRole(u.id, isAdmin ? "user" : "admin")}
                        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors ${
                          isAdmin
                            ? "text-amber-500 hover:bg-amber-500/10"
                            : "text-muted hover:bg-accent/10 hover:text-accent"
                        }`}
                        title={isAdmin ? "降为普通用户" : "升为管理员"}
                      >
                        {isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isAdmin ? "降权" : "升权"}</span>
                      </button>

                      {/* 删除 */}
                      {deletingId === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25 transition-colors"
                            title="确认删除"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-card-hover transition-colors"
                            title="取消"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(u.id)}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="删除用户"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">删除</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════ 说明 ══════ */}
      <div className="rounded-xl border border-border/30 bg-card/50 px-5 py-4 text-xs text-muted space-y-1.5">
        <p className="flex items-center gap-1.5">
          <UserX className="h-3.5 w-3.5 shrink-0" />
          删除用户将同时清除该用户的所有登录会话
        </p>
        <p className="flex items-center gap-1.5">
          <Crown className="h-3.5 w-3.5 shrink-0" />
          管理员可以管理用户、修改设置、访问日志等
        </p>
        <p className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 shrink-0" />
          AI 图标亮起表示该用户可使用 AI 功能，管理员默认拥有 AI 权限
        </p>
        <p className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          系统至少需要保留一个管理员账号
        </p>
      </div>
    </div>
  );
}




