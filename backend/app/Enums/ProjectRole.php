<?php

namespace App\Enums;

/** A user's role inside one project (separate from their app-wide Spatie role). */
enum ProjectRole: string
{
    /** Changes the project's settings, members and workflow. */
    case Manager = 'manager';
    case Member = 'member';
}
