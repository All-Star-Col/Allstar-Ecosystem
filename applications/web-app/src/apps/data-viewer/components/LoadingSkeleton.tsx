export function LoadingSkeleton() {
  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
      </div>

      {/* Table Header Skeleton */}
      <div className="bg-gray-200 rounded-lg h-12 mb-2"></div>

      {/* Table Rows Skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded"></div>
        ))}
      </div>
    </div>
  );
}
