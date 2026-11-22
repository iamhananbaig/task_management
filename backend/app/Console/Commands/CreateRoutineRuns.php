<?php

namespace App\Console\Commands;

use App\Services\RoutineService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Throwable;

/** Daily: create the runs of routines whose next period ends within their lead days. */
#[Signature('routines:create-runs')]
#[Description('Create the task batches of routines that are due')]
class CreateRoutineRuns extends Command
{
    public function handle(RoutineService $routines): int
    {
        try {
            $runs = $routines->createDueRuns();
        } catch (Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
        foreach ($runs as $run) {
            $this->line("Started {$run->name} ({$run->tasks()->count()} task(s))");
        }
        $this->info('Created '.count($runs).' run(s).');

        return self::SUCCESS;
    }
}
