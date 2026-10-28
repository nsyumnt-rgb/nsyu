import RequireModule from "../components/RequireModule";
import { useAuthStore } from "../store/authStore";

function SettingsInner() {
  const owner = useAuthStore((s) => s.owner);
  const employee = useAuthStore((s) => s.employee);
  const accountType = useAuthStore((s) => s.accountType);
  const person = accountType === "owner" ? owner : employee;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="text-sm text-muted mt-1">Account details for this session.</p>
      </div>
      <div className="card p-5 max-w-md">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Name</dt>
            <dd className="font-medium">{person?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium">{person?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Account type</dt>
            <dd className="font-medium capitalize">{accountType}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <RequireModule module="settings">
      <SettingsInner />
    </RequireModule>
  );
}
