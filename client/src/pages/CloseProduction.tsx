import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { db, addRecordWithSync, updateRecordWithSync } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function CloseProduction() {
  const userRole = localStorage.getItem('userRole');
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [shift, setShift] = useState("morning");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supervisor, setSupervisor] = useState(userRole === 'supervisor' ? "علي شمس الدين" : "");
  const [productionCount, setProductionCount] = useState("");
  const [defects, setDefects] = useState("");
  const [defectsReason, setDefectsReason] = useState("");
  const [shortage, setShortage] = useState("");
  const [shortageReason, setShortageReason] = useState("");
  const [bottleScrap, setBottleScrap] = useState("");
  const [bottleScrapReason, setBottleScrapReason] = useState("");
  const [orderId, setOrderId] = useState<string>("");
  const [cartonStandard, setCartonStandard] = useState("1248");
  const [isSuccess, setIsSuccess] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editRecordId, setEditRecordId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  useEffect(() => {
    const editData = sessionStorage.getItem('editRecord');
    if (editData) {
      sessionStorage.removeItem('editRecord');
      try {
        const record = JSON.parse(editData);
        setIsEditMode(true);
        setEditRecordId(record.id);
        setShift(record.shift);
        setDate(record.date);
        if (record.orderId) setOrderId(record.orderId.toString());
        const d = record.data || {};
        if (d.supervisor) setSupervisor(d.supervisor);
        if (d.productionCount) setProductionCount(d.productionCount.toString());
        if (d.defects) setDefects(d.defects.toString());
        if (d.defectsReason) setDefectsReason(d.defectsReason);
        if (d.shortage) setShortage(d.shortage.toString());
        if (d.shortageReason) setShortageReason(d.shortageReason);
        if (d.bottleScrap) setBottleScrap(d.bottleScrap.toString());
        if (d.bottleScrapReason) setBottleScrapReason(d.bottleScrapReason);
        if (d.cartonStandard) setCartonStandard(d.cartonStandard.toString());
      } catch (e) {
        console.warn('Failed to load edit record:', e);
      }
    }
  }, []);

  const sectionReports = useLiveQuery(() => 
    db.records.where('status').equals('pending_supervisor').toArray()
  );
  
  const activeOrders = useLiveQuery(
    () => db.orders.where('status').equals('active').toArray()
  );

  const selectedOrder = activeOrders?.find((o: any) => o.id?.toString() === orderId);

  const BOM = {
    'bom_330ml': { 
      preforms: 30, caps: 30, labels: 30, shrink: 0.055, minerals: 0,
      matTypes: { preforms: 'mat_preform_11_7', shrink: 'mat_shrink_470', labels: 'mat_label_330', caps: 'mat_caps_30_25' },
      units: {
        preforms: { perCarton: 1728, name: 'Cartons', singleName: 'Carton of Preforms 11.7' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 28000, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 470 Rolls', singleName: 'Roll of Shrink 470' }
      }
    },
    'bom_750ml': { 
      preforms: 20, caps: 20, labels: 20, shrink: 0.055, minerals: 0,
      matTypes: { shrink: 'mat_shrink_560', labels: 'mat_label_750', caps: 'mat_caps_30_25', preforms: 'mat_preform_20_5' },
      units: {
        preforms: { perCarton: 1248, alternatePerCarton: 1280, name: 'Cartons', singleName: 'Carton of Preforms 20.5g' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 22000, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 560 Rolls', singleName: 'Roll of Shrink 560' }
      }
    },
    'bom_1500ml': { 
      preforms: 12, caps: 12, labels: 12, shrink: 0.055, minerals: 0,
      matTypes: { shrink: 'mat_shrink_560', labels: 'mat_label_1500', caps: 'mat_caps_30_25', preforms: 'mat_preform_31_5' },
      units: {
        preforms: { perCarton: 960, name: 'Cartons', singleName: 'Carton of Preforms 31.5g' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 17500, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 560 Rolls', singleName: 'Roll of Shrink 560' }
      }
    },
    'size_330ml': { 
      preforms: 30, caps: 30, labels: 30, shrink: 0.055, minerals: 0,
      matTypes: { preforms: 'mat_preform_11_7', shrink: 'mat_shrink_470', labels: 'mat_label_330', caps: 'mat_caps_30_25' },
      units: {
        preforms: { perCarton: 1728, name: 'Cartons', singleName: 'Carton of Preforms 11.7' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 28000, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 470 Rolls', singleName: 'Roll of Shrink 470' }
      }
    },
    'size_750ml': { 
      preforms: 20, caps: 20, labels: 20, shrink: 0.055, minerals: 0,
      matTypes: { shrink: 'mat_shrink_560', labels: 'mat_label_750', caps: 'mat_caps_30_25', preforms: 'mat_preform_20_5' },
      units: {
        preforms: { perCarton: 1248, alternatePerCarton: 1280, name: 'Cartons', singleName: 'Carton of Preforms 20.5g' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 22000, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 560 Rolls', singleName: 'Roll of Shrink 560' }
      }
    },
    'size_1500ml': { 
      preforms: 12, caps: 12, labels: 12, shrink: 0.055, minerals: 0,
      matTypes: { shrink: 'mat_shrink_560', labels: 'mat_label_1500', caps: 'mat_caps_30_25', preforms: 'mat_preform_31_5' },
      units: {
        preforms: { perCarton: 960, name: 'Cartons', singleName: 'Carton of Preforms 31.5g' },
        caps: { perCarton: 5500, name: 'Cartons', singleName: 'Carton of Caps' },
        labels: { perCarton: 17500, name: 'Rolls', singleName: 'Roll of Labels' },
        shrink: { perCarton: 25, name: 'Shrink 560 Rolls', singleName: 'Roll of Shrink 560' }
      }
    },
  };

      
  
  const handleReject = async () => {
    if (!rejectReason) {
      toast({ title: "Error", description: "Reason is required to reject", variant: "destructive" });
      return;
    }

    try {
      const relevantReports = sectionReports?.filter(r => 
        r.date === date && 
        r.shift === shift && 
        (r.orderId?.toString() === orderId || !orderId || orderId === "none")
      ) || [];

      for (const report of relevantReports) {
        await updateRecordWithSync(report.id, {
          status: 'returned_to_operator',
          "data.notes": report.data?.notes ? report.data.notes + ` | Rejected by Supervisor: ${rejectReason}` : `Rejected by Supervisor: ${rejectReason}`,
          updatedAt: Date.now()
        });
      }

      toast({ title: t('success_save'), description: "Reports rejected and returned to operators" });
      setRejectDialogOpen(false);
      setLocation('/records');
    } catch (error) {
      toast({ title: t('error_save'), variant: "destructive" });
    }
  };

  const handleSave = async () => {
    
    if (!orderId || orderId === "none") {
      toast({ title: t('error_save'), description: "Active Order is required.", variant: "destructive" });
      return;
    }
    if (!productionCount || Number(productionCount) <= 0) {
      toast({ title: t('error_save'), description: "Valid production count is required.", variant: "destructive" });
      return;
    }
    
    try {
      const deductCount = Number(productionCount);
      const size = selectedOrder?.productSize || 'size_330ml';
      const rates = BOM[size as keyof typeof BOM] || BOM['size_330ml'];
      
        const recordData = {
          date,
          shift,
          section: 'wh2_transfer',
          orderId: Number(orderId),
          data: {
                        supervisor,
            productionCount: deductCount,
            defects: Number(defects) || 0,
            defectsReason,
            shortage: Number(shortage) || 0,
            shortageReason,
            bottleScrap: Number(bottleScrap) || 0,
            bottleScrapReason,
            cartonStandard: size === 'bom_750ml' ? Number(cartonStandard) : undefined,
            productSize: size,
            notes: "1-Step Close & Transfer to WH3"
          },
          status: 'pending_wh3' as const, // Directly to WH3 because the supervisor is doing this
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        console.log("Saving transfer record:", recordData);
        
        let transferRecordId: number;
        if (isEditMode && editRecordId) {
          const { createdAt: _ignored, ...updateFields } = recordData;
          await updateRecordWithSync(editRecordId, {
            ...updateFields,
            updatedAt: Date.now()
          });
          transferRecordId = editRecordId;
        } else {
          transferRecordId = await addRecordWithSync(recordData);
        }

        // Update all associated section reports to closed
        const relevantReports = sectionReports?.filter(r => 
          r.date === date && 
          r.shift === shift && 
          (r.orderId?.toString() === orderId || !orderId || orderId === "none")
        ) || [];

        for (const report of relevantReports) {
          await updateRecordWithSync(report.id, {
            status: 'accepted',
            updatedAt: Date.now()
          });
        }


      const deductions: any[] = []; // Deduction moved to individual machine reports

      // Removed duplicate multi-label deductions from CloseProduction.tsx
      
      setIsSuccess(true);
      
      toast({
        title: t('success_save'),
        description: `Transferred ${productionCount} cartons to WH3`,
      });
      
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: t('error_save'),
        description: error.message || "Failed to save record",
        variant: "destructive",
      });
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto mt-10">
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 text-center py-8">
          <CardContent className="space-y-4 flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-2" />
            <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">Transfer Successful!</h2>
            <p className="text-muted-foreground">{productionCount} Cartons transferred to WH3.</p>
            
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg p-4 mt-6 text-left shadow-sm">
              <h3 className="font-semibold border-b pb-2 mb-3">Transfer Summary</h3>
              <ul className="space-y-2 text-sm mb-4">
                                <li className="flex justify-between">
                  <span className="text-muted-foreground">Supervisor:</span>
                  <span className="font-medium">{supervisor}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Shift:</span>
                  <span className="font-medium">{shift}</span>
                </li>
              </ul>
              
            </div>

            <div className="flex gap-4 w-full max-w-md mt-8">
              <Button className="flex-1" variant="outline" onClick={() => window.print()}>
                Print Receipt
              </Button>
              <Button className="flex-1" onClick={() => setLocation('/')}>
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{isEditMode ? t('edit_record', 'Edit Record') : t('close_production')}</h1>
        <p className="text-muted-foreground">{t('close_production_desc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="date">{t('date')}</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift">{t('shift')}</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger id="shift"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{t('shift_morning')}</SelectItem>
                  <SelectItem value="night">{t('shift_night')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="orderId">{t('select_order')}</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger id="orderId"><SelectValue placeholder="Select active order" /></SelectTrigger>
                <SelectContent>
                  {activeOrders && activeOrders.length > 0 ? (
                    activeOrders.map((order: any) => (
                      <SelectItem key={order.id} value={order.id!.toString()}>
                        Order #{order.id} - {t(order.productSize)} ({order.targetQuantity} Cartons)
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No active orders</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {(selectedOrder?.productSize === 'bom_750ml') && (
              <div className="space-y-2 md:col-span-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200">
                <Label htmlFor="cartonStandard" className="text-amber-800 dark:text-amber-300 font-semibold">{t('preforms_standard')} (750ml required)</Label>
                <Select value={cartonStandard} onValueChange={setCartonStandard}>
                  <SelectTrigger id="cartonStandard" className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1248">{t('pcs_carton_1248')}</SelectItem>
                    <SelectItem value="1280">{t('pcs_carton_1280')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

                        <div className="space-y-2">
              <Label htmlFor="supervisor">{t('supervisor')}</Label>
              <Input id="supervisor" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} />
            </div>
          </div>

          
          {sectionReports && sectionReports.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                Submitted Section Reports (Needs Closing)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectionReports.filter(r => (!date || r.date === date) && (!shift || r.shift === shift) && (!orderId || orderId === "none" || r.orderId?.toString() === orderId)).map(report => (
                  <div key={report.id} className="p-3 border rounded-md bg-muted/20">
                    <div className="font-semibold text-primary">{t(report.section)}</div>
                    <div className="text-sm space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Operator:</span>
                        <span>{report.data?.operator}</span>
                      </div>
                      {report.data?.productionCount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Produced:</span>
                          <span>{report.data.productionCount}</span>
                        </div>
                      )}
                      {report.data?.consumedQuantity > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Consumed:</span>
                          <span>{report.data.consumedQuantity}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="text-amber-600">Pending Close</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{t('quality_metrics')}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defects">{t('defects')}</Label>
                <Input 
                  id="defects" 
                  type="number" 
                  placeholder="0" 
                  value={defects}
                  onChange={(e) => setDefects(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defectsReason">{t('defects_reason')}</Label>
                <Input 
                  id="defectsReason" 
                  placeholder={t('reason')} 
                  value={defectsReason}
                  onChange={(e) => setDefectsReason(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="shortage">{t('shortage')}</Label>
                <Input 
                  id="shortage" 
                  type="number" 
                  placeholder="0" 
                  value={shortage}
                  onChange={(e) => setShortage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortageReason">{t('shortage_reason')}</Label>
                <Input 
                  id="shortageReason" 
                  placeholder={t('reason')} 
                  value={shortageReason}
                  onChange={(e) => setShortageReason(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bottleScrap">{t('bottle_scrap')}</Label>
                <Input 
                  id="bottleScrap" 
                  type="number" 
                  placeholder="0" 
                  value={bottleScrap}
                  onChange={(e) => setBottleScrap(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bottleScrapReason">{t('bottle_scrap_reason')}</Label>
                <Input 
                  id="bottleScrapReason" 
                  placeholder={t('reason')} 
                  value={bottleScrapReason}
                  onChange={(e) => setBottleScrapReason(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="productionCount" className="text-lg text-primary">Finished Goods Quantity ({t('cartons')})</Label>
            <Input 
              id="productionCount" 
              type="number" 
              value={productionCount} 
              onChange={(e) => setProductionCount(e.target.value)} 
              placeholder="Total cartons to transfer"
              className="text-lg py-6"
            />
          </div>

          {/* Preview deductions removed */}
        </CardContent>
        <CardFooter className="bg-muted/30 p-6 flex gap-4">
          <Button variant="outline" className="w-1/4" onClick={() => setLocation('/')}>{t('cancel')}</Button>
   <Button variant="destructive" className="w-1/4" onClick={() => setRejectDialogOpen(true)} disabled={!orderId || (sectionReports?.filter(r => r.date === date && r.shift === shift && r.orderId?.toString() === orderId).length === 0)}>Reject Reports</Button>
          <Button className="w-2/4" size="lg" onClick={handleSave} disabled={!orderId || !productionCount}>
            Confirm Transfer
          </Button>
        </CardFooter>
      </Card>
    
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Section Reports</DialogTitle>
            <DialogDescription>
              This will reject all submitted section reports for this order and shift, returning them to the operators for correction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Input 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)} 
                placeholder="Data mismatch, missing information..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject Reports</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}