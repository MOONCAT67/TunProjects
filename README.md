# Project Documentation

## Overview
This project consists of a full-stack web application with a frontend built using Angular and a backend built with Node.js/Express.js. The application follows a modern web architecture with clear separation between the frontend and backend components.

## Project Structure

### Frontend (`/front`)
The frontend is an Angular 17.3.0 application that provides the user interface for the application.

#### Key Features
- Built with Angular 17.3.0
- TypeScript for type safety
- Responsive design
- Component-based architecture

#### Directory Structure
- `/src` - Main application source code
  - `/app` - Angular components, services, and modules
  - `/assets` - Static assets (images, styles, etc.)
  - `/environments` - Environment-specific configuration
- `/node_modules` - NPM dependencies
- `angular.json` - Angular CLI configuration
- `package.json` - Project dependencies and scripts

#### Getting Started
1. Install Node.js and npm
2. Navigate to the `/front` directory
3. Run `npm install` to install dependencies
4. Run `ng serve` for a dev server
5. Navigate to `http://localhost:4200/`

### Backend (`/le backend de moi`)
The backend is a Node.js/Express.js application that provides the API and business logic for the application.

#### Key Features
- RESTful API architecture
- JWT authentication
- File upload handling
- Database integration
- Middleware support

#### Directory Structure
- `/config` - Configuration files
- `/controllers` - Request handlers
- `/middleware` - Custom middleware
- `/routes` - API route definitions
- `/services` - Business logic and external service integration
- `/uploads` - File upload directory
- `app.js` - Main application entry point
- `.env` - Environment variables

#### Getting Started
1. Ensure you have Node.js and npm installed
2. Navigate to the `/le backend de moi` directory
3. Run `npm install` to install dependencies
4. Set up your environment variables in `.env`
5. Run `node app.js` to start the server
6. The API will be available at `http://localhost:3000/`

## Database
- The application uses a SQL database (MySQL/PostgreSQL)
- Database schema and initial data can be found in the SQL files
- Run the SQL scripts to set up the database structure and initial data

## Environment Variables

### Frontend
Create an `environment.ts` file in `/front/src/environments/` with your configuration:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api', // Update with your backend API URL
};
```

### Backend
Create a `.env` file in `/le backend de moi/` with your configuration:

```
PORT=3000
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASS=your_database_password
DB_NAME=your_database_name
JWT_SECRET=your_jwt_secret
UPLOAD_DIR=./uploads
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with email and password
- `GET /api/auth/me` - Get current user profile (requires authentication)

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Development

### Frontend Development
- Run `ng serve` for a dev server
- The app will automatically reload if you change any of the source files

### Backend Development
- Run `node app.js` to start the development server
- The server will automatically restart when files change (if using nodemon)

## Build

### Frontend
- Run `ng build` to build the project
- The build artifacts will be stored in the `dist/` directory

## Testing
- Run `ng test` to execute the frontend unit tests
- Run `ng e2e` to execute the end-to-end tests

## Deployment

### Frontend
- Build the project using `ng build --prod`
- Deploy the contents of the `dist/` directory to your web server

### Backend
- Ensure all environment variables are properly set in production
- Use a process manager like PM2 to keep the Node.js application running
- Set up a reverse proxy (Nginx, Apache) for production deployment

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
[Specify your license here]

## Contact
[Your Name] - [Your Email]

Project Link: [https://github.com/yourusername/your-project](https://github.com/yourusername/your-project)
