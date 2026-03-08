import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { db, ProductionOrder, addOrderWithSync, updateOrderWithSync } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Plus, Calendar, Settings2 } from "lucide-react";

export default function Orders() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [showNewForm, setShowNewForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [productSize, setProductSize] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const orders = useLiveQuery(
    () => db.orders.orderBy('createdAt').reverse().toArray()
  );

  const handleSave = async () => {
    if (!productSize || !targetQuantity) {
      toast({
        title: t('error_save'),
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await addOrderWithSync({
        date,
        productSize: productSize as any,
        targetQuantity: Number(targetQuantity),
        status: 'active',
        notes,
        createdAt: Date.now()
      });
      
      toast({ title: t('success_save') });
      setShowNewForm(false);
      
      // Reset form
      setProductSize("");
      setTargetQuantity("");
      setNotes("");
    } catch (error) {
      toast({
        title: t('error_save'),
        variant: "destructive",
      });
    }
  };

  const markCompleted = async (id: number) => {
    try {
      await updateOrderWithSync(id, { status: 'completed' });
      toast({ title: t('success_save') });
    } catch (error) {
      toast({ title: t('error_save'), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('production_orders')}</h1>
        <Button onClick={() => setShowNewForm(!showNewForm)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('new_order')}
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{t('new_order')}</CardTitle>
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
              <div className="space-y-2">
                <Label htmlFor="productSize">{t('product_size')}</Label>
                <Select value={productSize} onValueChange={setProductSize}>
                  <SelectTrigger id="productSize">
                    <SelectValue placeholder={t('product_size')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bom_330ml">{t('bom_330ml')}</SelectItem>
                    <SelectItem value="bom_750ml">{t('bom_750ml')}</SelectItem>
                    <SelectItem value="bom_1500ml">{t('bom_1500ml')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetQuantity">{t('target_quantity')}</Label>
              <Input 
                id="targetQuantity" 
                type="number" 
                placeholder="0" 
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea 
                id="notes" 
                placeholder={t('notes')} 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('save')}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="space-y-4">
        {orders?.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed">
            {t('no_records')}
          </div>
        ) : (
          orders?.map((order) => (
            <Card key={order.id} className={order.status === 'active' ? 'border-primary/50 shadow-sm' : 'opacity-75'}>
              <CardHeader className="pb-3 p-4 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base">{t("order_hash", "Order #")}{order.id}</CardTitle>
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {order.date}
                  </CardDescription>
                </div>
                <Badge variant={order.status === 'active' ? 'default' : 'secondary'} className={order.status === 'active' ? 'bg-blue-500' : ''}>
                  {order.status === 'active' ? t('active') : t('completed')}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 grid gap-2 text-sm">
                <div className="flex justify-between p-2 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">{t('product_size')}:</span>
                  <span className="font-medium text-right max-w-[200px] truncate" title={t(order.productSize)}>{t(order.productSize)}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded-md">
                  <span className="text-muted-foreground">{t('target_quantity')}:</span>
                  <span className="font-medium">{order.targetQuantity} Cartons</span>
                </div>
                {order.notes && (
                  <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                    {order.notes}
                  </div>
                )}
              </CardContent>
              {order.status === 'active' && (
                <CardFooter className="p-3 border-t bg-muted/20 flex justify-end">
                  <Button size="sm" variant="outline" className="text-emerald-600 hover:text-emerald-700" onClick={() => markCompleted(order.id!)}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t('completed')}
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
