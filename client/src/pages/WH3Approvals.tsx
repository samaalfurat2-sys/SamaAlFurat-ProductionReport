import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ProductionRecord, updateRecordWithSync, updateInventoryWithSync } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WH3Approvals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending_wh3");
  const [amendDialogOpen, setAmendDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [amendedQty, setAmendedQty] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const records = useLiveQuery(
    async () => {
      const all = await db.records.where('section').equals('wh2_transfer').toArray();
      return all.reverse();
    }
  );

  const filteredRecords = records?.filter(record => {
    if (filterShift !== "all" && record.shift !== filterShift) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "pending_wh3" && record.status !== "pending_wh3") return false;
      if (filterStatus === "pending" && record.status !== "pending") return false;
      if (filterStatus === "wh3_rejected" && record.status !== "wh3_rejected") return false;
    }
    return true;
  });

  const handleUpdateStatus = async (record: any, newStatus: 'pending' | 'wh3_rejected' | 'pending_wh3') => {
    try {
      const updateData = { status: newStatus, data: { ...record.data }, updatedAt: Date.now() };
      await updateRecordWithSync(record.id, updateData);

      // If accepted, update inventory
      if (newStatus === 'pending') {
        const material = updateData.data.productSize || 'product';
        const qty = updateData.data.productionCount;
        
        if (qty > 0) {
          const wh3Inv = await db.inventory.where({ location: 'warehouse_3', material }).first();
          if (wh3Inv) {
            await updateInventoryWithSync(wh3Inv.id, { quantity: wh3Inv.quantity + qty, updatedAt: Date.now() });
          } else {
            await db.inventory.add({ location: 'warehouse_3', material, quantity: qty, unit: 'cartons', updatedAt: Date.now() });
          }
        }

        toast({
        title: t('success_save'),
      });
    }
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const handleAmend = async () => {

  const userRole = localStorage.getItem('userRole') || '';
  const actionBy = userRole === 'keeper1' ? 'صالح الاشول' : 
                   userRole === 'keeper2' ? 'اكرم الشعري' :
                   userRole === 'keeper3' ? 'أمين مستودع 4' :
                   userRole === 'supervisor' ? 'علي شمس الدين' :
                   userRole === 'manager' ? 'مدير النظام' :
                   userRole === 'auditor' ? 'المراجع' :
                   userRole === 'accountant' ? 'المحاسب' : userRole;

    if (!selectedRecord) return;
    try {
      const newQty = parseInt(amendedQty);
      if (isNaN(newQty) || newQty < 0) {
        toast({ title: t("invalid_quantity", "Invalid Quantity"), variant: "destructive" });
        return;
      }
      
      const updatedData = { ...selectedRecord.data };
      const oldQty = updatedData.productionCount;
      updatedData.productionCount = newQty;
      updatedData.notes = `${updatedData.notes || ''}\n[Amended by WH3: changed quantity from ${oldQty} to ${newQty}]`.trim();
      
      await updateRecordWithSync(selectedRecord.id, { 
        status: 'pending', 
        data: updatedData,
        updatedAt: Date.now() 
      });
      
      // Update inventory with new quantity
      if (newQty > 0) {
        const material = updatedData.productSize || 'product';
        const wh3Inv = await db.inventory.where({ location: 'warehouse_3', material }).first();
        if (wh3Inv) {
          await updateInventoryWithSync(wh3Inv.id, { quantity: wh3Inv.quantity + newQty, updatedAt: Date.now() });
        } else {
          await db.inventory.add({ location: 'warehouse_3', material, quantity: newQty, unit: 'cartons', updatedAt: Date.now() });
        }
      }
      
      setAmendDialogOpen(false);
      setSelectedRecord(null);
      setAmendedQty("");
      toast({ title: t('success_save') });
    } catch (error) {
      toast({ title: t('error_save'), variant: "destructive" });
    }
  };

  const handleReject = async () => {

  const userRole = localStorage.getItem('userRole') || '';
  const actionBy = userRole === 'keeper1' ? 'صالح الاشول' : 
                   userRole === 'keeper2' ? 'اكرم الشعري' :
                   userRole === 'keeper3' ? 'أمين مستودع 4' :
                   userRole === 'supervisor' ? 'علي شمس الدين' :
                   userRole === 'manager' ? 'مدير النظام' :
                   userRole === 'auditor' ? 'المراجع' :
                   userRole === 'accountant' ? 'المحاسب' : userRole;

    if (!selectedRecord) return;
    try {
      const updatedData = { ...selectedRecord.data };
      updatedData.notes = `${updatedData.notes || ''}\n[Rejected by WH3: ${rejectReason}]`.trim();
      
      await updateRecordWithSync(selectedRecord.id, { 
        status: 'wh3_rejected', 
        data: updatedData,
        updatedAt: Date.now() 
      });
      
      setRejectDialogOpen(false);
      setSelectedRecord(null);
      setRejectReason("");
      toast({ title: t('success_save') });
    } catch (error) {
      toast({ title: t('error_save'), variant: "destructive" });
    }
  };

  const openAmendDialog = (record: any) => {
    setSelectedRecord(record);
    setAmendedQty(record.data.productionCount.toString());
    setAmendDialogOpen(true);
  };

  const openRejectDialog = (record: any) => {
    setSelectedRecord(record);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20'; // WH3 Accepted
      case 'wh3_rejected': return 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20';
      case 'pending_wh3': return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20';
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
        <h1 className="text-2xl font-bold tracking-tight">{t('wh3_approvals')}</h1>
      </div>

      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger>
            <SelectValue placeholder={t('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('status')} (All)</SelectItem>
            <SelectItem value="pending_wh3">{t('pending_wh3')}</SelectItem>
            <SelectItem value="pending">{t('wh3_accepted')}</SelectItem>
            <SelectItem value="wh3_rejected">{t('wh3_rejected')}</SelectItem>
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
                  {record.status === 'pending' ? t('wh3_accepted') : t(record.status || 'pending_wh3')}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 gap-y-2 text-sm">
                {(record.data.operator || record.data.supervisor) && (
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
                  </div>
                )}
                {record.data.productSize && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-muted-foreground text-xs">{t('product_size')}</span>
                    <span className="font-medium text-blue-600">{t(record.data.productSize)}</span>
                  </div>
                )}
                {record.data.productionCount > 0 && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-muted-foreground text-xs">{t('transferred_quantity')}</span>
                    <span className="font-medium">{record.data.productionCount}</span>
                  </div>
                )}
                {record.data.notes && (
                  <div className="col-span-2 mt-2 pt-2 border-t text-xs text-muted-foreground">
                    {record.data.notes}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/20 p-3 flex justify-end gap-2 border-t">
                {record.status === 'pending_wh3' ? (
                  <>
                    <Button size="sm" variant="outline" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-200" onClick={() => handleUpdateStatus(record, 'wh3_rejected')}>
                      <XCircle className="w-4 h-4 mr-1" />
                      {t('reject')}
                    </Button>
                    <Button size="sm" variant="outline" className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 border-blue-200" onClick={() => handleUpdateStatus(record, 'pending')}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {t('accept')}
                    </Button>
                  </>
                ) : (['pending', 'wh3_rejected'].includes(record.status as string)) ? (
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(record, 'pending_wh3')}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    {t('amend')}
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    
      {/* Amend Dialog */}
      <Dialog open={amendDialogOpen} onOpenChange={setAmendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("amend_transfer_qty", "Amend Transfer Quantity")}</DialogTitle>
            <DialogDescription>
              Adjust the received quantity before accepting. The supervisor will see this amendment in the notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("original_qty", "Original Quantity")}</Label>
              <Input disabled value={selectedRecord?.data.productionCount || ""} />
            </div>
            <div className="space-y-2">
              <Label>{t("actual_received_qty", "Actual Received Quantity (Cartons)")}</Label>
              <Input 
                type="number" 
                value={amendedQty} 
                onChange={(e) => setAmendedQty(e.target.value)} 
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAmend}>{t("confirm_accept", "Confirm & Accept")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reject_transfer", "Reject Transfer")}</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this transfer from WH2. The transfer will be marked as rejected and no inventory will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Input 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)} 
                placeholder="Missing items, wrong product, etc."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>{t("reject_transfer", "Reject Transfer")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

