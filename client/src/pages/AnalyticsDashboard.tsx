
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import html2pdf from "html2pdf.js";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, Cell
} from "recharts";
import { 
  TrendingUp, Activity, AlertTriangle, CheckCircle2, 
  Clock, Droplet, Factory, Filter, Download
} from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Filters
  const [dateRange, setDateRange] = useState({ 
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'), 
    end: format(new Date(), 'yyyy-MM-dd') 
  });
  const [shiftFilter, setShiftFilter] = useState("all");
  
  // Data Fetching
  const allRecords = useLiveQuery(() => db.records.toArray()) || [];
  const wh3Inventory = useLiveQuery(() => db.inventory.filter(i => i.location === 'warehouse_3').toArray()) || [];
  const wh1Inventory = useLiveQuery(() => db.inventory.filter(i => i.location === 'warehouse_1').toArray()) || [];
  const wh2Inventory = useLiveQuery(() => db.inventory.filter(i => i.location === 'warehouse_2').toArray()) || [];
  
  // Processed Data based on filters
  const processedData = useMemo(() => {
    let filteredRecords = allRecords;
    
    if (dateRange.start && dateRange.end) {
      const start = startOfDay(new Date(dateRange.start));
      const end = endOfDay(new Date(dateRange.end));
      
      filteredRecords = filteredRecords.filter(r => {
        const d = new Date(r.createdAt);
        return isAfter(d, start) && isBefore(d, end);
      });
    }
    
    if (shiftFilter !== "all") {
      filteredRecords = filteredRecords.filter(r => r.shift === shiftFilter);
    }
    
    let totalProd = 0;
    let goodOutput = 0;
    let totalDefects = 0;
    let totalScrap = 0;
    let totalDowntime = 0;
    let totalRejects = 0;
    let totalConsumed = 0;
    
    let pendingTransfers = 0;
    let acceptedTransfers = 0;
    let rejectedTransfers = 0;
    let totalTransferredQty = 0;
    
    let totalDieselReceived = 0;
    let totalDieselConsumed = 0;
    
    const dailyDataMap = new Map<string, { name: string; production: number; defects: number; downtime: number; consumption: number }>();
    const sectionDataMap = new Map<string, { name: string; production: number }>();

    const WH2_PRODUCTION_SECTIONS = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'];

    filteredRecords.forEach(r => {
      const data = r.data || {};
      const day = format(new Date(r.createdAt), 'MMM dd');
      
      if (WH2_PRODUCTION_SECTIONS.includes(r.section)) {
        const prod = Number(data.productionCount || data.production_quantity || 0);
        const defect = Number(data.defects || data.defect_quantity || 0);
        const rejects = Number(data.rejects || 0);
        const shortage = Number(data.shortage || data.shortage_quantity || 0);
        const scrap = Number(data.bottleScrap || data.bottle_scrap || 0);
        const downtime = Number(data.downtime || data.downtime_minutes || 0);
        const consumed = Number(data.consumedQuantity || 0);
        
        totalProd += prod;
        goodOutput += Math.max(0, prod - defect - rejects);
        totalDefects += (defect + shortage);
        totalRejects += rejects;
        totalScrap += scrap;
        totalDowntime += downtime;
        totalConsumed += consumed;
        
        if (!dailyDataMap.has(day)) {
          dailyDataMap.set(day, { name: day, production: 0, defects: 0, downtime: 0, consumption: 0 });
        }
        const dailyObj = dailyDataMap.get(day)!;
        dailyObj.production += prod;
        dailyObj.defects += (defect + rejects);
        dailyObj.downtime += downtime;
        dailyObj.consumption += consumed;
        
        const secName = t(r.section, r.section);
        if (!sectionDataMap.has(secName)) {
          sectionDataMap.set(secName, { name: secName, production: 0 });
        }
        sectionDataMap.get(secName)!.production += prod;
      }
      
      if (r.section === 'wh2_transfer') {
        if (r.status === 'pending_wh3') pendingTransfers++;
        if (r.status === 'pending' || r.status === 'accepted' || r.status === 'audited') {
          acceptedTransfers++;
          totalTransferredQty += Number(data.productionCount || data.quantity || 0);
        }
        if (r.status === 'wh3_rejected' || r.status === 'rejected') rejectedTransfers++;
      }
      
      if (r.section === 'warehouse_4') {
        if (data.type === 'received' || data.type === 'receipt') {
          totalDieselReceived += Number(data.receivedQuantity || data.quantity || 0);
        } else {
          totalDieselConsumed += Number(data.consumedQuantity || data.quantity || 0);
        }
      }
    });
    
    const dailyTrends = Array.from(dailyDataMap.values()).sort((a, b) => {
      return new Date(a.name).getTime() - new Date(b.name).getTime();
    });
    
    const sectionPerformance = Array.from(sectionDataMap.values());
    
    return {
      kpis: {
        totalProd, goodOutput, totalDefects, totalRejects, totalScrap, totalDowntime, totalConsumed,
        pendingTransfers, acceptedTransfers, rejectedTransfers, totalTransferredQty,
        totalDieselReceived, totalDieselConsumed
      },
      charts: {
        dailyTrends,
        sectionPerformance
      }
    };
  }, [allRecords, dateRange, shiftFilter, t]);

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle = "" }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <span className="text-2xl font-bold">{value.toLocaleString()}</span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
          <div className={`p-3 rounded-full ${colorClass}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  
  const exportToCSV = () => {
    // Basic CSV export for BI tools (PowerBI, Tableau, Excel)
    const headers = ['Date', 'Shift', 'Section', 'Order ID', 'Production', 'Defects', 'Shortage', 'Scrap', 'Downtime'];
    
    let csvContent = headers.join(',') + '\n';
    
    allRecords.forEach(r => {
      if (['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(r.section)) {
        const d = r.data || {};
        const row = [
          format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
          r.shift || '-',
          t(r.section, r.section),
          r.orderId || '-',
          d.productionCount || d.production_quantity || 0,
          d.defects || d.defect_quantity || 0,
          d.shortage || d.shortage_quantity || 0,
          d.bottleScrap || d.bottle_scrap || 0,
          d.downtime || d.downtime_minutes || 0
        ];
        csvContent += row.join(',') + '\n';
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Production_Data_Export_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const exportToPDF = () => {
    const element = document.getElementById('analytics-dashboard-content');
    if (!element) return;
    
    // Create a wrapper with standard styling for the PDF
    const printContainer = document.createElement('div');
    printContainer.style.padding = '20px';
    printContainer.style.background = '#ffffff';
    printContainer.style.direction = isRTL ? 'rtl' : 'ltr';
    printContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    
    // Add header with Logo
    printContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px;">
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 15px; gap: 15px;">
          <img src="${isRTL ? '/logo.png' : '/logo-en.jpg'}" style="width: 70px; height: 70px; object-fit: contain; border-radius: 4px;" />
          <div>
            <div style="font-size: 18px; font-weight: bold; color: #0284c7; letter-spacing: 0.5px;">${t('company_name', 'Sama Alfurat Industries And Trade Co Ltd')}</div>
            <h1 style="font-size: 24px; font-weight: bold; margin: 5px 0 0 0; color: #111827;">${t('advanced_analytics', 'Advanced Analytics')}</h1>
          </div>
        </div>
        <p style="margin: 0 0 5px 0; color: #4b5563; font-size: 14px;">${t('period', 'Period')}: ${dateRange.start} ${t('to', 'to')} ${dateRange.end}</p>
        <p style="margin: 0; color: #4b5563; font-size: 12px;">${t('generated_on', 'Generated on')}: ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</p>
      </div>
    `;

    // Clone the dashboard content
    const contentClone = element.cloneNode(true);
    
    // Remove the filter header from the PDF clone to make it cleaner
    const headerToRemove = (contentClone as HTMLElement).querySelector('.dashboard-header');
    if (headerToRemove) headerToRemove.remove();
    
    printContainer.appendChild(contentClone);
    
    // Temporarily append to body to render correctly, then remove
    document.body.appendChild(printContainer);
    
    const opt: any = {
      margin: 10,
      filename: `Analytics_Dashboard_${format(new Date(), 'yyyyMMdd')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    setTimeout(() => {
      html2pdf().set(opt).from(printContainer).save().then(() => {
        if (document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
      }).catch(() => {
        if (document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
      });
    }, 500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div id="analytics-dashboard-content" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 dashboard-header">
        <div>
          <h1 className="text-3xl font-bold">{t('advanced_analytics', 'Advanced Analytics')}</h1>
          <p className="text-muted-foreground">{t('dashboard_desc', 'Production & Inventory Overview')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-lg border shadow-sm w-full md:w-auto">
          <a href="/consumption-analytics">
            <Button variant="outline" size="sm" className="h-9 gap-2" data-testid="link-consumption-analytics">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">{t('consumption_analytics', 'Consumption')}</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="h-9 gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('export_pdf', 'Export PDF')}</span>
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('filter_by', 'Filter By')}:</span>
          </div>
          <Input 
            type="date" 
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))}
            className="w-[140px] h-9 text-sm"
          />
          <span className="text-muted-foreground text-sm">{t('to', 'to')}</span>
          <Input 
            type="date" 
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))}
            className="w-[140px] h-9 text-sm"
          />
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue placeholder={t('all_shifts', 'All Shifts')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_shifts', 'All Shifts')}</SelectItem>
              <SelectItem value="morning">{t('morning', 'Morning')}</SelectItem>
              <SelectItem value="evening">{t('evening', 'Evening')}</SelectItem>
              <SelectItem value="night">{t('night', 'Night')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-8">{t('kpi_production', 'Production KPIs')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t('total_production_pcs', 'Total Production (pcs)')} 
          value={processedData.kpis.totalProd} 
          icon={TrendingUp} 
          colorClass="bg-blue-500" 
          subtitle={`${t('raw_consumed', 'Raw Consumed')}: ${processedData.kpis.totalConsumed.toLocaleString()}`}
        />
        <StatCard 
          title={t('good_output', 'Good Output')} 
          value={processedData.kpis.goodOutput} 
          icon={CheckCircle2} 
          colorClass="bg-green-500" 
          subtitle={processedData.kpis.totalProd > 0 ? `${((processedData.kpis.goodOutput / processedData.kpis.totalProd) * 100).toFixed(1)}%` : ''}
        />
        <StatCard 
          title={t('total_defects', 'Total Defects')} 
          value={processedData.kpis.totalDefects} 
          icon={AlertTriangle} 
          colorClass="bg-yellow-500" 
          subtitle={`${t('rejects', 'Rejects')}: ${processedData.kpis.totalRejects} | ${t('bottle_scrap', 'Scrap')}: ${processedData.kpis.totalScrap}`}
        />
        <StatCard 
          title={t('total_downtime', 'Total Downtime (min)')} 
          value={processedData.kpis.totalDowntime} 
          icon={Clock} 
          colorClass="bg-red-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('daily_production_trend', 'Daily Production Trend')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedData.charts.dailyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="production" name={t('total_production_label', 'Production')} stroke="#0088FE" fill="#0088FE" fillOpacity={0.2} />
                <Area type="monotone" dataKey="defects" name={t('total_defects', 'Defects')} stroke="#FFBB28" fill="#FFBB28" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('production_wh2', 'Production Sections')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedData.charts.sectionPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="production" name={t('total_production_label', 'Production')} fill="#00C49F" radius={[4, 4, 0, 0]}>
                  {processedData.charts.sectionPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-8">{t('finished_goods_transfers', 'Finished Goods & Operations')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t('pending_approvals', 'Pending Approvals')} 
          value={processedData.kpis.pendingTransfers} 
          icon={Activity} 
          colorClass="bg-purple-500" 
        />
        <StatCard 
          title={t('accepted_transfers', 'Accepted Transfers')} 
          value={processedData.kpis.acceptedTransfers} 
          icon={CheckCircle2} 
          colorClass="bg-green-600" 
          subtitle={`Qty: ${processedData.kpis.totalTransferredQty.toLocaleString()}`}
        />
        <StatCard 
          title={t('diesel_received', 'Diesel Received')} 
          value={processedData.kpis.totalDieselReceived} 
          icon={Droplet} 
          colorClass="bg-blue-600" 
        />
        <StatCard 
          title={t('diesel_consumed', 'Diesel Consumed')} 
          value={processedData.kpis.totalDieselConsumed} 
          icon={Factory} 
          colorClass="bg-orange-500" 
        />
      </div>

      <h2 className="text-xl font-semibold mt-8">{t('inventory_balances', 'Inventory Balances Snapshot')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('warehouse_1', 'Warehouse 1')} ({t('raw_material_consumption', 'Raw Materials')})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wh1Inventory.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div className="font-medium">{t(inv.material, inv.material)}</div>
                  <div className="text-lg font-bold">{Number(inv.quantity).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{inv.unit}</span></div>
                </div>
              ))}
              {wh1Inventory.length === 0 && <p className="text-muted-foreground">{t('no_records', 'No records')}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('warehouse_2', 'Warehouse 2')} ({t('production_hall', 'Production Hall')})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wh2Inventory.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div className="font-medium">{t(inv.material, inv.material)}</div>
                  <div className="text-lg font-bold">{Number(inv.quantity).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{inv.unit}</span></div>
                </div>
              ))}
              {wh2Inventory.length === 0 && <p className="text-muted-foreground">{t('no_records', 'No records')}</p>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{t('warehouse_3', 'Warehouse 3')} ({t('finished_goods_transfers', 'Finished Goods')})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {wh3Inventory.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div className="font-medium">{t(inv.material, inv.material)}</div>
                  <div className="text-lg font-bold">{Number(inv.quantity).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{inv.unit}</span></div>
                </div>
              ))}
              {wh3Inventory.length === 0 && <p className="text-muted-foreground">{t('no_records', 'No records')}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
