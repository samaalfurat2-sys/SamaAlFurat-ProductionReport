import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { db, addRecordWithSync } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Fuel, ArrowDownToLine, ArrowUpFromLine, History, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ar, enUS } from 'date-fns/locale';
import i18n from '@/lib/i18n';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Warehouse4Diesel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const TANK_CAPACITY = 30000; // 30,000 Liters
  
  // Receiving Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [notes, setNotes] = useState("");

  // Query all WH4 records (both receipts and consumptions)
  const allWH4Records = useLiveQuery(
    () => db.records.where('section').equals('warehouse_4').reverse().sortBy('createdAt')
  );

  // Calculate current balance
  const [currentBalance, setCurrentBalance] = useState(0);

  const inventoryRecords = useLiveQuery(() => db.inventory.toArray());

  useEffect(() => {
    if (allWH4Records) {
      let baseBalance = 30000;
      if (inventoryRecords) {
        const wh4Opening = inventoryRecords.find(inv => inv.location === 'warehouse_4' && inv.material === 'diesel');
        if (wh4Opening) {
          baseBalance = wh4Opening.quantity;
        }
      }

      let totalReceived = 0;
      let totalConsumed = 0;
      
      allWH4Records.forEach((r: any) => {
        if (r.status !== 'rejected' && r.status !== 'audit_rejected') {
          if (r.data?.type === 'receipt') {
            totalReceived += Number(r.data?.receivedQuantity || 0);
          } else {
            totalConsumed += Number(r.data?.consumedQuantity || 0);
          }
        }
      });
      
      const calcBalance = baseBalance + totalReceived - totalConsumed;
      setCurrentBalance(calcBalance);
    }
  }, [allWH4Records, inventoryRecords]);

  const handleReceiveFuel = async () => {
    try {
      if (!supplierName || !receivedQuantity || !receiverName) {
        toast({ title: "Error", description: "Supplier, Quantity, and Receiver are required.", variant: "destructive" });
        return;
      }
      
      const qty = Number(receivedQuantity);
      
      if (isNaN(qty) || qty <= 0) {
        toast({ title: "Error", description: "Quantity must be a positive number.", variant: "destructive" });
        return;
      }
      
      if (currentBalance + qty > TANK_CAPACITY) {
        toast({ 
          title: "Capacity Exceeded", 
          description: `Cannot receive \${qty}L. Maximum capacity is \${TANK_CAPACITY}L. You can only receive up to \${TANK_CAPACITY - currentBalance}L.`, 
          variant: "destructive" 
        });
        return;
      }

      await addRecordWithSync({
        date,
        shift: 'morning', // Default or make selectable if needed
        section: 'warehouse_4',
        data: {
          type: 'receipt', // custom type to distinguish from consumption
          supplierName,
          receivedQuantity: qty,
          documentRef,
          operator: receiverName, // mapped to operator for consistency
          notes,
          balanceAfter: currentBalance + qty
        },
        status: 'accepted', // Auto accept receipts for now, or could be pending_supervisor
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      toast({
        title: "Fuel Received",
        description: `Successfully received \${qty}L from \${supplierName}.`,
      });
      
      // Reset form
      setSupplierName("");
      setReceivedQuantity("");
      setDocumentRef("");
      setNotes("");
      
    } catch (error) {
      toast({ title: "Error saving record", variant: "destructive" });
    }
  };

  const fillPercentage = (currentBalance / TANK_CAPACITY) * 100;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Fuel className="h-6 w-6 text-primary" />
            WH4: Diesel Management
          </h1>
          <p className="text-muted-foreground">{t('warehouse_4')} - Main Tank Tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tank Status Card */}
        <Card className="md:col-span-1 border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle>{t("main_tank_status", "Main Tank Status")}</CardTitle>
            <CardDescription>{t("current_diesel", "Current available diesel fuel")}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 flex items-center justify-center rounded-full border-4 border-muted overflow-hidden bg-background">
              {/* Liquid Fill Animation Effect */}
              <div 
                className={`absolute bottom-0 w-full transition-all duration-1000 ease-in-out \${
                  fillPercentage < 15 ? 'bg-destructive' : 
                  fillPercentage < 30 ? 'bg-warning' : 
                  'bg-primary'
                }`}
                style={{ height: `\${fillPercentage}%`, opacity: 0.8 }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <span className="text-3xl font-bold font-mono tracking-tighter drop-shadow-md">
                  {currentBalance.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-muted-foreground">/ {TANK_CAPACITY.toLocaleString()} L</span>
              </div>
            </div>
            
            <div className="mt-6 w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t("capacity", "Capacity")}</span>
                <span className="font-medium">{fillPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className={`h-2 rounded-full \${
                    fillPercentage < 15 ? 'bg-destructive' : 
                    fillPercentage < 30 ? 'bg-warning' : 
                    'bg-primary'
                  }`}
                  style={{ width: `\${Math.min(fillPercentage, 100)}%` }}
                />
              </div>
            </div>

            {fillPercentage < 15 && (
              <Alert variant="destructive" className="mt-4 py-2 px-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">{t("low_fuel_warning", "Low Fuel Warning")}</AlertTitle>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Action Tabs */}
        <Card className="md:col-span-2">
          <Tabs defaultValue="receive" className="w-full">
            <CardHeader className="pb-0 border-b">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="receive" className="data-[state=active]:bg-background">
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Receive Fuel (Supplier)
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-background">
                  <History className="h-4 w-4 mr-2" />
                  Movement History
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent className="pt-6">
              <TabsContent value="receive" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("receipt_date", "Receipt Date")}</Label>
                    <Input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("supplier_name", "Supplier Name")}</Label>
                    <Input 
                      placeholder="e.g. National Fuel Co." 
                      value={supplierName} 
                      onChange={(e) => setSupplierName(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("delivered_qty", "Delivered Quantity (Liters)")}</Label>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={receivedQuantity} 
                      onChange={(e) => setReceivedQuantity(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("invoice_ref", "Invoice / Doc Ref #")}</Label>
                    <Input 
                      placeholder="INV-12345" 
                      value={documentRef} 
                      onChange={(e) => setDocumentRef(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("receiver_name", "Receiver Name (Operator)")}</Label>
                    <Input 
                      placeholder="Name of person receiving" 
                      value={receiverName} 
                      onChange={(e) => setReceiverName(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input 
                    placeholder="Any remarks about the delivery..." 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                  />
                </div>
                <Button onClick={handleReceiveFuel} className="w-full">
                  Record Fuel Receipt
                </Button>
              </TabsContent>
              
              <TabsContent value="history" className="mt-0">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Qty (L)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allWH4Records && allWH4Records.length > 0 ? (
                        allWH4Records.map((record: any) => {
                          const isReceipt = record.data?.type === 'receipt';
                          const qty = isReceipt ? record.data?.receivedQuantity : record.data?.consumedQuantity;
                          const operator = record.data?.operator || record.data?.receiverName || '-';
                          
                          return (
                            <TableRow key={record.id}>
                              <TableCell className="text-xs">
                                <div>{record.date}</div>
                                <div className="text-muted-foreground">{format(record.createdAt, 'HH:mm')}</div>
                              </TableCell>
                              <TableCell>
                                {isReceipt ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                    <ArrowDownToLine className="h-3 w-3 mr-1" />
                                    Receipt
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                    <ArrowUpFromLine className="h-3 w-3 mr-1" />
                                    Issue
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {isReceipt ? (
                                  <div>
                                    <span className="font-medium">{record.data?.supplierName}</span>
                                    <div className="text-muted-foreground text-xs">Ref: {record.data?.documentRef}</div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-medium">{record.data?.generatorType || 'Generator'}</span>
                                    <div className="text-muted-foreground text-xs">Op: {operator}</div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-medium \${isReceipt ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                {isReceipt ? '+' : '-'}{Number(qty).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No diesel movement history found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
