// en-US display formatting; dates are the visitor's local calendar dates (design/DESIGN.md). From the reference.
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

export const formatDate = (d: Date) => DATE.format(d);
export const formatDateTime = (d: Date) => DATE_TIME.format(d);
export const pages = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
