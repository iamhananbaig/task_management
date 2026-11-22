<?php

namespace Database\Seeders;

use App\Support\Permissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Idempotent: creates missing permissions, gives a built-in role its defaults only when the role
 * is created (so admins' edits on the Roles page survive), and keeps admin on every permission.
 * Runs on every container start (entrypoint).
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permissions::all() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        foreach (Permissions::defaults() as $roleName => $permissions) {
            $role = Role::where('name', $roleName)->where('guard_name', 'web')->first();
            if (! $role) {
                Role::create(['name' => $roleName, 'guard_name' => 'web'])->syncPermissions($permissions);
            }
        }

        Role::findByName('admin', 'web')->syncPermissions(Permissions::all());
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
