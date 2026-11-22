<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Audit;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * First sign-in on a new install: creates an admin (or makes an existing user admin and resets
 * their password). The password is asked for, never passed on the command line, and must be
 * changed at first sign-in.
 */
#[Signature('tasks:create-admin {email : Email to sign in with} {--name= : Display name (new users only)}')]
#[Description('Create an admin user, or make an existing user admin with a new password')]
class CreateAdmin extends Command
{
    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();
        $name = $user?->name ?? ($this->option('name') ?: $this->ask('Name'));
        $password = (string) $this->secret('Password (at least 10 characters)');

        $validator = Validator::make(
            ['email' => $email, 'name' => $name, 'password' => $password],
            [
                'email' => ['required', 'email', 'max:255'],
                'name' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', Password::min(10)],
            ],
        );
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user ??= new User(['email' => $email, 'name' => $name]);
        $user->password = $password;
        $user->password_changed_at = null;   // asked to choose their own at first sign-in
        $user->is_active = true;
        $user->save();
        $user->syncRoles(['admin']);
        Audit::log('role changed', 'Role → admin (tasks:create-admin)', $user, ['role' => [null, 'admin']], null, $user);

        $this->info("{$user->email} is an admin. They will choose a new password at first sign-in.");

        return self::SUCCESS;
    }
}
