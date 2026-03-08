import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { subDays, format, parseISO, isAfter, isBefore } from "date-fns";
import { TrendingUp, Activity, Box, Filter, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#6366f1', '#ec4899'];

export default function Analytics() {
  const { t } = useTranslation();
  
  // Filters
  const [timeRange, setTimeRange] = useState("30");
  const [materialFilter, setMaterialFilter] = useState("all");
  
  // Fetch all accepted records
  const records = useLiveQuery(
    () => db.records.where('status').anyOf(['accepted', 'audited', 'wh2_accepted', 'wh3_accepted', 'pending', 'pending_supervisor', 'pending_wh2', 'pending_wh3']).toArray()
  );

  // Process data for charts
  const { chartData, pieData, kpiData, forecastData } = useMemo(() => {
    if (!records || records.length === 0) return { chartData: [], pieData: [], kpiData: {}, forecastData: null };

    // Date filtering
    const endDate = new Date();
    const startDate = subDays(endDate, parseInt(timeRange));
    
    // 1. Filter records by date and type (we only want consumptions, not receipts/transfers unless they represent consumption)
    const filteredRecords = records.filter(r => {
      const rDate = new Date(r.date);
      // Basic date check
      if (isBefore(rDate, startDate) || isAfter(rDate, endDate)) return false;
      
      // Material filter
      if (materialFilter !== 'all') {
        const mat = r.data?.materialType || '';
        // Group similar materials if needed, or exact match
        if (materialFilter === 'preforms' && !mat.includes('preform')) return false;
        if (materialFilter === 'caps' && !mat.includes('caps')) return false;
        if (materialFilter === 'labels' && !mat.includes('label')) return false;
        if (materialFilter === 'shrink' && !mat.includes('shrink')) return false;
        if (materialFilter === 'diesel' && r.section !== 'warehouse_4') return false;
      }
      
      // We are looking for consumption
      return r.data?.consumedQuantity && Number(r.data.consumedQuantity) > 0;
    });

    // 2. Aggregate by Date for Bar/Line Chart
    const dateMap = new Map();
    let totalConsumed = 0;
    let maxDay = { date: '', qty: 0 };
    
    // 3. Aggregate by Material for Pie Chart
    const materialMap = new Map();

    const isAllMaterials = materialFilter === 'all';

    filteredRecords.forEach(r => {
      const date = r.date;
      const qty = Number(r.data.consumedQuantity || 0);
      let mat = r.data.materialType || 'Unknown';
      if (r.section === 'warehouse_4') mat = 'Diesel (L)';
      
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, total: 0 });
      }
      const dayData = dateMap.get(date);
      dayData.total += isAllMaterials ? 1 : qty;
      
      let category = 'Other';
      if (mat.includes('preform')) category = t('preforms', 'Preforms');
      else if (mat.includes('caps')) category = t('caps', 'Caps');
      else if (mat.includes('label')) category = t('labels', 'Labels');
      else if (mat.includes('shrink')) category = t('shrink', 'Shrink');
      else if (mat === 'Diesel (L)' || r.section === 'warehouse_4') category = t('diesel_fuel', 'Diesel');
      
      if (!materialMap.has(category)) {
        materialMap.set(category, 0);
      }
      materialMap.set(category, materialMap.get(category) + 1);

      totalConsumed += isAllMaterials ? 1 : qty;
    });

    // Format chart data
    const sortedDates = Array.from(dateMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Find max day
    sortedDates.forEach(d => {
      if (d.total > maxDay.qty) {
        maxDay = { date: d.date, qty: d.total };
      }
    });

    // Format pie data
    const pieFormatted = Array.from(materialMap.entries()).map(([name, value]) => ({ name, value }));

    // Simple forecast (Average per day * 7 days)
    const daysWithData = sortedDates.length || 1;
    const dailyAvg = totalConsumed / daysWithData;
    const forecast7Days = dailyAvg * 7;

    return {
      chartData: sortedDates,
      pieData: pieFormatted,
      kpiData: {
        total: totalConsumed,
        avg: dailyAvg,
        maxDate: maxDay.date,
        maxQty: maxDay.qty
      },
      forecastData: forecast7Days
    };
  }, [records, timeRange, materialFilter]);

  // Safe formatting for numbers
  const formatNumber = (num: number) => {
    if (num > 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num > 1000) return (num / 1000).toFixed(1) + 'k';
    return Math.round(num).toString();
  };

  const getUnit = () => {
    if (materialFilter === 'preforms' || materialFilter === 'caps') return 'pcs';
    if (materialFilter === 'shrink') return 'kg';
    if (materialFilter === 'diesel') return 'L';
    return 'units';
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t('historical_analytics')}
          </h1>
          <p className="text-muted-foreground">{t('analytics_desc', 'Monitor consumption trends and forecast needs')}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px] bg-background">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('last_7_days', 'Last 7 Days')}</SelectItem>
              <SelectItem value="30">{t('last_30_days', 'Last 30 Days')}</SelectItem>
              <SelectItem value="90">{t('last_3_months', 'Last 3 Months')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-[160px] bg-background">
              <Box className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all_materials_count', 'All Materials (Count)')}</SelectItem>
              <SelectItem value="preforms">{t('preforms_pcs', 'Preforms (pcs)')}</SelectItem>
              <SelectItem value="caps">{t('caps_pcs', 'Caps (pcs)')}</SelectItem>
              <SelectItem value="labels">{t('labels_pcs', 'Labels (pcs)')}</SelectItem>
              <SelectItem value="shrink">{t('shrink_kg', 'Shrink (kg)')}</SelectItem>
              <SelectItem value="diesel">{t('diesel_l', 'Diesel (L)')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {materialFilter === 'all' && (
        <Alert className="bg-blue-50/50 text-blue-800 border-blue-200">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('mixed_units_view', 'Mixed Units View')}</AlertTitle>
          <AlertDescription>
            {t('mixed_units_desc', 'When "All Materials" is selected, the trend chart displays the number of consumption events rather than volume, because pieces, liters, and kilograms cannot be added together. Select a specific material to see volume trends.')}
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('total_consumed', 'Total Consumed')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpiData.total || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {materialFilter === 'all' ? t('transactions', 'Transactions') : getUnit()} {t('in_period', 'in period')}
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('daily_average', 'Daily Average')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpiData.avg || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {materialFilter === 'all' ? t('transactions_per_day', 'Transactions/day') : `${getUnit()}/${t('day', 'day')}`}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('peak_day', 'Peak Day')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(kpiData.maxQty || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('on_date', 'On')} {kpiData.maxDate || '-'}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {t('forecast_7day', '7-Day Forecast')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatNumber(forecastData || 0)}</div>
            <p className="text-xs text-primary/70 mt-1">
              {t('estimated_needed', 'Estimated')} {materialFilter === 'all' ? t('events', 'events') : getUnit()} {t('needed', 'needed')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>{t('consumption_trend', 'Consumption Trend')}</CardTitle>
            <CardDescription>{t('daily_usage_period', 'Daily usage over the selected period')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(parseISO(val), 'MMM dd')}
                      tick={{ fontSize: 12 }}
                      tickMargin={10}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tickFormatter={(val) => formatNumber(val)}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString(), materialFilter === 'all' ? t('events', 'Events') : t('quantity', 'Quantity')]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#0ea5e9" 
                      radius={[4, 4, 0, 0]} 
                      barSize={timeRange === '7' ? 40 : timeRange === '30' ? 12 : 4}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                  {t('no_consumption_data', 'No consumption data for this period')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Pie Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t('material_breakdown', 'Material Breakdown')}</CardTitle>
            <CardDescription>{t('material_usage_freq', 'Frequency of material usage')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex flex-col items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, t('entries', 'Entries')]}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground">{t('no_data', 'No data available')}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
