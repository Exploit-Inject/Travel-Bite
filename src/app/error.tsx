"use client";
export default function Error({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="container page-shell">
      <div className="empty-state">
        <h1>A small bump in the road.</h1>
        <p>We couldn’t load this page. Please try again.</p>
        <button className="button" onClick={retry}>
          Try again
        </button>
      </div>
    </div>
  );
}
