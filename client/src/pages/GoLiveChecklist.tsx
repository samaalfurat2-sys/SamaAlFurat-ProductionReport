import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export default function GoLiveChecklist() {
  const { t } = useTranslation();

  const sections = [
    {
      title: "1. Basic Data & Masters",
      items: [
        { label: "Define all active Products & BOM mappings", status: "complete" },
        { label: "Define Unit Conversions (Cartons vs Base Units)", status: "complete" },
        { label: "Create initial Active Production Orders", status: "complete" },
      ]
    },
    {
      title: "2. Initial Inventory Loading",
      items: [
        { label: "Count physical stock in WH1 (Raw Materials)", status: "pending" },
        { label: "Count physical stock in WH2 (Hall stations)", status: "pending" },
        { label: "Count physical stock in WH3 (Finished Goods)", status: "pending" },
        { label: "Enter all starting balances via Inventory Setup", status: "pending" }
      ]
    },
    {
      title: "3. Roles & Permissions",
      items: [
        { label: "Operators trained on reporting interface", status: "pending" },
        { label: "Supervisors trained on WH2 transfer and BOM logic", status: "complete" },
        { label: "Accountants trained on review and cost centers", status: "pending" },
        { label: "Auditor trained on discrepancy handling", status: "pending" },
      ]
    },
    {
      title: "4. System Controls Validated",
      items: [
        { label: "Negative stock blocking tested", status: "complete" },
        { label: "BOM auto-deduction validated", status: "complete" },
        { label: "Correction/Audit trail workflow validated", status: "pending" },
      ]
    }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("go_live_readiness", "Go-Live Readiness")}</h1>
        <p className="text-muted-foreground">Track system setup and organizational readiness</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, idx) => (
          <Card key={idx} className="h-full">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex items-start space-x-3">
                  <Checkbox 
                    checked={item.status === "complete"} 
                    id={`check-${idx}-${itemIdx}`} 
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label 
                      htmlFor={`check-${idx}-${itemIdx}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {item.label}
                    </label>
                    <Badge variant={item.status === "complete" ? "default" : "outline"} className="w-fit mt-1">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
