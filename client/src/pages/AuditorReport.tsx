import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, ClipboardCheck } from "lucide-react";
import jsPDF from "jspdf";
import { generateHtmlPdf } from "@/lib/pdfGenerator";
import autoTable from "jspdf-autotable";
import { format, subDays } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';

export default function AuditorReport() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Filters
  const [reportType, setReportType] = useState<"daily" | "shift" | "range">("daily");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(subDays(new Date(), 7).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all records
  const allRecords = useLiveQuery(() => db.records.toArray());

  const getFilteredRecords = () => {
    if (!allRecords) return [];

    return allRecords.filter(record => {
      // Date filter
      if (reportType === "daily" || reportType === "shift") {
        if (record.date !== date) return false;
      } else if (reportType === "range") {
        if (record.date < startDate || record.date > endDate) return false;
      }

      // Shift filter
      if (reportType === "shift" && shift !== "all") {
        if (record.shift !== shift) return false;
      }

      // Status filter
      if (statusFilter !== "all" && record.status !== statusFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const filteredRecords = getFilteredRecords();

  // Summary statistics
  const summary = {
    totalTransactions: filteredRecords.length,
    pendingCount: filteredRecords.filter(r => r.status?.includes('pending') || !r.status).length,
    auditedCount: filteredRecords.filter(r => r.status === 'audited').length,
    rejectedCount: filteredRecords.filter(r => r.status?.includes('reject')).length,
    acceptedCount: filteredRecords.filter(r => r.status === 'accepted').length,
  };

  
  
  const generatePDF = () => {
    const records = getFilteredRecords();
    if (records.length === 0) {
      alert(t('no_records', 'No data to generate report'));
      return;
    }
    
    let reportPeriod = "";
    if (reportType === "daily") reportPeriod = `${t('date', 'Date')}: ${date}`;
    else if (reportType === "shift") reportPeriod = `${t('date', 'Date')}: ${date} | ${t('shift', 'Shift')}: ${t(shift, shift)}`;
    else reportPeriod = `${t('period', 'Period')}: ${startDate} ${t('to', 'to')} ${endDate}`;

    const summaryData = {
      [t('total_records', 'Total Records')]: summary.totalTransactions,
      [t('pending', 'Pending')]: summary.pendingCount,
      [t('audited', 'Audited')]: summary.auditedCount,
      [t('rejected', 'Rejected')]: summary.rejectedCount
    };

    const tableColumn = [
      t('date') + '/' + t('time', 'Time'), 
      t('section', 'Section'), 
      t('shift', 'Shift'), 
      t('ref_order', 'Ref/Order'), 
      t('item_material', 'Item/Material'),
      t('qty', 'Qty'), 
      t('status', 'Status'),
        t('action_by', 'Action By'),
        t('action_type', 'Action'),
        t('action_note', 'Action Note'),
      t('user_sup_acc', 'User / Sup / Acc'),
      t('notes', 'Notes')
    ];
    
    const tableRows = records.map(record => {
      let qtyStr = "";
      if (record.section === 'warehouse_4') {
        const isRcv = record.data.type === 'receipt' || !!record.data.receivedCurrentShift;
        qtyStr = isRcv ? `IN: ${record.data.receivedQuantity || record.data.receivedCurrentShift}L` : `OUT: ${record.data.consumedQuantity}L`;
      } else if (record.section === 'wh1_receiving') {
        qtyStr = `IN: ${record.data.consumedQuantity}`;
      } else if (record.section === 'wh2_transfer') {
        qtyStr = `TR: ${record.data.productionCount}`;
      } else if (record.section === 'warehouse_3') {
        qtyStr = `OUT: ${record.data.consumedQuantity}`;
      } else {
        qtyStr = `P: ${record.data.productionCount || 0} / C: ${record.data.consumedQuantity || 0}`;
      }

      const user = record.data.operator || '-';
      const supervisor = record.data.supervisor ? ` / S: ${record.data.supervisor}` : '';
      
      let item = "-";
      if (record.data.materialType) item = record.data.materialType.replace('mat_', '');
      if (record.data.productSize) item = record.data.productSize;
      
      let notes = [];
      if (record.data.notes) notes.push(record.data.notes);
      
      return [
        `${record.date}\n${format(new Date(record.createdAt), 'HH:mm')}`,
        t(record.section),
        t('shift_' + record.shift, record.shift),
        record.orderId ? `${t('order')} #${record.orderId}` : (record.id ? `#${record.id}` : '-'),
        t(item),
        qtyStr,
        t(record.status || 'pending'),
        `${user}${supervisor}`,
        notes.join(' | ')
      ];
    });

    const filename = `Auditor_Report_${reportType}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    generateHtmlPdf(t('report_title_auditor_compliance_report', 'Auditor Compliance Report'), reportPeriod, summaryData, tableColumn, tableRows, filename, isRTL, t);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Auditor Reports</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-purple-600" />{t('generate_pdf_report', 'Generate PDF Report')}</CardTitle>
          <CardDescription>
            Export complete transaction history, approval/correction history, and audit trails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-muted/30 p-4 rounded-lg border">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(val: any) => setReportType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="shift">By Shift</SelectItem>
                  <SelectItem value="range">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === "range" ? (
              <>
                <div className="space-y-2">
                  <Label>{t("start_date", "Start Date")}</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("end_date", "End Date")}</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{t("date", t('date', 'Date'))}</Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                />
              </div>
            )}

            {reportType === "shift" && (
              <div className="space-y-2">
                <Label>{t("shift", t('shift', 'Shift'))}</Label>
                <Select value={shift} onValueChange={setShift}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_shifts", "All Shifts")}</SelectItem>
                    <SelectItem value="morning">{t("morning_shift", "Morning")}</SelectItem>
                    <SelectItem value="night">{t("night_shift", "Night")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="audited">Audited</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Total Records</span>
                <span className="text-2xl font-bold text-primary">{summary.totalTransactions}</span>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/5 border-purple-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Audited</span>
                <span className="text-2xl font-bold text-purple-600">{summary.auditedCount}</span>
              </CardContent>
            </Card>
            <Card className="bg-rose-500/5 border-rose-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Rejected</span>
                <span className="text-2xl font-bold text-rose-600">{summary.rejectedCount}</span>
              </CardContent>
            </Card>
            <Button 
              className="h-full w-full py-8 text-base shadow-md bg-purple-600 hover:bg-purple-700 text-white"
              onClick={generatePDF}
              disabled={filteredRecords.length === 0}
            >
              <FileDown className="w-5 h-5 mr-2" />{t('download_pdf', 'Download PDF')}</Button>
          </div>

          {/* Preview Table */}
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted px-4 py-2 text-sm font-medium border-b flex justify-between">
              <span>{t('preview', 'Preview')} ({filteredRecords.length} records)</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date/Time</th>
                    <th className="px-4 py-2 font-medium">{t("section", t('section', 'Section'))}</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.slice(0, 50).map((record) => {
                      return (
                        <tr key={record.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <div className="flex flex-col">
                              <span>{record.date}</span>
                              <span className="text-xs text-muted-foreground">{record.shift}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 uppercase text-xs">{t(record.section)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              record.status === 'audited'
                                ? 'bg-purple-100 text-purple-700'
                                : record.status?.includes('accepted')
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : record.status?.includes('reject')
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                              {t(record.status || 'pending')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-muted-foreground truncate max-w-[200px]">
                            {record.data.operator || '-'} {record.data.materialType ? `| ${record.data.materialType}` : ''}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No records found for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredRecords.length > 50 && (
                <div className="px-4 py-2 text-center text-xs text-muted-foreground border-t bg-muted/20">
                  {t('showing_first_50', 'Showing first 50 of {count} records. Download PDF to see all.').replace('{count}', filteredRecords.length.toString())}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
