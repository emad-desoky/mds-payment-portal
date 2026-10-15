const nextConfig = {
  poweredByHeader:false,
  reactStrictMode:true,
  async headers(){ return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
    {key:'Cache-Control',value:'private, no-store'}
  ]}]}
};
export default nextConfig;
