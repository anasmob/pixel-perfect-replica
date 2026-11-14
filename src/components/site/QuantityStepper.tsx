import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuantityStepper({
  value,
  onChange,
  canIncrease,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  canIncrease: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Quantity for ${label}`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`Remove one ${label}`}
      >
        <Minus />
      </Button>
      <span className="w-8 text-center font-mono text-base tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        aria-label={`Add one ${label}`}
      >
        <Plus />
      </Button>
    </div>
  );
}
