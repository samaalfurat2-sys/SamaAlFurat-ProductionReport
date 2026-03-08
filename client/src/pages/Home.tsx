import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Bell, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Factory, Droplet, Tag, Package, Fuel, Activity, Boxes, FileText, Calculator, FileCheck, ClipboardCheck, Shield } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';

export default function Home() {
  const { t, i18n } = useTranslation();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Get current role
  const role = localStorage.getItem('userRole') || 'operator';
  const isOperator = role === 'operator';
  const isKeeper1 = role === 'keeper1';
  const isKeeper2 = role === 'keeper2';
  const isKeeper3 = role === 'keeper3';
  const isSupervisor = role === 'supervisor';
  const isAccountant = role === 'accountant';
  const isAuditor = role === 'auditor';
  const isManager = role === 'manager';


  // Inbox Logic
  const pendingRecords = useLiveQuery(() => db.records.toArray()) || [];
  
  const getInboxTasks = () => {
    let tasks: any[] = [];
    pendingRecords.forEach(record => {
      // Operator -> Supervisor (WH2 & WH4 & WH1_receiving) -> pending_supervisor / pending_wh2
      // Supervisor -> WH3 Keeper (WH3 Transfers) -> pending_wh3
      // Keeper -> Accountant -> pending
      // Accountant -> Auditor -> accepted
      
      const isPendingWH2 = record.status === 'pending_wh2' || record.status === 'pending_supervisor';
      const isPendingWH3 = record.status === 'pending_wh3';
      const isPendingAccountant = record.status === 'pending';
      const isPendingAuditor = record.status === 'accepted';
      
      // Routing logic based on roles
      if (isSupervisor && isPendingWH2 && (record.section === 'warehouse_1' || ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(record.section))) {
        tasks.push({ ...record, targetRole: 'supervisor', actionRequired: 'wh2_approval', link: '/wh2-approvals' });
      }
      
      if (isKeeper2 && isPendingWH3 && record.section === 'wh2_transfer') {
        tasks.push({ ...record, targetRole: 'keeper2', actionRequired: 'wh3_approval', link: '/wh3-approvals' });
      }
      
      if (isAccountant && isPendingAccountant) {
        tasks.push({ ...record, targetRole: 'accountant', actionRequired: 'accounting_review', link: '/accounting' });
      }
      
      if (isAuditor && isPendingAuditor) {
        tasks.push({ ...record, targetRole: 'auditor', actionRequired: 'auditor_review', link: '/auditor' });
      }
      
      // Manager sees everything pending
      if (isManager && (isPendingWH2 || isPendingWH3 || isPendingAccountant || isPendingAuditor)) {
        let link = '/records';
        let action = 'review_required';
        if (isPendingWH2) { link = '/wh2-approvals'; action = 'wh2_approval'; }
        if (isPendingWH3) { link = '/wh3-approvals'; action = 'wh3_approval'; }
        if (isPendingAccountant) { link = '/accounting'; action = 'accounting_review'; }
        if (isPendingAuditor) { link = '/auditor'; action = 'auditor_review'; }
        
        tasks.push({ ...record, targetRole: 'manager', actionRequired: action, link });
      }
    });
    
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  };
  
  const inboxTasks = getInboxTasks();


  // Visibility Logic
  const showWarehouse1 = isManager || isKeeper1 || isAccountant || isAuditor || (!isOperator && !isSupervisor && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor);
  const showWarehouse2 = isManager || isOperator || isSupervisor || isAccountant || isAuditor || (!isKeeper1 && !isKeeper2 && !isKeeper3 && !isOperator && !isSupervisor && !isAccountant && !isAuditor);
  const showWarehouse3 = isManager || isKeeper2 || isAccountant || isAuditor || (!isOperator && !isSupervisor && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor);
  const showWarehouse4 = isManager || isKeeper3 || isAccountant || isAuditor || (!isOperator && !isSupervisor && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor);
  const showUtilities = isManager || !isOperator && !isSupervisor && !isKeeper1 && !isKeeper2 && !isKeeper3;

  
  const categories = [
    ...(showWarehouse1 ? [{
      title: t('warehouse_1'),
      items: [
        ...(!(isAccountant || isAuditor) ? [
          { id: "wh1_receiving", icon: Package, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/entry?section=wh1_receiving" },
          { id: "warehouse_1", icon: Boxes, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/entry?section=warehouse_1" }
        ] : []),
        ...(isManager || isKeeper1 || isAccountant || isAuditor ? [{ id: "wh1_reports", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", link: "/wh1-report" }] : [])
      ]
    }] : []),
    ...(showWarehouse2 ? [{
      title: t('warehouse_2'),
      items: [
        ...(isManager || isSupervisor || (!isOperator && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor) ? [{ id: "wh2_approvals", icon: FileCheck, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/wh2-approvals" }] : []),
        ...(isManager || isSupervisor || (!isOperator && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor) ? [{ id: "production_orders", icon: FileText, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", link: "/orders" }] : []),
        ...(isManager || isSupervisor || (!isOperator && !isKeeper1 && !isKeeper2 && !isKeeper3 && !isAccountant && !isAuditor) ? [{ id: "close_production", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/close-production" }] : []),
        ...(!(isAccountant || isAuditor) ? [
          { id: "water_treatment", icon: Droplet, color: "text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { id: "blow_molding", icon: Factory, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
          { id: "filling", icon: Droplet, color: "text-cyan-500", bg: "bg-cyan-100 dark:bg-cyan-900/30" },
          { id: "labeling", icon: Tag, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
          { id: "shrink", icon: Package, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30" }
        ] : []),
        ...(isManager || isSupervisor || isAccountant || isAuditor ? [{ id: "wh2_reports", icon: FileText, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", link: "/wh2-report" }] : [])
      ]
    }] : []),
    ...(showWarehouse3 ? [{
      title: t('warehouse_3'),
      items: [
        ...(!(isAccountant || isAuditor) ? [
          { id: "wh3_approvals", icon: FileCheck, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/wh3-approvals" },
          { id: "warehouse_3", icon: Boxes, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/entry?section=warehouse_3" }
        ] : []),
        ...(isManager || isKeeper2 || isAccountant || isAuditor ? [{ id: "wh3_reports", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", link: "/wh3-report" }] : [])
      ]
    }] : []),
    ...(showWarehouse4 ? [{
      title: t('warehouse_4'),
      items: [
        ...(!(isAccountant || isAuditor) ? [
          { id: "fuel_consumption", icon: Activity, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", link: "/entry?section=warehouse_4" },
          { id: "diesel_management", icon: Fuel, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/warehouse4-diesel" }
        ] : []),
        ...(isManager || isKeeper3 || isAccountant || isAuditor ? [{ id: "wh4_reports", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", link: "/wh4-report" }] : [])
      ]
    }] : []),
    ...(showUtilities ? [{
      title: t('utilities_reports'),
      items: [
        ...(isManager || isAccountant ? [{ id: "accounting", icon: Calculator, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", link: "/accounting" }] : []),
        ...(isManager || isAccountant ? [{ id: "accounting_reports", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", link: "/accounting-report" }] : []),
        ...(isManager || isAuditor ? [{ id: "auditor_reports", icon: FileText, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", link: "/auditor-report" }] : []),
        ...(isManager || isAuditor ? [{ id: "auditor", icon: FileCheck, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30", link: "/auditor" }] : []),
        ...(isManager || (!isAccountant && !isAuditor) ? [{ id: "inventory_setup", icon: Boxes, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", link: "/inventory-setup" }] : []),
        ...(isManager || (!isAccountant && !isAuditor) ? [{ id: "go_live_checklist", icon: FileText, color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-900/30", link: "/go-live-checklist" }] : []),
        ...(isManager || (!isAccountant && !isAuditor) ? [{ id: "analysis", icon: Activity, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/analytics" }] : []),
        ...(isManager ? [{ id: "admin_panel", icon: Shield, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", link: "/admin" }] : []),
      ]
    }] : [])
  ];

  return (
    <div className="space-y-8 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('app_title')}</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            {format(currentDateTime, 'yyyy-MM-dd HH:mm:ss')}
          </p>
        </div>
      </div>

      
      {inboxTasks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/10 mb-8 shadow-sm">
          <CardHeader className="pb-2 border-b border-amber-100 dark:border-amber-900/30 bg-amber-100/50 dark:bg-amber-900/20">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-500">
              <Bell className="w-5 h-5" />
              {t('inbox_tasks', 'Task Inbox')}
              <Badge variant="secondary" className="bg-amber-200 text-amber-800 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 ml-2">
                {inboxTasks.length} {t('pending', 'Pending')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-100 dark:divide-amber-900/30 max-h-[300px] overflow-y-auto">
              {inboxTasks.map(task => (
                <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{task.id} - {t(task.section, task.section)}</span>
                      <Badge variant="outline" className="text-xs bg-white dark:bg-black/20">
                        {String(t(task.actionRequired, task.actionRequired.replace('_', ' ')))}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                      <span>{t('shift')}: {t(task.shift || 'morning')}</span>
                    </div>
                  </div>
                  <Link href={task.link}>
                    <Button size="sm" className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white gap-2">
                      {t('take_action', 'Take Action')}
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {categories.map((category, index) => (
        <div key={index} className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground/80">{category.title}</h2>
          <div className="grid grid-cols-2 gap-4">
            {category.items.map((section) => {
              const Icon = section.icon;
              const href = section.link || `/entry?section=${section.id}`;
              return (
                <Link key={section.id} href={href} className="block h-full no-underline transition-transform active:scale-95">
                    <Card className="h-full border shadow-sm hover-elevate transition-all">
                      <CardContent className="flex flex-col items-center justify-center p-6 text-center h-full space-y-3">
                        <div className={`p-3 rounded-full ${section.bg}`}>
                          <Icon className={`w-8 h-8 ${section.color}`} />
                        </div>
                        <span className="font-medium text-sm">{t(section.id)}</span>
                      </CardContent>
                    </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}