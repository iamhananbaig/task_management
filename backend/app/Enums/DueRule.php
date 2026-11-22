<?php

namespace App\Enums;

use Carbon\CarbonImmutable;

/**
 * When a routine item's task is due, counted from the end of its period. Calendar days: a due
 * date on a weekend or holiday stays where it is.
 */
enum DueRule: string
{
    /** N days after period end (0 = on the last day). */
    case DaysAfterEnd = 'days_after_end';
    /** Day N of the month after the period ends (e.g. 15 → the 15th; clamped to the month's length). */
    case DayOfNextMonth = 'day_of_next_month';
    /** N days before period end. */
    case DaysBeforeEnd = 'days_before_end';

    public function dueDate(CarbonImmutable $periodEnd, int $value): CarbonImmutable
    {
        return match ($this) {
            self::DaysAfterEnd => $periodEnd->addDays($value),
            self::DaysBeforeEnd => $periodEnd->subDays($value),
            self::DayOfNextMonth => (function () use ($periodEnd, $value) {
                $month = $periodEnd->startOfMonth()->addMonthNoOverflow();

                return $month->day(min(max($value, 1), $month->daysInMonth));
            })(),
        };
    }
}
