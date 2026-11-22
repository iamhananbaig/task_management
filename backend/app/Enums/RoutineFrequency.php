<?php

namespace App\Enums;

use Carbon\CarbonImmutable;

/**
 * How often a routine runs. Periods follow the Jul–Jun fiscal year (config app.fiscal_year_end_month):
 * quarters end Sep / Dec / Mar / Jun, halves Dec / Jun, years Jun. Weeks run Monday–Sunday.
 */
enum RoutineFrequency: string
{
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case HalfYearly = 'half_yearly';
    case Yearly = 'yearly';

    public function label(): string
    {
        return match ($this) {
            self::Weekly => 'Weekly',
            self::Monthly => 'Monthly',
            self::Quarterly => 'Quarterly',
            self::HalfYearly => 'Half-yearly',
            self::Yearly => 'Yearly',
        };
    }

    /** The end of the period that contains $date. */
    public function periodEndFor(CarbonImmutable $date): CarbonImmutable
    {
        if ($this === self::Weekly) {
            return $date->endOfWeek(CarbonImmutable::SUNDAY)->startOfDay();
        }
        $months = $this->months();
        $fyEnd = (int) config('app.fiscal_year_end_month', 6);
        // Months since the fiscal year started (0 = first month), then round up to the period
        $index = ($date->month - $fyEnd - 1 + 12) % 12;
        $add = $months - 1 - ($index % $months);

        return $date->startOfMonth()->addMonthsNoOverflow($add)->endOfMonth()->startOfDay();
    }

    /** The end of the period after the one ending on $periodEnd. */
    public function nextPeriodEnd(CarbonImmutable $periodEnd): CarbonImmutable
    {
        if ($this === self::Weekly) {
            return $periodEnd->addWeek();
        }

        return $periodEnd->startOfMonth()->addMonthsNoOverflow($this->months())->endOfMonth()->startOfDay();
    }

    public function periodStart(CarbonImmutable $periodEnd): CarbonImmutable
    {
        if ($this === self::Weekly) {
            return $periodEnd->subDays(6);
        }

        return $periodEnd->startOfMonth()->subMonthsNoOverflow($this->months() - 1);
    }

    /** "June 2026", "Q4 FY26", "H2 FY26", "FY26", "Week ending 28-Jun-2026". */
    public function periodName(CarbonImmutable $periodEnd): string
    {
        $fyEnd = (int) config('app.fiscal_year_end_month', 6);
        $fiscalYear = $periodEnd->month > $fyEnd ? $periodEnd->year + 1 : $periodEnd->year;
        $fy = 'FY'.substr((string) $fiscalYear, -2);
        $monthInYear = ($periodEnd->month - $fyEnd - 1 + 12) % 12 + 1;

        return match ($this) {
            self::Weekly => 'Week ending '.$periodEnd->format('d-M-Y'),
            self::Monthly => $periodEnd->format('F Y'),
            self::Quarterly => 'Q'.intdiv($monthInYear + 2, 3).' '.$fy,
            self::HalfYearly => 'H'.intdiv($monthInYear + 5, 6).' '.$fy,
            self::Yearly => $fy,
        };
    }

    private function months(): int
    {
        return match ($this) {
            self::Monthly => 1,
            self::Quarterly => 3,
            self::HalfYearly => 6,
            self::Yearly => 12,
            self::Weekly => 0,
        };
    }
}
