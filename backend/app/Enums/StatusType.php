<?php

namespace App\Enums;

/**
 * What a project status means, whatever it is called. Reports, reminders and the
 * "completed" date read the type, so statuses can be renamed freely.
 */
enum StatusType: string
{
    case Open = 'open';
    case Active = 'active';
    case Review = 'review';
    case Done = 'done';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Not started',
            self::Active => 'In progress',
            self::Review => 'In review',
            self::Done => 'Done',
        };
    }
}
