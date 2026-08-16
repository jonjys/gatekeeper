/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.openai.com https://api.anthropic.com; img-src 'self' data: blob:; worker-src 'self' blob:;"
          },
          {
            key: 'Permissions-Policy',
            value: 'locks=(self), compute-pressure=(self), clipboard-read=(self)'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
