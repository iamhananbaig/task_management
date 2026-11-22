<?php

use App\Enums\ProjectRole;
use App\Models\Project;
use App\Models\Task;

it('creates a project with the default workflow and the creator as manager', function () {
    $manager = $this->signIn($this->userWithRole('manager'));
    $member = $this->userWithRole('member');

    $response = $this->postJson('/api/v1/projects', ['name' => 'Website', 'key' => 'web', 'member_ids' => [$member->id]])
        ->assertCreated()
        ->assertJsonPath('data.key', 'WEB')
        ->assertJsonCount(4, 'data.statuses')
        ->assertJsonCount(6, 'data.transitions')
        ->assertJsonPath('data.can.manage', true);

    $project = Project::find($response->json('data.id'));
    expect($project->isManager($manager))->toBeTrue()
        ->and($project->isMember($member))->toBeTrue()
        ->and($project->isManager($member))->toBeFalse()
        ->and($project->statuses->pluck('name')->all())->toBe(['To do', 'In progress', 'Submitted for review', 'Completed']);
});

it('does not let members create projects', function () {
    $this->signIn($this->userWithRole('member'));

    $this->postJson('/api/v1/projects', ['name' => 'Website', 'key' => 'WEB'])->assertForbidden();
});

it('shows members only their own projects, managers all of them', function () {
    $member = $this->userWithRole('member');
    $mine = Project::factory()->create();
    $this->addMembers($mine, [$member]);
    Project::factory()->create();

    $this->signIn($member);
    $this->getJson('/api/v1/projects')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);
    $this->getJson('/api/v1/projects/'.Project::whereKeyNot($mine->id)->value('id'))->assertForbidden();

    $this->signIn($this->userWithRole('manager'));
    $this->getJson('/api/v1/projects')->assertJsonCount(2, 'data');
});

it('lets a project manager edit the project and its members without the app-wide permission', function () {
    $lead = $this->userWithRole('member');
    $other = $this->userWithRole('member');
    $project = Project::factory()->create();
    $this->addMembers($project, [$lead], ProjectRole::Manager);

    $this->signIn($lead);
    $this->putJson("/api/v1/projects/{$project->id}", ['name' => 'Renamed'])->assertOk()->assertJsonPath('data.name', 'Renamed');
    $this->postJson("/api/v1/projects/{$project->id}/members", ['user_id' => $other->id, 'role' => 'member'])->assertOk();

    expect($project->fresh()->isMember($other))->toBeTrue();

    $this->signIn($other);
    $this->putJson("/api/v1/projects/{$project->id}", ['name' => 'Nope'])->assertForbidden();
});

it('keeps at least one manager on a project', function () {
    $owner = $this->userWithRole('member');
    $project = Project::factory()->create(['owner_id' => $owner->id]);

    $this->signIn($owner);
    $this->deleteJson("/api/v1/projects/{$project->id}/members/{$owner->id}")
        ->assertUnprocessable()
        ->assertJsonPath('message', 'A project needs at least one manager. Make someone else a manager first.');
});

it('unassigns a removed member from open tasks', function () {
    $manager = $this->signIn($this->userWithRole('manager'));
    $member = $this->userWithRole('member');
    $project = Project::factory()->create(['owner_id' => $manager->id]);
    $this->addMembers($project, [$member]);
    $task = Task::factory()->create(['project_id' => $project->id, 'assignee_id' => $member->id]);

    $this->deleteJson("/api/v1/projects/{$project->id}/members/{$member->id}")->assertOk();

    expect($task->fresh()->assignee_id)->toBeNull();
});

it('archives projects with tasks instead of deleting them', function () {
    $manager = $this->signIn($this->userWithRole('manager'));
    $project = Project::factory()->create(['owner_id' => $manager->id]);
    Task::factory()->create(['project_id' => $project->id]);

    $this->deleteJson("/api/v1/projects/{$project->id}")->assertUnprocessable();
    $this->postJson("/api/v1/projects/{$project->id}/archive")->assertOk();
    $this->getJson('/api/v1/projects')->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/projects?archived=1')->assertJsonCount(1, 'data');

    $this->postJson("/api/v1/projects/{$project->id}/tasks", ['title' => 'New'])->assertUnprocessable();
});

it('deletes an empty project', function () {
    $manager = $this->signIn($this->userWithRole('manager'));
    $project = Project::factory()->create(['owner_id' => $manager->id]);

    $this->deleteJson("/api/v1/projects/{$project->id}")->assertOk();

    expect(Project::count())->toBe(0);
});
