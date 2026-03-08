import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ProductionRecord, updateRecordWithSync, updateInventoryWithSync } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Accounting() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");

  const records = useLiveQuery(
    () => db.records.orderBy('createdAt').reverse().toArray()
  );

  const filteredRecords = records?.filter(record => {
    if (filterShift !== "all" && record.shift !== filterShift) return false;
    if (filterStatus !== "all" && record.status !== filterStatus) return false;
    // Don't show warehouse 1 transfers that are still pending WH2 approval
    if (record.section === 'warehouse_1' && (record.status === 'pending_wh2' || record.status === 'wh2_rejected')) return false;
    // Don't show warehouse 2 transfers that are still pending WH3 approval
    if (record.section === 'wh2_transfer' && (record.status === 'pending_wh3' || record.status === 'wh3_rejected')) return false;
    // Default backward compatibility for records without status
    if (filterStatus === "pending" && record.status === undefined) return true;
    return true;
  });

  const handleUpdateStatus = async (id: number, newStatus: 'accepted' | 'rejected' | 'pending') => {
    try {
      const wh2ProductionSections = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'];

      if (newStatus === 'rejected') {
        const record = await db.records.get(id);
        if (record && wh2ProductionSections.includes(record.section)) {
          const material = record.data.materialType;
          const qty = Number(record.data.consumedQuantity);
          if (material && qty > 0) {
            const wh2Inv = await db.inventory.where({ location: 'warehouse_2', material }).first();
            if (wh2Inv) {
              await updateInventoryWithSync(wh2Inv.id!, {
                quantity: wh2Inv.quantity + qty,
                updatedAt: Date.now()
              });
            } else {
              await db.inventory.add({
                location: 'warehouse_2',
                material,
                quantity: qty,
                unit: record.data.unit || 'units',
                updatedAt: Date.now()
              });
            }
          }
        }
      }

      await updateRecordWithSync(id, { status: newStatus, updatedAt: Date.now() });
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
        <h1 className="text-2xl font-bold tracking-tight">{t('accounting_station')}</h1>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status')} ({t('all_filter')})</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="accepted">{t('accepted')}</SelectItem>
            <SelectItem value="rejected">{t('rejected')}</SelectItem>
            <SelectItem value="audited">{t('audited')}</SelectItem>
            <SelectItem value="audit_rejected">{t('audit_rejected')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger>
            <SelectValue placeholder={t('shift')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('shift')} ({t('all_filter')})</SelectItem>
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
            <Card key={record.id} className="overflow-hidden">
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
                    <span className="font-medium">{record.data.downtime} {t('mins_unit')}</span>
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
                {(!record.status || record.status === 'pending') ? (
                  <>
                    <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200" onClick={() => handleUpdateStatus(record.id!, 'rejected')}>
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('reject')}
                    </Button>
                    <Button size="sm" variant="outline" className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => handleUpdateStatus(record.id!, 'accepted')}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('accept')}
                    </Button>
                  </>
                ) : record.status === 'accepted' || record.status === 'rejected' ? (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(record.id!, 'pending')}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    {t('amend')}
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}