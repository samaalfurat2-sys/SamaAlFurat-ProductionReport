import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db, addRecordWithSync, updateRecordWithSync, updateInventoryWithSync } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "@/hooks/use-toast";

export default function Entry() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Parse section from URL or default
  const searchParams = new URLSearchParams(window.location.search);
  const userRole = localStorage.getItem('userRole');
  
  const getInitialSection = () => {
    const sec = searchParams.get("section");
    if (sec) return sec;
    if (userRole === 'keeper1') return "wh1_receiving";
    if (userRole === 'keeper2') return "warehouse_3";
    if (userRole === 'keeper3') return "warehouse_4";
    if (userRole === 'operator' || userRole === 'supervisor' || userRole === 'manager') return "water_treatment";
    return "warehouse_1";
  };
  
  const [section, setSection] = useState(getInitialSection());
  const [shift, setShift] = useState("morning");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Form State
  const [operator, setOperator] = useState(userRole === 'keeper1' ? "صالح الاشول" : userRole === 'keeper2' ? "اكرم الشعري" : "");
  const [supplierName, setSupplierName] = useState("");
  const [isInitialBalanceLoaded, setIsInitialBalanceLoaded] = useState(false);
  const [generatorType, setGeneratorType] = useState("");
  const [totalFlowMeter, setTotalFlowMeter] = useState("");
  const [supervisor, setSupervisor] = useState(userRole === 'supervisor' ? "علي شمس الدين" : "");
  const [productionCount, setProductionCount] = useState("");
  const [rejects, setRejects] = useState("");
  const [downtime, setDowntime] = useState("");
  const [defects, setDefects] = useState("");
  const [defectsWeight, setDefectsWeight] = useState("");
  const [shortageWeight, setShortageWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"g"|"kg">("kg");
  const [defectsReason, setDefectsReason] = useState("");
  const [shortage, setShortage] = useState("");
  const [shortageReason, setShortageReason] = useState("");
  const [bottleScrap, setBottleScrap] = useState("");
  const [emptyCartons, setEmptyCartons] = useState("");
  const [emptyPlasticPipes, setEmptyPlasticPipes] = useState("");
  const [bottleScrapReason, setBottleScrapReason] = useState("");
  const [notes, setNotes] = useState("");
  const [consumedQuantity, setConsumedQuantity] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [cartonStandard, setCartonStandard] = useState("1248");
  const [balancePreviousShift, setBalancePreviousShift] = useState("");
  const [receivedCurrentShift, setReceivedCurrentShift] = useState("");
  const [balanceNextShift, setBalanceNextShift] = useState("");
  const [orderId, setOrderId] = useState<string>("");
  const [editRecordId, setEditRecordId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const activeOrders = useLiveQuery(
    () => db.orders.where('status').equals('active').toArray()
  );

  useEffect(() => {
    const editData = sessionStorage.getItem('editRecord');
    if (editData) {
      sessionStorage.removeItem('editRecord');
      try {
        const record = JSON.parse(editData);
        setIsEditMode(true);
        setEditRecordId(record.id);
        setSection(record.section);
        setShift(record.shift);
        setDate(record.date);
        if (record.orderId) setOrderId(record.orderId.toString());
        const d = record.data || {};
        if (d.operator) setOperator(d.operator);
        if (d.supervisor) setSupervisor(d.supervisor);
        if (d.supplierName) setSupplierName(d.supplierName);
        if (d.productionCount) setProductionCount(d.productionCount.toString());
        if (d.consumedQuantity) setConsumedQuantity(d.consumedQuantity.toString());
        if (d.rejects) setRejects(d.rejects.toString());
        if (d.downtime) setDowntime(d.downtime.toString());
        if (d.defects) setDefects(d.defects.toString());
        if (d.shortage) setShortage(d.shortage.toString());
        if (d.bottleScrap) setBottleScrap(d.bottleScrap.toString());
        if (d.emptyCartons) setEmptyCartons(d.emptyCartons.toString());
        if (d.emptyPlasticPipes) setEmptyPlasticPipes(d.emptyPlasticPipes.toString());
        if (d.defectsReason) setDefectsReason(d.defectsReason);
        if (d.shortageReason) setShortageReason(d.shortageReason);
        if (d.bottleScrapReason) setBottleScrapReason(d.bottleScrapReason);
        if (d.notes) setNotes(d.notes);
        if (d.materialType) setMaterialType(d.materialType);
        if (d.generatorType) setGeneratorType(d.generatorType);
        if (d.totalFlowMeter) setTotalFlowMeter(d.totalFlowMeter.toString());
        if (d.cartonStandard) setCartonStandard(d.cartonStandard.toString());
        if (d.balancePreviousShift !== undefined) setBalancePreviousShift(d.balancePreviousShift.toString());
        if (d.receivedCurrentShift !== undefined) setReceivedCurrentShift(d.receivedCurrentShift.toString());
        if (d.balanceNextShift !== undefined) setBalanceNextShift(d.balanceNextShift.toString());
      } catch (e) {
        console.warn('Failed to load edit record:', e);
      }
    }
  }, []);

  const approvedWH1Transfers = useLiveQuery(
    () => db.records.where('section').equals('warehouse_1').toArray()
  );

  const allWH4Records = useLiveQuery(
    () => db.records.where('section').equals('warehouse_4').toArray()
  );

  const inventoryRecords = useLiveQuery(
    () => db.inventory.toArray()
  );

  const isWarehouse2Section = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(section);

  useEffect(() => {
    // Load initial balance from inventory if it hasn't been modified yet
    if (inventoryRecords && inventoryRecords.length > 0 && !isInitialBalanceLoaded && section !== 'warehouse_4') {
      const currentMaterial = getMaterialTypeForSection(section, materialType);
      
      const openingBalance = inventoryRecords.find(inv => 
        inv.location === section && 
        (inv.material === currentMaterial || (currentMaterial.startsWith('mat_preform') && inv.material.startsWith('mat_preform')))
      );
      
      if (openingBalance) {
        setBalancePreviousShift(openingBalance.quantity.toString());
        setIsInitialBalanceLoaded(true);
      }
    }
  }, [section, materialType, inventoryRecords, isInitialBalanceLoaded]);

  useEffect(() => {
    if (isWarehouse2Section && approvedWH1Transfers) {
      const relevantTransfers = approvedWH1Transfers.filter((r: any) => 
        r.date === date && 
        r.shift === shift && 
        (r.status === 'pending' || r.status === 'pending_wh2' || r.status === 'wh2_accepted')
      );
      
      let sum = 0;
      relevantTransfers.forEach((r: any) => {
        const mat = r.data?.materialType || '';
        const qty = Number(r.data?.consumedQuantity || 0); // Need to consider if this is in Cartons or Pcs/kg from WH1 transfer. WH1 sends in Cartons/Rolls typically. 
        // Let's standardise to say WH1 sends in tracking units (Cartons/Rolls), so we need to convert to base units here for the shift balance.
        let baseQty = 0;
        
        if (mat.startsWith('mat_preform')) {
          if (mat === 'mat_preform_11_7') baseQty = qty * 1728;
          else if (mat === 'mat_preform_20_5') baseQty = qty * Number(cartonStandard);
          else if (mat === 'mat_preform_31_5') baseQty = qty * 960;
        } else if (mat.startsWith('mat_caps')) {
          baseQty = qty * 5500;
        } else if (mat.startsWith('mat_label')) {
          if (mat === 'mat_label_330') baseQty = qty * 28000;
          else if (mat === 'mat_label_750') baseQty = qty * 22000;
          else if (mat === 'mat_label_1500') baseQty = qty * 17500;
        } else if (mat.startsWith('mat_shrink')) {
          baseQty = qty * 25; // rolls to kg
        } else if (mat === 'minerals') {
          baseQty = qty; // assumed L
        }
        
        if (section === 'blow_molding' && mat.startsWith('mat_preform')) sum += baseQty;
        else if (section === 'filling' && mat.startsWith('mat_caps')) sum += baseQty;
        else if (section === 'labeling' && mat.startsWith('mat_label')) sum += baseQty;
        else if (section === 'shrink' && mat.startsWith('mat_shrink')) sum += baseQty;
        else if (section === 'water_treatment' && mat === 'minerals') sum += baseQty;
      });
      
      if (sum > 0) {
        setReceivedCurrentShift(sum.toString());
      } else {
        setReceivedCurrentShift("");
      }
    }
  }, [section, date, shift, approvedWH1Transfers, isWarehouse2Section, cartonStandard]);
  
  useEffect(() => {
    // Auto calculate balance next shift for WH2
    if (isWarehouse2Section) {
      const prev = Number(balancePreviousShift) || 0;
      const rec = Number(receivedCurrentShift) || 0;
      const cons = Number(consumedQuantity) || 0; // assuming consumedQuantity is entered in base units
      const next = prev + rec - cons;
      setBalanceNextShift(next.toString());
    }
  }, [balancePreviousShift, receivedCurrentShift, consumedQuantity, isWarehouse2Section]);

  useEffect(() => {
    // Auto calculate warehouse 4 remaining balance
    if (section === 'warehouse_4' && allWH4Records) {
      // Try to get opening balance from inventory setup, fallback to 30000
      let mainTankCapacity = 30000;
      if (inventoryRecords) {
        const wh4Opening = inventoryRecords.find(inv => inv.location === 'warehouse_4' && inv.material === 'diesel');
        if (wh4Opening) {
          mainTankCapacity = wh4Opening.quantity;
        }
      }
      
      // Calculate total consumed across all accepted and pending records
      let totalConsumed = 0;
      let totalReceived = 0;
      allWH4Records.forEach((r: any) => {
        if (r.status !== 'rejected' && r.status !== 'audit_rejected') {
          if (r.data?.type === 'receipt') {
            totalReceived += Number(r.data?.receivedQuantity || 0);
          } else {
            totalConsumed += Number(r.data?.consumedQuantity || 0);
          }
        }
      });
      
      const currentConsumption = Number(consumedQuantity) || 0;
      const currentBalance = mainTankCapacity + totalReceived - totalConsumed;
      const remaining = currentBalance - currentConsumption;
      
      // We'll use balanceNextShift to store the remaining diesel for WH4
      setBalanceNextShift(remaining.toString());
      
      // balancePreviousShift can show the balance before this entry
      setBalancePreviousShift(currentBalance.toString());
    }
  }, [section, consumedQuantity, allWH4Records]);

  const isTransferToWH3 = section === 'wh2_transfer';

  
  const getBOMDeduction = (section: string, size: string, count: number) => {
    if (!count || count <= 0) return 0;
    
    // Fallback size if none selected
    const productSize = size || 'size_330ml';
    const is750 = productSize === 'bom_750ml' || productSize === 'size_750ml';
    const is1500 = productSize === 'bom_1500ml' || productSize === 'size_1500ml';
    
    switch(section) {
      case 'blow_molding':
        return is1500 ? count * 12 : is750 ? count * 20 : count * 30; // Preforms per carton
      case 'filling':
        return is1500 ? count * 12 : is750 ? count * 20 : count * 30; // Caps per carton
      case 'labeling':
        return is1500 ? count * 12 : is750 ? count * 20 : count * 30; // Labels per carton
      case 'shrink':
        return count * 0.055; // kg of shrink roll per carton
      case 'water_treatment':
        return count * (is1500 ? 18 : is750 ? 15 : 9.9); // Liters per carton approx
      default:
        return 0;
    }
  };

  const getMaterialTypeForSection = (sec: string, currentMatType: string, selectedOrderObj?: any) => {
    if (selectedOrderObj) {
      const size = selectedOrderObj.productSize;
      if (sec === 'water_treatment') return 'minerals';
      if (sec === 'blow_molding') {
        if (size === 'size_330ml') return 'mat_preform_11_7';
        if (size === 'size_750ml') return 'mat_preform_20_5';
        if (size === 'size_1500ml') return 'mat_preform_31_5';
      }
      if (sec === 'filling') return 'mat_caps_30_25';
      if (sec === 'labeling') {
        if (size === 'size_330ml') return 'mat_label_330';
        if (size === 'size_750ml') return 'mat_label_750';
        if (size === 'size_1500ml') return 'mat_label_1500';
      }
      if (sec === 'shrink') {
        if (size === 'size_330ml') return 'mat_shrink_470';
        return 'mat_shrink_560'; // 750ml and 1500ml use 560
      }
    }
    
    // Fallback for WH1 or without order
    if (sec === 'water_treatment') return 'minerals';
    if (sec === 'blow_molding') return 'preforms';
    if (sec === 'filling') return 'caps';
    if (sec === 'labeling') return 'labels';
    if (sec === 'shrink') return 'shrink_roll';
    return currentMatType;
  };

  const handleSave = async () => {
    try {
      if (!operator) {
        toast({ title: t('error_save'), description: t('operator_required'), variant: "destructive" });
        return;
      }
      
      const isWarehouse2Section = ['water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(section);
      const isTransferToWH3 = section === 'wh2_transfer';
      
      if (section === 'warehouse_4') {
        const consumed = Number(consumedQuantity) || 0;
        const available = Number(balancePreviousShift) || 0;
        if (consumed > available) {
          toast({ title: t('error_save'), description: t('cannot_consume', { consumed, available }), variant: "destructive" });
          return;
        }
      }

      if ((isWarehouse2Section || isTransferToWH3) && (!orderId || orderId === "none")) {
        toast({ title: t('error_save'), description: t('order_required'), variant: "destructive" });
        return;
      }
      
      if (!productionCount && !consumedQuantity && section !== 'warehouse_4' && section !== 'wh1_receiving') {
        toast({ title: t('error_save'), description: t('quantity_required'), variant: "destructive" });
        return;
      }

      const selectedOrder = activeOrders?.find((o: any) => o.id?.toString() === orderId);
      
      if (isTransferToWH3 && !selectedOrder) {
        toast({ title: t('error_save'), description: t('invalid_order'), variant: "destructive" });
        return;
      }
      
      let transferRecordId: number;
      if (isEditMode && editRecordId) {
        await updateRecordWithSync(editRecordId, {
          date,
          shift,
          section,
          orderId: orderId ? Number(orderId) : undefined,
          data: {
            operator,
            supervisor: isWarehouse2Section || isTransferToWH3 ? supervisor : undefined,
            productionCount: Number(productionCount),
            rejects: Number(rejects),
            downtime: Number(downtime),
            consumedQuantity: consumedQuantity ? Number(consumedQuantity) : 0,
            supplierName: section === 'wh1_receiving' ? supplierName : undefined,
            materialType: section === 'warehouse_4' ? generatorType : isTransferToWH3 ? materialType : getMaterialTypeForSection(section, materialType, selectedOrder),
            cartonStandard: (section === 'blow_molding' || materialType === 'mat_preform_20_5' || (isTransferToWH3 && selectedOrder?.productSize === 'bom_750ml') || (selectedOrder?.productSize === 'bom_750ml')) ? Number(cartonStandard) : undefined,
            productSize: selectedOrder ? selectedOrder.productSize : undefined,
            generatorType: section === 'warehouse_4' ? generatorType : undefined,
            totalFlowMeter: section === 'warehouse_4' ? Number(totalFlowMeter) : undefined,
            defects: Number(defects) || 0,
            defectsReason,
            shortage: Number(shortage) || 0,
            shortageReason,
            bottleScrap: Number(bottleScrap) || 0,
            emptyCartons: Number(emptyCartons) || 0,
            emptyPlasticPipes: Number(emptyPlasticPipes) || 0,
            bottleScrapReason,
            balancePreviousShift: (isWarehouse2Section || section === 'warehouse_4') && balancePreviousShift ? Number(balancePreviousShift) : undefined,
            receivedCurrentShift: isWarehouse2Section && receivedCurrentShift ? Number(receivedCurrentShift) : undefined,
            balanceNextShift: (isWarehouse2Section || section === 'warehouse_4') && balanceNextShift ? Number(balanceNextShift) : undefined,
            notes
          },
          updatedAt: Date.now(),
          status: section === 'warehouse_1' ? 'pending_wh2' : section === 'wh2_transfer' ? 'pending_wh3' : isWarehouse2Section ? 'pending_supervisor' : 'pending'
        });
        transferRecordId = editRecordId;
      } else {
      transferRecordId = await addRecordWithSync({
        date,
        shift,
        section,
        orderId: orderId ? Number(orderId) : undefined,
        data: {
          operator,
          supervisor: isWarehouse2Section || isTransferToWH3 ? supervisor : undefined,
          productionCount: Number(productionCount),
          rejects: Number(rejects),
          downtime: Number(downtime),
          consumedQuantity: consumedQuantity ? Number(consumedQuantity) : 0,
          supplierName: section === 'wh1_receiving' ? supplierName : undefined,
          materialType: section === 'warehouse_4' ? generatorType : isTransferToWH3 ? materialType : getMaterialTypeForSection(section, materialType, selectedOrder),
          cartonStandard: (section === 'blow_molding' || materialType === 'mat_preform_20_5' || (isTransferToWH3 && selectedOrder?.productSize === 'bom_750ml') || (selectedOrder?.productSize === 'bom_750ml')) ? Number(cartonStandard) : undefined,
          productSize: selectedOrder ? selectedOrder.productSize : undefined,
          generatorType: section === 'warehouse_4' ? generatorType : undefined,
          totalFlowMeter: section === 'warehouse_4' ? Number(totalFlowMeter) : undefined,
          defects: section === 'labeling' ? Math.round((Number(defectsWeight) * (weightUnit === 'kg' ? 1000 : 1)) / 0.35) : section === 'shrink' ? Math.round((Number(defectsWeight) * (weightUnit === 'kg' ? 1000 : 1)) / 55) : (Number(defects) || 0),
          defectsReason,
          shortage: section === 'labeling' ? Math.round((Number(shortageWeight) * (weightUnit === 'kg' ? 1000 : 1)) / 0.35) : section === 'shrink' ? Math.round((Number(shortageWeight) * (weightUnit === 'kg' ? 1000 : 1)) / 55) : (Number(shortage) || 0),
          shortageReason,
          bottleScrap: Number(bottleScrap) || 0,
          emptyCartons: Number(emptyCartons) || 0,
          emptyPlasticPipes: Number(emptyPlasticPipes) || 0,
          bottleScrapReason,
          balancePreviousShift: (isWarehouse2Section || section === 'warehouse_4') && balancePreviousShift ? Number(balancePreviousShift) : undefined,
          receivedCurrentShift: isWarehouse2Section && receivedCurrentShift ? Number(receivedCurrentShift) : undefined,
          balanceNextShift: (isWarehouse2Section || section === 'warehouse_4') && balanceNextShift ? Number(balanceNextShift) : undefined,
          notes
        },
        status: section === 'warehouse_1' ? 'pending_wh2' : section === 'wh2_transfer' ? 'pending_wh3' : isWarehouse2Section ? 'pending_supervisor' : 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      }
      
      
      
      // Auto deduct from WH2 inventory based on reported consumption OR BOM if only production count is given
      // Skip inventory deduction in edit mode to avoid double-deduction
      if (!isEditMode && isWarehouse2Section && (Number(consumedQuantity) > 0 || Number(productionCount) > 0)) {
        const mat = getMaterialTypeForSection(section, materialType, selectedOrder);
        let qty = Number(consumedQuantity);
        
        // If they didn't enter consumed quantity manually but entered production count, use BOM
        if (!qty && Number(productionCount) > 0 && selectedOrder) {
           qty = getBOMDeduction(section, selectedOrder.productSize || materialType, Number(productionCount));
        } else if (!qty && Number(productionCount) > 0 && ['bom_330ml', 'bom_750ml', 'bom_1500ml', 'size_330ml', 'size_750ml', 'size_1500ml'].includes(materialType)) {
           qty = getBOMDeduction(section, materialType, Number(productionCount));
        }
        
        // Final fallback if they entered production but we couldn't calc BOM
        if (!qty) qty = Number(productionCount);

        let unit = 'units';
        if (section === 'water_treatment') unit = 'L';
        else if (section === 'shrink') unit = 'kg';
        else unit = 'pcs';

        if (mat && qty > 0) {
          const wh2Inv = await db.inventory.where({ location: 'warehouse_2', material: mat }).first();
          if (wh2Inv) {
            await updateInventoryWithSync(wh2Inv.id, { 
              quantity: wh2Inv.quantity - qty,
              updatedAt: Date.now()
            });
          } else {
            await db.inventory.add({
              location: 'warehouse_2',
              material: mat,
              quantity: -qty,
              unit,
              updatedAt: Date.now()
            });
          }
          
          // Also save this calculated consumed quantity to the record if it was calculated from BOM
          if (!consumedQuantity && qty > 0) {
            await updateRecordWithSync(transferRecordId, {
               "data.consumedQuantity": qty
            });
          }
        }
      }

      if (!isEditMode && section === 'wh1_receiving' && Number(consumedQuantity) > 0 && materialType) {
        const qty = Number(consumedQuantity);
        const mat = materialType;
        const unit = 'units';

        const wh1Inv = await db.inventory.where({ location: 'warehouse_1', material: mat }).first();
        if (wh1Inv) {
          await updateInventoryWithSync(wh1Inv.id!, {
            quantity: wh1Inv.quantity + qty,
            updatedAt: Date.now()
          });
        } else {
          await db.inventory.add({
            location: 'warehouse_1',
            material: mat,
            quantity: qty,
            unit,
            updatedAt: Date.now()
          });
        }
      }

      toast({
        title: t('success_save'),
        description: `${t(section)} - ${date}`,
      });
      
      // Reset form or navigate away
      setLocation('/records');
      
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const selectedOrder = activeOrders?.find((o: any) => o.id?.toString() === orderId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{isEditMode ? t('edit_record', 'Edit Record') : t('new_entry')}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t('date')}</Label>
              <Input 
                id="date" 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
              />
            </div>
            {section !== 'wh1_receiving' && (
            <div className="space-y-2">
              <Label htmlFor="shift">{t('shift')}</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger id="shift">
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">{t('morning')}</SelectItem>
                  <SelectItem value="night">{t('night')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          </div>
          
          {(isWarehouse2Section || isTransferToWH3) && (
            <div className="space-y-2">
              <Label htmlFor="orderId">{t('select_order')}</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger id="orderId">
                  <SelectValue placeholder={t('select_order')} />
                </SelectTrigger>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="section">{t('section')}</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger id="section">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {(!userRole || userRole === 'manager' || userRole === 'accountant' || userRole === 'auditor' || userRole === 'keeper1') && (
                  <SelectGroup>
                    <SelectLabel>{t('warehouse_1')}</SelectLabel>
                    <SelectItem value="warehouse_1">{t('warehouse_1')}</SelectItem>
                    <SelectItem value="wh1_receiving">{t('wh1_receiving')}</SelectItem>
                  </SelectGroup>
                )}
                
                {(!userRole || userRole === 'manager' || userRole === 'accountant' || userRole === 'auditor' || userRole === 'operator' || userRole === 'supervisor') && (
                  <SelectGroup>
                    <SelectLabel>{t('warehouse_2')}</SelectLabel>
                    <SelectItem value="water_treatment">{t('water_treatment')}</SelectItem>
                    <SelectItem value="blow_molding">{t('blow_molding')}</SelectItem>
                    <SelectItem value="filling">{t('filling')}</SelectItem>
                    <SelectItem value="labeling">{t('labeling')}</SelectItem>
                    <SelectItem value="shrink">{t('shrink')}</SelectItem>
                  </SelectGroup>
                )}
                
                {(!userRole || userRole === 'manager' || userRole === 'accountant' || userRole === 'auditor' || userRole === 'keeper2') && (
                  <SelectGroup>
                    <SelectLabel>{t('warehouse_3')}</SelectLabel>
                    <SelectItem value="warehouse_3">{t('warehouse_3')}</SelectItem>
                  </SelectGroup>
                )}

                {(!userRole || userRole === 'manager' || userRole === 'accountant' || userRole === 'auditor' || userRole === 'keeper3') && (
                  <SelectGroup>
                    <SelectLabel>{t('warehouse_4')}</SelectLabel>
                    <SelectItem value="warehouse_4">{t('warehouse_4')}</SelectItem>
                  </SelectGroup>
                )}
                
                {(!userRole || userRole === 'manager') && (
                  <SelectGroup>
                    <SelectLabel>{t('utilities_reports')}</SelectLabel>
                    <SelectItem value="analysis">{t('analysis')}</SelectItem>
                    <SelectItem value="inventory">{t('inventory')}</SelectItem>
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operator">{t('operator')}</Label>
              <Input 
                id="operator" 
                placeholder={t('operator')} 
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
              />
            </div>

            {(isWarehouse2Section || isTransferToWH3) && (
              <div className="space-y-2">
                <Label htmlFor="supervisor">{t('supervisor')}</Label>
                <Input 
                  id="supervisor" 
                  placeholder={t('name')} 
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                />
              </div>
            )}
            {isWarehouse2Section && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{t('quality_metrics')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(section === 'labeling' || section === 'shrink') ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="defectsWeight">{t('defects_weight')}</Label>
                        <select 
                          className="text-xs border rounded p-1 bg-background" 
                          value={weightUnit} 
                          onChange={(e) => setWeightUnit(e.target.value as "g"|"kg")}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </select>
                      </div>
                      <Input 
                        id="defectsWeight" 
                        type="number" 
                        placeholder="0" 
                        value={defectsWeight}
                        onChange={(e) => setDefectsWeight(e.target.value)}
                      />
                      {defectsWeight && (
                        <p className="text-xs text-muted-foreground">
                          ≈ {Math.round((Number(defectsWeight) * (weightUnit === 'kg' ? 1000 : 1)) / (section === 'shrink' ? 55 : 0.35))} {section === 'shrink' ? 'cartons' : 'labels'}
                        </p>
                      )}
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
                      <div className="flex justify-between items-center">
                        <Label htmlFor="shortageWeight">{t('shortage_weight')}</Label>
                        <select 
                          className="text-xs border rounded p-1 bg-background" 
                          value={weightUnit} 
                          onChange={(e) => setWeightUnit(e.target.value as "g"|"kg")}
                        >
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </select>
                      </div>
                      <Input 
                        id="shortageWeight" 
                        type="number" 
                        placeholder="0" 
                        value={shortageWeight}
                        onChange={(e) => setShortageWeight(e.target.value)}
                      />
                      {shortageWeight && (
                        <p className="text-xs text-muted-foreground">
                          ≈ {Math.round((Number(shortageWeight) * (weightUnit === 'kg' ? 1000 : 1)) / (section === 'shrink' ? 55 : 0.35))} {section === 'shrink' ? 'cartons' : 'labels'}
                        </p>
                      )}
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
                  </>
                ) : (
                  <>
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
                  </>
                )}
                
                {section === 'shrink' && (
                  <div className="space-y-2">
                    <Label htmlFor="emptyPlasticPipes">{t('empty_plastic_pipes')}</Label>
                    <Input 
                      id="emptyPlasticPipes" 
                      type="number" 
                      placeholder="0" 
                      value={emptyPlasticPipes}
                      onChange={(e) => setEmptyPlasticPipes(e.target.value)}
                    />
                  </div>
                )}
                
                {section !== 'blow_molding' && section !== 'labeling' && section !== 'shrink' && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {['warehouse_1', 'wh1_receiving', 'warehouse_2', 'warehouse_3', 'warehouse_4', 'water_treatment', 'blow_molding', 'filling', 'labeling', 'shrink'].includes(section) && (
              <div className="space-y-4 col-span-2 sm:col-span-1">
                {section !== 'warehouse_4' && !isWarehouse2Section && (
                  <div className="space-y-2">
                    <Label htmlFor="materialType">{t('material_type_size')}</Label>
                    <Select value={materialType} onValueChange={setMaterialType}>
                      <SelectTrigger id="materialType">
                        <SelectValue placeholder={t('material_placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {section === 'warehouse_1' || section === 'wh1_receiving' ? (
                          <>
                            <SelectItem value="mat_preform_20_5">{t('mat_preform_20_5')}</SelectItem>
                            <SelectItem value="mat_preform_31_5">{t('mat_preform_31_5')}</SelectItem>
                            <SelectItem value="mat_preform_11_7">{t('mat_preform_11_7')}</SelectItem>
                            <SelectItem value="mat_caps_30_25">{t('mat_caps_30_25')}</SelectItem>
                            <SelectItem value="mat_label_330">{t('mat_label_330')}</SelectItem>
                            <SelectItem value="mat_label_750">{t('mat_label_750')}</SelectItem>
                            <SelectItem value="mat_label_1500">{t('mat_label_1500')}</SelectItem>
                            <SelectItem value="mat_shrink_560">{t('mat_shrink_560')}</SelectItem>
                            <SelectItem value="mat_shrink_470">{t('mat_shrink_470')}</SelectItem>
                            <SelectItem value="minerals">{t('minerals')}</SelectItem>
                          </>
                        ) : section === 'warehouse_2' ? (
                          <>
                            <SelectItem value="bom_330ml">{t('bom_330ml')}</SelectItem>
                            <SelectItem value="bom_750ml">{t('bom_750ml')}</SelectItem>
                            <SelectItem value="bom_1500ml">{t('bom_1500ml')}</SelectItem>
                            <SelectItem value="minerals">{t('minerals')}</SelectItem>
                            <SelectItem value="preforms">{t('preforms')}</SelectItem>
                            <SelectItem value="caps">{t('caps')}</SelectItem>
                            <SelectItem value="labels">{t('labels')}</SelectItem>
                            <SelectItem value="shrink_roll">{t('shrink_roll')}</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="size_330ml">{t('size_330ml')}</SelectItem>
                            <SelectItem value="size_750ml">{t('size_750ml')}</SelectItem>
                            <SelectItem value="size_1500ml">{t('size_1500ml')}</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {section === 'warehouse_4' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="generatorType">{t('select_generator')}</Label>
                      <Select value={generatorType} onValueChange={setGeneratorType}>
                        <SelectTrigger id="generatorType">
                          <SelectValue placeholder={t('select_generator')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="generator_1">{t('generator_1')}</SelectItem>
                          <SelectItem value="generator_2">{t('generator_2')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalFlowMeter">{t('total_flow_meter')}</Label>
                      <Input 
                        id="totalFlowMeter" 
                        type="number" 
                        placeholder="0"
                        value={totalFlowMeter}
                        onChange={(e) => setTotalFlowMeter(e.target.value)}
                      />
                    </div>
                  </>
                )}
                
                {section === 'wh1_receiving' && (
                  <div className="space-y-2">
                    <Label htmlFor="supplierName">{t('supplier_name')}</Label>
                    <Input 
                      id="supplierName" 
                      placeholder={t('supplier_name')} 
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  </div>
                )}
                
                {materialType === 'mat_preform_20_5' || ((section === 'wh2_transfer' || section === 'blow_molding') && selectedOrder && selectedOrder.productSize === 'bom_750ml') ? (
                  <div className="space-y-2">
                    <Label htmlFor="cartonStandard">{t('preforms_standard')}</Label>
                    <Select value={cartonStandard} onValueChange={setCartonStandard}>
                      <SelectTrigger id="cartonStandard">
                        <SelectValue placeholder={t('preforms_standard')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1248">{t('pcs_carton_1248')}</SelectItem>
                        <SelectItem value="1280">{t('pcs_carton_1280')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="consumedQuantity">
                    {section === 'warehouse_4' ? t('specific_fill_meter') :
                     section === 'wh1_receiving' ? t('received_quantity') :
                     ['warehouse_1', 'warehouse_2'].includes(section) && !['bom_330ml', 'bom_750ml', 'bom_1500ml'].includes(materialType) ? t('consumed_quantity') :
                     ['bom_330ml', 'bom_750ml', 'bom_1500ml'].includes(materialType) ? t('production_count') :
                     section === 'warehouse_3' ? t('product_quantity') :
                     section === 'water_treatment' ? t('minerals') :
                     section === 'blow_molding' ? t('preforms') + ' (pcs)' :
                     section === 'filling' ? t('caps') + ' (pcs)' :
                     section === 'labeling' ? t('labels') + ' (pcs)' :
                     section === 'shrink' ? t('shrink_roll') + ' (kg)' : t('consumed_quantity')}
                  </Label>
                  <Input 
                    id="consumedQuantity" 
                    type="number" 
                    placeholder="0"
                    value={consumedQuantity}
                    onChange={(e) => setConsumedQuantity(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            {(isWarehouse2Section || section === 'warehouse_4') && (
              <div className="col-span-2 space-y-4 pt-4 mt-2 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {section !== 'warehouse_4' && (
                    <div className="space-y-2">
                      <Label htmlFor="balancePreviousShift">{t('balance_previous_shift')} {section === 'shrink' ? '(kg)' : section !== 'water_treatment' ? '(pcs)' : ''}</Label>
                      <Input 
                        id="balancePreviousShift" 
                        type="number" 
                        placeholder="0"
                        value={balancePreviousShift}
                        onChange={(e) => setBalancePreviousShift(e.target.value)}
                      />
                    </div>
                  )}
                  {section !== 'warehouse_4' && (
                    <div className="space-y-2">
                      <Label htmlFor="receivedCurrentShift">{t('received_current_shift')} {section === 'shrink' ? '(kg)' : section !== 'water_treatment' ? '(pcs)' : ''}</Label>
                      <Input 
                        id="receivedCurrentShift" 
                        type="number" 
                        placeholder="0"
                        value={receivedCurrentShift}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  )}
                  {section === 'warehouse_4' && (
                    <div className="space-y-2">
                      <Label htmlFor="balancePreviousShift">Current Main Tank Balance (L)</Label>
                      <Input 
                        id="balancePreviousShift" 
                        type="number" 
                        placeholder="30000"
                        value={balancePreviousShift}
                        readOnly
                        className="bg-muted font-mono"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="balanceNextShift">{section === 'warehouse_4' ? 'Remaining Tank Balance (L)' : t('balance_next_shift') + (section === 'shrink' ? ' (kg)' : section !== 'water_treatment' ? ' (pcs)' : '')}</Label>
                    <Input 
                      id="balanceNextShift" 
                      type="number" 
                      placeholder="0"
                      value={balanceNextShift}
                      readOnly
                      className="bg-muted font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea 
              id="notes" 
              placeholder={t('notes')} 
              className="resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-4">
          <Button variant="outline" onClick={() => setLocation('/')}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>
            {isEditMode ? t('update_record') : t('save')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}