export type ChangelogEntry = {
  date: string;
  title: string;
  emoji: string;
  description: string;
  tag?: 'new' | 'improvement' | 'fix';
};

export const changelog: ChangelogEntry[] = [
  {
    date: 'Feb 6, 2026',
    title: 'Bulk Job Import',
    emoji: '📦',
    tag: 'new',
    description:
      'Paste up to 50 job URLs and import them all at once. No more adding jobs one by one — just paste, review, and go.',
  },
  {
    date: 'Jan 1, 2026',
    title: 'Cozy Job Tracker launched!',
    emoji: '🌱',
    description:
      "Your cozy corner of the internet for tracking job applications. Create a board, paste a URL, and you're off.",
  },
];
