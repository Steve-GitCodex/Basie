import { icon } from '../icons.js';

export const CATEGORY_META = {
  reports: { label: 'Reports', icon: 'sword',      empty: 'No battle reports yet.' },
  rewards: { label: 'Rewards', icon: 'gift',       empty: 'No reward mail.' },
  system:  { label: 'System',  icon: 'gear',       empty: 'No system mail.' },
  starred: { label: 'Starred', icon: 'star-burst', empty: 'Star a mail to keep it here.' },
  trash:   { label: 'Trash',   icon: 'trash',      empty: 'Trash is empty. Mail here is removed after 7 days.' },
};

export const categoryIcon = (cat) => icon(CATEGORY_META[cat].icon);
