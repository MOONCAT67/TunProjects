import { Component, OnInit } from '@angular/core';
import { TeamService, TeamResponse, WorkerJob, TeamMember, LeaveTeamPayload } from '../services/team.service';
import { AuthService } from '../services/authService';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, tap, switchMap, map } from 'rxjs/operators';
import { MessagerieService } from '../services/messagerie.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule, FormsModule],
  templateUrl: './team-page.component.html',
  styleUrl: './team-page.component.css'
})
export class TeamPageComponent implements OnInit {
  teamData: TeamResponse | null = null;
  loading = true;
  error: string | null = null;
  isCurrentUserLeader: boolean = false;
  showMessageInput: boolean = false;
  leaderMessage: string = '';
  sendingMessage: boolean = false;
  messageSendSuccess: boolean = false;
  messageSendError: string | null = null;
  leavingTeam: boolean = false;
  leaveTeamSuccess: boolean = false;
  leaveTeamError: string | null = null;

  constructor(
    private teamService: TeamService,
    private authService: AuthService,
    private router: Router,
    private messagerieService: MessagerieService
  ) {}

  ngOnInit() {
    this.loadTeamData();
  }

  loadTeamData() {
    const user = this.authService.getCurrentUser();
    console.log('Current user:', user);
    if (!user) {
      this.router.navigate(['/auth']);
      return;
    }

    this.teamService.getUserTeams(user.id).pipe(
      tap((response: TeamResponse) => {
        console.log('Team data response:', response);
        this.teamData = response;
      }),
      switchMap((response: TeamResponse) => {
        // After getting team data, also check if current user is a leader
        return this.teamService.checkIfWorkerIsLeader(user.id).pipe(
          tap(leaderResponse => {
            console.log('CheckIfWorkerIsLeader response:', leaderResponse);
            this.isCurrentUserLeader = leaderResponse.isLeader;
          }),
          // Continue with fetching member jobs only if team data exists
          switchMap(() => {
        if (response.data && response.data.members && response.data.members.length > 0) {
          console.log('Fetching jobs for members:', response.data.members);
          const memberJobRequests: Observable<{ memberId: number, jobs: WorkerJob[] }>[] = response.data.members.map(member =>
            this.teamService.getWorkerJobs(member.id).pipe(
              tap(jobsResponse => {
                console.log(`Raw jobs response for member ${member.id}:`, jobsResponse);
              }),
              map(jobsResponse => {
                console.log(`Jobs for member ${member.id}:`, jobsResponse.data);
                return { memberId: member.id, jobs: jobsResponse.data };
              }),
              catchError(error => {
                console.error(`Failed to fetch jobs for worker ${member.id}:`, error);
                return of({ memberId: member.id, jobs: [] });
              })
            )
          );
          return forkJoin(memberJobRequests);
        } else {
          console.log('No members found in team data');
          return of([]);
        }
          })
        );
      })
    ).subscribe({
      next: (memberJobs: { memberId: number, jobs: WorkerJob[] }[]) => {
        console.log('All member jobs loaded:', memberJobs);
        if (this.teamData?.data?.members) {
          this.teamData.data.members = this.teamData.data.members.map(member => {
            const foundMemberJobs = memberJobs.find(mj => mj.memberId === member.id);
            return { ...member, jobs: foundMemberJobs ? foundMemberJobs.jobs : [] };
          });
          console.log('Final teamData with jobs:', this.teamData);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading team data:', error);
        this.error = error.error?.message || 'Failed to load team data';
        this.loading = false;
      }
    });
  }

  toggleMessageInput(): void {
    this.showMessageInput = !this.showMessageInput;
    this.leaderMessage = '';
    this.messageSendSuccess = false;
    this.messageSendError = null;
  }

  sendMessageToLeader(): void {
    if (!this.leaderMessage.trim()) {
      this.messageSendError = 'Message cannot be empty.';
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const teamLeader = this.getLeader();

    if (!currentUser?.id || !teamLeader?.id) {
      this.messageSendError = 'Cannot send message: current user or team leader not identified.';
      console.error('Missing user ID or team leader ID for sending message.');
      return;
    }

    this.sendingMessage = true;
    this.messageSendSuccess = false;
    this.messageSendError = null;

    this.messagerieService.sendMessage(currentUser.id, teamLeader.id, this.leaderMessage).subscribe({
      next: (response) => {
        console.log('Message sent successfully:', response);
        this.messageSendSuccess = true;
        this.leaderMessage = '';
        this.sendingMessage = false;
        setTimeout(() => this.messageSendSuccess = false, 3000);
      },
      error: (error) => {
        console.error('Error sending message to leader:', error);
        this.messageSendError = error.error?.message || 'Failed to send message.';
        this.sendingMessage = false;
        setTimeout(() => this.messageSendError = null, 5000);
      }
    });
  }

  leaveTeam(): void {
    const currentUser = this.authService.getCurrentUser();
    const teamId = this.teamData?.data?.team?.id;

    if (!currentUser?.id || !teamId) {
      this.leaveTeamError = 'Cannot leave team: User not logged in or team ID not available.';
      console.error('Missing user ID or team ID for leaving team.');
      return;
    }

    this.leavingTeam = true;
    this.leaveTeamSuccess = false;
    this.leaveTeamError = null;

    const payload: LeaveTeamPayload = {
      userId: currentUser.id
    };

    this.teamService.leaveTeam(teamId, payload).subscribe({
      next: (response) => {
        console.log('Successfully left team:', response);
        this.leaveTeamSuccess = true;
        this.leavingTeam = false;
        setTimeout(() => {
          this.router.navigate(['/get-team']);
        }, 1500);
      },
      error: (error) => {
        console.error('Error leaving team:', error);
        this.leaveTeamError = error.error?.message || 'Failed to leave team.';
        this.leavingTeam = false;
        setTimeout(() => this.leaveTeamError = null, 5000);
      }
    });
  }

  getLeader(): TeamMember | undefined {
    return this.teamData?.data?.members.find(member => member.is_leader === true);
  }

  getMembers(): TeamMember[] | undefined {
    return this.teamData?.data?.members.filter(member => member.is_leader === false);
  }

  getJobColorClass(index: number): string {
    const colors = ['job-color-orange', 'job-color-blue', 'job-color-black', 'job-color-grey'];
    return colors[index % colors.length];
  }

  getCurrentUserId(): number | null {
    return this.authService.getCurrentUser()?.id || null;
  }
}
