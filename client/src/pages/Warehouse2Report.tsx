import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Calendar, Search } from "lucide-react";
import jsPDF from "jspdf";
import { generateHtmlPdf } from "@/lib/pdfGenerator";
import autoTable from "jspdf-autotable";
import { format, subDays } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';

export default function Warehouse2Report() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Filters
  const [reportType, setReportType] = useState<"daily" | "shift" | "range">("daily");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(subDays(new Date(), 7).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  const wh2Sections = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'];

  // Fetch WH2 records
  const allRecords = useLiveQuery(() => 
    db.records.where('section').anyOf(wh2Sections).toArray()
  );

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
      
      // Section filter
      if (sectionFilter !== "all") {
        if (record.section !== sectionFilter) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const filteredRecords = getFilteredRecords();

  // Summary statistics
  const summary = {
    totalTransactions: filteredRecords.length,
    totalProduction: filteredRecords.reduce((sum, r) => sum + (Number(r.data.productionCount) || 0), 0),
    totalConsumed: filteredRecords.reduce((sum, r) => sum + (Number(r.data.consumedQuantity) || 0), 0),
    totalDefects: filteredRecords.reduce((sum, r) => sum + (Number(r.data.defects) || 0), 0),
    totalDowntime: filteredRecords.reduce((sum, r) => sum + (Number(r.data.downtime) || 0), 0),
    totalShortage: filteredRecords.reduce((sum, r) => sum + (Number(r.data.shortage) || 0), 0),
    totalBottleScrap: filteredRecords.reduce((sum, r) => sum + (Number(r.data.bottleScrap) || 0), 0),
    totalEmptyCartons: filteredRecords.reduce((sum, r) => sum + (Number(r.data.emptyCartons) || 0), 0),
    totalEmptyPipes: filteredRecords.reduce((sum, r) => sum + (Number(r.data.emptyPlasticPipes) || 0), 0),
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
      [t('total_production_pcs', 'Total Production (PCs)')]: summary.totalProduction,
      [t('total_consumed', 'Total Consumed')]: summary.totalConsumed,
      [t('total_downtime_min', 'Total Downtime')]: summary.totalDowntime + " min",
      [t('defects', 'Defects')]: summary.totalDefects,
      [t('shortage', 'Shortage')]: summary.totalShortage,
      [t('bottle_scrap', 'Bottle Scrap')]: summary.totalBottleScrap,
      [t('empty_cartons', 'Empty Cartons')]: summary.totalEmptyCartons,
      [t('empty_plastic_pipes', 'Empty Pipes')]: summary.totalEmptyPipes
    };

    const tableColumn = [
      t('date') + '/' + t('shift', 'Shift'), 
      t('section', 'Section'), 
      t('order', 'Order'),
      t('material', 'Material'),
      t('prod_qty', 'Prod Qty'),
      t('cons_qty', 'Cons Qty'),
      t('balances_in_rcv_out', 'Bal In/Rcv/Out'),
      t('defects_scrap', 'Def/Scrap'),
      t('user_approver', 'User/Appr'),
      t('notes', 'Notes')
    ];
    
    const tableRows = records.map(record => {
      const orderInfo = record.orderId ? `${t('order_hash')} ${record.orderId}\n${record.data.productSize ? t(record.data.productSize) : ''}` : '-';
      const mat = record.data.materialType ? t(record.data.materialType.replace('mat_', '')) : '-';
      const balIn = record.data.balancePreviousShift || 0;
      const rcv = record.data.receivedCurrentShift || 0;
      const balOut = record.data.balanceNextShift || 0;
      
      const balances = `${balIn} / ${rcv} / ${balOut}`;
      const defects = `${record.data.defects || 0} / ${record.data.bottleScrap || 0}${record.data.emptyCartons ? ` / ${record.data.emptyCartons} c` : ''}${record.data.emptyPlasticPipes ? ` / ${record.data.emptyPlasticPipes} p` : ''}`;
      
      const user = record.data.operator || '-';
      const approver = record.data.supervisor ? ` / ${record.data.supervisor}` : '';
      
      let notes = [];
      if (record.data.downtime) notes.push(`DT: ${record.data.downtime}m`);
      if (record.data.shortage) notes.push(`Short: ${record.data.shortage}`);
      if (record.data.notes) notes.push(record.data.notes);
      
      return [
        `${record.date}\n${t('shift_' + record.shift, record.shift)}`,
        t(record.section),
        orderInfo,
        mat,
        (record.data.productionCount || 0).toString(),
        (record.data.consumedQuantity || 0).toString(),
        balances,
        defects,
        `${user}${approver}`,
        notes.join(' | '),
        record.action_by || '-',
        record.action_type ? t(record.action_type, record.action_type) : '-',
        record.action_note || '-'
      ];
    });

    const filename = `WH2_Report_${reportType}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    generateHtmlPdf(t("warehouse_2_report", "Production Hall (Warehouse 2) Report"), reportPeriod, summaryData, tableColumn, tableRows, filename, isRTL, t);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("warehouse_2_report", "Production & Quality Report (WH2)")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" />{t('generate_pdf_report', 'Generate PDF Report')}</CardTitle>
          <CardDescription>
            Export transactions, production counts, balances, and machine details for Production Hall (WH2).
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
              <Label>{t("section", t('section', 'Section'))}</Label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all_sections", "All Sections")}</SelectItem>
                  <SelectItem value="water_treatment">Water Treatment</SelectItem>
                  <SelectItem value="blow_molding">Blow Molding</SelectItem>
                  <SelectItem value="filling">Filling</SelectItem>
                  <SelectItem value="labeling">Labeling</SelectItem>
                  <SelectItem value="shrink">Shrink</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">{t("records", "Records")}</span>
                <span className="text-2xl font-bold text-primary">{summary.totalTransactions}</span>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/5 border-blue-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">{t("production", "Production")}</span>
                <span className="text-2xl font-bold text-blue-600">{summary.totalProduction}</span>
              </CardContent>
            </Card>
            <Card className="bg-rose-500/5 border-rose-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">{t("downtime", "Downtime")}</span>
                <span className="text-2xl font-bold text-rose-600">{summary.totalDowntime} m</span>
              </CardContent>
            </Card>
            <Button 
              className="h-full w-full py-8 text-base shadow-md bg-blue-600 hover:bg-blue-700"
              onClick={generatePDF}
              disabled={filteredRecords.length === 0}
            >
              <FileDown className="w-5 h-5 mr-2" />{t('download_pdf', 'Download PDF')}</Button>
          </div>
          {/* {t("quality_metrics_summary", "Quality & Loss Metrics Summary")} */}
          <div className="border rounded-md overflow-hidden bg-muted/10">
            <div className="bg-muted/50 px-4 py-3 text-sm font-medium border-b">
              {t("quality_metrics_summary", "Quality & Loss Metrics Summary")}
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase">{t('defects', 'Defects')}</span>
                <p className="text-xl font-semibold text-rose-600">{summary.totalDefects}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase">{t('shortage', 'Shortage')}</span>
                <p className="text-xl font-semibold text-amber-600">{summary.totalShortage}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase">{t('bottle_scrap', 'Bottle Scrap')}</span>
                <p className="text-xl font-semibold text-orange-500">{summary.totalBottleScrap}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase">{t('empty_cartons', 'Empty Cartons')}</span>
                <p className="text-xl font-semibold text-indigo-500">{summary.totalEmptyCartons}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase">{t('empty_plastic_pipes', 'Empty Plastic Pipes')}</span>
                <p className="text-xl font-semibold text-purple-500">{summary.totalEmptyPipes}</p>
              </div>
            </div>
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
                    <th className="px-4 py-2 font-medium">Order</th>
                    <th className="px-4 py-2 font-medium text-right">{t("prod_qty", t('prod_qty', 'Prod Qty'))}</th>
                    <th className="px-4 py-2 font-medium text-right">{t("cons_qty", t('cons_qty', 'Cons Qty'))}</th>
                    <th className="px-4 py-2 font-medium text-right">{t("action_by", "Action By")}</th>
                    <th className="px-4 py-2 font-medium text-right">{t("action_type", "Action")}</th>
                    <th className="px-4 py-2 font-medium text-right">{t("action_note", "Note")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.slice(0, 50).map((record) => (
                      <tr key={record.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span>{record.date}</span>
                            <span className="text-xs text-muted-foreground">{record.shift}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 uppercase text-xs">{record.section.replace('_', ' ')}</td>
                        <td className="px-4 py-2">{record.orderId ? `#${record.orderId}` : '-'}</td>
                        <td className="px-4 py-2 text-right font-medium">{record.data.productionCount || 0}</td>
                        <td className="px-4 py-2 text-right font-medium text-blue-600">{record.data.consumedQuantity || 0}</td>
                        <td className="px-4 py-2 text-right">{record.action_by || '-'}</td>
                        <td className="px-4 py-2 text-right">{record.action_type ? t(record.action_type, record.action_type) : '-'}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{record.action_note || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
