import { Component, OnInit } from '@angular/core';
import { WorkerService, WorkerListItem } from '../services/worker.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MessagerieService } from '../services/messagerie.service';
import { AuthService } from '../services/authService';
import { TeamService } from '../services/team.service';
import { JobCategory } from '../models/verification.model';

@Component({
  selector: 'app-search-worker',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search-worker.component.html',
  styleUrl: './search-worker.component.css'
})
export class SearchWorkerComponent implements OnInit {
  workers: WorkerListItem[] = [];
  filteredWorkers: WorkerListItem[] = [];
  searchEmail: string = '';
  searchName: string = '';
  isLoading = true;
  error: string | null = null;
  showNearbyWorkers: boolean = false;
  userLocation: string | null = null;

  jobCategories: JobCategory[] = [];
  selectedJobCategory: number | null = null;

  openMessageWorkerId: number | null = null;
  messageInputs: { [workerId: number]: string } = {};
  isSendingMessage: { [workerId: number]: boolean } = {};
  messageStatus: { [workerId: number]: 'success' | 'error' | undefined } = {};

  isTeamLeader: boolean = false;

  showAllSkills = false;

  constructor(
    private workerService: WorkerService,
    private messagerieService: MessagerieService,
    public authService: AuthService,
    private teamService: TeamService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to query params for navbar search
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchName = params['search'];
        this.applyFilters();
      }
    });

    this.workerService.getAllWorkers().subscribe({
      next: (workers) => {
        this.workers = workers.map(worker => ({
          ...worker,
          job_categories: Array.isArray(worker.job_categories) ? worker.job_categories : [],
          years_experience: Array.isArray(worker.years_experience) ? worker.years_experience : []
        }));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load workers.';
        this.isLoading = false;
      }
    });

    this.loadJobCategories();

    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      this.teamService.checkIfWorkerIsLeader(currentUser.id).subscribe({
        next: (response) => {
          this.isTeamLeader = response.isLeader;
        },
        error: (err) => {
          console.error('Error checking if user is a team leader:', err);
        }
      });

      if (currentUser.location) {
        this.userLocation = currentUser.location;
        console.log('User location from current user:', this.userLocation);
      } else {
        console.log('No location found in user profile');
      }
    }
  }

  onSearch() {
    console.log('Search triggered with email:', this.searchEmail); // Debug log
    this.applyFilters();
  }

  onJobCategoryChange() {
    this.applyFilters();
  }

  applyFilters() {
    let tempWorkers = [...this.workers];
    console.log('Initial workers count:', tempWorkers.length); // Debug log

    // Email search
    if (this.searchEmail && this.searchEmail.trim()) {
      const email = this.searchEmail.trim().toLowerCase();
      console.log('Filtering by email:', email); // Debug log
      tempWorkers = tempWorkers.filter(w => {
        const matches = w.email.toLowerCase().includes(email);
        console.log(`Worker ${w.email} matches: ${matches}`); // Debug log
        return matches;
      });
      console.log('Workers after email filter:', tempWorkers.length); // Debug log
    }

    // Name search (from navbar)
    if (this.searchName && this.searchName.trim()) {
      const name = this.searchName.trim().toLowerCase();
      tempWorkers = tempWorkers.filter(w => w.fullname.toLowerCase().includes(name));
    }

    // Nearby workers filter
    if (this.showNearbyWorkers && this.userLocation) {
      const userCoords = this.parseCoordinates(this.userLocation);
      if (userCoords) {
        tempWorkers = tempWorkers.filter(worker => {
          if (!worker.location) return false;
          const workerCoords = this.parseCoordinates(worker.location);
          if (!workerCoords) return false;
          const distance = this.calculateDistance(
            userCoords.lat,
            userCoords.lon,
            workerCoords.lat,
            workerCoords.lon
          );
          return distance <= 20;
        });
      }
    }

    // Job category filter
    if (this.selectedJobCategory !== null) {
      tempWorkers = tempWorkers.filter(worker =>
        worker.job_categories.some(cat => cat.toLowerCase() === this.jobCategories.find(jc => jc.id === this.selectedJobCategory)?.name.toLowerCase())
      );
    }

    // Filter out the current user
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && currentUser.id) {
      tempWorkers = tempWorkers.filter(worker => worker.id !== currentUser.id);
    }

    console.log('Final filtered workers count:', tempWorkers.length); // Debug log
    this.filteredWorkers = tempWorkers;
  }

  loadJobCategories() {
    this.workerService.getJobs().subscribe({
      next: (jobCategories) => {
        this.jobCategories = jobCategories;
      },
      error: (err) => {
        console.error('Failed to load job categories:', err);
      }
    });
  }

  openMessageModal(worker: WorkerListItem) {
    this.openMessageWorkerId = worker.id;
    if (!this.messageInputs[worker.id]) {
      this.messageInputs[worker.id] = '';
    }
    this.messageStatus[worker.id] = undefined;
  }

  sendMessageToWorker(worker: WorkerListItem) {
    const workerId = worker.id;
    const message = this.messageInputs[workerId];
    if (!message) return;
    this.isSendingMessage[workerId] = true;
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      this.isSendingMessage[workerId] = false;
      this.messageStatus[workerId] = 'error';
      return;
    }
    this.messagerieService.sendMessage(currentUser.id, workerId, message).subscribe({
      next: () => {
        this.isSendingMessage[workerId] = false;
        this.messageStatus[workerId] = 'success';
        this.messageInputs[workerId] = '';
        setTimeout(() => {
          this.openMessageWorkerId = null;
          this.messageStatus[workerId] = undefined;
        }, 1500);
      },
      error: () => {
        this.isSendingMessage[workerId] = false;
        this.messageStatus[workerId] = 'error';
      }
    });
  }

  sendTeamRequest(worker: WorkerListItem) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      alert('Error: No current user found');
      return;
    }
    const payload = {
      senderId: currentUser.id,
      userEmail: worker.email,
      teamId: 1
    };
    this.teamService.sendTeamRequest(payload).subscribe({
      next: (response) => {
        console.log('Team request sent successfully:', response);
        alert(`Team request sent successfully to ${worker.fullname}!`);
      },
      error: (err) => {
        console.error('Error sending team request:', err);
        alert('Failed to send team request. Please try again later.');
      }
    });
  }

  toggleNearbyWorkers() {
    console.log('Toggle button clicked');
    console.log('Current user location:', this.userLocation);
    this.showNearbyWorkers = !this.showNearbyWorkers;
    if (this.showNearbyWorkers && this.userLocation) {
      this.applyFilters();
    } else {
      this.filteredWorkers = this.workers;
    }
  }

  private parseCoordinates(location: string): { lat: number; lon: number } | null {
    try {
      console.log('Parsing location string:', location);
      const match = location.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        const coords = {
          lat: parseFloat(match[1]),
          lon: parseFloat(match[2])
        };
        console.log('Parsed coordinates:', coords);
        return coords;
      }
      console.log('No coordinates found in location string');
      return null;
    } catch (error) {
      console.error('Error parsing coordinates:', error);
      return null;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  toggleSkills() {
    this.showAllSkills = !this.showAllSkills;
  }

  navigateToWorkerProfile(workerId: number) {
    this.router.navigate(['/profile', workerId]);
  }
}
