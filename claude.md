# claude.md

## Project Overview
Node.js application deployed on Vercel Free Tier

## Repository Structure
- **Frontend/API**: This repository (auto-deploys via GitHub workflow)
- **Database**: Separate Supabase repository for schema management

## Critical Workflow
**Always run a build after making changes to ensure deployment compatibility:**
```bash
npm run build
# or
yarn build
```

## Development Setup
```bash
npm install
npm run dev
```

## Vercel Free Tier Considerations
- **Function Timeout**: 10 seconds max execution time
- **Bundle Size**: Keep functions under 50MB
- **Concurrent Executions**: 1000 per day limit
- **Edge Functions**: 100KB size limit
- **Build Time**: 45 seconds max

## Recommended Best Practices

### Environment Variables
- Use `.env.local` for local development
- Configure production variables in Vercel dashboard
- Never commit sensitive data to git
- Prefix public variables with `NEXT_PUBLIC_` (if using Next.js)

### Performance Optimization
- Minimize bundle size with tree shaking
- Use dynamic imports for heavy libraries
- Implement proper caching headers
- Consider edge functions for simple operations

### Code Quality
```bash
# Recommended scripts in package.json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
  "type-check": "tsc --noEmit"
}
```

### Git Workflow
1. Make changes
2. Run `npm run build` to verify locally
3. Fix any build errors
4. Commit and push to main
5. GitHub workflow automatically deploys to Vercel
6. Monitor deployment status in Vercel dashboard

### API Routes Best Practices
- Keep API functions lightweight
- Use proper HTTP status codes
- Implement error handling
- Consider rate limiting for public APIs
- Cache responses when possible

### Database
- **Supabase**: Deployed in separate repository
- Use Supabase client with proper connection pooling
- Store Supabase URL and anon key in environment variables
- Consider Row Level Security (RLS) policies

### Monitoring
- Use Vercel Analytics (free tier available)
- Monitor function execution time
- Track build times and failures
- Set up error tracking (Sentry, LogRocket)

### Dependencies
- Regularly update dependencies for security
- Use `npm audit` to check for vulnerabilities
- Consider bundle analyzers to track size impact

## Pre-deployment Checklist
- [ ] `npm run build` completes successfully
- [ ] All environment variables configured
- [ ] No console.log statements in production code
- [ ] Error handling implemented
- [ ] Function execution times under 10 seconds
- [ ] Bundle size optimized

## Troubleshooting
- Check Vercel function logs for runtime errors
- Use `vercel dev` for local testing with Vercel environment
- Monitor build logs for dependency issues
- Test API routes individually before deployment