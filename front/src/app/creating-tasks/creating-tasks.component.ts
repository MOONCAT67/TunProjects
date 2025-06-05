import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectTasksService, Task, Subtask } from '../services/project-tasks.service';
import { TeamService, TeamMember, Team, TeamResponse } from '../services/team.service';
import { AuthService, User } from '../services/authService';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-creating-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creating-tasks.component.html',
  styleUrl: './creating-tasks.component.css'
})
export class CreatingTasksComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  teamMembers: TeamMember[] = [];
  teamInfo: Team | null = null;
  isInTeam: boolean = false;
  currentUserId: number = 0;
  projectId: number = 0;
  isTeamLeader: boolean = false;
  mainTaskAssignment: 'self' | 'team' = 'self';
  currentUser: User | null = null;
  subtaskAssignableMembers: TeamMember[] = [];
  loading: boolean = true; // Add loading state

  private userSubscription: Subscription | undefined;
  private teamDataSubscription: Subscription | undefined; // To manage team data subscriptions

  constructor(
    private projectTasksService: ProjectTasksService,
    private route: ActivatedRoute,
    private teamService: TeamService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const projectId = params.get('projectId');
      this.projectId = projectId ? +projectId : 0;
    });

    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.currentUserId = user.id;
        this.loading = true; // Start loading when user is detected
        this.initializeTaskAssignmentLogic(user.id);
      } else {
        // User logged out, reset state and stop loading
        this.resetComponentState();
        this.loading = false;
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.teamDataSubscription) {
       this.teamDataSubscription.unsubscribe();
    }
  }

  resetComponentState() {
     this.currentUserId = 0;
     this.isInTeam = false;
     this.isTeamLeader = false;
     this.teamMembers = [];
     this.teamInfo = null;
     this.mainTaskAssignment = 'self';
     this.subtaskAssignableMembers = [];
     this.tasks = [];
  }

  initializeTaskAssignmentLogic(userId: number) {
      this.teamDataSubscription = this.teamService.getUserTeams(userId).pipe(
        tap((response: TeamResponse) => {
           this.isInTeam = !!response.data?.team; // Check if team property exists
           this.teamInfo = response.data?.team || null;
           this.teamMembers = response.data?.members || [];
        }),
        switchMap(() => {
           if (this.isInTeam) {
             return this.teamService.checkIfWorkerIsLeader(userId).pipe(
                tap(res => this.isTeamLeader = res.isLeader),
                catchError(err => {
                   console.error('Error checking leader status:', err);
                   this.isTeamLeader = false;
                   // Return an observable of a specific type if necessary for downstream operations,
                   // or rethrow if the error should halt the stream.
                   // For now, returning an observable of the same type as a successful response
                   // but with isLeader set to false to allow the stream to continue.
                   return of({ success: false, message: 'Error', isLeader: false, teams: [] });
                })
             );
           } else {
             this.isTeamLeader = false;
             return of({ success: true, message: 'Not in team', isLeader: false, teams: [] }); // Return a consistent type
           }
        })
      ).subscribe({
          next: () => {
             this.mainTaskAssignment = (this.isTeamLeader && this.isInTeam) ? 'team' : 'self';
             this.updateSubtaskAssignableMembers();
             this.loading = false; // Loading complete
          },
          error: (err) => {
             console.error('Error initializing team data:', err);
             this.resetComponentState(); // Reset on error
             this.loading = false; // Loading complete
          }
      });
  }

  loadTeamMembers() {
     // Team members are loaded in initializeTaskAssignmentLogic now
     // This method is kept but might be refactored or removed later if not needed separately.
     // For now, ensure subtask assignable members are updated after potential teamMembers change
     this.updateSubtaskAssignableMembers();
  }

  onMainTaskAssignmentChange() {
    this.updateSubtaskAssignableMembers();
    // Update all existing tasks assignment when the main assignment changes
    const assignedTo = (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team' && this.teamInfo) ? this.teamInfo.id : this.currentUser?.id || 0;
    const assignedType = (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team') ? 'team' : 'individual';
    this.tasks.forEach(task => {
      task.assigned_to = assignedTo;
      task.assigned_type = assignedType;
    });
  }

  updateSubtaskAssignableMembers() {
    if (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team') {
      // If leader and assigning to team, subtasks can be assigned to any team member
      // Ensure teamMembers is not null or empty before assigning
      this.subtaskAssignableMembers = this.teamMembers && this.teamMembers.length > 0 ? this.teamMembers : [];
    } else {
      // Otherwise, subtasks can only be assigned to the current user
      this.subtaskAssignableMembers = this.currentUser ? [{
        id: this.currentUser.id,
        fullname: this.currentUser.fullname,
        email: this.currentUser.email,
        profile_picture: this.currentUser.profile_picture || null,
        role: this.currentUser.role,
        joined_at: '', // Provide a default or get from user data if available
        is_leader: this.isTeamLeader
      }] : [];
    }
  }

  addTask() {
     const assignedTo = (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team' && this.teamInfo) ? this.teamInfo.id : this.currentUser?.id || 0;
     const assignedType = (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team') ? 'team' : 'individual';
     const newTask: Task = {
      title: '',
      description: '',
      status: 'pending',
      progress_percentage: 0,
      deadline: '',
      assigned_to: assignedTo,
      assigned_type: assignedType,
      sequence_order: this.tasks.length + 1,
      subtasks: []
    };
    this.tasks.push(newTask);
     // Update subtask assignable members immediately after adding a task
     this.updateSubtaskAssignableMembers();
  }

  addSubtask(taskIndex: number) {
    // Subtask is assigned to the first member in subtaskAssignableMembers (which will be the current user if assigned to self/not leader)
    const assignedTo = this.subtaskAssignableMembers.length > 0 ? this.subtaskAssignableMembers[0].id : this.currentUser?.id || 0;
    const assignedType = (this.isTeamLeader && this.isInTeam && this.mainTaskAssignment === 'team') ? 'team' : 'individual';

    const newSubtask: Subtask = {
      title: '',
      description: '',
      status: 'pending',
      progress_percentage: 0,
      deadline: '',
      assigned_to: assignedTo,
      assigned_type: assignedType
    };
    this.tasks[taskIndex].subtasks.push(newSubtask);
  }

  removeTask(index: number) {
    this.tasks.splice(index, 1);
    // Update sequence order for remaining tasks
    this.tasks.forEach((task, i) => {
      task.sequence_order = i + 1;
    });
  }

  removeSubtask(taskIndex: number, subtaskIndex: number) {
    this.tasks[taskIndex].subtasks.splice(subtaskIndex, 1);
  }

  submitTasks() {
    if (this.projectId === 0) {
      console.error('Project ID is not set.');
      // Optionally show a user-friendly error message
      return;
    }
     // Ensure assigned_to and assigned_type are correct for all tasks before submitting
     // This was already handled in onMainTaskAssignmentChange and addTask, but good to be sure.

    this.projectTasksService.createBulkTasks(this.projectId, this.tasks)
      .subscribe({
        next: (response) => {
          console.log('Tasks submitted successfully:', response);
          alert('Tasks submitted successfully!');
          this.router.navigate(['/body']);
          // TODO: Show success message and redirect
        },
        error: (error) => {
          console.error('Error submitting tasks:', error);
          // TODO: Show error message
        }
      });
  }
}
