// navbar.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';  // Import Router to programmatically navigate
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/authService';
import { ClickOutsideDirective } from '../directives/click-outside.directive';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationResponse, Notification } from '../services/notification.service';
import { MessagerieService } from '../services/messagerie.service';
import { UnreadMessageService } from '../services/unread-message.service';
import { TeamService, TeamRequest, GetTeamRequestsResponse, AcceptRejectTeamRequestPayload, AcceptRejectTeamRequestResponse } from '../services/team.service';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ContractService } from '../services/contract.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, ClickOutsideDirective],
  templateUrl: './navbar.component.html', // Separate HTML file
  styleUrls: ['./navbar.component.css']   // Separate CSS file
})
export class NavbarComponent implements OnInit, OnDestroy {
  isDropdownOpen = false;
  isWorkerSpaceOpen = false;
  isAuthenticated = false;
  currentUser: any = null;
  private authSubscription: Subscription | null = null;
  notifications: Notification[] = [];
  unreadCount: number = 0;
  showNotifications: boolean = false;
  isLoading: boolean = true;
  unreadMessagesCount: number = 0;
  teamRequests: TeamRequest[] = [];
  hasError = false;
  signedContracts: { [key: number]: boolean } = {};

  // Add subscription for unread messages service
  private unreadMessageSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private messagerieService: MessagerieService,
    private unreadMessageService: UnreadMessageService,
    private teamService: TeamService,
    private contractService: ContractService
  ) {}

  ngOnInit() {
    // Subscribe to auth state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
      this.currentUser = user;
      
      // Reset notifications when auth state changes
      this.resetNotifications();
      
      // Load notifications if user is authenticated
      if (this.isAuthenticated) {
        this.loadNotificationsAndRequests();
        this.loadUnreadCount();
        this.loadUnreadMessagesCount();
        // Subscribe to unread messages service updates
        this.unreadMessageSubscription = this.unreadMessageService.messageRead$.subscribe(() => {
          this.loadUnreadMessagesCount();
        });
      } else {
        // Unsubscribe when user is not authenticated
        if (this.unreadMessageSubscription) {
          this.unreadMessageSubscription.unsubscribe();
          this.unreadMessageSubscription = null;
        }
      }
    });

    this.loadNotifications();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    // Unsubscribe from unread messages service
    if (this.unreadMessageSubscription) {
      this.unreadMessageSubscription.unsubscribe();
    }
  }

  // Add new method to reset notifications
  private resetNotifications() {
    this.notifications = [];
    this.unreadCount = 0;
    this.showNotifications = false;
    this.isLoading = true;
    this.hasError = false;
  }

  // Method to navigate back to the body component
  goToBody() {
    this.router.navigate(['/body']);  // Navigate to the '/body' route
  }
  goToAuth() {
    this.router.navigate(['/auth']);  
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.isWorkerSpaceOpen = false;
    }
  }

  toggleWorkerSpace(event: Event) {
    event.stopPropagation();
    this.isWorkerSpaceOpen = !this.isWorkerSpaceOpen;
    if (this.isWorkerSpaceOpen) {
      this.isDropdownOpen = false;
    }
  }

  logout() {
    this.resetNotifications(); // Reset notifications before logging out
    this.authService.logout();
    this.isDropdownOpen = false;
    this.isWorkerSpaceOpen = false;
  }

  goToMyProjects() {
    if (!this.isAuthenticated) {
      this.router.navigate(['/auth']);
      return;
    }
    this.router.navigate(['/client/projects']);
    this.isDropdownOpen = false;
  }

  goToManageTeam() {
    this.router.navigate(['/team']);
  }

  goToFindProjects() {
    this.router.navigate(['/worker']);
    this.isWorkerSpaceOpen = false;
  }

  goToCurrentProjects() {
    this.router.navigate(['/worker/current-projects']);
    this.isWorkerSpaceOpen = false;
  }

  closeDropdowns() {
    this.isDropdownOpen = false;
    this.isWorkerSpaceOpen = false;
  }

  loadNotificationsAndRequests() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      console.error('User not logged in. Cannot fetch notifications or requests.');
      this.isLoading = false;
      this.hasError = true;
      return;
    }

    const notifications$: Observable<NotificationResponse> = this.notificationService.getUserNotifications().pipe(
      catchError((error: any) => {
        console.error('Error fetching notifications:', error);
        this.hasError = true;
        return of({ statusCode: error.status || 500, message: error.error?.message || 'Failed to fetch notifications', data: [] });
      })
    );

    const teamRequests$: Observable<GetTeamRequestsResponse> = this.teamService.getTeamRequests(currentUser.id).pipe(
      catchError((error: any) => {
        console.error('Error fetching team requests:', error);
        return of({ message: error.error?.message || 'Failed to fetch team requests', data: [] });
      })
    );

    forkJoin([notifications$, teamRequests$]).subscribe({
      next: ([notificationResponse, teamRequestsResponse]) => {
        this.notifications = notificationResponse.data || [];
        this.teamRequests = teamRequestsResponse.data || [];
        // Count unread notifications + all team requests
        const unreadNotifications = this.notifications.filter(n => n.is_read === 0).length;
        this.unreadCount = unreadNotifications + this.teamRequests.length;
        this.isLoading = false;
        this.hasError = false;
      },
      error: (err: any) => {
        console.error('Error loading combined data:', err);
        this.isLoading = false;
        this.hasError = true;
      }
    });
  }

  loadUnreadCount() {
    this.notificationService.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadCount = response.data.unread_count;
      },
      error: (error) => {
        console.error('Error loading unread count:', error);
      }
    });
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotificationsAndRequests();
    }
  }

  markAsRead(notification: Notification) {
    if (notification.is_read === 0) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.is_read = 1;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        },
        error: (error) => {
          console.error('Error marking notification as read:', error);
        }
      });
    }
  }

  deleteNotification(notification: Notification) {
    this.notificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        if (notification.is_read === 0) {
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
      }
    });
  }

  goToSignContract(notification: Notification) {
    if (notification.extra) {
      this.router.navigate(['/contract/sign', notification.extra]);
    } else {
      console.error('No contract ID found in notification', notification);
      alert('Could not find contract details for this project.');
    }
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-container')) {
      this.showNotifications = false;
    }
  }

  loadUnreadMessagesCount() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    if (!user?.id) return;
    
    this.messagerieService.getUnreadMessagesCount(user.id).subscribe({
      next: (response) => {
        this.unreadMessagesCount = response.data;
      },
      error: (error) => {
        console.error('Error loading unread messages count:', error);
      }
    });
  }

  goToMessagerie() {
    if (!this.isAuthenticated) {
      this.router.navigate(['/auth']);
      return;
    }
    this.router.navigate(['/messagerie']);
  }

  acceptTeamRequest(request: TeamRequest) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      console.error('User not logged in. Cannot accept request.');
      return;
    }
    console.log(`Accepting team request ${request.request_id} for user ${currentUser.id}`);
    const payload: AcceptRejectTeamRequestPayload = { userId: currentUser.id };
    this.teamService.acceptTeamRequest(request.request_id, payload).subscribe({
      next: (response: AcceptRejectTeamRequestResponse) => {
        console.log('Request accepted:', response);
        this.teamRequests = this.teamRequests.filter(req => req.request_id !== request.request_id);
      },
      error: (error: any) => {
        console.error('Error accepting request:', error);
      }
    });
  }

  rejectTeamRequest(request: TeamRequest) {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser?.id) {
      console.error('User not logged in. Cannot reject request.');
      return;
    }
    console.log(`Rejecting team request ${request.request_id} for user ${currentUser.id}`);
    const payload: AcceptRejectTeamRequestPayload = { userId: currentUser.id };
    this.teamService.rejectTeamRequest(request.request_id, payload).subscribe({
      next: (response: AcceptRejectTeamRequestResponse) => {
        console.log('Request rejected:', response);
        this.teamRequests = this.teamRequests.filter(req => req.request_id !== request.request_id);
      },
      error: (error: any) => {
        console.error('Error rejecting request:', error);
      }
    });
  }

  isTeamRequest(item: Notification | TeamRequest): item is TeamRequest {
    return (item as TeamRequest).sender !== undefined && (item as TeamRequest).request_id !== undefined;
  }

  loadNotifications(): void {
    this.notificationService.getUserNotifications().subscribe({
      next: (response: any) => {
        if (response && response.data) {
          this.notifications = response.data;
          // Check signature status for each project notification
          this.notifications.forEach(notification => {
            if (notification.type === 'project' && 
                notification.title === 'Application Accepted' && 
                notification.extra) {
              this.checkContractSignature(notification.extra);
            }
          });
        }
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
      }
    });
  }

  checkContractSignature(contractId: number): void {
    this.contractService.checkWorkerSignature(contractId).subscribe({
      next: (response: any) => {
        if (response && response.data) {
          this.signedContracts[contractId] = response.data.isSigned;
        }
      },
      error: (error: any) => {
        console.error('Error checking contract signature:', error);
      }
    });
  }

  goToProjectSection(): void {
    this.router.navigate(['/worker/current-projects']);
  }
}
