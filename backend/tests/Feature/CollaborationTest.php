<?php

use App\Models\Project;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Notifications\TaskCommented;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->manager = $this->userWithRole('manager');
    $this->member = $this->userWithRole('member');
    $this->project = Project::factory()->create(['owner_id' => $this->manager->id]);
    $this->addMembers($this->project, [$this->member]);
    $this->task = Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'creator_id' => $this->manager->id]);
});

it('notifies everyone involved of a comment except its author', function () {
    Notification::fake();
    $this->signIn($this->manager);

    $this->postJson("/api/v1/tasks/{$this->task->id}/comments", ['body' => 'Any news?'])->assertCreated();

    Notification::assertSentTo($this->member, TaskCommented::class);
    Notification::assertNotSentTo($this->manager, TaskCommented::class);
});

it('lets only the author edit a comment', function () {
    $this->signIn($this->member);
    $id = $this->postJson("/api/v1/tasks/{$this->task->id}/comments", ['body' => 'First'])->json('data.id');

    $this->putJson("/api/v1/comments/{$id}", ['body' => 'Edited'])->assertOk()->assertJsonPath('data.body', 'Edited');

    $this->signIn($this->manager);
    $this->putJson("/api/v1/comments/{$id}", ['body' => 'Hijack'])->assertForbidden();
    $this->deleteJson("/api/v1/comments/{$id}")->assertOk();
});

it('stores attachments privately and serves them only to project members', function () {
    Storage::fake('local');
    $this->signIn($this->member);

    $id = $this->postJson("/api/v1/tasks/{$this->task->id}/attachments", ['file' => UploadedFile::fake()->create('brief.pdf', 100, 'application/pdf')])
        ->assertCreated()
        ->assertJsonPath('data.original_name', 'brief.pdf')
        ->json('data.id');
    Storage::disk('local')->assertExists(TaskAttachment::find($id)->path);

    $this->get("/api/v1/attachments/{$id}/download")->assertOk()->assertDownload('brief.pdf');

    $this->signIn($this->userWithRole('member'));
    $this->getJson("/api/v1/attachments/{$id}/download")->assertForbidden();
});

it('refuses executable uploads', function () {
    Storage::fake('local');
    $this->signIn($this->member);

    $this->postJson("/api/v1/tasks/{$this->task->id}/attachments", ['file' => UploadedFile::fake()->create('run.php', 1, 'application/x-php')])
        ->assertJsonValidationErrors('file');
});

it('shows notifications in the bell and marks them read', function () {
    $this->signIn($this->manager);
    $this->postJson("/api/v1/tasks/{$this->task->id}/comments", ['body' => 'Ping']);

    $this->signIn($this->member);
    $response = $this->getJson('/api/v1/notifications')->assertOk()->assertJsonPath('unread', 1);
    expect($response->json('data.0.data.kind'))->toBe('commented');

    $this->postJson('/api/v1/notifications/'.$response->json('data.0.id').'/read')->assertJsonPath('unread', 0);
});

it('registers a phone for push and moves a token to the user who signs in on it', function () {
    $this->signIn($this->member);
    $this->postJson('/api/v1/devices', ['token' => 'ExponentPushToken[abc]', 'platform' => 'android'])->assertOk();
    $this->postJson('/api/v1/devices', ['token' => 'not-a-token', 'platform' => 'android'])->assertJsonValidationErrors('token');

    $this->signIn($this->manager);
    $this->postJson('/api/v1/devices', ['token' => 'ExponentPushToken[abc]', 'platform' => 'android'])->assertOk();

    expect($this->member->deviceTokens()->count())->toBe(0)->and($this->manager->deviceTokens()->count())->toBe(1);
});

it('searches tasks and projects the user can see', function () {
    $this->signIn($this->member);

    $this->getJson('/api/v1/search?q='.urlencode($this->task->title))->assertOk()->assertJsonCount(1, 'tasks');
    $this->getJson('/api/v1/search?q='.$this->project->key)->assertJsonCount(1, 'projects');
});

it('summarises my work on the dashboard', function () {
    Task::factory()->create(['project_id' => $this->project->id, 'assignee_id' => $this->member->id, 'due_date' => today()->subDays(2)]);
    $this->signIn($this->member);

    $this->getJson('/api/v1/dashboard')
        ->assertOk()
        ->assertJsonPath('counts.open', 2)
        ->assertJsonPath('counts.overdue', 1)
        ->assertJsonCount(1, 'projects');
});
