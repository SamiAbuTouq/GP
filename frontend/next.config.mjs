import path from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Next.js only auto-loads env from the frontend folder. Auth/password API routes use
// Prisma + SMTP — mirror backend/.env so DATABASE_URL, SMTP_*, etc. stay in one file.
loadEnv({ path: path.resolve(__dirname, '../backend/.env') })

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
