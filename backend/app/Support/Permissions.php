<?php

namespace App\Support;

/**
 * Every permission, grouped for the Roles page, and each built-in role's defaults.
 * New permission: add it here AND in a migration that grants it to existing roles
 * (RolePermissionSeeder only fills in roles on a fresh install).
 */
class Permissions
{
    public const GROUPS = [
        'Projects' => ['view all projects', 'manage projects', 'manage workflow templates'],
        'Tasks' => ['create tasks', 'edit tasks', 'delete tasks', 'comment on tasks', 'override workflow'],
        'Administration' => ['view users', 'manage users', 'view roles', 'manage roles', 'view audit log'],
    ];

    public const BUILT_IN_ROLES = ['admin', 'manager', 'member', 'viewer'];

    /** @return list<string> */
    public static function all(): array
    {
        return array_merge(...array_values(self::GROUPS));
    }

    /** @return array<string, list<string>> role => permissions */
    public static function defaults(): array
    {
        return [
            'admin' => self::all(),
            'manager' => [
                'view all projects', 'manage projects', 'manage workflow templates',
                'create tasks', 'edit tasks', 'delete tasks', 'comment on tasks', 'override workflow',
                'view users', 'view audit log',
            ],
            'member' => ['create tasks', 'edit tasks', 'comment on tasks'],
            'viewer' => ['comment on tasks'],
        ];
    }
}
