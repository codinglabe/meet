import './globals.css';

export const metadata = {
  title: 'Kreo Meet',
  description: 'Custom video meetings, webinar mode, chat, and attendance tracking.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
