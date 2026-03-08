import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Pencil, Trash2, Shield, Key, Settings2, UserCheck, UserX, ChevronDown, ChevronRight } from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  enabled: boolean;
  permissions: any;
  createdAt: number | null;
  updatedAt: number | null;
}

const ROLE_VALUES = ["operator", "keeper1", "keeper2", "keeper3", "supervisor", "accountant", "auditor", "manager"] as const;

const DASHBOARD_SECTION_KEYS = ["warehouse_1", "warehouse_2", "warehouse_3", "warehouse_4", "utilities", "analytics", "orders", "inventory_setup"] as const;

export default function AdminPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [permUser, setPermUser] = useState<AppUser | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("operator");
  const [formEnabled, setFormEnabled] = useState(true);
  const [permState, setPermState] = useState<Record<string, boolean>>({});

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormDisplayName("");
    setFormPassword("");
    setFormRole("operator");
    setFormEnabled(true);
    setDialogOpen(true);
  };

  const openEditDialog = (user: AppUser) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormDisplayName(user.displayName || "");
    setFormPassword("");
    setFormRole(user.role);
    setFormEnabled(user.enabled);
    setDialogOpen(true);
  };

  const openPermDialog = (user: AppUser) => {
    setPermUser(user);
    const current = (user.permissions as Record<string, boolean>) || {};
    const state: Record<string, boolean> = {};
    DASHBOARD_SECTION_KEYS.forEach(key => {
      state[key] = current[key] !== false;
    });
    setPermState(state);
    setPermDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formUsername) {
      toast({ title: t('error'), description: t('username_required'), variant: "destructive" });
      return;
    }
    if (!editingUser && !formPassword) {
      toast({ title: t('error'), description: t('password_required'), variant: "destructive" });
      return;
    }

    try {
      const body: any = {
        username: formUsername,
        displayName: formDisplayName || formUsername,
        role: formRole,
        enabled: formEnabled,
      };
      if (formPassword) body.password = formPassword;

      let res;
      if (editingUser) {
        res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } else {
        body.password = formPassword;
        res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        toast({ title: editingUser ? t('user_updated') : t('user_created_toast'), description: formUsername });
        setDialogOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t('error'), description: err.error || t('failed_to_save'), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t('error'), description: e.message, variant: "destructive" });
    }
  };

  const handleSavePermissions = async () => {
    if (!permUser) return;
    try {
      const res = await fetch(`/api/admin/users/${permUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions: permState }),
      });
      if (res.ok) {
        toast({ title: t('permissions_updated'), description: permUser.username });
        setPermDialogOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t('error'), description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t('error'), description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (user: AppUser) => {
    if (!confirm(t('confirm_delete_user', { username: user.username }))) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: t('user_deleted'), description: user.username });
        fetchUsers();
      } else {
        const err = await res.json();
        toast({ title: t('error'), description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: t('error'), description: e.message, variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: !user.enabled }),
      });
      if (res.ok) {
        toast({ title: user.enabled ? t('account_disabled') : t('account_enabled_toast'), description: user.username });
        fetchUsers();
      }
    } catch (e: any) {
      toast({ title: t('error'), description: e.message, variant: "destructive" });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "manager": return "bg-amber-100 text-amber-800 border-amber-200";
      case "supervisor": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "accountant": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "auditor": return "bg-purple-100 text-purple-800 border-purple-200";
      case "operator": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const ROLE_GROUPS = [
    { key: "operator", label: t('role_operators', 'Operators'), icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
    { key: "supervisor", label: t('role_supervisors', 'Supervisors'), icon: Shield, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20", border: "border-indigo-200 dark:border-indigo-800" },
    { key: "accountant", label: t('role_accountants', 'Accountants'), icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
    { key: "auditor", label: t('role_auditors', 'Auditors'), icon: UserCheck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800" },
  ];

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ operator: true, supervisor: true, accountant: true, auditor: true });

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            {t('admin_panel', 'Administration')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('admin_desc', 'Manage users, passwords, and permissions')}</p>
        </div>
        <Button onClick={openCreateDialog} size="sm" data-testid="button-create-user">
          <Plus className="h-4 w-4 mr-1" /> {t('add_user', 'Add User')}
        </Button>
      </div>

      <div className="space-y-3" data-testid="panel-role-overview">
        <h2 className="text-base font-semibold text-foreground/80">{t('role_overview', 'Team Overview by Role')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_GROUPS.map(group => {
            const groupUsers = users.filter(u => u.role === group.key);
            const activeCount = groupUsers.filter(u => u.enabled).length;
            const Icon = group.icon;
            return (
              <Card key={group.key} className={`border ${group.border} ${group.bg}`} data-testid={`card-role-${group.key}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${group.color}`} />
                    <span className={`text-sm font-semibold ${group.color}`}>{group.label}</span>
                  </div>
                  <div className="text-2xl font-bold" data-testid={`count-role-${group.key}`}>{groupUsers.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {activeCount} {t('status_active', 'active')} · {groupUsers.length - activeCount} {t('status_inactive', 'inactive')}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {ROLE_GROUPS.map(group => {
          const groupUsers = users.filter(u => u.role === group.key);
          if (groupUsers.length === 0) return null;
          const Icon = group.icon;
          const isExpanded = expandedGroups[group.key] !== false;

          return (
            <Card key={group.key} className={`border ${group.border}`} data-testid={`panel-group-${group.key}`}>
              <CardHeader className={`p-3 cursor-pointer ${group.bg}`} onClick={() => toggleGroup(group.key)}>
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${group.color}`} />
                    <span>{group.label}</span>
                    <Badge variant="secondary" className="text-xs">{groupUsers.length}</Badge>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </CardTitle>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-0">
                  <div className="divide-y">
                    {groupUsers.map(user => {
                      const perms = (user.permissions as Record<string, boolean>) || {};
                      const enabledPerms = DASHBOARD_SECTION_KEYS.filter(key => perms[key] !== false);
                      return (
                        <div key={user.id} className="px-3 py-2.5 flex items-center justify-between" data-testid={`row-user-${user.id}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${user.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                              {(user.displayName || user.username).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                {user.displayName || user.username}
                                {user.enabled
                                  ? <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  : <UserX className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">@{user.username}</div>
                              {enabledPerms.length > 0 && enabledPerms.length < DASHBOARD_SECTION_KEYS.length && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {enabledPerms.map(key => (
                                    <Badge key={key} variant="outline" className="text-[10px] px-1 py-0">{t(`section_${key}`)}</Badge>
                                  ))}
                                </div>
                              )}
                              {enabledPerms.length === DASHBOARD_SECTION_KEYS.length && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 mt-1 border-emerald-300 text-emerald-600">{t('full_access', 'Full Access')}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(user)} title={t('edit')}>
                              <Pencil className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPermDialog(user)} title={t('dashboard_permissions')}>
                              <Settings2 className="h-3.5 w-3.5 text-blue-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <h2 className="text-base font-semibold text-foreground/80 pt-2">{t('all_users', 'All Users')}</h2>
      <div className="grid gap-3">
        {users.map((user) => (
          <Card key={user.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${user.enabled ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                    {(user.displayName || user.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2" data-testid={`text-username-${user.id}`}>
                      {user.displayName || user.username}
                      {!user.enabled && <Badge variant="outline" className="text-xs text-red-500 border-red-200">{t('disabled')}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      @{user.username}
                      <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(user.role)}`}>
                        {t(`role_${user.role}`, user.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPermDialog(user)} title={t('dashboard_permissions')} data-testid={`button-perms-${user.id}`}>
                    <Settings2 className="h-4 w-4 text-blue-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)} title={t('edit_user')} data-testid={`button-edit-user-${user.id}`}>
                    <Pencil className="h-4 w-4 text-blue-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleEnabled(user)} title={user.enabled ? t('account_disabled') : t('account_enabled_toast')} data-testid={`button-toggle-${user.id}`}>
                    <Key className={`h-4 w-4 ${user.enabled ? 'text-emerald-500' : 'text-red-500'}`} />
                  </Button>
                  {user.role !== 'manager' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(user)} title={t('delete')} data-testid={`button-delete-user-${user.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">{t('no_users')}</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {editingUser ? t('edit_user', 'Edit User') : t('create_user', 'Create User')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('username', 'Username')}</Label>
              <Input
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder={t('enter_username')}
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('display_name', 'Display Name')}</Label>
              <Input
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder={t('full_name_placeholder')}
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? t('new_password', 'New Password (leave blank to keep)') : t('password', 'Password')}</Label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={editingUser ? t('leave_blank_keep') : t('enter_password')}
                data-testid="input-password"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('role', 'Role')}</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_VALUES.map((role) => (
                    <SelectItem key={role} value={role}>{t(`role_${role}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('account_enabled', 'Account Enabled')}</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} data-testid="switch-enabled" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSaveUser} data-testid="button-save-user">
              {editingUser ? t('update_record', 'Update') : t('create_user', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('dashboard_permissions', 'Dashboard Permissions')}
              {permUser && <Badge variant="outline" className="ml-2">{permUser.displayName || permUser.username}</Badge>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t('perm_desc', 'Control which dashboard sections this user can see. Managers always have full access.')}
            </p>
            {DASHBOARD_SECTION_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <Label className="font-normal">{t(`section_${key}`)}</Label>
                <Switch
                  checked={permState[key] !== false}
                  onCheckedChange={(checked) => setPermState(prev => ({ ...prev, [key]: checked }))}
                  disabled={permUser?.role === 'manager'}
                  data-testid={`switch-perm-${key}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermDialogOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleSavePermissions} data-testid="button-save-perms">
              {t('save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
