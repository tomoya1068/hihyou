export function GET() {
  // Return an empty favicon response to avoid noisy 404s in browser console.
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
