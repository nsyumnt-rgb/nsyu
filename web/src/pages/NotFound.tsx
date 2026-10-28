import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3 bg-canvas">
      <h1 className="text-3xl font-display">404</h1>
      <p className="text-sm text-muted">That page doesn't exist.</p>
      <Link to="/app" className="btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
