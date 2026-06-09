export default function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-200 border-t-college-amber rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  )
}
