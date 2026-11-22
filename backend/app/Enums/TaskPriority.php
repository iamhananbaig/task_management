<?php

namespace App\Enums;

enum TaskPriority: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
    case Urgent = 'urgent';

    /** Sort weight: urgent first. */
    public function weight(): int
    {
        return match ($this) {
            self::Urgent => 0,
            self::High => 1,
            self::Medium => 2,
            self::Low => 3,
        };
    }
}
