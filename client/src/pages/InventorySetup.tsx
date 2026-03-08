import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db, updateInventoryWithSync } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function InventorySetup() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [warehouse, setWarehouse] = useState("warehouse_1");
  const [material, setMaterial] = useState("mat_preform_11_7");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");

  const inventoryRecords = useLiveQuery(() => db.inventory.toArray());

  const saveBalance = async () => {
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid positive number for stock balance.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Check if we already have an entry for this location + material
      const existing = await db.inventory
        .where('location').equals(warehouse)
        .and(item => item.material === material)
        .first();

      if (existing && existing.id) {
        await updateInventoryWithSync(existing.id, {
          quantity: Number(quantity),
          unit: unit,
          updatedAt: Date.now()
        });
      } else {
        await db.inventory.add({
          location: warehouse,
          material: material,
          quantity: Number(quantity),
          unit: unit,
          updatedAt: Date.now()
        });
      }
      
      toast({
        title: "Balance Saved",
        description: `Set ${quantity} ${unit} of ${t(material)} in ${t(warehouse)}`,
      });
      setQuantity("");
    } catch (error) {
      toast({
        title: "Error saving balance",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("initial_inventory_setup", "Initial Inventory Setup")}</h1>
        <p className="text-muted-foreground">{t("set_opening_balances", "Set opening balances for warehouses and stations")}</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("strict_base_unit_policy", "Strict Base Unit Policy")}</AlertTitle>
        <AlertDescription>
          All stock balances must be entered in base units (pcs, L, kg) only. Cartons and rolls are display-only units.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("set_opening_balance", "Set Opening Balance")}</CardTitle>
          <CardDescription>Select location and material to set current physical stock</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("location_warehouse", "Location / Warehouse")}</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse_1">{t('warehouse_1')} (Raw Materials)</SelectItem>
                  <SelectItem value="warehouse_2">{t('warehouse_2')} (Production Hall)</SelectItem>
                  <SelectItem value="warehouse_3">{t('warehouse_3')} (Finished Goods)</SelectItem>
                  <SelectItem value="warehouse_4">{t('warehouse_4')} (Diesel)</SelectItem>
                  <SelectItem value="water_treatment">{t('water_treatment')}</SelectItem>
                  <SelectItem value="blow_molding">{t('blow_molding')}</SelectItem>
                  <SelectItem value="filling">{t('filling')}</SelectItem>
                  <SelectItem value="labeling">{t('labeling')}</SelectItem>
                  <SelectItem value="shrink">{t('shrink')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>{t("material_item", "Material / Item")}</Label>
              <Select value={material} onValueChange={(val) => {
                setMaterial(val);
                if(val.includes('minerals') || val === 'diesel') setUnit('L');
                else if(val.includes('shrink')) setUnit('kg');
                else setUnit('pcs');
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mat_preform_11_7">{t('mat_preform_11_7')} (pcs)</SelectItem>
                  <SelectItem value="mat_preform_20_5">{t('mat_preform_20_5')} (pcs)</SelectItem>
                  <SelectItem value="mat_preform_31_5">{t('mat_preform_31_5')} (pcs)</SelectItem>
                  <SelectItem value="mat_caps_30_25">{t('mat_caps_30_25')} (pcs)</SelectItem>
                  <SelectItem value="mat_label_330">{t('mat_label_330')} (pcs)</SelectItem>
                  <SelectItem value="mat_label_750">{t('mat_label_750')} (pcs)</SelectItem>
                  <SelectItem value="mat_label_1500">{t('mat_label_1500')} (pcs)</SelectItem>
                  <SelectItem value="mat_shrink_470">{t('mat_shrink_470')} (kg)</SelectItem>
                  <SelectItem value="mat_shrink_560">{t('mat_shrink_560')} (kg)</SelectItem>
                  <SelectItem value="minerals">Minerals/Chemicals (L)</SelectItem>
                  <SelectItem value="diesel">{t('diesel')} (L)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Base Quantity ({unit})</Label>
              <Input 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Enter quantity in ${unit}`}
              />
            </div>
          </div>

          <Button onClick={saveBalance} className="w-full mt-4">
            <Save className="w-4 h-4 mr-2" /> Save Opening Balance
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("current_opening_balances", "Current Opening Balances")}</CardTitle>
          <CardDescription>{t("live_data", "Live data from database")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryRecords && inventoryRecords.length > 0 ? (
                  inventoryRecords.map((record, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{t(record.location)}</TableCell>
                      <TableCell>{t(record.material)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{record.quantity.toLocaleString()}</TableCell>
                      <TableCell>{record.unit}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      No opening balances recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
