import { Component, OnInit } from '@angular/core';
import { TeamService } from '../services/team.service';
import { WorkerService } from '../services/worker.service';
import { Project } from '../models/project.model';
import { User } from '../models/user';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { AuthService } from '../services/authService';
import { FormsModule } from '@angular/forms';
import { TeamMember } from '../services/team.service';
import { ContractService } from '../services/contract.service';
import { MessagerieService } from '../services/messagerie.service';

@Component({
  selector: 'app-team-project',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './team-project.component.html',
  styleUrl: './team-project.component.css'
})
export class TeamProjectComponent implements OnInit {
  projects: any[] = [];
  loading = true;
  error: string | null = null;
  teamId!: number;
  workerProfiles: { [workerName: string]: any } = {};
  isTeamLeader = false;
  showAddTaskForm = false;
  showAddSubtaskForm = false;
  selectedMainTaskId: number | null = null;
  unsignedProjects: { [key: string]: boolean } = {};
  teamLeaderInfo: { id: number; name: string; picture: string | null } | null = null;
  showContactLeaderInput: { [projectId: string]: boolean } = {};
  messageContent: { [projectId: string]: string } = {};
  showMessageSuccessAlert: boolean = false;

  newTask = {
    title: '',
    description: '',
    deadline: '',
    assigned_to: '',
    subtasks: [] as any[]
  };
  newSubtask = {
    title: '',
    description: '',
    assigned_to: ''
  };
  teamMembers: TeamMember[] = [];

