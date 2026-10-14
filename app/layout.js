import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export const metadata = {
  title: 'YC Match — Find startups that match your resume',
  description: 'Upload your resume, get ranked YC startup matches with outreach drafts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}<Analytics /></body>
    </html>
  );
}
