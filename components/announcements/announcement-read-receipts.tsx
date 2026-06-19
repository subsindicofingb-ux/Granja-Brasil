import { formatDateTime } from "@/lib/utils";
import type { AnnouncementReadReceipt } from "@/lib/services/announcements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AnnouncementReadReceiptsProps {
  receipts: AnnouncementReadReceipt[];
}

export function AnnouncementReadReceipts({ receipts }: AnnouncementReadReceiptsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confirmações de leitura</CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro automático ao abrir o aviso — use para comprovar a leitura.
        </p>
      </CardHeader>
      <CardContent>
        {receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma leitura confirmada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Leitor</th>
                  <th className="pb-2 font-medium">Confirmado em</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.profile_id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{receipt.full_name}</td>
                    <td className="py-2 text-muted-foreground">{formatDateTime(receipt.read_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
