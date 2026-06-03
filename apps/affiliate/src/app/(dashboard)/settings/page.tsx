import { PayoutSettings } from "@/components/payout-settings";
import { UsernameSettings } from "@/components/username-settings";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your public store URL and payout details.</p>
      </div>
      <UsernameSettings />
      <PayoutSettings />
    </div>
  );
}
