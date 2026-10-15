import { redirect } from 'next/navigation';

/**
 * Root Route (/)
 * Server-side redirects incoming traffic to /admin (which middleware protects and forwards to /admin/login if unauthenticated).
 */
export default function RootPage() {
  redirect('/admin');
}
