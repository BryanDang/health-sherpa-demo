import CleanTriageChat from '@/components/clean-triage-chat';

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-28px)] bg-gray-50">
      <CleanTriageChat userId="user_demo" />
    </div>
  );
}
