import { Component, OnInit, AfterViewInit, inject, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/authService';
import { WINDOW } from '../window.token';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css']
})
export class AuthComponent implements AfterViewInit {
  isLogin = true;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  private map: any = null;
  private marker: any = null;
  selectedLocation: string = '';
  showMapModal = false;
  private _window = inject(WINDOW) as Window;
  private leafletModule: any = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  // Login Form
  loginForm: FormGroup;

  // Register Form
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Initialize login form
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    // Initialize register form
    this.registerForm = this.fb.group({
      fullname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone_number: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      location: ['', Validators.required],
      profile_picture: [''] // Optional
    }, { validator: this.passwordMatchValidator });
  }

  ngAfterViewInit() {
    // No-op: map is now initialized only when modal opens
  }

  async openMapModal() {
    if (isPlatformBrowser(this.platformId)) {
      this.showMapModal = true;
      await this.initMap();
    }
  }

  closeMapModal() {
    this.showMapModal = false;
    // Optionally, destroy map instance to free memory
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }

  async initMap() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.leafletModule) {
      const mod = await import('leaflet');
      this.leafletModule = mod.default || mod;
    }
    const L = this.leafletModule;
    // Define custom pin icon
    const pinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    setTimeout(() => {
      this.map = L.map('map-modal').setView([36.8065, 10.1815], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);
      // If already selected, show marker
      if (this.selectedLocation && this.registerForm.value.location) {
        // Optionally, parse lat/lng from address if possible
      }
      this.map.on('click', (e: any) => {
        this.updateMarker(e.latlng, L, pinIcon);
      });
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 250);
    }, 50);
  }

  async selectCurrentLocation() {
    const L = this.leafletModule;
    const pinIcon = L.icon({
      iconUrl: 'assets/pin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    if (this._window.navigator && this._window.navigator.geolocation) {
      this._window.navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
          this.map?.setView(latlng, 15);
          this.updateMarker(latlng, L, pinIcon);
        },
        (error: GeolocationPositionError) => {
          alert('Could not get your location.');
        }
      );
    }
  }

  private updateMarker(latlng: any, L: any, pinIcon?: any) {
    if (this.marker) {
      this.marker.setLatLng(latlng);
    } else {
      this.marker = L.marker(latlng, { draggable: true, icon: pinIcon }).addTo(this.map!);
      this.marker.on('dragend', (e: any) => {
        const newLatLng = e.target.getLatLng();
        this.reverseGeocode(newLatLng.lat, newLatLng.lng);
      });
    }
    if (pinIcon && this.marker) {
      this.marker.setIcon(pinIcon);
    }
    this.reverseGeocode(latlng.lat, latlng.lng);
  }

  private reverseGeocode(lat: number, lng: number) {
    this.lastLat = lat;
    this.lastLng = lng;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then((response: Response) => response.json())
      .then((data: any) => {
        this.selectedLocation = data.display_name;
      })
      .catch((error: any) => {
        this.selectedLocation = `${lat}, ${lng}`;
      });
  }

  confirmLocation() {
    if (this.lastLat !== null && this.lastLng !== null) {
      const locationString = `@${this.lastLat},${this.lastLng}`;
      this.registerForm.patchValue({ location: locationString });
    }
    this.closeMapModal();
  }

  toggleLoginMode(): void {
    this.isLogin = !this.isLogin;
    this.errorMessage = '';
    this.successMessage = '';
    // No map init here; open modal on input click
  }

  passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    return form.get('password')?.value === form.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
      next: (user) => {
        this.isLoading = false;
        if (user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/body']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Login failed. Please try again.';
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const { fullname, email, password, phone_number, location, profile_picture } = this.registerForm.value;
    this.authService.register(fullname, email, password, phone_number, location, profile_picture).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.successMessage = 'Registration successful! You can now login.';
        setTimeout(() => {
          this.isLogin = true;
          if (user.role === 'admin') {
            this.router.navigate(['/admin/dashboard']);
          } else {
            this.router.navigate(['/body']);
          }
        }, 2000);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.message || 'Registration failed. Please try again.';
      }
    });
  }

  handleForgotPassword(event: Event) {
    event.preventDefault();
    
    const email = this.loginForm.get('email')?.value;
    if (!email) {
      alert('Please enter your email address first');
      return;
    }

    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        alert('Your password has been sent to your email address');
      },
      error: (error) => {
        console.error('Error sending password:', error);
        alert('Failed to send password. Please try again later.');
      }
    });
  }
}