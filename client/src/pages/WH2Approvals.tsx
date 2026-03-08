import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db, updateRecordWithSync, updateInventoryWithSync } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WH2_PRODUCTION_SECTIONS = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'];

export default function WH2Approvals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending_wh2");
  const [filterTab, setFilterTab] = useState<'transfers' | 'production'>('transfers');
  
  const [amendDialogOpen, setAmendDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [amendedQty, setAmendedQty] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  
  const [productionRejectDialogOpen, setProductionRejectDialogOpen] = useState(false);
  const [productionRejectReason, setProductionRejectReason] = useState("");
  const [selectedProductionRecord, setSelectedProductionRecord] = useState<any>(null);
  
  const role = localStorage.getItem('userRole');
  const isSupervisor = role === 'supervisor' || role === 'manager';

  const transferRecords = useLiveQuery(
    async () => {
      const all = await db.records.where('section').equals('warehouse_1').toArray();
      return all.sort((a, b) => b.createdAt - a.createdAt);
    }
  );

  const productionRecords = useLiveQuery(
    async () => {
      const all = await db.records.toArray();
      const production = all.filter(r => WH2_PRODUCTION_SECTIONS.includes(r.section));
      return production.sort((a, b) => b.createdAt - a.createdAt);
    }
  );

  const filteredTransferRecords = transferRecords?.filter(record => {
    if (filterShift !== "all" && record.shift !== filterShift) return false;
    if (filterStatus !== "all" && record.status !== filterStatus) return false;
    return true;
  });

  const filteredProductionRecords = productionRecords?.filter(record => {
    if (filterShift !== "all" && record.shift !== filterShift) return false;
    if (filterStatus === "pending_wh2") {
      return record.status === 'pending_supervisor';
    }
    if (filterStatus === "pending") {
      return record.status === 'pending';
    }
    if (filterStatus === "wh2_rejected") {
      return record.status === 'returned_to_operator';
    }
    if (filterStatus === "pending_supervisor") {
      return record.status === 'pending_supervisor';
    }
    if (filterStatus === "returned_to_operator") {
      return record.status === 'returned_to_operator';
    }
    if (filterStatus !== "all") {
      return record.status === filterStatus;
    }
    return true;
  });

  const handleUpdateStatus = async (record: any, newStatus: 'pending' | 'wh2_rejected' | 'pending_wh2', customNotes = '') => {
    try {
      const supervisorName = 'علي شمس الدين';
      
      let updateData: any = { 
        status: newStatus, 
        updatedAt: Date.now() 
      };
      
      updateData.data = { ...record.data };
      
      if (newStatus === 'pending') {
        updateData.data.supervisor = supervisorName;
        if (customNotes) {
          updateData.data.notes = updateData.data.notes 
            ? `${updateData.data.notes} | WH2 Sup: ${customNotes}` 
            : `WH2 Sup: ${customNotes}`;
        }
      } else if (newStatus === 'wh2_rejected') {
        updateData.data.supervisor = supervisorName;
        updateData.data.rejectReason = customNotes;
        updateData.data.notes = updateData.data.notes 
          ? `${updateData.data.notes} | WH2 Rej: ${customNotes}` 
          : `WH2 Rej: ${customNotes}`;
      }
      
      await updateRecordWithSync(record.id, updateData);

      if (newStatus === 'pending') {
        const material = updateData.data.materialType;
        const qty = updateData.data.consumedQuantity;
        
        if (material && qty > 0) {
          const wh1Inv = await db.inventory.where({ location: 'warehouse_1', material }).first();
          if (wh1Inv) {
            await updateInventoryWithSync(wh1Inv.id!, { 
              quantity: wh1Inv.quantity - qty,
              updatedAt: Date.now()
            });
          } else {
            await db.inventory.add({
              location: 'warehouse_1',
              material,
              quantity: -qty,
              unit: updateData.data.unit || 'units',
              updatedAt: Date.now()
            });
          }
          
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
              unit: updateData.data.unit || 'units',
              updatedAt: Date.now()
            });
          }
        }
      }

      
      toast({
        title: t('success_save'),
        description: t(newStatus === 'pending' ? 'wh2_accepted' : 'rejected')
      });
      
      setAmendDialogOpen(false);
      setSelectedRecord(null);
      setAmendedQty("");
      setRejectReason("");
      
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const handleProductionApprove = async (record: any) => {
    try {
      const supervisorName = localStorage.getItem('userName') || 'علي شمس الدين';
      
      let updateData: any = { 
        status: 'pending' as const,
        updatedAt: Date.now() 
      };
      
      updateData.data = { ...record.data };
      updateData.data.supervisor = supervisorName;
      
      await updateRecordWithSync(record.id, updateData);
      
      toast({
        title: t('success_save'),
        description: t('production_approved')
      });
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const handleProductionReject = async () => {
    if (!selectedProductionRecord) return;
    try {
      const supervisorName = localStorage.getItem('userName') || 'علي شمس الدين';
      
      let updateData: any = { 
        status: 'returned_to_operator' as const,
        updatedAt: Date.now() 
      };
      
      updateData.data = { ...selectedProductionRecord.data };
      updateData.data.supervisor = supervisorName;
      updateData.data.rejectReason = productionRejectReason;
      if (productionRejectReason) {
        updateData.data.notes = updateData.data.notes 
          ? `${updateData.data.notes} | ${t('rejected')}: ${productionRejectReason}` 
          : `${t('rejected')}: ${productionRejectReason}`;
      }
      
      const wh2Sections = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'];
      if (wh2Sections.includes(selectedProductionRecord.section)) {
        const consumed = selectedProductionRecord.data?.consumedQuantity;
        const matType = selectedProductionRecord.data?.materialType;
        if (consumed && consumed > 0 && matType) {
          const wh2Items = await db.inventory.where('location').equals('warehouse_2').toArray();
          const wh2Inv = wh2Items.find((i: any) => i.material === matType);
          if (wh2Inv) {
            await updateInventoryWithSync(wh2Inv.id!, { quantity: (wh2Inv.quantity || 0) + consumed });
          } else {
            await db.inventory.add({ location: 'warehouse_2', material: matType, quantity: consumed, unit: 'unit', updatedAt: Date.now() });
          }
        }
      }
      
      await updateRecordWithSync(selectedProductionRecord.id, updateData);
      
      toast({
        title: t('success_save'),
        description: t('production_rejected')
      });
      
      setProductionRejectDialogOpen(false);
      setSelectedProductionRecord(null);
      setProductionRejectReason("");
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const openProductionRejectDialog = (record: any) => {
    setSelectedProductionRecord(record);
    setProductionRejectReason("");
    setProductionRejectDialogOpen(true);
  };

  const handleAmend = async () => {
    if (!selectedRecord) return;
    
    try {
      const supervisorName = 'علي شمس الدين';
      const originalQty = selectedRecord.data.consumedQuantity;
      const newQty = Number(amendedQty);
      
      if (isNaN(newQty) || newQty <= 0) {
        toast({ title: t('error'), description: t('invalid_quantity'), variant: "destructive" });
        return;
      }

      let updateData: any = { 
        status: 'pending',
        updatedAt: Date.now() 
      };
      
      updateData.data = { ...selectedRecord.data };
      updateData.data.supervisor = supervisorName;
      updateData.data.consumedQuantity = newQty;
      
      const amendmentNote = `Amended Qty: ${originalQty} -> ${newQty} by ${supervisorName}`;
      updateData.data.notes = updateData.data.notes 
        ? `${updateData.data.notes} | ${amendmentNote}` 
        : amendmentNote;
        
      if (rejectReason) {
         updateData.data.notes += ` (Reason: ${rejectReason})`;
      }

      await updateRecordWithSync(selectedRecord.id, updateData);

      const material = updateData.data.materialType;
      if (material && newQty > 0) {
        const wh1Inv = await db.inventory.where({ location: 'warehouse_1', material }).first();
        if (wh1Inv) {
          await updateInventoryWithSync(wh1Inv.id!, { quantity: wh1Inv.quantity - newQty, updatedAt: Date.now() });
        } else {
          await db.inventory.add({ location: 'warehouse_1', material, quantity: -newQty, unit: 'units', updatedAt: Date.now() });
        }
        
        const wh2Inv = await db.inventory.where({ location: 'warehouse_2', material }).first();
        if (wh2Inv) {
          await updateInventoryWithSync(wh2Inv.id!, { quantity: wh2Inv.quantity + newQty, updatedAt: Date.now() });
        } else {
          await db.inventory.add({ location: 'warehouse_2', material, quantity: newQty, unit: 'units', updatedAt: Date.now() });
        }
      }

      
      toast({
        title: t('success_save'),
        description: t('transfer_amended_accepted')
      });
      
      setAmendDialogOpen(false);
      
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const openAmendDialog = (record: any) => {
    setSelectedRecord(record);
    setAmendedQty(record.data.consumedQuantity?.toString() || "");
    setRejectReason("");
    setAmendDialogOpen(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20';
      case 'wh2_rejected': return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20';
      case 'pending_supervisor': return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20';
      case 'returned_to_operator': return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20';
      default: return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending': return t('wh2_accepted');
      case 'pending_supervisor': return t('pending_supervisor');
      case 'returned_to_operator': return t('returned_to_operator');
      case 'wh2_rejected': return t('wh2_rejected');
      default: return t(status || 'pending_wh2');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">{t('wh2_approvals')}</h1>
      </div>

      <div className="flex gap-2">
        <Button 
          variant={filterTab === 'transfers' ? 'default' : 'outline'} 
          onClick={() => { setFilterTab('transfers'); setFilterStatus('pending_wh2'); }}
          data-testid="button-tab-transfers"
        >
          {t('wh1_transfer_approvals')}
        </Button>
        <Button 
          variant={filterTab === 'production' ? 'default' : 'outline'} 
          onClick={() => { setFilterTab('production'); setFilterStatus('pending_supervisor'); }}
          data-testid="button-tab-production"
        >
          {t('wh2_production_approvals')}
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="select-filter-status">
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status')} ({t('all_filter')})</SelectItem>
            {filterTab === 'transfers' ? (
              <>
                <SelectItem value="pending_wh2">{t('pending_wh2')}</SelectItem>
                <SelectItem value="pending">{t('wh2_accepted')}</SelectItem>
                <SelectItem value="wh2_rejected">{t('rejected')}</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="pending_supervisor">{t('pending_supervisor')}</SelectItem>
                <SelectItem value="pending">{t('pending')}</SelectItem>
                <SelectItem value="returned_to_operator">{t('returned_to_operator')}</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        <Select value={filterShift} onValueChange={setFilterShift}>
          <SelectTrigger data-testid="select-filter-shift">
            <SelectValue placeholder={t('shift')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('shift')} ({t('all_filter')})</SelectItem>
            <SelectItem value="morning">{t('shift_morning')}</SelectItem>
            <SelectItem value="night">{t('shift_night')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterTab === 'transfers' ? (
        <div className="space-y-4">
          {filteredTransferRecords?.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed" data-testid="text-no-records">
              {t('no_records')}
            </div>
          ) : (
            filteredTransferRecords?.map((record) => (
              <Card key={record.id} className="overflow-hidden" data-testid={`card-transfer-${record.id}`}>
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
                    {getStatusLabel(record.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                  {(record.data.operator || record.data.supervisor) && (
                    <div className="col-span-2 text-muted-foreground flex flex-col gap-1">
                      {record.data.operator && (
                        <div className="flex gap-2">
                          <span className="font-medium text-foreground">{t('operator')} (WH1):</span> 
                          {record.data.operator}
                        </div>
                      )}
                      {record.data.supervisor && (
                        <div className="flex gap-2">
                          <span className="font-medium text-foreground">{t('supervisor')} (WH2):</span> 
                          {record.data.supervisor}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {record.data.consumedQuantity > 0 && (
                    <div className="flex flex-col col-span-2">
                      <span className="text-muted-foreground text-xs">
                        {t('transfer_quantity')}
                        <span>
                          {" ("}
                          {record.data.materialType ? t(record.data.materialType) : t(record.section)}
                          {")"}
                        </span>
                      </span>
                      <span className="font-medium text-lg text-primary">
                        {record.data.consumedQuantity}
                      </span>
                    </div>
                  )}
                  
                  {record.data.notes && (
                    <div className="col-span-2 mt-2 pt-2 border-t text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      <strong>{t("notes_label", "Notes:")}</strong> {record.data.notes}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/20 p-3 flex justify-end gap-2 border-t">
                  {record.status === 'pending_wh2' ? (
                    <>
                      <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200" onClick={() => openAmendDialog(record)} data-testid={`button-reject-transfer-${record.id}`}>
                        <XCircle className="w-4 h-4 mr-1" />
                        {t('reject')} / {t('amend')}
                      </Button>
                      <Button size="sm" variant="outline" className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => handleUpdateStatus(record, 'pending')} data-testid={`button-accept-transfer-${record.id}`}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {t('accept')}
                      </Button>
                    </>
                  ) : null}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProductionRecords?.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed" data-testid="text-no-production-records">
              {t('no_records')}
            </div>
          ) : (
            filteredProductionRecords?.map((record) => (
              <Card key={record.id} className="overflow-hidden" data-testid={`card-production-${record.id}`}>
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
                    {getStatusLabel(record.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                  {record.data.operator && (
                    <div className="col-span-2 text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="font-medium text-foreground">{t('operator')}:</span> 
                        {record.data.operator}
                      </div>
                    </div>
                  )}
                  
                  {record.data.supervisor && (
                    <div className="col-span-2 text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="font-medium text-foreground">{t('supervisor')}:</span> 
                        {record.data.supervisor}
                      </div>
                    </div>
                  )}

                  {record.data.productionCount > 0 && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">{t('production_count')}</span>
                      <span className="font-medium text-lg text-primary">{record.data.productionCount}</span>
                    </div>
                  )}

                  {record.data.consumedQuantity > 0 && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">
                        {t('consumed_quantity')}
                        {record.data.materialType && (
                          <span> ({t(record.data.materialType)})</span>
                        )}
                      </span>
                      <span className="font-medium text-lg text-primary">{record.data.consumedQuantity}</span>
                    </div>
                  )}

                  {record.data.rejects > 0 && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">{t('rejects')}</span>
                      <span className="font-medium text-rose-500">{record.data.rejects}</span>
                    </div>
                  )}

                  {record.data.downtime > 0 && (
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">{t('downtime')}</span>
                      <span className="font-medium">{record.data.downtime}</span>
                    </div>
                  )}
                  
                  {record.data.rejectReason && (
                    <div className="col-span-2 mt-2 pt-2 border-t text-xs text-rose-500 bg-rose-50 p-2 rounded">
                      <strong>{t("reject_reason")}:</strong> {record.data.rejectReason}
                    </div>
                  )}
                  
                  {record.data.notes && (
                    <div className="col-span-2 mt-2 pt-2 border-t text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                      <strong>{t("notes_label", "Notes:")}</strong> {record.data.notes}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/20 p-3 flex justify-end gap-2 border-t">
                  {record.status === 'pending_supervisor' ? (
                    <>
                      <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200" onClick={() => openProductionRejectDialog(record)} data-testid={`button-reject-production-${record.id}`}>
                        <XCircle className="w-4 h-4 mr-1" />
                        {t('reject_production')}
                      </Button>
                      <Button size="sm" variant="outline" className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => handleProductionApprove(record)} data-testid={`button-approve-production-${record.id}`}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {t('approve_production')}
                      </Button>
                    </>
                  ) : null}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}
      
      <Dialog open={amendDialogOpen} onOpenChange={setAmendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("review_transfer_request", "Review Transfer Request")}</DialogTitle>
            <DialogDescription>
              {t("comments_reason")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("original_qty")} ({selectedRecord.data.materialType ? t(selectedRecord.data.materialType) : ''})</Label>
                <div className="text-lg font-medium">{selectedRecord.data.consumedQuantity}</div>
              </div>
              
              <div className="space-y-2">
                <Label>{t("amended_qty_label", "Amended Quantity (Change if different from requested)")}</Label>
                <Input 
                  type="number" 
                  value={amendedQty} 
                  onChange={e => setAmendedQty(e.target.value)}
                  data-testid="input-amended-qty"
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t("comments_reason", "Comments / Reason")}</Label>
                <Textarea 
                  placeholder={t("reject_reason_placeholder")}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  data-testid="input-reject-reason"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setAmendDialogOpen(false)} data-testid="button-cancel-amend">{t('cancel')}</Button>
            <Button variant="destructive" onClick={() => handleUpdateStatus(selectedRecord, 'wh2_rejected', rejectReason)} data-testid="button-reject-completely">
              {t('reject')}
            </Button>
            <Button variant="default" onClick={handleAmend} data-testid="button-accept-amend">
              {t('accept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={productionRejectDialogOpen} onOpenChange={setProductionRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("review_production_record")}</DialogTitle>
            <DialogDescription>
              {t("reject_reason")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedProductionRecord && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('section')}</Label>
                <div className="text-lg font-medium">{t(selectedProductionRecord.section)}</div>
              </div>
              
              <div className="space-y-2">
                <Label>{t("reject_reason")}</Label>
                <Textarea 
                  placeholder={t("reject_reason_placeholder")}
                  value={productionRejectReason}
                  onChange={e => setProductionRejectReason(e.target.value)}
                  data-testid="input-production-reject-reason"
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setProductionRejectDialogOpen(false)} data-testid="button-cancel-production-reject">{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleProductionReject} data-testid="button-confirm-production-reject">
              {t('reject_production')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
