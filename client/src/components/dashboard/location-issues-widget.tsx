import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Issue = { id: string; locationId: string; title: string; severity: string; status: string };
type Location = { id: string; name: string };

export default function LocationIssuesWidget() {
  const issuesQuery = useQuery<Issue[]>({ queryKey: ["/api/location-issues"], refetchInterval: 15_000 });
  const locationsQuery = useQuery<Location[]>({ queryKey: ["/api/locations"], staleTime: 30_000 });
  const locations = new Map((locationsQuery.data ?? []).map((location) => [location.id, location.name]));
  const active = (issuesQuery.data ?? []).filter((issue) => !["resolved", "cancelled"].includes(issue.status)).slice(0, 5);
  return <Card className="border-l-4 border-l-amber-500/80"><CardHeader className="flex flex-row items-center justify-between px-3 py-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" />Площадки требуют внимания</CardTitle><Link href="/locations" className="text-xs text-primary hover:underline">Все</Link></CardHeader><CardContent className="space-y-2 px-3 pb-3 pt-0">{active.length === 0 ? <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Активных ошибок нет</div> : active.map((issue) => <div key={issue.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{issue.title}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{locations.get(issue.locationId) || "Площадка"}</div></div><Badge variant="outline" className="shrink-0">{issue.severity}</Badge></div>)}</CardContent></Card>;
}
