import './globals.css';

export const metadata = {
  title: 'ZAYRA API - Sri Lankan Developer Hub',
  description: 'APIs for Sri Lankan developers - Test, manage, and deploy',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
