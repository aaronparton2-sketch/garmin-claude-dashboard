// POST { password } -> sets an httpOnly session cookie when the password matches
// GH_PASSWORD. Only relevant when GH_PASSWORD is set (the demo leaves it unset).
// The password + session token live server-side, never in the browser bundle.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  if (!process.env.GH_PASSWORD) {
    res.status(200).json({ ok: true, open: true });
    return;
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const password = body && body.password;
  if (!password || String(password) !== String(process.env.GH_PASSWORD)) {
    res.status(401).json({ ok: false });
    return;
  }
  const token = process.env.GH_SESSION_TOKEN || "ok";
  res.setHeader(
    "Set-Cookie",
    `gh_auth=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  );
  res.status(200).json({ ok: true });
}
