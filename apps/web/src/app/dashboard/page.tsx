export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Welcome to TechFusion AI</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-sm text-gray-400">Active Agents</h3>
          <p className="text-3xl font-bold mt-1">0</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-sm text-gray-400">Monitored Devices</h3>
          <p className="text-3xl font-bold mt-1">0</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="text-sm text-gray-400">Active Alerts</h3>
          <p className="text-3xl font-bold mt-1">0</p>
        </div>
      </div>
    </div>
  );
}
