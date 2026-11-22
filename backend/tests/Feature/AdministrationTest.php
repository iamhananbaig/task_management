<?php

use App\Models\AuditLog;
use App\Models\User;
use App\Support\Permissions;
use Database\Seeders\RolePermissionSeeder;
use Spatie\Permission\Models\Role;

it('lets admins create users who must set their own password', function () {
    $this->signIn($this->userWithRole('admin'));

    $this->postJson('/api/v1/users', ['name' => 'Sara', 'email' => 'Sara@Example.com', 'password' => 'TempPass1234', 'role' => 'member'])
        ->assertCreated()
        ->assertJsonPath('data.email', 'sara@example.com')
        ->assertJsonPath('data.must_change_password', true);
});

it('does not let managers manage users', function () {
    $this->signIn($this->userWithRole('manager'));

    $this->getJson('/api/v1/users')->assertOk();
    $this->postJson('/api/v1/users', ['name' => 'X', 'email' => 'x@example.com', 'password' => 'TempPass1234', 'role' => 'member'])->assertForbidden();
});

it('keeps at least one administrator and never deactivates yourself', function () {
    $admin = $this->signIn($this->userWithRole('admin'));

    $this->putJson("/api/v1/users/{$admin->id}", ['role' => 'member'])->assertUnprocessable();
    $this->putJson("/api/v1/users/{$admin->id}", ['is_active' => false])->assertUnprocessable();
});

it('signs a user out everywhere on password reset or deactivation', function () {
    $this->signIn($this->userWithRole('admin'));
    $user = $this->userWithRole('member');
    $user->createToken('phone');

    $this->putJson("/api/v1/users/{$user->id}", ['password' => 'TempPass1234'])->assertOk()->assertJsonPath('data.must_change_password', true);
    expect($user->tokens()->count())->toBe(0);

    $user->createToken('phone');
    $this->putJson("/api/v1/users/{$user->id}", ['is_active' => false])->assertOk();
    expect($user->tokens()->count())->toBe(0);
});

it('edits role permissions with an audit entry, but never the admin role', function () {
    $this->signIn($this->userWithRole('admin'));
    $member = Role::findByName('member', 'web');

    $this->putJson("/api/v1/roles/{$member->id}", ['permissions' => ['create tasks', 'comment on tasks']])->assertOk();
    $this->putJson('/api/v1/roles/'.Role::findByName('admin', 'web')->id, ['permissions' => []])->assertUnprocessable();

    expect($member->fresh()->permissions->pluck('name')->sort()->values()->all())->toBe(['comment on tasks', 'create tasks'])
        ->and(AuditLog::where('action', 'permissions changed')->first()->summary)->toContain('− edit tasks');
});

it('keeps the seeder from overwriting edited roles', function () {
    Role::findByName('member', 'web')->syncPermissions(['comment on tasks']);

    $this->seed(RolePermissionSeeder::class);

    expect(Role::findByName('member', 'web')->permissions->pluck('name')->all())->toBe(['comment on tasks'])
        ->and(Role::findByName('admin', 'web')->permissions)->toHaveCount(count(Permissions::all()));
});

it('shows the audit log only to those allowed', function () {
    $this->signIn($this->userWithRole('member'));
    $this->getJson('/api/v1/audit-log')->assertForbidden();

    $this->signIn($this->userWithRole('admin'));
    $this->getJson('/api/v1/audit-log')->assertOk();
});

it('lists active users for pickers', function () {
    $this->userWithRole('member', ['name' => 'Gone', 'is_active' => false]);
    $this->signIn($this->userWithRole('member'));

    $names = collect($this->getJson('/api/v1/users/options')->json('data'))->pluck('name');
    expect($names)->not->toContain('Gone');
    expect(User::count())->toBe(2);
});

it('creates the first admin from the command line', function () {
    $this->artisan('tasks:create-admin', ['email' => 'Boss@Example.com', '--name' => 'Boss'])
        ->expectsQuestion('Password (at least 10 characters)', 'FirstPass1234')
        ->assertSuccessful();

    $admin = User::where('email', 'boss@example.com')->firstOrFail();
    expect($admin->hasRole('admin'))->toBeTrue()
        ->and($admin->password_changed_at)->toBeNull();
    $this->postJson('/api/v1/login', ['email' => 'boss@example.com', 'password' => 'FirstPass1234'])->assertOk();
});

it('makes an existing user admin and refuses short passwords', function () {
    $member = $this->userWithRole('member');

    $this->artisan('tasks:create-admin', ['email' => $member->email])
        ->expectsQuestion('Password (at least 10 characters)', 'short')
        ->assertFailed();
    expect($member->fresh()->hasRole('admin'))->toBeFalse();

    $this->artisan('tasks:create-admin', ['email' => $member->email])
        ->expectsQuestion('Password (at least 10 characters)', 'ResetPass1234')
        ->assertSuccessful();
    expect($member->fresh()->hasRole('admin'))->toBeTrue()
        ->and($member->fresh()->hasRole('member'))->toBeFalse();
});

it('lists roles with how many users have each', function () {
    $this->signIn($this->userWithRole('admin'));
    $this->userWithRole('member');
    $this->userWithRole('member');

    $roles = collect($this->getJson('/api/v1/roles')->assertOk()->json('data'))->keyBy('name');

    expect($roles['admin']['users_count'])->toBe(1)
        ->and($roles['member']['users_count'])->toBe(2)
        ->and($roles['admin']['locked'])->toBeTrue()
        ->and($roles['member']['permissions'])->toContain('comment on tasks');
});
