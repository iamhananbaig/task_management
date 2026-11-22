import { colorNames, swatch } from "@/lib/labels"
import { cn } from "@/lib/utils"

/** Row of colour dots (radio group). */
export function ColorPicker({ value, onChange, label = "Colour" }: { value: string; onChange: (color: string) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colorNames.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          title={color}
          onClick={() => onChange(color)}
          className={cn(
            "size-7 rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring",
            swatch(color).dot,
            value === color && "ring-2 ring-foreground"
          )}
        />
      ))}
    </div>
  )
}
