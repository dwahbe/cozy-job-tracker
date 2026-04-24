export type ChangelogEntry = {
  date: string;
  title: string;
  emoji: string;
  description: string | string[];
  tag?: 'new' | 'improvement' | 'fix' | 'beta';
  link?: { url: string; text: string };
};

export const changelog: ChangelogEntry[] = [
  {
    date: 'Apr 3, 2026',
    title: 'Board view for jobs',
    emoji: '📋',
    description: [
      'A new way to see your job pipeline. The board view shows your jobs as a kanban board with columns for each status — Saved, Applied, Interview, Offer, and Rejected.',
      'Drag and drop jobs between columns to update their status',
      'Click any card to open a detail panel with all your fields and custom columns',
      'Edit everything inline without leaving the board view',
      'Custom column values show as tags right on the cards',
    ],
  },
  {
    date: 'Feb 23, 2026',
    title: 'Professional network tab',
    emoji: '🤝',
    description: [
      "I got some great feedback from a few users that their job search spreadsheet had a people tab too. Recruiters, old coworkers, friends at companies you're interested in. cozy job tracker couldn't really replace that sheet until it could track people. The new Network tab can:",
      'Track contacts with name, company, title, LinkedIn, and status',
      'Add custom columns like you can on the Job board',
      'Import from Google Sheets with auto-detected column mapping',
      'Inline editing, drag-and-drop columns, search, and multi-sort',
      'Link people to jobs on your board',
      "This is in beta and I'll be refining it and adding more. Let me know what's missing!",
    ],
  },
  {
    date: 'Feb 22, 2026',
    title: 'AI chat integration',
    emoji: '🤖',
    description:
      'You can now connect your board to the AI assistant of your choice — I recommend Claude. Manage your jobs right from a chat. Try things like "what jobs have I applied to?" or "add a barista role at Cosmic Cat Cafe".',
    link: {
      url: '/settings',
      text: 'Set it up in settings',
    },
  },
  {
    date: 'Feb 19, 2026',
    title: 'Chrome extension',
    emoji: '🧩',
    description:
      'Save job postings to your board without leaving the page. Just click the extension icon, hit "Add to board", and the job title, company, location, and details are parsed and saved automatically.',
    link: {
      url: 'https://chromewebstore.google.com/detail/cozy-job-tracker/jnkjaboanaihkoiidmpjolldkgkbpllm',
      text: 'Get it on the Chrome Web Store',
    },
  },
  {
    date: 'Feb 8, 2026',
    title: 'Multi-column sorting',
    emoji: '🔀',
    description:
      'Sort your board by multiple columns at once — including custom columns. Stack sort rules to dial in exactly the order you want — like company A–Z, then date applied newest first.',
  },
  {
    date: 'Feb 8, 2026',
    title: 'Email accounts',
    emoji: '🔑',
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