  constructor(
    private teamService: TeamService,
    private workerService: WorkerService,
    private route: ActivatedRoute,
    public authService: AuthService,
    private contractService: ContractService,
    private router: Router,
    private messagerieService: MessagerieService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.teamId = +(params.get('teamId') || 0);
      this.checkTeamLeader();
      this.fetchProjects();
      this.fetchTeamMembers();
      this.fetchTeamLeaderInfo();
    });
  }

  fetchTeamLeaderInfo() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      console.error('Current user not found to fetch team leader info.');
      return;
    }

    this.teamService.getTeamLeaderInfo(currentUser.id).subscribe({
      next: (response) => {
        console.log('Raw response from getTeamLeaderInfo:', response);
        if (response.data && response.data.leader) {
          this.teamLeaderInfo = {
            id: response.data.leader.id,
            name: response.data.leader.name,
            picture: response.data.leader.profile_picture || null
          };
          console.log('Team Leader Info fetched:', this.teamLeaderInfo);
        } else {
          console.error('Failed to fetch team leader info: Data or leader object missing.');
        }
      },
      error: (err) => {
        console.error('Error fetching team leader info:', err);
      }
    });
  }

  checkTeamLeader() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      this.teamService.checkIfWorkerIsLeader(currentUser.id).subscribe({
        next: (response) => {
          this.isTeamLeader = response.isLeader;
        },
        error: (err) => {
          console.error('Error checking team leader status:', err);
          this.isTeamLeader = false;
        }
      });
    }
  }

  checkContractSignature(projectId: string) {
    this.contractService.checkWorkerSignatureByProject(Number(projectId)).subscribe({
      next: (response) => {
        this.unsignedProjects[projectId] = response.isSigned === 0;
      },
      error: (error) => {
        console.error('Error checking contract signature:', error);
        this.unsignedProjects[projectId] = true; // Assume unsigned on error
      }
    });
  }

  goToSignContract(projectId: string) {
    this.contractService.getContractIdByProjectId(Number(projectId)).subscribe({
      next: (response) => {
        if (response.statusCode === 200 && response.contractId) {
          this.router.navigate(['/contract/sign', response.contractId]);
        } else {
          console.error('Contract ID not found for project:', projectId);
        }
      },
      error: (err) => {
        console.error('Error fetching contract ID:', err);
      }
    });
  }

  contactTeamLeader(projectId: string) {
    if (this.teamLeaderInfo) {
      this.showContactLeaderInput[projectId] = true;
    } else {
      // If teamLeaderInfo is not yet fetched, fetch it and then show the input
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser?.id) {
        console.error('Cannot contact leader: Current user not authenticated.');
        return;
      }

      this.teamService.getTeamLeaderInfo(currentUser.id).subscribe({
        next: (response) => {
          console.log('Raw response from getTeamLeaderInfo (on demand):', response);
          if (response.data && response.data.leader) {
            this.teamLeaderInfo = {
              id: response.data.leader.id,
              name: response.data.leader.name,
              picture: response.data.leader.profile_picture || null
            };
            console.log('Team Leader Info fetched (on demand):', this.teamLeaderInfo);
            this.showContactLeaderInput[projectId] = true;
          } else {
            console.error('Failed to fetch team leader info on demand: Data or leader object missing.');
          }
        },
        error: (err) => {
          console.error('Error fetching team leader info on demand:', err);
          alert('Could not get team leader information. Please try again.');
        }
      });
    }
  }

  sendMessageToLeader(projectId: string) {
    const currentUser = this.authService.getCurrentUser();
    console.log('Current User for sending message:', currentUser); // Debug log
    if (!currentUser?.id || !this.teamLeaderInfo?.id || !this.messageContent[projectId]) {
      console.error('Cannot send message: User, leader info, or message content missing.');
      return;
    }

    const senderId = currentUser.id;
    const receiverId = this.teamLeaderInfo.id;
    const message = this.messageContent[projectId];

    console.log('Sending message:', { senderId, receiverId, message });

    this.messagerieService.sendMessage(senderId, receiverId, message).subscribe({
      next: (response) => {
        console.log('Message sent successfully:', response);
        this.messageContent[projectId] = ''; // Clear the message input
        this.showContactLeaderInput[projectId] = false; // Hide the input field
        this.showMessageSuccessAlert = true; // Show the success alert
        console.log('showMessageSuccessAlert set to true:', this.showMessageSuccessAlert); // Debug log
        setTimeout(() => {
          this.showMessageSuccessAlert = false; // Hide the alert after 3 seconds
        }, 3000);
      },
      error: (err) => {
        console.error('Error sending message:', err);
        alert('Failed to send message.');
      }
    });
  }

  cancelContactLeader(projectId: string) {
    this.showContactLeaderInput[projectId] = false;
    this.messageContent[projectId] = '';
  }

  fetchProjects() {
    this.loading = true;
    this.teamService.getTeamProjects(this.teamId).subscribe({
      next: (res) => {
        this.projects = res.data || [];
        this.fetchAllWorkerProfiles();
        // Check contract signatures for each project
        this.projects.forEach(project => {
          this.checkContractSignature(project.id.toString());
          this.showContactLeaderInput[project.id] = false; // Initialize message input visibility
          this.messageContent[project.id] = ''; // Initialize message content
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load projects.';
        this.loading = false;
      }
    });
  }

  fetchTeamMembers() {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      this.teamService.getUserTeams(currentUser.id).subscribe({
        next: (response) => {
          if (response.data?.members) {
            this.teamMembers = response.data.members.filter(member => !member.is_leader);
          }
        },
        error: (err) => {
          console.error('Error fetching team members:', err);
        }
      });
    }
  }

  fetchAllWorkerProfiles() {
    const workerIds = new Set<number>();
    this.projects.forEach(project => {
      project.main_tasks?.forEach((mainTask: any) => {
        mainTask.sub_tasks?.forEach((subTask: any) => {
          if (subTask.assigned_to) {
            workerIds.add(subTask.assigned_to);
          }
        });
      });
    });
    const profileRequests = Array.from(workerIds).map(id =>
      this.workerService.getWorkerProfile(id.toString())
    );
    forkJoin(profileRequests).subscribe({
      next: (profiles: any[]) => {
        profiles.forEach((profile, idx) => {
          this.workerProfiles[Array.from(workerIds)[idx].toString()] = profile.data;
        });
      },
      error: () => {
        // Ignore errors for individual profiles
      }
    });
  }

  getWorkerProfile(id: number) {
    return this.workerProfiles[id.toString()];
  }

  toggleAddTaskForm() {
    this.showAddTaskForm = !this.showAddTaskForm;
    if (!this.showAddTaskForm) {
      this.resetNewTask();
    }
  }

  toggleAddSubtaskForm(mainTaskId: number) {
    this.selectedMainTaskId = mainTaskId;
    this.showAddSubtaskForm = !this.showAddSubtaskForm;
    if (!this.showAddSubtaskForm) {
      this.resetNewSubtask();
    }
  }

  resetNewTask() {
    this.newTask = {
      title: '',
      description: '',
      deadline: '',
      assigned_to: this.teamId.toString(),
      subtasks: []
    };
  }

  resetNewSubtask() {
    this.newSubtask = {
      title: '',
      description: '',
      assigned_to: ''
    };
  }

  addSubtask() {
    if (this.newTask.subtasks.length < 10) {
      this.newTask.subtasks.push({
        title: '',
        description: '',
        assigned_to: ''
      });
    }
  }

  removeSubtask(index: number) {
    this.newTask.subtasks.splice(index, 1);
  }

  addMainTask(projectId: number) {
    if (!this.newTask.title || !this.newTask.description || !this.newTask.deadline) {
      this.error = 'Please fill in all required fields for the main task';
      return;
    }

    // Validate subtasks if any exist
    if (this.newTask.subtasks.length > 0) {
      const invalidSubtask = this.newTask.subtasks.find(
        subtask => !subtask.title || !subtask.description || !subtask.assigned_to
      );
      if (invalidSubtask) {
        this.error = 'Please fill in all fields for all subtasks';
        return;
      }
    }

    const taskData = {
      ...this.newTask,
      assigned_to: this.teamId.toString()
    };

    this.teamService.addMainTask(projectId, taskData).subscribe({
      next: (response) => {
        this.fetchProjects();
        this.toggleAddTaskForm();
        this.resetNewTask();
      },
      error: (err) => {
        this.error = 'Failed to add main task. Please try again.';
      }
    });
  }

  addSubtaskToMainTask() {
    if (!this.selectedMainTaskId) return;

    if (!this.newSubtask.title || !this.newSubtask.description || !this.newSubtask.assigned_to) {
      this.error = 'Please fill in all fields for the subtask';
      return;
    }

    this.teamService.addSubtaskToMainTask(this.selectedMainTaskId, this.newSubtask).subscribe({
      next: (response) => {
        this.fetchProjects();
        this.toggleAddSubtaskForm(this.selectedMainTaskId!);
        this.resetNewSubtask();
      },
      error: (err) => {
        this.error = 'Failed to add subtask. Please try again.';
      }
    });
  }

  canAddSubtasks(mainTask: any, project: any): boolean {
    return this.isTeamLeader && 
           (mainTask.sequence_order === project.current_phase || 
            mainTask.sequence_order > project.current_phase);
  }
}
