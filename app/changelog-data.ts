export type ChangelogEntry = {
  date: string;
  title: string;
  emoji: string;
  description: string;
  tag?: 'new' | 'improvement' | 'fix';
};

export const changelog: ChangelogEntry[] = [
  {
    date: 'Feb 8, 2026',
    title: 'Multi-column sorting',
    emoji: '🔀',
    tag: 'new',
    description:
      'Sort your board by multiple columns at once — including custom columns. Stack sort rules to dial in exactly the order you want — like company A–Z, then date applied newest first.',
  },
  {
    date: 'Feb 8, 2026',
    title: 'Email accounts',
    emoji: '🔑',
    tag: 'new',
    description:
      'Sign in with your email to get a personal board tied to your account. No password needed — just a magic link. Already have a board? Import it after creating your account.',
  },
  {
    date: 'Feb 6, 2026',
    title: 'Bulk job import',
    emoji: '📦',
    description:
      'Paste up to 50 job URLs and import them all at once. No more adding jobs one by one — just paste, review, and go.',
  },
  {
    date: 'Jan 1, 2026',
    title: 'cozy job tracker launched!',
    emoji: '🌱',
    description:
      "Your cozy corner of the internet for tracking job applications. Create a board, paste a URL, and you're off.",
  },
];
