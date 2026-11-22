<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * New permissions for existing installs (RolePermissionSeeder only fills in new roles):
 * admin gets all of them, manager gets reports and tags.
 */
return new class extends Migration
{
    private const GRANTS = [
        'view restricted projects' => ['admin'],
        'manage tags' => ['admin', 'manager'],
        'view reports' => ['admin', 'manager'],
    ];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (self::GRANTS as $name => $roles) {
            $permission = Permission::findOrCreate($name, 'web');
            foreach ($roles as $roleName) {
                Role::where('name', $roleName)->where('guard_name', 'web')->first()?->givePermissionTo($permission);
            }
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::whereIn('name', array_keys(self::GRANTS))->where('guard_name', 'web')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
