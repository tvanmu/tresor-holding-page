export default function handler(_request, response) {
  response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  response.setHeader(
    "X-Robots-Tag",
    "noindex, nofollow, noimageindex, nosnippet, max-image-preview:none"
  );
  response.status(410).send("Gone");
}
