# Family Photo

A photo sharing platform for families built with React, TypeScript, and Convex. Family Photo enables families to upload, organize, and share their memories with features like collections, editorial feeds, and user profiles.

## Features

- **Photo Feed**: Browse all photos in chronological order
- **Editorial Feed**: Curated selection of featured photos managed by administrators
- **Collections**: Organize photos into public or private collections
- **User Profiles**: Customizable profiles with display names and bios
- **Photo Upload**: Upload photos with titles, descriptions, and tags
- **Comments**: Engage with photos through comments
- **Admin Panel**: Administrative tools for managing the platform
- **Authentication**: Secure user authentication powered by Convex Auth

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Convex (serverless backend)
- **Styling**: Tailwind CSS
- **Authentication**: Convex Auth
- **UI Components**: Custom components with Tailwind CSS
- **Notifications**: Sonner (toast notifications)

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Convex account (sign up at [convex.dev](https://convex.dev))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd family-photo
```

2. Install dependencies:
```bash
npm install
```

3. Set up Convex:
   - If you haven't already, create a Convex account and project
   - Run `npx convex dev` to initialize your Convex deployment
   - Follow the prompts to configure your Convex project

4. Configure environment variables:
   - Create a `.env.local` file in the root directory
   - Add your Convex deployment URL and other necessary environment variables

5. Start the development server:
```bash
npm run dev
```

This will start both the frontend (Vite) and backend (Convex) development servers in parallel. The app will open automatically in your browser.

## Project Structure

```
family-photo/
├── convex/              # Backend code (Convex functions)
│   ├── auth.ts         # Authentication configuration
│   ├── photos.ts       # Photo-related queries and mutations
│   ├── profiles.ts     # User profile functions
│   ├── collections.ts  # Collection management
│   ├── editorial.ts    # Editorial feed management
│   ├── router.ts       # HTTP routes
│   └── schema.ts       # Database schema definitions
├── src/
│   ├── components/     # React components
│   │   ├── PhotoFeed.tsx
│   │   ├── PhotoCard.tsx
│   │   ├── UploadPhoto.tsx
│   │   ├── UserProfile.tsx
│   │   ├── Collections.tsx
│   │   ├── EditorialFeed.tsx
│   │   └── AdminPanel.tsx
│   ├── App.tsx         # Main application component
│   ├── SignInForm.tsx  # Authentication form
│   └── main.tsx        # Application entry point
├── package.json
├── vite.config.ts      # Vite configuration
└── tailwind.config.js  # Tailwind CSS configuration
```

## Available Scripts

- `npm run dev`: Start both frontend and backend development servers
- `npm run dev:frontend`: Start only the frontend development server
- `npm run dev:backend`: Start only the Convex backend development server
- `npm run build`: Build the application for production
- `npm run lint`: Run TypeScript type checking and linting

## Database Schema

The application uses the following main tables:

- **users**: User accounts (managed by Convex Auth)
- **profiles**: User profile information (display name, bio)
- **photos**: Photo metadata (title, description, tags, storage reference)
- **comments**: Comments on photos
- **collections**: User-created photo collections
- **collectionPhotos**: Junction table for photos in collections
- **editorialPeriods**: Editorial feed periods managed by curators
- **editorialPhotos**: Photos featured in editorial feeds

## Authentication

Family Photo uses [Convex Auth](https://auth.convex.dev/) for authentication. The current configuration uses Anonymous auth for easy development and testing. Before deploying to production, you should configure a more secure authentication provider.

## Development

### Adding New Features

1. **Backend (Convex)**: Add queries and mutations in the `convex/` directory
2. **Frontend**: Create or update React components in `src/components/`
3. **Schema Changes**: Update `convex/schema.ts` and run `npx convex dev` to apply migrations

### Code Style

- TypeScript is used throughout the project
- ESLint is configured for code quality
- Prettier is available for code formatting

## Deployment

### Deploying to Production

1. **Build the frontend**:
```bash
npm run build
```

2. **Deploy Convex backend**:
   - Your Convex backend is automatically deployed when you run `npx convex dev`
   - For production, use `npx convex deploy` or configure CI/CD

3. **Deploy the frontend**:
   - Deploy the `dist/` folder to your preferred hosting service (Vercel, Netlify, etc.)
   - Make sure to set the appropriate environment variables

### Environment Variables

Required environment variables:
- `VITE_CONVEX_URL`: Your Convex deployment URL
- `CONVEX_SITE_URL`: Your site URL (for authentication)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Convex Auth Documentation](https://auth.convex.dev/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Support

For issues and questions, please open an issue in the repository or contact the development team.
