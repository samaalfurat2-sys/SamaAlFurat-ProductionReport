import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Fuel } from "lucide-react";
import jsPDF from "jspdf";
import { generateHtmlPdf } from "@/lib/pdfGenerator";
import autoTable from "jspdf-autotable";
import { format, subDays } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';

export default function Warehouse4Report() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Filters
  const [reportType, setReportType] = useState<"daily" | "shift" | "range">("daily");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(subDays(new Date(), 7).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<string>("all");

  // Fetch WH4 records
  const allRecords = useLiveQuery(() => 
    db.records.where('section').equals('warehouse_4').toArray()
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

      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const filteredRecords = getFilteredRecords();

  // Summary statistics
  const summary = {
    totalTransactions: filteredRecords.length,
    totalReceived: filteredRecords
      .filter(r => r.data.type === 'receipt' || r.data.receivedCurrentShift)
      .reduce((sum, r) => sum + (Number(r.data.receivedQuantity || r.data.receivedCurrentShift) || 0), 0),
    totalConsumed: filteredRecords
      .filter(r => r.data.type !== 'receipt' && r.data.consumedQuantity)
      .reduce((sum, r) => sum + (Number(r.data.consumedQuantity) || 0), 0),
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
      [t('total_quantity_received', 'Total Received')]: summary.totalReceived,
      [t('total_quantity_issued', 'Total Consumed')]: summary.totalConsumed
    };

    const tableColumn = [
      t('date') + '/' + t('time', 'Time'), 
      t('type', 'Type'),
      t('material_item', 'Material'), 
      t('quantity_l', 'Quantity (L)'), 
      t('supplier_name', 'Supplier/Section'), 
      t('invoice_ref', 'Ref/Order'),
      t('user', 'User')
    ];
    
    const tableRows = records.map(record => {
      const isReceipt = record.data.type === 'receipt' || !!record.data.receivedCurrentShift;
      const typeStr = isReceipt ? t('received', 'Received') : t('issued', 'Issued');
      const qtyStr = isReceipt 
        ? (record.data.receivedQuantity || record.data.receivedCurrentShift || 0).toString() 
        : (record.data.consumedQuantity || 0).toString();
        
      const supplierOrSection = isReceipt 
        ? (record.data.supplierName || '-') 
        : (record.data.toSection ? t(record.data.toSection) : '-');
        
      const refOrOrder = isReceipt 
        ? (record.data.invoiceRef || '-') 
        : (record.orderId ? `${t('order')} #${record.orderId}` : '-');

      return [
        `${record.date}\n${format(new Date(record.createdAt), 'HH:mm')}`,
        typeStr,
        t(record.data.materialType ? record.data.materialType.replace('mat_', '') : '-'),
        qtyStr,
        supplierOrSection,
        refOrOrder,
        record.data.operator || record.data.receiverName || '-',
        record.action_by || '-',
        record.action_type ? t(record.action_type, record.action_type) : '-',
        record.action_note || '-'
      ];
    });

    const filename = `WH4_Report_${reportType}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    generateHtmlPdf(t('report_title_warehouse_4_raw_materials_report', 'Warehouse 4 Report'), reportPeriod, summaryData, tableColumn, tableRows, filename, isRTL, t);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">WH4 Reports</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-amber-600" />{t('generate_pdf_report', 'Generate PDF Report')}</CardTitle>
          <CardDescription>
            Export transactions, fuel receipts, and consumption history for Diesel Fuel Warehouse 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg border">
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
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Total Records</span>
                <span className="text-2xl font-bold text-primary">{summary.totalTransactions}</span>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Fuel Received (L)</span>
                <span className="text-2xl font-bold text-emerald-600">{summary.totalReceived}</span>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/20 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <span className="text-sm text-muted-foreground mb-1">Fuel Consumed (L)</span>
                <span className="text-2xl font-bold text-amber-600">{summary.totalConsumed}</span>
              </CardContent>
            </Card>
            <Button 
              className="h-full w-full py-8 text-base shadow-md bg-amber-600 hover:bg-amber-700 text-white"
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
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Source/Dest</th>
                    <th className="px-4 py-2 font-medium text-right">Recv Qty (L)</th>
                    <th className="px-4 py-2 font-medium text-right">Iss Qty (L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.slice(0, 50).map((record) => {
                      const isReceive = record.data.type === 'receipt' || !!record.data.receivedCurrentShift;
                      const rcvQty = isReceive ? (Number(record.data.receivedQuantity || record.data.receivedCurrentShift) || 0) : 0;
                      const issQty = !isReceive ? (Number(record.data.consumedQuantity) || 0) : 0;
                      
                      return (
                        <tr key={record.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2">
                            <div className="flex flex-col">
                              <span>{record.date}</span>
                              <span className="text-xs text-muted-foreground">{record.shift}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isReceive 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isReceive ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="px-4 py-2">{isReceive ? (record.data.supplierName || 'Supplier') : (record.data.generatorType || 'Generators')}</td>
                          <td className="px-4 py-2 text-right font-medium text-emerald-600">
                            {isReceive ? rcvQty : '-'}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-amber-600">
                            {!isReceive ? issQty : '-'}
                          </td>
                        </tr>
                      );
                    })
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
