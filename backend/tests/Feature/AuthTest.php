<?php

use App\Models\AuditLog;
use App\Models\User;

it('signs in with email and password and returns permissions', function () {
    $user = $this->userWithRole('member', ['email' => 'ali@example.com']);

    $response = $this->postJson('/api/v1/login', ['email' => 'ali@example.com', 'password' => 'password', 'device_name' => 'Pixel 8'])
        ->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.must_change_password', false);

    expect($response->json('token'))->toBeString()
        ->and($response->json('user.permissions'))->toContain('create tasks')
        ->and($user->tokens()->first()->name)->toBe('Pixel 8');
});

it('refuses a wrong password and records the failure', function () {
    $this->userWithRole('member', ['email' => 'ali@example.com']);

    $this->postJson('/api/v1/login', ['email' => 'ali@example.com', 'password' => 'wrong'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    expect(AuditLog::where('action', 'sign-in failed')->count())->toBe(1);
});

it('refuses a deactivated account, also for an existing token', function () {
    $user = $this->userWithRole('member', ['email' => 'ali@example.com', 'is_active' => false]);

    $this->postJson('/api/v1/login', ['email' => 'ali@example.com', 'password' => 'password'])->assertUnprocessable();

    $this->signIn($user);
    $this->getJson('/api/v1/dashboard')->assertUnauthorized();
});

it('lets a new account do nothing but change its password', function () {
    $user = User::factory()->mustChangePassword()->create()->assignRole('member');
    $this->signIn($user);

    $this->getJson('/api/v1/user')->assertOk()->assertJsonPath('must_change_password', true);
    $this->getJson('/api/v1/projects')->assertForbidden()->assertJsonPath('code', 'password_change_required');

    $this->putJson('/api/v1/user/password', [
        'current_password' => 'password',
        'password' => 'NewSecret123',
        'password_confirmation' => 'NewSecret123',
    ])->assertOk()->assertJsonPath('must_change_password', false);

    $this->getJson('/api/v1/projects')->assertOk();
});

it('requires a strong, different new password', function () {
    $this->signIn($this->userWithRole('member'));

    $this->putJson('/api/v1/user/password', ['current_password' => 'password', 'password' => 'short', 'password_confirmation' => 'short'])
        ->assertJsonValidationErrors('password');
    $this->putJson('/api/v1/user/password', ['current_password' => 'nope', 'password' => 'NewSecret123', 'password_confirmation' => 'NewSecret123'])
        ->assertJsonValidationErrors('current_password');
});

it('removes the phone push token on sign out', function () {
    $user = $this->signIn($this->userWithRole('member'));
    $user->deviceTokens()->create(['token' => 'ExponentPushToken[abc]', 'platform' => 'ios']);

    $this->postJson('/api/v1/logout', ['push_token' => 'ExponentPushToken[abc]'])->assertOk();

    expect($user->deviceTokens()->count())->toBe(0);
});
