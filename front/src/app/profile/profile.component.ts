import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WorkerService } from '../services/worker.service';
import { AuthService } from '../services/authService';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profile: any = null;
  loading = true;
  error: string | null = null;
  currentUser: any = null;
  averageRating: number = 0;
  totalReviews: number = 0;
  protected readonly Math = Math;

  constructor(
    private route: ActivatedRoute,
    private workerService: WorkerService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    const workerId = this.route.snapshot.paramMap.get('workerId');
    
    if (workerId) {
      this.loadWorkerProfile(workerId);
    } else {
      this.error = 'Worker ID not provided';
      this.loading = false;
    }
  }

  loadWorkerProfile(workerId: string) {
    this.loading = true;
    this.error = null;

    this.workerService.getWorkerProfile(workerId).subscribe({
      next: (response) => {
        if (response.success) {
          this.profile = response.data;
          this.calculateRating();
        } else {
          this.error = response.message || 'Failed to load worker profile';
        }
        this.loading = false;
      },
      error: (error) => {
        this.error = error.message || 'Failed to load worker profile';
        this.loading = false;
      }
    });
  }

  calculateRating() {
    if (this.profile?.reviews?.length > 0) {
      const totalRating = this.profile.reviews.reduce((sum: number, review: any) => sum + review.rating, 0);
      this.averageRating = totalRating / this.profile.reviews.length;
      this.totalReviews = this.profile.reviews.length;
    } else {
      this.averageRating = 0;
      this.totalReviews = 0;
    }
  }

  getVerificationStatus(): string {
    if (!this.profile) return '';
    return this.profile.is_verified ? 'Verified Worker' : 'Not Verified';
  }

  getVerificationDate(): string {
    if (!this.profile?.worker_verified_at) return '';
    return new Date(this.profile.worker_verified_at).toLocaleDateString();
  }

  getTeamInfo(): string {
    if (!this.profile) return '';
    return this.profile.teamInfo === 'solo worker' ? 'Solo Worker' : 'Team Member';
  }

  getRatingPercentage(rating: number): number {
    if (this.totalReviews === 0) return 0;
    const count = this.getRatingCount(rating);
    return (count / this.totalReviews) * 100;
  }

  getRatingCount(rating: number): number {
    return this.profile.reviews.filter((review: { rating: number }) => review.rating === rating).length;
  }
}
