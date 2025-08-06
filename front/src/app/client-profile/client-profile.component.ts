import { Component, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/authService';
import { ClientService, ClientProfile } from '../services/client.service';
import type { Map, Icon } from 'leaflet';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './client-profile.component.html',
  styleUrls: ['./client-profile.component.css'],
  styles: [`
    @import 'leaflet/dist/leaflet.css';
  `]
})
export class ClientProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  currentUser: ClientProfile | null = null;
  isLoading = true;
  error: string | null = null;
  private map: Map | null = null;
  private customIcon: Icon | null = null;
  private L: any;

  editFullNameMode: boolean = false;
  editedFullName: string = '';
  editPhoneNumberMode: boolean = false;
  editedPhoneNumber: string = '';

  constructor(
    private authService: AuthService,
    private clientService: ClientService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    if (isPlatformBrowser(this.platformId)) {
      import('leaflet').then(L => {
        this.L = L;
        this.customIcon = L.icon({
          iconUrl: 'assets/pin.png',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
      });
    }
  }

  ngOnInit() {
    this.loadProfile();
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initializeMap();
      }, 500);
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  loadProfile() {
    this.isLoading = true;
    this.error = null;

    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      this.error = 'Please log in to view your profile';
      this.isLoading = false;
      return;
    }

    this.clientService.getClientProfile(user.id).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          this.currentUser = response.data;
          if (this.currentUser) {
            this.currentUser.statistics.activeProjects = this.getActiveProjectsCount();
            this.currentUser.statistics.completedProjects = this.getCompletedProjectsCount();
            this.cdr.detectChanges();
            console.log('Profile loaded. currentUser.profile_picture:', this.currentUser.profile_picture);
            
            // Initialize edited values
            this.editedFullName = this.currentUser.fullname;
            this.editedPhoneNumber = this.currentUser.phone_number;

            if (isPlatformBrowser(this.platformId)) {
              setTimeout(() => {
                this.initializeMap();
              }, 500);
            }
          }
        } else {
          this.error = 'Failed to load profile';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.error = 'Failed to load profile';
        this.isLoading = false;
      }
    });
  }

  private initializeMap() {
    if (!this.L || !this.customIcon || !isPlatformBrowser(this.platformId)) return;
    const mapElement = document.getElementById('user-location-map');
    if (!mapElement) return;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    // Use user's location if available, otherwise fallback to a default
    let lat = 36.797897119589905;
    let lng = 10.16726302681491;
    if (this.currentUser?.location) {
      const loc = this.currentUser.location.startsWith('@') ? this.currentUser.location.slice(1) : this.currentUser.location;
      const [latStr, lngStr] = loc.split(',');
      if (!isNaN(parseFloat(latStr)) && !isNaN(parseFloat(lngStr))) {
        lat = parseFloat(latStr);
        lng = parseFloat(lngStr);
      }
    }
    this.map = this.L.map('user-location-map', {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false
    });
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);
    this.L.marker([lat, lng], { icon: this.customIcon })
      .addTo(this.map)
      .bindPopup(this.currentUser?.fullname || 'Your Location');
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);
  }

  toggleEditFullName(): void {
    this.editFullNameMode = !this.editFullNameMode;
    if (this.editFullNameMode && this.currentUser) {
      this.editedFullName = this.currentUser.fullname;
    }
  }

  saveFullName(): void {
    if (!this.currentUser?.id) {
      alert('User not logged in.');
      return;
    }
    this.isLoading = true;
    this.clientService.updateFullName(this.currentUser.id, this.editedFullName).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          alert('Full name updated successfully!');
          if (this.currentUser) {
            this.currentUser.fullname = this.editedFullName;
          }
          this.editFullNameMode = false;
        } else {
          alert('Failed to update full name: ' + (response.message || 'Unknown error'));
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating full name:', error);
        alert('Error updating full name. Please try again.');
        this.isLoading = false;
      }
    });
  }

  toggleEditPhoneNumber(): void {
    this.editPhoneNumberMode = !this.editPhoneNumberMode;
    if (this.editPhoneNumberMode && this.currentUser) {
      this.editedPhoneNumber = this.currentUser.phone_number;
    }
  }

  savePhoneNumber(): void {
    if (!this.currentUser?.id) {
      alert('User not logged in.');
      return;
    }
    this.isLoading = true;
    this.clientService.updatePhoneNumber(this.currentUser.id, this.editedPhoneNumber).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          alert('Phone number updated successfully!');
          if (this.currentUser) {
            this.currentUser.phone_number = this.editedPhoneNumber;
          }
          this.editPhoneNumberMode = false;
        } else {
          alert('Failed to update phone number: ' + (response.message || 'Unknown error'));
    }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating phone number:', error);
        alert('Error updating phone number. Please try again.');
        this.isLoading = false;
      }
    });
  }

  getActiveProjectsCount(): number {
    if (!this.currentUser?.projects) return 0;
    return this.currentUser.projects.filter(project => 
      project.status.toLowerCase() === 'in progress'
    ).length;
  }

  getCompletedProjectsCount(): number {
    if (!this.currentUser?.projects) return 0;
    return this.currentUser.projects.filter(project => 
      project.status.toLowerCase() === 'completed'
    ).length;
  }

  handleImageError(event: any) {
    console.warn('Image loading error. Falling back to default profile picture.', event);
    event.target.src = 'assets/profile.jpg';
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Max 2MB
        alert('File size exceeds 2MB. Please choose a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        this.uploadProfilePicture(base64String);
      };
      reader.readAsDataURL(file);
    }
  }

  uploadProfilePicture(base64Image: string): void {
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      alert('User not logged in.');
      return;
    }
    this.isLoading = true;
    this.clientService.updateProfilePicture(user.id, base64Image).subscribe({
      next: (response) => {
        if (response.statusCode === 200) {
          alert('Profile picture updated successfully!');
          // Optionally, update the currentUser profile_picture to reflect the change immediately
          if (this.currentUser) {
            this.currentUser.profile_picture = base64Image; 
          }
        } else {
          alert('Failed to update profile picture: ' + (response.message || 'Unknown error'));
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error uploading profile picture:', error);
        alert('Error uploading profile picture. Please try again.');
        this.isLoading = false;
      }
    });
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
