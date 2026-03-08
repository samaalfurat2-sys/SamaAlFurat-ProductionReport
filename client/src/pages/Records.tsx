import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { db } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Records() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [, navigate] = useLocation();
  const userRole = localStorage.getItem('userRole') || '';

  const canEditRecord = (record: any) => {
    const editableStatuses = ['pending_supervisor', 'pending_wh2', 'returned_to_operator', 'wh3_rejected'];
    if (!record.status || !editableStatuses.includes(record.status)) return false;
    if (userRole === 'manager') return true;
    if (userRole === 'operator' && record.section !== 'wh2_transfer') return true;
    if (userRole === 'supervisor') return true;
    return false;
  };

  const handleEdit = (record: any) => {
    if (record.section === 'wh2_transfer') {
      sessionStorage.setItem('editRecord', JSON.stringify(record));
      navigate('/close-production');
    } else {
      sessionStorage.setItem('editRecord', JSON.stringify(record));
      navigate('/entry');
    }
  };

  const records = useLiveQuery(
    () => db.records.orderBy('date').reverse().toArray()
  );

  const filteredRecords = records?.filter(record => 
    t(record.section).toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.date.includes(searchTerm) ||
    (record.data.operator && record.data.operator.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async (id: number) => {
    if(confirm(t('confirm_delete'))) {
      try {
        await db.records.delete(id);
        toast({ title: t('record_deleted') });
      } catch (e) {
        toast({ title: t('error_deleting'), variant: "destructive" });
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'accepted': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'rejected': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'audited': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'audit_rejected': return 'bg-red-500/10 text-red-600 border-red-200';
      case 'wh2_rejected': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'pending_wh2': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      default: return 'bg-amber-500/10 text-amber-600 border-amber-200';
    }
  };

  const getDisplayStatus = (status?: string, section?: string) => {
    if (!status || status === 'pending') {
      return section === 'warehouse_1' ? t('accepted') : t('pending');
    }
    return t(status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('view_records')}</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          className="pl-9" 
          placeholder={t('search')} 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
                  <CardDescription className="flex gap-2 text-xs">
                    <span>{record.date}</span>
                    <span>•</span>
                    <span>{t(`shift_${record.shift}`)}</span>
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    {canEditRecord(record) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEdit(record)} data-testid={`button-edit-${record.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(record.id!)} data-testid={`button-delete-${record.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Badge className={getStatusColor(record.status)} variant="outline">
                    {getDisplayStatus(record.status, record.section)}
                  </Badge>
                </div>
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
            </Card>
          ))
        )}
      </div>
    </div>
  );
}