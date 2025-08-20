export default function AnnouncementBar() {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl text-center text-sm py-1.5 px-4 rounded-b-xl border shadow-sm"
        style={{
          background:
            'linear-gradient(180deg, rgba(236,72,153,0.10), rgba(236,72,153,0.06))',
        }}
      >
        Private beta is open — weekly onboarding cohorts are limited. <span className="font-semibold text-pink-600">Reserve a spot</span>
      </div>
    </div>
  );
}


