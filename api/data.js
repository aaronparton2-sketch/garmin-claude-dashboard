// Data proxy. Returns the dashboard bundle (weigh-ins, activities, sleep, daily,
// DEXA, bloods) from Supabase when configured, otherwise the bundled sample set.
// With GH_PASSWORD set, it answers 401 until /api/login has set the session
// cookie. The Supabase key only ever lives here, server-side.
import { authorised, loadBundle } from "./_bundle.js";

export default async function handler(req, res) {
  if (!authorised(req)) {
    res.status(401).json({ error: "auth" });
    return;
  }
  try {
    const bundle = await loadBundle();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(bundle);
  } catch (e) {
    res.status(502).json({ error: "upstream", detail: String(e) });
  }
}
