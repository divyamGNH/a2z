import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: "Striver’s A2Z Sheet · The Original", description: 'The original 455-question A2Z roadmap, with GFG, LeetCode and Striver video links.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html> }
