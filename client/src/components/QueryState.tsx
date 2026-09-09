import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryError({ message = "Unable to load this data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5" /> Something went wrong</div><p className="mt-2 text-sm">{message}</p>{onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}</div>;
}
