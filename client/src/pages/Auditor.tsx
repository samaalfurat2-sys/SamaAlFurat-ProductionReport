import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ProductionRecord, updateRecordWithSync } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auditor() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("accepted");

  const records = useLiveQuery(
    () => db.records.orderBy('createdAt').reverse().toArray()
  );

  const filteredRecords = records?.filter(record => {
    // Only show records that have reached at least 'accepted' by Accounting
    if (!['accepted', 'audited', 'audit_rejected'].includes(record.status as string)) {
       return false;
    }

    if (filterShift !== "all" && record.shift !== filterShift) return false;
    if (filterStatus !== "all" && record.status !== filterStatus) return false;
    
    return true;
  });

  const handleUpdateStatus = async (id: number, newStatus: 'accepted' | 'rejected' | 'pending' | 'pending_wh2' | 'wh2_rejected' | 'audited' | 'audit_rejected') => {
    try {
      await updateRecordWithSync(id, { 
        status: newStatus as any, 
        updatedAt: Date.now(),
        action_by: 'auditor',
        action_type: newStatus === 'audited' ? 'audit_approve' : 'audit_reject',
        action_timestamp: new Date().toISOString()
      });
      toast({
        title: t('success_save'),
      });
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'accepted': return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20';
      case 'rejected': return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20';
      case 'audited': return 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20';
      case 'audit_rejected': return 'bg-red-500/10 text-red-600 hover:bg-red-500/20';
      default: return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('auditor_station')}</h1>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status')} (All)</SelectItem>
            <SelectItem value="accepted">{t('accepted')}</SelectItem>
            <SelectItem value="audited">{t('audited')}</SelectItem>
            <SelectItem value="audit_rejected">{t('audit_rejected')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger>
            <SelectValue placeholder={t('shift')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('shift')} (All)</SelectItem>
            <SelectItem value="morning">{t('shift_morning')}</SelectItem>
            <SelectItem value="night">{t('shift_night')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredRecords?.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
            {t('no_records')}
          </div>
        ) : (
          filteredRecords?.map((record) => (
            <Card key={record.id} className="overflow-hidden border-blue-100 dark:border-blue-900/30 shadow-md">
              <CardHeader className="bg-muted/50 pb-3 p-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{t(record.section)}</CardTitle>
                  <CardDescription className="flex gap-2 text-xs mt-1">
                    <span>{record.date}</span>
                    <span>•</span>
                    <span>{t(`shift_${record.shift}`)}</span>
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(record.status)} variant="outline">
                  {t(record.status || 'pending')}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                {(record.data.operator || record.data.supervisor || record.data.supplierName) && (
                  <div className="col-span-2 text-muted-foreground flex flex-col gap-1">
                    {record.data.operator && (
                      <div className="flex gap-2">
                        <span className="font-medium text-foreground">{t('operator')}:</span> 
                        {record.data.operator}
                      </div>
                    )}
                    {record.data.supervisor && (
                      <div className="flex gap-2">
                        <span className="font-medium text-foreground">{t('supervisor')}:</span> 
                        {record.data.supervisor}
                      </div>
                    )}
                    {record.data.supplierName && (
                      <div className="flex gap-2">
                        <span className="font-medium text-foreground">{t('supplier_name')}:</span> 
                        {record.data.supplierName}
                      </div>
                    )}
                  </div>
                )}
                {record.data.productionCount > 0 && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">{record.section === 'wh2_transfer' ? t('transferred_quantity') : t('production_count')}</span>
                    <span className="font-medium">{record.data.productionCount}</span>
                  </div>
                )}
                {record.data.rejects > 0 && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">{t('rejects')}</span>
                    <span className="font-medium">{record.data.rejects}</span>
                  </div>
                )}
                {record.data.downtime > 0 && (
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs">{t('downtime')}</span>
                    <span className="font-medium">{record.data.downtime} mins</span>
                  </div>
                )}
                {record.data.productSize && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-muted-foreground text-xs">{t('product_size')}</span>
                    <span className="font-medium text-blue-600">{t(record.data.productSize)}</span>
                  </div>
                )}
                
                {record.data.consumedQuantity > 0 && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-muted-foreground text-xs">
                      {record.section === 'warehouse_3' ? t('product_quantity') : record.section === 'wh1_receiving' ? t('received_quantity') : record.section === 'warehouse_4' ? t('specific_fill_meter') : ['bom_330ml', 'bom_750ml', 'bom_1500ml'].includes(record.data.materialType) ? t('production_count') : t('consumed_quantity')}
                      {['warehouse_1', 'wh1_receiving', 'warehouse_2', 'warehouse_3', 'warehouse_4', 'water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(record.section) && (
                        <span>
                          {" ("}
                          {['warehouse_1', 'wh1_receiving', 'warehouse_2', 'warehouse_3'].includes(record.section) && (record.data.materialType ? t(record.data.materialType) : t(record.section))}
                          {record.section === 'warehouse_4' && record.data.materialType ? t(record.data.materialType) : record.section === 'warehouse_4' ? t('diesel_fuel') : null}
                          {record.section === 'water_treatment' && t('minerals')}
                          {record.section === 'blow_molding' && t('preforms')}
                          {record.section === 'filling' && t('caps')}
                          {record.section === 'labeling' && t('labels')}
                          {record.section === 'shrink' && t('shrink_roll')}
                          {")"}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      {record.data.consumedQuantity} {record.data.materialType && !['warehouse_2', 'warehouse_3', 'warehouse_4'].includes(record.section) ? `- ${t(record.data.materialType)}` : ''}
                    </span>
                  </div>
                )}
                {record.section === 'warehouse_4' && record.data.totalFlowMeter > 0 && (
                  <div className="flex flex-col col-span-2 mt-2">
                    <span className="text-muted-foreground text-xs">{t('total_flow_meter')}</span>
                    <span className="font-medium">{record.data.totalFlowMeter}</span>
                  </div>
                )}
                {(record.data.balancePreviousShift !== undefined || record.data.receivedCurrentShift !== undefined || record.data.balanceNextShift !== undefined) && (
                  <div className="col-span-2 flex flex-col gap-1 mt-2 pt-2 border-t text-xs bg-muted/30 p-2 rounded-md">
                    {record.data.balancePreviousShift !== undefined && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>{t('balance_previous_shift')}:</span>
                        <span className="font-medium text-foreground">{record.data.balancePreviousShift}</span>
                      </div>
                    )}
                    {record.data.receivedCurrentShift !== undefined && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>{t('received_current_shift')}:</span>
                        <span className="font-medium text-foreground">{record.data.receivedCurrentShift}</span>
                      </div>
                    )}
                    {record.data.balanceNextShift !== undefined && (
                      <div className="flex justify-between items-center text-muted-foreground border-t pt-1 mt-1">
                        <span>{t('balance_next_shift')}:</span>
                        <span className="font-medium text-blue-600">{record.data.balanceNextShift}</span>
                      </div>
                    )}
                  </div>
                )}
                {record.data.notes && (
                  <div className="col-span-2 mt-2 pt-2 border-t text-xs text-muted-foreground">
                    {record.data.notes}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/20 p-3 flex justify-end gap-2 border-t">
                {record.status === 'accepted' ? (
                  <>
                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200" onClick={() => handleUpdateStatus(record.id!, 'audit_rejected')}>
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('reject')}
                    </Button>
                    <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 border-emerald-200" onClick={() => handleUpdateStatus(record.id!, 'audited')}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('confirm_post')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(record.id!, 'accepted')}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    {t('amend')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}