import * as React from "react"
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { parseTypedDate, toYmd } from "@/lib/parse-date"
import { cn, formatDate } from "@/lib/utils"

interface DatePickerInputProps {
  id?: string
  label?: string
  /** Y-m-d, or "" for none */
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Local-date string for a Date picked in the calendar (no UTC shift). */
function dateToYmd(date: Date): string {
  return toYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

const ymdToDate = (value: string) => (value ? new Date(value + "T12:00:00") : undefined)

/** Date field shown as dd-mmm-yyyy; type a date or pick from the calendar. Emits Y-m-d. */
export function DatePickerInput({
  id,
  label,
  value,
  onChange,
  required,
  placeholder = "dd-mmm-yyyy",
  disabled,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState(value ? formatDate(value) : "")
  const [invalid, setInvalid] = React.useState(false)
  const [month, setMonth] = React.useState<Date | undefined>(ymdToDate(value))

  // Follow external changes (e.g. a form reset) — adjusted during render, not in an effect
  const [prevValue, setPrevValue] = React.useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value ? formatDate(value) : "")
    setInvalid(false)
    if (value) setMonth(ymdToDate(value))
  }

  const commit = () => {
    if (!text.trim()) {
      setInvalid(false)
      if (value) onChange("")
      return
    }
    const parsed = parseTypedDate(text)
    if (parsed) {
      setInvalid(false)
      setText(formatDate(parsed))
      if (parsed !== value) onChange(parsed)
    } else {
      setInvalid(true)
    }
  }

  return (
    <Field className={className} data-invalid={invalid || undefined}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <InputGroup>
        <InputGroupInput
          id={id}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={<InputGroupButton aria-label="Pick a date" disabled={disabled} />}
            >
              <CalendarBlankIcon className="size-4" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end" sideOffset={10}>
              <PickerBody
                selected={ymdToDate(value)}
                month={month ?? new Date()}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  onChange(dateToYmd(date))
                  setMonth(date)
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {invalid && <p className="text-xs text-destructive">Use dd-mmm-yyyy, dd/mm/yyyy or yyyy-mm-dd.</p>}
    </Field>
  )
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Calendar with its own month / year pickers. Month and year are chosen from grids inside the
 * popover — not native <select> dropdowns, whose lists close as soon as they open inside a popover.
 */
function PickerBody({
  selected,
  month,
  onMonthChange,
  onSelect,
}: {
  selected?: Date
  month: Date
  onMonthChange: (d: Date) => void
  onSelect: (d: Date) => void
}) {
  const [view, setView] = React.useState<"days" | "months" | "years">("days")
  const year = month.getFullYear()
  const [yearPage, setYearPage] = React.useState(year - (year % 12))
  const go = (y: number, m: number) => onMonthChange(new Date(y, m, 1, 12))
  const shift = (delta: number) => go(year, month.getMonth() + delta)

  const header = (
    <div className="flex items-center justify-between gap-1 px-3 pt-3">
      <Button
        type="button" variant="ghost" size="icon-sm" aria-label={view === "years" ? "Earlier years" : "Previous month"}
        onClick={() => (view === "years" ? setYearPage((p) => p - 12) : view === "months" ? go(year - 1, month.getMonth()) : shift(-1))}
      >
        <CaretLeftIcon />
      </Button>
      <div className="flex items-center gap-1">
        <Button
          type="button" variant={view === "months" ? "secondary" : "ghost"} size="sm" aria-label="Choose month"
          onClick={() => setView(view === "months" ? "days" : "months")}
        >
          {MONTH_LABELS[month.getMonth()]} <CaretDownIcon className="size-3" />
        </Button>
        <Button
          type="button" variant={view === "years" ? "secondary" : "ghost"} size="sm" aria-label="Choose year"
          onClick={() => { setYearPage(year - (year % 12)); setView(view === "years" ? "days" : "years") }}
        >
          {year} <CaretDownIcon className="size-3" />
        </Button>
      </div>
      <Button
        type="button" variant="ghost" size="icon-sm" aria-label={view === "years" ? "Later years" : "Next month"}
        onClick={() => (view === "years" ? setYearPage((p) => p + 12) : view === "months" ? go(year + 1, month.getMonth()) : shift(1))}
      >
        <CaretRightIcon />
      </Button>
    </div>
  )

  if (view === "months") {
    return (
      <div className="w-64">
        {header}
        <div className="grid grid-cols-3 gap-1.5 p-3">
          {MONTH_LABELS.map((label, m) => (
            <Button
              key={label} type="button" size="sm" variant={m === month.getMonth() ? "default" : "ghost"}
              onClick={() => { go(year, m); setView("days") }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    )
  }
  if (view === "years") {
    return (
      <div className="w-64">
        {header}
        <div className="grid grid-cols-3 gap-1.5 p-3">
          {Array.from({ length: 12 }, (_, i) => yearPage + i).map((y) => (
            <Button
              key={y} type="button" size="sm" variant={y === year ? "default" : "ghost"}
              className={cn("tabular-nums", y === new Date().getFullYear() && y !== year && "text-primary")}
              onClick={() => { go(y, month.getMonth()); setView("months") }}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div>
      {header}
      <Calendar
        mode="single"
        selected={selected}
        month={month}
        onMonthChange={onMonthChange}
        classNames={{ month_caption: "hidden", nav: "hidden" }}
        className="pt-1"
        onSelect={(date) => date && onSelect(date)}
      />
    </div>
  )
}
