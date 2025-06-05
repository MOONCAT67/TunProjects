export class User {
    constructor(
      public id: string,
      public fullname: string,
      public email: string,
      public phone_number?: string,
      public role?: string,
      public is_verified?: boolean,
      public profile_picture?: string,
      public token?: string
    ) {}
  
    static fromJson(json: any): User {
      return new User(
        json.id,
        json.fullname,
        json.email,
        json.phone_number,
        json.role,
        json.is_verified,
        json.profile_picture,
        json.token
      );
    }
  
    toJson(): any {
      return {
        id: this.id,
        fullname: this.fullname,
        email: this.email,
        phone_number: this.phone_number,
        role: this.role,
        is_verified: this.is_verified,
        profile_picture: this.profile_picture,
        token: this.token
      };
    }
  
    hasRole(role: string): boolean {
      return this.role === role;
    }
  
    isAuthenticated(): boolean {
      return !!this.token;
    }
  }