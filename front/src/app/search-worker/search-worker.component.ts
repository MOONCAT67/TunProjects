import { Component, OnInit } from '@angular/core';
import { WorkerService, WorkerListItem } from '../services/worker.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessagerieService } from '../services/messagerie.service';
import { AuthService } from '../services/authService';
import { TeamService } from '../services/team.service';

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
  isLoading = true;
  error: string | null = null;
  showNearbyWorkers: boolean = false;
  userLocation: string | null = null;

  openMessageWorkerId: number | null = null;
  messageInputs: { [workerId: number]: string } = {};
  isSendingMessage: { [workerId: number]: boolean } = {};
  messageStatus: { [workerId: number]: 'success' | 'error' | undefined } = {};

  isTeamLeader: boolean = false;

  constructor(
    private workerService: WorkerService,
    private messagerieService: MessagerieService,
    private authService: AuthService,
    private teamService: TeamService
  ) {}

  ngOnInit(): void {
    this.workerService.getAllWorkers().subscribe({
      next: (workers) => {
        this.workers = workers;
        this.filteredWorkers = workers;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load workers.';
        this.isLoading = false;
      }
    });

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

      // Get user location from current user object
      if (currentUser.location) {
        this.userLocation = currentUser.location;
        console.log('User location from current user:', this.userLocation);
      } else {
        console.log('No location found in user profile');
      }
    }
  }

  onSearch() {
    const email = this.searchEmail.trim().toLowerCase();
    if (!email) {
      this.filteredWorkers = this.workers;
    } else {
      this.filteredWorkers = this.workers.filter(w => w.email.toLowerCase().includes(email));
    }
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
      console.error('No current user found');
      return;
    }
    const payload = {
      senderId: currentUser.id,
      userEmail: worker.email,
      teamId: 1 // Replace with the actual team ID if available
    };
    this.teamService.sendTeamRequest(payload).subscribe({
      next: (response) => {
        console.log('Team request sent successfully:', response);
      },
      error: (err) => {
        console.error('Error sending team request:', err);
      }
    });
  }

  toggleNearbyWorkers() {
    console.log('Toggle button clicked');
    console.log('Current user location:', this.userLocation);
    this.showNearbyWorkers = !this.showNearbyWorkers;
    if (this.showNearbyWorkers && this.userLocation) {
      this.filterNearbyWorkers();
    } else {
      this.filteredWorkers = this.workers;
    }
  }

  private filterNearbyWorkers() {
    console.log('Filtering nearby workers');
    if (!this.userLocation) {
      console.log('No user location found');
      this.filteredWorkers = this.workers;
      return;
    }

    const userCoords = this.parseCoordinates(this.userLocation);
    console.log('Parsed user coordinates:', userCoords);
    if (!userCoords) {
      console.log('Failed to parse user coordinates');
      this.filteredWorkers = this.workers;
      return;
    }

    this.filteredWorkers = this.workers.filter(worker => {
      if (!worker.location) {
        console.log(`Worker ${worker.id} has no location`);
        return false;
      }
      const workerCoords = this.parseCoordinates(worker.location);
      if (!workerCoords) {
        console.log(`Failed to parse coordinates for worker ${worker.id}`);
        return false;
      }
      
      const distance = this.calculateDistance(
        userCoords.lat,
        userCoords.lon,
        workerCoords.lat,
        workerCoords.lon
      );
      console.log(`Distance to worker ${worker.id}: ${distance}km`);
      
      return distance <= 20; // 20 km radius
    });
    console.log('Filtered workers:', this.filteredWorkers);
  }

  private parseCoordinates(location: string): { lat: number; lon: number } | null {
    try {
      console.log('Parsing location string:', location);
      // Extract coordinates from OpenStreetMap location string
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
    const R = 6371; // Earth's radius in kilometers
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
}
