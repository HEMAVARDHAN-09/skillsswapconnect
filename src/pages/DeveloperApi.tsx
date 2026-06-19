import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const API_VERSION = "v1";
const BASE_URL = "https://rsuyznydlccgiywycogo.supabase.co/rest/v1/rpc";

type Endpoint = {
  name: string;
  summary: string;
  auth: "Authenticated user (JWT)" | "Authenticated user (JWT) — admin only";
  method: "POST";
  params: { name: string; type: string; required: boolean; description: string }[];
  request: object;
  response: unknown;
  notes?: string[];
};

const endpoints: Endpoint[] = [
  {
    name: "get_my_profile",
    summary: "Return the signed-in user's own profile (name, email, credit balance).",
    auth: "Authenticated user (JWT)",
    method: "POST",
    params: [],
    request: {},
    response: [{ user_id: "uuid", name: "Ada Lovelace", email: "ada@example.com", credits: 3 }],
  },
  {
    name: "get_leaderboard",
    summary: "Top teachers ranked by credit balance, with average session rating.",
    auth: "Authenticated user (JWT)",
    method: "POST",
    params: [
      { name: "_limit", type: "integer", required: false, description: "Max rows to return (1–25, default 5)." },
    ],
    request: { _limit: 10 },
    response: [
      { user_id: "uuid", name: "Grace Hopper", credits: 42, avg_rating: 4.8 },
    ],
  },
  {
    name: "get_public_profiles",
    summary:
      "Resolve display names for a set of user IDs. Only returns rows the caller is allowed to see (matched skills, shared session, active chat, or admin).",
    auth: "Authenticated user (JWT)",
    method: "POST",
    params: [
      { name: "_user_ids", type: "uuid[]", required: true, description: "Array of user IDs to look up." },
    ],
    request: { _user_ids: ["8a3e...", "ce91..."] },
    response: [{ user_id: "8a3e...", name: "Ada Lovelace" }],
  },
  {
    name: "complete_session",
    summary:
      "Mark a confirmed session as completed and atomically transfer 1 credit from learner to teacher. Caller must be the teacher.",
    auth: "Authenticated user (JWT)",
    method: "POST",
    params: [
      { name: "_session_id", type: "uuid", required: true, description: "The session to complete." },
    ],
    request: { _session_id: "0f1c..." },
    response: null,
    notes: [
      "Errors: 'Session not found', 'Not authorized', 'Session cannot be completed from current status'.",
    ],
  },
  {
    name: "get_suspicious_rpc_activity",
    summary:
      "Admin-only. Returns callers exceeding a per-function call threshold in the recent window. Backed by the rpc_audit_log table.",
    auth: "Authenticated user (JWT) — admin only",
    method: "POST",
    params: [
      { name: "_minutes", type: "integer", required: false, description: "Window in minutes (default 60)." },
      { name: "_threshold", type: "integer", required: false, description: "Min calls to flag (default 100)." },
    ],
    request: { _minutes: 60, _threshold: 100 },
    response: [
      {
        caller_id: "uuid",
        function_name: "get_leaderboard",
        call_count: 412,
        failure_count: 0,
        last_call: "2026-06-10T04:55:00Z",
      },
    ],
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted text-foreground rounded-md p-4 text-xs overflow-x-auto border">
      <code>{children}</code>
    </pre>
  );
}

export default function DeveloperApi() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">

      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to app
          </Link>
          <Badge variant="secondary">API {API_VERSION}</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
        <section>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Developer API</h1>
          <p className="text-muted-foreground">
            The SkillSwap public API exposes a small set of authenticated RPC endpoints over PostgREST.
            Calls require a valid user access token. This page documents version{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted">{API_VERSION}</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Conventions</h2>
          <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
            <li>Base URL: <code className="px-1 rounded bg-muted">{BASE_URL}</code></li>
            <li>All RPCs use <strong>HTTP POST</strong> with a JSON body of parameters.</li>
            <li>Headers: <code className="px-1 rounded bg-muted">apikey</code>, <code className="px-1 rounded bg-muted">Authorization: Bearer &lt;jwt&gt;</code>, <code className="px-1 rounded bg-muted">Content-Type: application/json</code>.</li>
            <li>All calls are recorded in the internal <code>rpc_audit_log</code> table (caller, function, args, success, timestamp).</li>
          </ul>
          <CodeBlock>{`curl -X POST '${BASE_URL}/get_my_profile' \\
  -H "apikey: <publishable-key>" \\
  -H "Authorization: Bearer <user-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">Endpoints</h2>
          {endpoints.map((ep) => (
            <Card key={ep.name} className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-xl font-semibold font-mono">{ep.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{ep.summary}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge>{ep.method}</Badge>
                  <Badge variant="outline">{ep.auth}</Badge>
                </div>
              </div>

              {ep.params.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Parameters</h4>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Required</th>
                          <th className="text-left px-3 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map((p) => (
                          <tr key={p.name} className="border-t">
                            <td className="px-3 py-2 font-mono">{p.name}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{p.type}</td>
                            <td className="px-3 py-2">{p.required ? "Yes" : "No"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Request body</h4>
                  <CodeBlock>{JSON.stringify(ep.request, null, 2)}</CodeBlock>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Response</h4>
                  <CodeBlock>{JSON.stringify(ep.response, null, 2)}</CodeBlock>
                </div>
              </div>

              {ep.notes && (
                <ul className="list-disc pl-6 text-sm text-muted-foreground">
                  {ep.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Internal-only functions</h2>
          <p className="text-sm text-muted-foreground">
            The following functions are SECURITY DEFINER but exist to support row-level security. They
            are not part of the public API contract and may change without notice.
          </p>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {internalRpcs.map((r) => (
                <li key={r.name}>
                  <code className="font-mono">{r.name}</code>
                  <span className="text-muted-foreground"> — {r.why}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Audit logging</h2>
          <p className="text-sm text-muted-foreground">
            Every call to a documented endpoint is recorded in <code>rpc_audit_log</code>. Only admins can
            read this table. Use <code className="font-mono">get_suspicious_rpc_activity</code> to find
            callers exceeding a per-function rate threshold.
          </p>
        </section>

        <section className="pt-6 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">API version {API_VERSION} · Updated {new Date().toISOString().slice(0, 10)}</p>
          <Button asChild variant="outline" size="sm"><Link to="/">Home</Link></Button>
        </section>
      </main>
    </div>
  );
}
