import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TeamService, Team, TeamMember, WorkerJob, TeamLeaderInfo, SendTeamRequestPayload, CreateTeamPayload } from '../services/team.service';
import { AuthService } from '../services/authService';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-get-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './get-team.component.html',
  styleUrl: './get-team.component.css',
  animations: [
    trigger('formAnimation', [
      state('* <=> *', style({ opacity: 1, transform: 'translateY(0)' })),
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out')
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class GetTeamComponent implements OnInit {
  showCreateTeamForm = false;
  createTeamForm: FormGroup;
  teams: Team[] = [];
  loading = true;
  error: string | null = null;
  teamFormLoading = false;
  teamFormError: string | null = null;
  selectedTeam: Team | null = null;
  teamMembers: TeamMember[] = [];
  teamLeader: TeamLeaderInfo | null = null;
  showDetails = false;
  requestSentSuccess = false;

  constructor(
    private fb: FormBuilder,
    private teamService: TeamService,
    private authService: AuthService,
    private router: Router
  ) {
    this.createTeamForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadTeams();
  }

  toggleCreateTeamForm() {
    this.showCreateTeamForm = !this.showCreateTeamForm;
    this.teamFormError = null;
    if (!this.showCreateTeamForm) {
      this.createTeamForm.reset();
    }
  }

  createTeam() {
    if (this.createTeamForm.invalid) {
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user || !user.id) {
      this.teamFormError = 'User not logged in.';
      return;
    }

    this.teamFormLoading = true;
    this.teamFormError = null;

    const payload: CreateTeamPayload = {
      userId: user.id,
      name: this.createTeamForm.value.name,
      description: this.createTeamForm.value.description
    };

    this.teamService.createTeam(payload).pipe(
      catchError(error => {
        this.teamFormLoading = false;
        this.teamFormError = error.error?.message || 'Failed to create team';
        console.error('Create team error:', error);
        return of(null);
      })
    ).subscribe(response => {
      if (response) {
        this.teamFormLoading = false;
        this.showCreateTeamForm = false;
        this.createTeamForm.reset();
        this.router.navigate(['/team']);
      }
    });
  }

  loadTeams() {
    this.teamService.getTeams().subscribe({
      next: (response) => {
        this.teams = response.data;
        this.loading = false;
      },
      error: (error) => {
        this.error = error.error?.message || 'Failed to load teams';
        this.loading = false;
      }
    });
  }

  viewTeamDetails(team: Team) {
    this.selectedTeam = team;
    this.showDetails = true;
    this.loadTeamDetails(team.id);
  }

  loadTeamDetails(teamId: number) {
    this.teamService.getTeamLeaderEmail(teamId).subscribe({
      next: (response) => {
        this.teamLeader = response.data;
      },
      error: (error) => {
        console.error('Error loading team leader info:', error);
      }
    });

    // Get team members directly from the team data
    if (this.selectedTeam?.leader?.id) {
      this.teamService.getUserTeams(this.selectedTeam.leader.id).pipe(
      switchMap((response) => {
        if (response.data?.members && response.data.members.length > 0) {
          const memberJobRequests = response.data.members.map((member: TeamMember) =>
            this.teamService.getWorkerJobs(member.id).pipe(
              map(jobsResponse => ({ ...member, jobs: jobsResponse.data })),
              catchError(error => {
                console.error(`Failed to fetch jobs for worker ${member.id}:`, error);
                return of({ ...member, jobs: [] });
              })
            )
          );
          return forkJoin(memberJobRequests);
        }
        return of([]);
      })
    ).subscribe({
      next: (membersWithJobs: TeamMember[]) => {
        this.teamMembers = membersWithJobs;
      },
      error: (error) => {
        console.error('Error loading team members:', error);
      }
    });
    }
  }

  sendTeamRequest(teamId: number) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id || !this.teamLeader?.email) {
      console.error('User not logged in or team leader email not available');
      return;
    }

    const payload: SendTeamRequestPayload = {
      senderId: currentUser.id,
      userEmail: this.teamLeader.email,
      teamId: teamId
    };

    this.teamService.sendTeamRequest(payload).subscribe({
      next: (response) => {
        console.log('Team request sent successfully');
        this.requestSentSuccess = true;
        setTimeout(() => {
          this.requestSentSuccess = false;
        }, 5000); // Hide after 5 seconds
      },
      error: (error) => {
        console.error('Error sending team request:', error);
      }
    });
  }

  getJobColorClass(index: number): string {
    const colors = ['job-color-orange', 'job-color-blue', 'job-color-black', 'job-color-grey'];
    return colors[index % colors.length];
  }

  closeDetails() {
    this.showDetails = false;
    this.selectedTeam = null;
    this.teamMembers = [];
    this.teamLeader = null;
  }
}
